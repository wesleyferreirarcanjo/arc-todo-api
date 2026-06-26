import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ProjectAccessModule } from '../projects/project-access.module';
import { RagClientService } from './rag-client.service';
import { RagSetting } from './rag-setting.entity';
import { RagController } from './rag.controller';
import { RagSettingsController } from './rag-settings.controller';
import { RagSettingsService } from './rag-settings.service';

@Module({
  imports: [TypeOrmModule.forFeature([RagSetting]), AuthModule, ProjectAccessModule],
  controllers: [RagSettingsController, RagController],
  providers: [RagSettingsService, RagClientService],
  exports: [RagSettingsService, RagClientService],
})
export class RagSettingsModule {}
