import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { OrganizationRole } from '../organization-role.enum';

export class AddOrganizationMemberDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsOptional()
  @IsEnum(OrganizationRole)
  role?: OrganizationRole;
}
