import { Injectable } from '@nestjs/common';
import { CertInfoDto } from './app.dto';
import puppeteer, { Page } from 'puppeteer';
import { XMLParser } from 'fast-xml-parser';
import { MedicalJson } from './data';


/**
 * 조회 정보

검진년도
검진일자

신장
체중
허리둘레
체질량지수
시력(좌/우)
청력(좌/우)

혈압(수축기혈압/확장기혈압)
요단백
혈색소
공복혈당
신전혈당
총콜레스테롤
HDL콜레스테롤
혈청크레아티닌
신사구체여과율(GFR)
AST(SGOT)
ALT(SGPT)
감마지피티(y-GPT)
골다공증
 */

function getRandomSixDigitString(): string {
  return `${Math.floor(Math.random() * 900000) + 100000}`;
}

type Session = {
  key: string,
  page: Page
}
@Injectable()
export class AppService {

  sessions: Session[] = [];
  headless = true;
  authTarget = '카카오톡'

  async cert(dto: CertInfoDto) {
    const userAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36';
    const browser = await puppeteer.launch({ headless: this.headless });
    const page = await browser.newPage();

    page.setUserAgent(userAgent);
    if (!this.headless) {
      await page.setViewport({
        width: 1366,
        height: 768,
      });
    }
    // 국민건강보험 로그인 페이지로 이동
    await page.goto('https://www.nhis.or.kr/nhis/etc/personalLoginPage.do');

    // 간편 인증 로그인 버튼 클릭
    await page.click('xpath=//*[@id="pc_view"]/div[2]/div[1]/button');

    // 클릭 후, UI 변경되어 xpath의 요소 접근 가능해질때까지 대기
    await page.waitForSelector('xpath=//input[@data-id="oacx_name"]');

    // 클라인트단에서 실해(why? 인증 수단 선택요소가 클릭불가능한 비표준 요소라, 브라우저단에서 document모델로 직접 click 이벤트 조작
    await page.evaluate((auth_target) => {
      const clickEvent = new Event('click');
      // 인증수단 icon 찾기
      const target = Array.from(
        document.querySelectorAll<HTMLButtonElement>('label .label-nm p'),
      ).find((el) => el.textContent === auth_target);
      if (target) {
        target.click();
        target.dispatchEvent(clickEvent);
      }
    }, this.authTarget);

    // key 이벤트 안태우고 직접 value='데이터' 로 셋팅하니 정상동작하지 않아, puppeteer에서 재공하는 key이벤트 태워서 입력처리
    await page.focus('xpath=//input[@data-id="oacx_name"]');
    await page.keyboard.type(dto.name);
    await page.focus('xpath=//input[@data-id="oacx_birth"]');
    await page.keyboard.type(dto.birth);
    await page.focus('xpath=//input[@data-id="oacx_phone2"]');
    await page.keyboard.type(dto.phone);
    // 동의하기 버튼 및 인증요청 버튼 클릭
    await page.evaluate(() => {
      // const clickEvent = new Event('click');
      document.querySelector<HTMLButtonElement>('#totalAgree').click();
      // document.querySelector('#totalAgree').dispatchEvent(clickEvent)
      document.querySelector<HTMLButtonElement>('#oacx-request-btn-pc').click();
      // document.querySelector('#oacx-request-btn-pc').dispatchEvent(clickEvent)
    });
    const key = getRandomSixDigitString()
    this.sessions.push({ key, page })
    return key;
  }

  async getHealthInfo(key: string) {
    const session = this.sessions.find(s => s.key === key);
    if (session === null) {
      return null;
    }
    const page = session.page
    await page.click(
      'xpath=//*[@id="oacxEmbededContents"]/div[1]/div/button[2]',
    );
    await page.waitForNavigation();

    const XmlString = await page.evaluate(async () => {
      const response = await fetch(
        'https://www.nhis.or.kr/nhis/healthin/retrieveCrryy10Dnlod.do',
        {
          method: 'GET',
          // 필요한 경우 헤더 추가
        },
      );
      return await response.text();
    });

    const parser = new XMLParser();
    let jObj: MedicalJson = parser.parse(XmlString);

    this.sessions = this.sessions.filter(s => s.key !== key)
    const results =
      jObj['ccr:ContinuityOfCareRecord']['ccr:Body']['ccr:Results'][
      'ccr:Result'
      ];

    const vitalSigns =
      jObj['ccr:ContinuityOfCareRecord']['ccr:Body']['ccr:VitalSigns'][
      'ccr:Result'
      ];

    const dataList = [...results, ...vitalSigns];

    return dataList.map((r) => {
      return {
        type: r['ccr:Type']['ccr:Text'],
        desc: r['ccr:Description']['ccr:Text'],
        createdAt: r['ccr:DateTime']['ccr:ExactDateTime'],
        unit: r['ccr:Test']['ccr:TestResult']['ccr:Units']['ccr:Unit'],
        value: r['ccr:Test']['ccr:TestResult']['ccr:Value'],
      };
    });

  }
}
