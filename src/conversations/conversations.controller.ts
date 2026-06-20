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
import { AddMessageDto } from './dto/add-message.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ListConversationsQueryDto } from './dto/list-conversations-query.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { ConversationsService } from './conversations.service';

interface AuthRequest extends Request {
  user: { id: string; username: string };
}

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  findAll(@Query() query: ListConversationsQueryDto, @Req() req: AuthRequest) {
    return this.conversationsService.findAllForUser(req.user.id, query);
  }

  @Post()
  create(@Body() dto: CreateConversationDto, @Req() req: AuthRequest) {
    return this.conversationsService.create(req.user.id, dto);
  }

  @Get(':conversationId')
  findOne(
    @Param('conversationId') conversationId: string,
    @Req() req: AuthRequest,
  ) {
    return this.conversationsService.findOne(req.user.id, conversationId);
  }

  @Patch(':conversationId')
  update(
    @Param('conversationId') conversationId: string,
    @Body() dto: UpdateConversationDto,
    @Req() req: AuthRequest,
  ) {
    return this.conversationsService.update(req.user.id, conversationId, dto);
  }

  @Delete(':conversationId')
  remove(
    @Param('conversationId') conversationId: string,
    @Req() req: AuthRequest,
  ) {
    return this.conversationsService.remove(req.user.id, conversationId);
  }

  @Post(':conversationId/messages')
  addMessage(
    @Param('conversationId') conversationId: string,
    @Body() dto: AddMessageDto,
    @Req() req: AuthRequest,
  ) {
    return this.conversationsService.addMessage(
      req.user.id,
      conversationId,
      dto,
    );
  }
}
