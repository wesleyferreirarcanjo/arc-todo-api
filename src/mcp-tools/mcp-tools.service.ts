import {
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { UpdateMcpToolSettingDto } from './dto/update-mcp-tool-setting.dto';
import { UpdateMcpToolSettingsDto } from './dto/update-mcp-tool-settings.dto';
import { McpToolSetting } from './mcp-tool-setting.entity';
import {
  MCP_TOOL_GROUPS,
  MCP_TOOL_REGISTRY,
  McpToolGroup,
} from './mcp-tool-registry';

export interface McpToolSettingResponse {
  key: string;
  group: McpToolGroup;
  displayName: string;
  description: string;
  enabled: boolean;
  defaultEnabled: boolean;
  sortOrder: number;
}

export interface McpToolGroupResponse {
  group: McpToolGroup;
  tools: McpToolSettingResponse[];
}

@Injectable()
export class McpToolsService implements OnModuleInit {
  constructor(
    @InjectRepository(McpToolSetting)
    private readonly settingsRepository: Repository<McpToolSetting>,
  ) {}

  async onModuleInit() {
    await this.seedRegistry();
  }

  private toResponse(setting: McpToolSetting): McpToolSettingResponse {
    return {
      key: setting.key,
      group: setting.group as McpToolGroup,
      displayName: setting.displayName,
      description: setting.description,
      enabled: setting.enabled,
      defaultEnabled: setting.defaultEnabled,
      sortOrder: setting.sortOrder,
    };
  }

  private async seedRegistry() {
    for (const entry of MCP_TOOL_REGISTRY) {
      const existing = await this.settingsRepository.findOne({
        where: { key: entry.key },
      });
      if (existing) {
        continue;
      }

      const setting = this.settingsRepository.create({
        key: entry.key,
        group: entry.group,
        displayName: entry.displayName,
        description: entry.description,
        enabled: entry.defaultEnabled,
        defaultEnabled: entry.defaultEnabled,
        sortOrder: entry.sortOrder,
      });
      await this.settingsRepository.save(setting);
    }
  }

  async findAllGrouped(): Promise<McpToolGroupResponse[]> {
    const settings = await this.settingsRepository.find({
      order: { sortOrder: 'ASC', key: 'ASC' },
    });

    return MCP_TOOL_GROUPS.map((group) => ({
      group,
      tools: settings
        .filter((setting) => setting.group === group)
        .map((setting) => this.toResponse(setting)),
    }));
  }

  async findEnabledKeys(): Promise<string[]> {
    const settings = await this.settingsRepository.find({
      where: { enabled: true },
      order: { sortOrder: 'ASC', key: 'ASC' },
    });
    return settings.map((setting) => setting.key);
  }

  async updateOne(key: string, dto: UpdateMcpToolSettingDto) {
    const setting = await this.settingsRepository.findOne({ where: { key } });
    if (!setting) {
      throw new NotFoundException(`MCP tool '${key}' not found`);
    }

    setting.enabled = dto.enabled;
    const saved = await this.settingsRepository.save(setting);
    return this.toResponse(saved);
  }

  async updateMany(dto: UpdateMcpToolSettingsDto) {
    const keys = dto.tools.map((tool) => tool.key);
    const settings = await this.settingsRepository.find({
      where: { key: In(keys) },
    });

    const settingsByKey = new Map(settings.map((setting) => [setting.key, setting]));
    const updated: McpToolSettingResponse[] = [];

    for (const item of dto.tools) {
      const setting = settingsByKey.get(item.key);
      if (!setting) {
        throw new NotFoundException(`MCP tool '${item.key}' not found`);
      }
      setting.enabled = item.enabled;
      const saved = await this.settingsRepository.save(setting);
      updated.push(this.toResponse(saved));
    }

    return updated;
  }
}
