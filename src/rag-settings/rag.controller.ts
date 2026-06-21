import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  RagProjectRetrieveDto,
  RagRetrieveDto,
  RagTokenEstimateDto,
} from './dto/rag-retrieve.dto';
import { RagClientService } from './rag-client.service';

@Controller('rag')
@UseGuards(JwtAuthGuard)
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
}
