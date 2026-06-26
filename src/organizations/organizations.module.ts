import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectAccessModule } from '../projects/project-access.module';
import { Organization } from './organization.entity';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Organization]),
    ProjectAccessModule,
  ],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
