import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AppService } from './app.service';
import { CertInfoDto } from './app.dto';
import { MedicalJson } from './data';


@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('cert')
  login(@Body() dto: CertInfoDto) {
    return this.appService.cert(dto);
  }
  @Get('health-check')
  async getHealthInfo(@Query('key') key:string) {
    return await this.appService.getHealthInfo(key);
  }
}
