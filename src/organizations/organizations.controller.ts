import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ListUserActivityQueryDto } from '../user-activity/dto/list-user-activity-query.dto';
import { UserActivityService } from '../user-activity/user-activity.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationsService } from './organizations.service';

interface AuthRequest extends Request {
  user: { id: string; username: string };
}

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly userActivityService: UserActivityService,
  ) {}

  @Get()
  findAll(@Req() req: AuthRequest) {
    return this.organizationsService.findForUser(req.user.id);
  }

  @Post()
  create(@Body() dto: CreateOrganizationDto, @Req() req: AuthRequest) {
    return this.organizationsService.create(req.user.id, dto);
  }

  @Get(':orgId')
  findOne(@Param('orgId') orgId: string, @Req() req: AuthRequest) {
    return this.organizationsService.findOneForMember(req.user.id, orgId);
  }

  @Patch(':orgId')
  update(
    @Param('orgId') orgId: string,
    @Body() dto: UpdateOrganizationDto,
    @Req() req: AuthRequest,
  ) {
    return this.organizationsService.update(req.user.id, orgId, dto);
  }

  @Delete(':orgId')
  remove(@Param('orgId') orgId: string, @Req() req: AuthRequest) {
    return this.organizationsService.remove(req.user.id, orgId);
  }

  @Get(':orgId/activity')
  async listActivity(
    @Param('orgId') orgId: string,
    @Query() query: ListUserActivityQueryDto,
    @Req() req: AuthRequest,
  ) {
    await this.organizationsService.assertOrgAccess(req.user.id, orgId);
    return this.userActivityService.listForOrganization(orgId, query);
  }
}
