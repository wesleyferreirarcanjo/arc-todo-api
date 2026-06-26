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
import { AddOrganizationMemberDto } from './dto/add-organization-member.dto';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { CreateOrganizationUserDto } from './dto/create-organization-user.dto';
import { UpdateOrganizationMemberDto } from './dto/update-organization-member.dto';
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
    await this.organizationsService.assertMember(req.user.id, orgId);
    return this.userActivityService.listForOrganization(orgId, query);
  }

  @Get(':orgId/membership')
  getMembership(@Param('orgId') orgId: string, @Req() req: AuthRequest) {
    return this.organizationsService.getCurrentMembership(req.user.id, orgId);
  }

  @Get(':orgId/members')
  listMembers(@Param('orgId') orgId: string, @Req() req: AuthRequest) {
    return this.organizationsService.listMembers(req.user.id, orgId);
  }

  @Post(':orgId/users')
  createUser(
    @Param('orgId') orgId: string,
    @Body() dto: CreateOrganizationUserDto,
    @Req() req: AuthRequest,
  ) {
    return this.organizationsService.createUserAndMember(
      req.user.id,
      orgId,
      dto,
    );
  }

  @Post(':orgId/members')
  addMember(
    @Param('orgId') orgId: string,
    @Body() dto: AddOrganizationMemberDto,
    @Req() req: AuthRequest,
  ) {
    return this.organizationsService.addMember(req.user.id, orgId, dto);
  }

  @Patch(':orgId/members/:userId')
  updateMemberRole(
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateOrganizationMemberDto,
    @Req() req: AuthRequest,
  ) {
    return this.organizationsService.updateMemberRole(
      req.user.id,
      orgId,
      userId,
      dto.role,
    );
  }

  @Delete(':orgId/members/:userId')
  removeMember(
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
    @Req() req: AuthRequest,
  ) {
    return this.organizationsService.removeMember(req.user.id, orgId, userId);
  }
}
