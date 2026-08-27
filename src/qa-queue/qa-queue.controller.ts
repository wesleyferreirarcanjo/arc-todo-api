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
import { AddQaQueueItemsDto } from './dto/add-qa-queue-items.dto';
import { ReorderQaQueueDto } from './dto/reorder-qa-queue.dto';
import { QaQueueService } from './qa-queue.service';

interface AuthRequest extends Request {
  user: { id: string; username: string };
}

@Controller('qa-queue')
@UseGuards(JwtAuthGuard)
export class QaQueueController {
  constructor(private readonly qaQueueService: QaQueueService) {}

  @Get()
  list(@Req() req: AuthRequest) {
    return this.qaQueueService.listForUser(req.user.id);
  }

  @Post('items')
  add(@Body() dto: AddQaQueueItemsDto, @Req() req: AuthRequest) {
    return this.qaQueueService.add(req.user.id, dto);
  }

  @Delete('items/:taskId')
  remove(@Param('taskId') taskId: string, @Req() req: AuthRequest) {
    return this.qaQueueService.remove(req.user.id, taskId);
  }

  @Patch()
  reorder(@Body() dto: ReorderQaQueueDto, @Req() req: AuthRequest) {
    return this.qaQueueService.reorder(req.user.id, dto.itemIds);
  }

  @Delete()
  clear(@Req() req: AuthRequest) {
    return this.qaQueueService.clear(req.user.id);
  }
}
