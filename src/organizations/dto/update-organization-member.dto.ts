import { IsEnum, IsNotEmpty } from 'class-validator';
import { OrganizationRole } from '../organization-role.enum';

export class UpdateOrganizationMemberDto {
  @IsEnum(OrganizationRole)
  @IsNotEmpty()
  role: OrganizationRole;
}
