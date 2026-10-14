import { ApiProperty } from '@nestjs/swagger';

export class GuestProfileDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  id!: string;

  @ApiProperty({ example: 'Trinidad', enum: ['Trinidad', 'Tobago'] })
  region!: 'Trinidad' | 'Tobago';

  @ApiProperty({ example: 0 })
  xp!: number;
}

export class GuestSessionDto {
  @ApiProperty({ type: GuestProfileDto })
  guest!: GuestProfileDto;
}
