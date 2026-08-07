import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../projects/admin.guard';
import { SetKnowledgeGrantsDto } from './dto/set-knowledge-grants.dto';
import { KnowledgeAccessService } from './knowledge-access.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { ProjectsService } from '../projects/projects.service';

interface AuthRequest extends Request {
  user: { id: string; username: string };
}

@Controller('organizations/:orgId/knowledge-access')
@UseGuards(JwtAuthGuard)
export class OrganizationKnowledgeAccessController {
  constructor(
    private readonly knowledgeAccessService: KnowledgeAccessService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  @Get()
  async getAccessStatus(
    @Param('orgId') orgId: string,
    @Req() req: AuthRequest,
  ) {
    await this.organizationsService.assertOrgAccess(req.user.id, orgId);
    const hasAccess = await this.knowledgeAccessService.hasOrgKnowledgeAccess(
      req.user.id,
      orgId,
    );
    return { hasAccess };
  }
}

@Controller('organizations/:orgId/knowledge-grants')
@UseGuards(JwtAuthGuard, AdminGuard)
export class OrganizationKnowledgeGrantsController {
  constructor(
    private readonly knowledgeAccessService: KnowledgeAccessService,
  ) {}

  @Get()
  list(@Param('orgId') orgId: string) {
    return this.knowledgeAccessService.listOrgGrants(orgId);
  }

  @Put()
  set(
    @Param('orgId') orgId: string,
    @Body() dto: SetKnowledgeGrantsDto,
    @Req() req: AuthRequest,
  ) {
    return this.knowledgeAccessService.setOrgGrants(
      orgId,
      dto.userIds,
      req.user.id,
    );
  }
}

@Controller('organizations/:orgId/projects/:projectId/knowledge-access')
@UseGuards(JwtAuthGuard)
export class ProjectKnowledgeAccessController {
  constructor(
    private readonly knowledgeAccessService: KnowledgeAccessService,
    private readonly projectsService: ProjectsService,
  ) {}

  @Get()
  async getAccessStatus(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Req() req: AuthRequest,
  ) {
    await this.projectsService.findOne(req.user.id, orgId, projectId);
    const hasAccess =
      await this.knowledgeAccessService.hasProjectKnowledgeAccess(
        req.user.id,
        projectId,
      );
    return { hasAccess };
  }
}

@Controller('organizations/:orgId/projects/:projectId/knowledge-grants')
@UseGuards(JwtAuthGuard, AdminGuard)
export class ProjectKnowledgeGrantsController {
  constructor(
    private readonly knowledgeAccessService: KnowledgeAccessService,
    private readonly projectsService: ProjectsService,
  ) {}

  @Get()
  async list(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Req() req: AuthRequest,
  ) {
    await this.projectsService.findOne(req.user.id, orgId, projectId);
    return this.knowledgeAccessService.listProjectGrants(projectId);
  }

  @Put()
  async set(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Body() dto: SetKnowledgeGrantsDto,
    @Req() req: AuthRequest,
  ) {
    await this.projectsService.findOne(req.user.id, orgId, projectId);
    return this.knowledgeAccessService.setProjectGrants(
      projectId,
      dto.userIds,
      req.user.id,
    );
  }

  @Post('grant-all-members')
  async grantAllMembers(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Req() req: AuthRequest,
  ) {
    await this.projectsService.findOne(req.user.id, orgId, projectId);
    return this.knowledgeAccessService.grantAllProjectMembers(
      projectId,
      req.user.id,
    );
  }
}
