import { ApiProperty } from '@nestjs/swagger';

export class CertInfoDto {
    @ApiProperty({
        description: '인증 대상의 이름',
        example: '최원진',
    })
    name: string

    @ApiProperty({
        description: '인증대상의 생년월일(19940805)',
        example: '19940805',
    })
    birth: string

    @ApiProperty({
        description: '연락처(010 제외)',
        example: '27721491',
    })
    phone: string
}