import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationsModule } from '../organizations/organizations.module';
import { Person } from './person.entity';
import { PersonsController } from './persons.controller';
import { PersonsService } from './persons.service';

@Module({
  imports: [TypeOrmModule.forFeature([Person]), OrganizationsModule],
  controllers: [PersonsController],
  providers: [PersonsService],
  exports: [PersonsService],
})
export class PersonsModule {}
