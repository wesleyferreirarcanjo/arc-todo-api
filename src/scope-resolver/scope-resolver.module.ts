import { Module } from '@nestjs/common';
import { ProjectAccessModule } from '../projects/project-access.module';
import { ScopeResolverController } from './scope-resolver.controller';
import { ScopeResolverService } from './scope-resolver.service';

@Module({
  imports: [ProjectAccessModule],
  controllers: [ScopeResolverController],
  providers: [ScopeResolverService],
  exports: [ScopeResolverService],
})
export class ScopeResolverModule {}
