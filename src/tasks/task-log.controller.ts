import {
  Body,
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
import { TaskLogService } from './task-log.service';

interface AuthRequest extends Request {
  user: { id: string; username: string };
}

@Controller('organizations/:orgId/projects/:projectId/tasks/:taskId/logs')
@UseGuards(JwtAuthGuard)
export class TaskLogController {
  constructor(private readonly logService: TaskLogService) {}

  @Get()
  list(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Req() req: AuthRequest,
  ) {
    return this.logService.list(req.user.id, orgId, projectId, taskId);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('checklistItemId') checklistItemId: string | undefined,
    @Req() req: AuthRequest,
  ) {
    return this.logService.upload(
      req.user.id,
      orgId,
      projectId,
      taskId,
      file,
      checklistItemId,
    );
  }

  @Get(':logId/download')
  async download(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Param('logId') logId: string,
    @Req() req: AuthRequest,
    @Res() res: Response,
  ) {
    await this.logService.download(
      req.user.id,
      orgId,
      projectId,
      taskId,
      logId,
      res,
    );
  }

  @Delete(':logId')
  remove(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Param('logId') logId: string,
    @Req() req: AuthRequest,
  ) {
    return this.logService.remove(
      req.user.id,
      orgId,
      projectId,
      taskId,
      logId,
    );
  }
}
