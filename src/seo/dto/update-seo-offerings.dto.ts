import { ArrayMaxSize, IsArray, IsString } from 'class-validator';

export class UpdateSeoOfferingsDto {
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  offerings: string[];
}
