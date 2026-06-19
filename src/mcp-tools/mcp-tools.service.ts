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
import {
  MCP_TOOL_TOKEN_ESTIMATE_METHOD,
  estimateMcpToolTokens,
} from './mcp-tool-token-estimator';

export interface McpToolSettingResponse {
  key: string;
  group: McpToolGroup;
  displayName: string;
  description: string;
  enabled: boolean;
  defaultEnabled: boolean;
  sortOrder: number;
  estimatedTokens: number;
}

export interface McpToolGroupResponse {
  group: McpToolGroup;
  tools: McpToolSettingResponse[];
  enabledTokens: number;
  totalTokens: number;
}

export interface McpTokenSummary {
  estimateMethod: string;
  enabledToolCount: number;
  totalToolCount: number;
  enabledTokens: number;
  totalTokens: number;
}

export interface McpToolsSettingsResponse {
  groups: McpToolGroupResponse[];
  tokenSummary: McpTokenSummary;
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
      estimatedTokens: estimateMcpToolTokens(setting.key, setting.description),
    };
  }

  private buildTokenSummary(
    groups: McpToolGroupResponse[],
  ): McpTokenSummary {
    const tools = groups.flatMap((group) => group.tools);

    return {
      estimateMethod: MCP_TOOL_TOKEN_ESTIMATE_METHOD,
      enabledToolCount: tools.filter((tool) => tool.enabled).length,
      totalToolCount: tools.length,
      enabledTokens: tools
        .filter((tool) => tool.enabled)
        .reduce((sum, tool) => sum + tool.estimatedTokens, 0),
      totalTokens: tools.reduce((sum, tool) => sum + tool.estimatedTokens, 0),
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

  async findAllGrouped(): Promise<McpToolsSettingsResponse> {
    const settings = await this.settingsRepository.find({
      order: { sortOrder: 'ASC', key: 'ASC' },
    });

    const groups = MCP_TOOL_GROUPS.map((group) => {
      const tools = settings
        .filter((setting) => setting.group === group)
        .map((setting) => this.toResponse(setting));

      return {
        group,
        tools,
        enabledTokens: tools
          .filter((tool) => tool.enabled)
          .reduce((sum, tool) => sum + tool.estimatedTokens, 0),
        totalTokens: tools.reduce((sum, tool) => sum + tool.estimatedTokens, 0),
      };
    });

    return {
      groups,
      tokenSummary: this.buildTokenSummary(groups),
    };
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
