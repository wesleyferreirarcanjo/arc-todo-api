import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../projects/admin.guard';
import {
  RagProjectRetrieveDto,
  RagRetrieveDto,
  RagTokenEstimateDto,
} from './dto/rag-retrieve.dto';
import { RagClientService } from './rag-client.service';

@Controller('rag')
@UseGuards(JwtAuthGuard, AdminGuard)
export class RagController {
  constructor(private readonly ragClientService: RagClientService) {}

  @Post('retrieve/general')
  retrieveGeneral(@Body() dto: RagRetrieveDto) {
    return this.ragClientService.retrieveGeneral(dto);
  }

  @Post('retrieve/project')
  retrieveProject(@Body() dto: RagProjectRetrieveDto) {
    return this.ragClientService.retrieveProject(dto);
  }

  @Post('tokens/estimate')
  estimateTokens(@Body() dto: RagTokenEstimateDto) {
    return this.ragClientService.estimateTokens(dto);
  }

  @Post('index/sync')
  syncIndex() {
    return this.ragClientService.syncIndex();
  }

  @Get('index/jobs')
  listJobs() {
    return this.ragClientService.listJobs();
  }

  @Get('index/status')
  getIndexStatus() {
    return this.ragClientService.getIndexStatus();
  }

  @Get('chunks/aggregate')
  aggregateChunks(
    @Query('scope') scope?: string,
    @Query('organizationId') organizationId?: string,
    @Query('projectId') projectId?: string,
    @Query('personId') personId?: string,
    @Query('knowledgeEntryId') knowledgeEntryId?: string,
    @Query('attachmentId') attachmentId?: string,
    @Query('mimeType') mimeType?: string,
    @Query('entryTextOnly') entryTextOnly?: string,
  ) {
    return this.ragClientService.aggregateChunks({
      scope,
      organizationId,
      projectId,
      personId,
      knowledgeEntryId,
      attachmentId,
      mimeType,
      entryTextOnly: entryTextOnly === 'true',
    });
  }

  @Get('chunks')
  listChunks(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('scope') scope?: string,
    @Query('organizationId') organizationId?: string,
    @Query('projectId') projectId?: string,
    @Query('personId') personId?: string,
    @Query('knowledgeEntryId') knowledgeEntryId?: string,
    @Query('attachmentId') attachmentId?: string,
    @Query('mimeType') mimeType?: string,
  ) {
    return this.ragClientService.listChunks({
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      scope,
      organizationId,
      projectId,
      personId,
      knowledgeEntryId,
      attachmentId,
      mimeType,
    });
  }

  @Delete('chunks/:chunkId')
  deleteChunk(@Param('chunkId') chunkId: string) {
    return this.ragClientService.deleteChunk(chunkId);
  }
}
