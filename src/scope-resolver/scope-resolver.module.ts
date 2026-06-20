import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationsModule } from '../organizations/organizations.module';
import { Project } from '../projects/project.entity';
import { ScopeResolverController } from './scope-resolver.controller';
import { ScopeResolverService } from './scope-resolver.service';

@Module({
  imports: [TypeOrmModule.forFeature([Project]), OrganizationsModule],
  controllers: [ScopeResolverController],
  providers: [ScopeResolverService],
  exports: [ScopeResolverService],
})
export class ScopeResolverModule {}
