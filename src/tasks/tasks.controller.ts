import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateTaskCommentDto } from './dto/create-task-comment.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskActivityService } from './task-activity.service';
import { TasksService } from './tasks.service';

interface AuthRequest extends Request {
  user: { id: string; username: string };
}

@Controller('organizations/:orgId/projects/:projectId/tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly taskActivityService: TaskActivityService,
  ) {}

  @Get()
  findAll(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Req() req: AuthRequest,
  ) {
    return this.tasksService.findAll(req.user.id, orgId, projectId);
  }

  @Post()
  create(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Body() dto: CreateTaskDto,
    @Req() req: AuthRequest,
  ) {
    return this.tasksService.create(req.user.id, orgId, projectId, dto);
  }

  @Get(':taskId')
  findOne(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Req() req: AuthRequest,
  ) {
    return this.tasksService.findOne(req.user.id, orgId, projectId, taskId);
  }

  @Patch(':taskId')
  update(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
    @Req() req: AuthRequest,
  ) {
    return this.tasksService.update(
      req.user.id,
      orgId,
      projectId,
      taskId,
      dto,
    );
  }

  @Delete(':taskId')
  remove(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Req() req: AuthRequest,
  ) {
    return this.tasksService.remove(req.user.id, orgId, projectId, taskId);
  }

  @Get(':taskId/comments')
  findComments(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Req() req: AuthRequest,
  ) {
    return this.taskActivityService.findComments(
      req.user.id,
      orgId,
      projectId,
      taskId,
    );
  }

  @Post(':taskId/comments')
  createComment(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() dto: CreateTaskCommentDto,
    @Req() req: AuthRequest,
  ) {
    return this.taskActivityService.createComment(
      req.user.id,
      orgId,
      projectId,
      taskId,
      dto,
    );
  }

  @Get(':taskId/history')
  findHistory(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Req() req: AuthRequest,
  ) {
    return this.taskActivityService.findHistory(
      req.user.id,
      orgId,
      projectId,
      taskId,
    );
  }
}
