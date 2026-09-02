import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateSeoSiteDto } from './dto/create-seo-site.dto';
import { SeoKeywordsDto } from './dto/seo-keywords.dto';
import { UpdateSeoOfferingsDto } from './dto/update-seo-offerings.dto';
import { UpdateSeoSiteDto } from './dto/update-seo-site.dto';
import { SeoSitesService } from './seo-sites.service';

interface AuthRequest extends Request {
  user: { id: string; username: string };
}

@Controller('organizations/:orgId/projects/:projectId/seo-sites')
@UseGuards(JwtAuthGuard)
export class SeoSitesController {
  constructor(private readonly seoSitesService: SeoSitesService) {}

  @Get()
  findAll(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Req() req: AuthRequest,
  ) {
    return this.seoSitesService.findAll(req.user.id, orgId, projectId);
  }

  @Post()
  create(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Body() dto: CreateSeoSiteDto,
    @Req() req: AuthRequest,
  ) {
    return this.seoSitesService.create(req.user.id, orgId, projectId, dto);
  }

  @Get(':siteId')
  findOne(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('siteId') siteId: string,
    @Req() req: AuthRequest,
  ) {
    return this.seoSitesService.findOne(req.user.id, orgId, projectId, siteId);
  }

  @Patch(':siteId')
  update(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('siteId') siteId: string,
    @Body() dto: UpdateSeoSiteDto,
    @Req() req: AuthRequest,
  ) {
    return this.seoSitesService.update(
      req.user.id,
      orgId,
      projectId,
      siteId,
      dto,
    );
  }

  @Delete(':siteId')
  remove(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('siteId') siteId: string,
    @Req() req: AuthRequest,
  ) {
    return this.seoSitesService.remove(req.user.id, orgId, projectId, siteId);
  }

  @Post(':siteId/audit')
  enqueueAudit(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('siteId') siteId: string,
    @Req() req: AuthRequest,
  ) {
    return this.seoSitesService.enqueueAudit(
      req.user.id,
      orgId,
      projectId,
      siteId,
    );
  }

  @Get(':siteId/audits')
  getLatestAudit(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('siteId') siteId: string,
    @Req() req: AuthRequest,
  ) {
    return this.seoSitesService.getLatestAudit(
      req.user.id,
      orgId,
      projectId,
      siteId,
    );
  }

  @Get(':siteId/audits/:runId')
  getAudit(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('siteId') siteId: string,
    @Param('runId') runId: string,
    @Req() req: AuthRequest,
  ) {
    return this.seoSitesService.getAudit(
      req.user.id,
      orgId,
      projectId,
      siteId,
      runId,
    );
  }

  @Post(':siteId/search-console/connect')
  connectSearchConsole(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('siteId') siteId: string,
    @Req() req: AuthRequest,
  ) {
    return this.seoSitesService.connectSearchConsole(
      req.user.id,
      orgId,
      projectId,
      siteId,
    );
  }

  @Post(':siteId/keywords')
  fetchKeywords(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('siteId') siteId: string,
    @Body() dto: SeoKeywordsDto = {},
    @Req() req: AuthRequest,
  ) {
    return this.seoSitesService.fetchKeywords(
      req.user.id,
      orgId,
      projectId,
      siteId,
      dto,
    );
  }

  @Get(':siteId/offerings')
  getOfferings(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('siteId') siteId: string,
    @Req() req: AuthRequest,
  ) {
    return this.seoSitesService.getOfferings(
      req.user.id,
      orgId,
      projectId,
      siteId,
    );
  }

  @Put(':siteId/offerings')
  putOfferings(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('siteId') siteId: string,
    @Body() dto: UpdateSeoOfferingsDto,
    @Req() req: AuthRequest,
  ) {
    return this.seoSitesService.putOfferings(
      req.user.id,
      orgId,
      projectId,
      siteId,
      dto,
    );
  }
}
