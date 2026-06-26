import { IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { OrganizationRole } from '../organization-role.enum';

export class CreateOrganizationUserDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsEnum(OrganizationRole)
  role?: OrganizationRole;
}
