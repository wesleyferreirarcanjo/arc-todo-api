import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectAccessModule } from '../projects/project-access.module';
import { McpToolSetting } from './mcp-tool-setting.entity';
import { McpToolsController } from './mcp-tools.controller';
import { McpToolsService } from './mcp-tools.service';

@Module({
  imports: [TypeOrmModule.forFeature([McpToolSetting]), ProjectAccessModule],
  controllers: [McpToolsController],
  providers: [McpToolsService],
  exports: [McpToolsService],
})
export class McpToolsModule {}
