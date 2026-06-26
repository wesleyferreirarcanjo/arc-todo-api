import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TaskEvidenceService } from './task-evidence.service';

interface AuthRequest extends Request {
  user: { id: string; username: string };
}

@Controller('organizations/:orgId/projects/:projectId/tasks/:taskId/evidence')
@UseGuards(JwtAuthGuard)
export class TaskEvidenceController {
  constructor(private readonly evidenceService: TaskEvidenceService) {}

  @Get()
  list(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Req() req: AuthRequest,
  ) {
    return this.evidenceService.list(
      req.user.id,
      orgId,
      projectId,
      taskId,
    );
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthRequest,
  ) {
    return this.evidenceService.upload(
      req.user.id,
      orgId,
      projectId,
      taskId,
      file,
    );
  }

  @Get(':evidenceId/download')
  async download(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Param('evidenceId') evidenceId: string,
    @Req() req: AuthRequest,
    @Res() res: Response,
  ) {
    await this.evidenceService.download(
      req.user.id,
      orgId,
      projectId,
      taskId,
      evidenceId,
      res,
    );
  }

  @Delete(':evidenceId')
  remove(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Param('evidenceId') evidenceId: string,
    @Req() req: AuthRequest,
  ) {
    return this.evidenceService.remove(
      req.user.id,
      orgId,
      projectId,
      taskId,
      evidenceId,
    );
  }
}
