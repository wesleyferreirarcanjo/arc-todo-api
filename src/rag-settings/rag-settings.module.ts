import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { RagClientService } from './rag-client.service';
import { RagSetting } from './rag-setting.entity';
import { RagSettingsController } from './rag-settings.controller';
import { RagSettingsService } from './rag-settings.service';

@Module({
  imports: [TypeOrmModule.forFeature([RagSetting]), AuthModule],
  controllers: [RagSettingsController],
  providers: [RagSettingsService, RagClientService],
  exports: [RagSettingsService, RagClientService],
})
export class RagSettingsModule {}
