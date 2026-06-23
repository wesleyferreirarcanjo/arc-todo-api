import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import { ListAttachmentQueryDto } from './dto/list-attachment-query.dto';
import { KnowledgeAttachmentService } from './knowledge-attachment.service';

interface AuthRequest extends Request {
  user: { id: string; username: string };
}

@Controller('knowledge/:knowledgeId/attachments')
@UseGuards(JwtAuthGuard)
export class GlobalKnowledgeAttachmentsController {
  constructor(
    private readonly attachmentService: KnowledgeAttachmentService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Param('knowledgeId') knowledgeId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateAttachmentDto,
    @Req() req: AuthRequest,
  ) {
    return this.attachmentService.uploadGeneral(
      req.user.id,
      knowledgeId,
      file,
      dto,
    );
  }

  @Get()
  list(
    @Param('knowledgeId') knowledgeId: string,
    @Query() query: ListAttachmentQueryDto,
    @Req() req: AuthRequest,
  ) {
    return this.attachmentService.listGeneral(req.user.id, knowledgeId, query);
  }

  @Get(':attachmentId/download')
  async download(
    @Param('knowledgeId') knowledgeId: string,
    @Param('attachmentId') attachmentId: string,
    @Req() req: AuthRequest,
    @Res() res: Response,
  ) {
    await this.attachmentService.downloadGeneral(
      req.user.id,
      knowledgeId,
      attachmentId,
      res,
    );
  }

  @Delete(':attachmentId')
  remove(
    @Param('knowledgeId') knowledgeId: string,
    @Param('attachmentId') attachmentId: string,
    @Req() req: AuthRequest,
  ) {
    return this.attachmentService.deleteGeneral(
      req.user.id,
      knowledgeId,
      attachmentId,
    );
  }

  @Post(':attachmentId/resync')
  resync(
    @Param('knowledgeId') knowledgeId: string,
    @Param('attachmentId') attachmentId: string,
    @Req() req: AuthRequest,
  ) {
    return this.attachmentService.resyncGeneral(
      req.user.id,
      knowledgeId,
      attachmentId,
    );
  }
}

@Controller('organizations/:orgId/knowledge/:knowledgeId/attachments')
@UseGuards(JwtAuthGuard)
export class OrganizationKnowledgeAttachmentsController {
  constructor(
    private readonly attachmentService: KnowledgeAttachmentService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Param('orgId') orgId: string,
    @Param('knowledgeId') knowledgeId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateAttachmentDto,
    @Req() req: AuthRequest,
  ) {
    return this.attachmentService.uploadOrganization(
      req.user.id,
      orgId,
      knowledgeId,
      file,
      dto,
    );
  }

  @Get()
  list(
    @Param('orgId') orgId: string,
    @Param('knowledgeId') knowledgeId: string,
    @Query() query: ListAttachmentQueryDto,
    @Req() req: AuthRequest,
  ) {
    return this.attachmentService.listOrganization(
      req.user.id,
      orgId,
      knowledgeId,
      query,
    );
  }

  @Get(':attachmentId/download')
  async download(
    @Param('orgId') orgId: string,
    @Param('knowledgeId') knowledgeId: string,
    @Param('attachmentId') attachmentId: string,
    @Req() req: AuthRequest,
    @Res() res: Response,
  ) {
    await this.attachmentService.downloadOrganization(
      req.user.id,
      orgId,
      knowledgeId,
      attachmentId,
      res,
    );
  }

  @Delete(':attachmentId')
  remove(
    @Param('orgId') orgId: string,
    @Param('knowledgeId') knowledgeId: string,
    @Param('attachmentId') attachmentId: string,
    @Req() req: AuthRequest,
  ) {
    return this.attachmentService.deleteOrganization(
      req.user.id,
      orgId,
      knowledgeId,
      attachmentId,
    );
  }

  @Post(':attachmentId/resync')
  resync(
    @Param('orgId') orgId: string,
    @Param('knowledgeId') knowledgeId: string,
    @Param('attachmentId') attachmentId: string,
    @Req() req: AuthRequest,
  ) {
    return this.attachmentService.resyncOrganization(
      req.user.id,
      orgId,
      knowledgeId,
      attachmentId,
    );
  }
}

@Controller('organizations/:orgId/projects/:projectId/knowledge/:knowledgeId/attachments')
@UseGuards(JwtAuthGuard)
export class ProjectKnowledgeAttachmentsController {
  constructor(
    private readonly attachmentService: KnowledgeAttachmentService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('knowledgeId') knowledgeId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateAttachmentDto,
    @Req() req: AuthRequest,
  ) {
    return this.attachmentService.uploadProject(
      req.user.id,
      orgId,
      projectId,
      knowledgeId,
      file,
      dto,
    );
  }

  @Get()
  list(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('knowledgeId') knowledgeId: string,
    @Query() query: ListAttachmentQueryDto,
    @Req() req: AuthRequest,
  ) {
    return this.attachmentService.listProject(
      req.user.id,
      orgId,
      projectId,
      knowledgeId,
      query,
    );
  }

  @Get(':attachmentId/download')
  async download(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('knowledgeId') knowledgeId: string,
    @Param('attachmentId') attachmentId: string,
    @Req() req: AuthRequest,
    @Res() res: Response,
  ) {
    await this.attachmentService.downloadProject(
      req.user.id,
      orgId,
      projectId,
      knowledgeId,
      attachmentId,
      res,
    );
  }

  @Delete(':attachmentId')
  remove(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('knowledgeId') knowledgeId: string,
    @Param('attachmentId') attachmentId: string,
    @Req() req: AuthRequest,
  ) {
    return this.attachmentService.deleteProject(
      req.user.id,
      orgId,
      projectId,
      knowledgeId,
      attachmentId,
    );
  }

  @Post(':attachmentId/resync')
  resync(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('knowledgeId') knowledgeId: string,
    @Param('attachmentId') attachmentId: string,
    @Req() req: AuthRequest,
  ) {
    return this.attachmentService.resyncProject(
      req.user.id,
      orgId,
      projectId,
      knowledgeId,
      attachmentId,
    );
  }
}

@Controller('organizations/:orgId/persons/:personId/knowledge/:knowledgeId/attachments')
@UseGuards(JwtAuthGuard)
export class PersonKnowledgeAttachmentsController {
  constructor(
    private readonly attachmentService: KnowledgeAttachmentService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Param('orgId') orgId: string,
    @Param('personId') personId: string,
    @Param('knowledgeId') knowledgeId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateAttachmentDto,
    @Req() req: AuthRequest,
  ) {
    return this.attachmentService.uploadPerson(
      req.user.id,
      orgId,
      personId,
      knowledgeId,
      file,
      dto,
    );
  }

  @Get()
  list(
    @Param('orgId') orgId: string,
    @Param('personId') personId: string,
    @Param('knowledgeId') knowledgeId: string,
    @Query() query: ListAttachmentQueryDto,
    @Req() req: AuthRequest,
  ) {
    return this.attachmentService.listPerson(
      req.user.id,
      orgId,
      personId,
      knowledgeId,
      query,
    );
  }

  @Get(':attachmentId/download')
  async download(
    @Param('orgId') orgId: string,
    @Param('personId') personId: string,
    @Param('knowledgeId') knowledgeId: string,
    @Param('attachmentId') attachmentId: string,
    @Req() req: AuthRequest,
    @Res() res: Response,
  ) {
    await this.attachmentService.downloadPerson(
      req.user.id,
      orgId,
      personId,
      knowledgeId,
      attachmentId,
      res,
    );
  }

  @Delete(':attachmentId')
  remove(
    @Param('orgId') orgId: string,
    @Param('personId') personId: string,
    @Param('knowledgeId') knowledgeId: string,
    @Param('attachmentId') attachmentId: string,
    @Req() req: AuthRequest,
  ) {
    return this.attachmentService.deletePerson(
      req.user.id,
      orgId,
      personId,
      knowledgeId,
      attachmentId,
    );
  }

  @Post(':attachmentId/resync')
  resync(
    @Param('orgId') orgId: string,
    @Param('personId') personId: string,
    @Param('knowledgeId') knowledgeId: string,
    @Param('attachmentId') attachmentId: string,
    @Req() req: AuthRequest,
  ) {
    return this.attachmentService.resyncPerson(
      req.user.id,
      orgId,
      personId,
      knowledgeId,
      attachmentId,
    );
  }
}

@Controller('persons/:personId/knowledge/:knowledgeId/attachments')
@UseGuards(JwtAuthGuard)
export class GeneralPersonKnowledgeAttachmentsController {
  constructor(
    private readonly attachmentService: KnowledgeAttachmentService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Param('personId') personId: string,
    @Param('knowledgeId') knowledgeId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateAttachmentDto,
    @Req() req: AuthRequest,
  ) {
    return this.attachmentService.uploadGeneralPerson(
      req.user.id,
      personId,
      knowledgeId,
      file,
      dto,
    );
  }

  @Get()
  list(
    @Param('personId') personId: string,
    @Param('knowledgeId') knowledgeId: string,
    @Query() query: ListAttachmentQueryDto,
    @Req() req: AuthRequest,
  ) {
    return this.attachmentService.listGeneralPerson(
      req.user.id,
      personId,
      knowledgeId,
      query,
    );
  }

  @Get(':attachmentId/download')
  async download(
    @Param('personId') personId: string,
    @Param('knowledgeId') knowledgeId: string,
    @Param('attachmentId') attachmentId: string,
    @Req() req: AuthRequest,
    @Res() res: Response,
  ) {
    await this.attachmentService.downloadGeneralPerson(
      req.user.id,
      personId,
      knowledgeId,
      attachmentId,
      res,
    );
  }

  @Delete(':attachmentId')
  remove(
    @Param('personId') personId: string,
    @Param('knowledgeId') knowledgeId: string,
    @Param('attachmentId') attachmentId: string,
    @Req() req: AuthRequest,
  ) {
    return this.attachmentService.deleteGeneralPerson(
      req.user.id,
      personId,
      knowledgeId,
      attachmentId,
    );
  }

  @Post(':attachmentId/resync')
  resync(
    @Param('personId') personId: string,
    @Param('knowledgeId') knowledgeId: string,
    @Param('attachmentId') attachmentId: string,
    @Req() req: AuthRequest,
  ) {
    return this.attachmentService.resyncGeneralPerson(
      req.user.id,
      personId,
      knowledgeId,
      attachmentId,
    );
  }
}
