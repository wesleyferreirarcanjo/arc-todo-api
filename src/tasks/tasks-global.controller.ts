import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { TasksService } from './tasks.service';

interface AuthRequest extends Request {
  user: { id: string; username: string };
}

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksGlobalController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  findAll(@Query() query: ListTasksQueryDto, @Req() req: AuthRequest) {
    return this.tasksService.findAllForUser(req.user.id, query);
  }
}
