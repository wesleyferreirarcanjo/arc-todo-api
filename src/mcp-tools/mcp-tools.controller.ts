import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../projects/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateMcpToolSettingDto } from './dto/update-mcp-tool-setting.dto';
import { UpdateMcpToolSettingsDto } from './dto/update-mcp-tool-settings.dto';
import { McpToolsService } from './mcp-tools.service';

@Controller('mcp-tools')
@UseGuards(JwtAuthGuard, AdminGuard)
export class McpToolsController {
  constructor(private readonly mcpToolsService: McpToolsService) {}

  @Get()
  findAllGrouped() {
    return this.mcpToolsService.findAllGrouped();
  }

  @Get('enabled')
  findEnabled() {
    return this.mcpToolsService.findEnabledKeys().then((keys) => ({ keys }));
  }

  @Patch()
  updateMany(@Body() dto: UpdateMcpToolSettingsDto) {
    return this.mcpToolsService.updateMany(dto);
  }

  @Patch(':key')
  updateOne(
    @Param('key') key: string,
    @Body() dto: UpdateMcpToolSettingDto,
  ) {
    return this.mcpToolsService.updateOne(key, dto);
  }
}
