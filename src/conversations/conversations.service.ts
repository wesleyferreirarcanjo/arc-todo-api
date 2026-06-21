import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationsService } from '../organizations/organizations.service';
import { ProjectsService } from '../projects/projects.service';
import { AddMessageDto } from './dto/add-message.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ListConversationsQueryDto } from './dto/list-conversations-query.dto';
import { TaskRefDto } from './dto/task-ref.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { ConversationMessageRole } from './conversation-message-role.enum';
import { ConversationMessage } from './conversation-message.entity';
import { ConversationTaskContext } from './conversation-task-context.entity';
import { Conversation } from './conversation.entity';

export interface ConversationMessageResponse {
  id: string;
  role: ConversationMessageRole;
  content: string;
  usedTools: string[];
  createdAt: string;
}

export interface TaskRefResponse {
  taskId: string;
  organizationId: string;
  projectId: string;
  title: string;
}

export interface ConversationSummaryResponse {
  id: string;
  title: string;
  organizationId: string | null;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationDetailResponse extends ConversationSummaryResponse {
  messages: ConversationMessageResponse[];
  taskRefs: TaskRefResponse[];
}

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(ConversationMessage)
    private readonly messageRepository: Repository<ConversationMessage>,
    @InjectRepository(ConversationTaskContext)
    private readonly taskContextRepository: Repository<ConversationTaskContext>,
    private readonly organizationsService: OrganizationsService,
    private readonly projectsService: ProjectsService,
  ) {}

  async findAllForUser(
    userId: string,
    query: ListConversationsQueryDto,
  ): Promise<ConversationSummaryResponse[]> {
    const qb = this.conversationRepository
      .createQueryBuilder('conversation')
      .where('conversation.userId = :userId', { userId })
      .orderBy('conversation.updatedAt', 'DESC');

    if (query.organizationId) {
      qb.andWhere('conversation.organizationId = :organizationId', {
        organizationId: query.organizationId,
      });
    }

    if (query.projectId) {
      qb.andWhere('conversation.projectId = :projectId', {
        projectId: query.projectId,
      });
    }

    const conversations = await qb.getMany();
    return conversations.map((conversation) =>
      this.toSummaryResponse(conversation),
    );
  }

  async create(
    userId: string,
    dto: CreateConversationDto,
  ): Promise<ConversationDetailResponse> {
    await this.assertWorkspaceAccess(userId, dto.organizationId, dto.projectId);

    const conversation = this.conversationRepository.create({
      userId,
      title: dto.title?.trim() || 'New conversation',
      organizationId: dto.organizationId ?? null,
      projectId: dto.projectId ?? null,
    });

    const saved = await this.conversationRepository.save(conversation);
    return this.toDetailResponse({
      ...saved,
      messages: [],
      taskContexts: [],
    });
  }

  async findOne(
    userId: string,
    conversationId: string,
  ): Promise<ConversationDetailResponse> {
    const conversation = await this.findOwnedConversation(userId, conversationId);
    return this.toDetailResponse(conversation);
  }

  async update(
    userId: string,
    conversationId: string,
    dto: UpdateConversationDto,
  ): Promise<ConversationDetailResponse> {
    const conversation = await this.findOwnedConversation(userId, conversationId);

    if (dto.title !== undefined) {
      conversation.title = dto.title.trim() || 'New conversation';
    }

    if (dto.taskRefs !== undefined) {
      await this.syncTaskRefs(conversation.id, dto.taskRefs);
    }

    const saved = await this.conversationRepository.save(conversation);
    const refreshed = await this.findOwnedConversation(userId, saved.id);
    return this.toDetailResponse(refreshed);
  }

  async remove(userId: string, conversationId: string): Promise<void> {
    const conversation = await this.findOwnedConversation(userId, conversationId);
    await this.conversationRepository.remove(conversation);
  }

  async addMessage(
    userId: string,
    conversationId: string,
    dto: AddMessageDto,
  ): Promise<ConversationMessageResponse> {
    await this.findOwnedConversation(userId, conversationId);

    const message = this.messageRepository.create({
      conversationId,
      role: dto.role,
      content: dto.content,
      usedTools: dto.usedTools ?? [],
    });

    const saved = await this.messageRepository.save(message);
    await this.conversationRepository.update(conversationId, {
      updatedAt: new Date(),
    });

    if (
      dto.role === ConversationMessageRole.USER &&
      dto.content.trim().length > 0
    ) {
      await this.maybeUpdateTitleFromFirstMessage(conversationId, dto.content);
    }

    return this.toMessageResponse(saved);
  }

  private async findOwnedConversation(
    userId: string,
    conversationId: string,
  ): Promise<Conversation> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, userId },
      relations: ['messages', 'taskContexts'],
      order: {
        messages: { createdAt: 'ASC' },
        taskContexts: { createdAt: 'ASC' },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  private async assertWorkspaceAccess(
    userId: string,
    organizationId?: string,
    projectId?: string,
  ): Promise<void> {
    if (organizationId) {
      await this.organizationsService.assertMember(userId, organizationId);
    }

    if (projectId) {
      if (!organizationId) {
        throw new NotFoundException('organizationId is required with projectId');
      }
      await this.projectsService.findOne(userId, organizationId, projectId);
    }
  }

  private async syncTaskRefs(
    conversationId: string,
    taskRefs: TaskRefDto[],
  ): Promise<void> {
    await this.taskContextRepository.delete({ conversationId });

    if (taskRefs.length === 0) {
      return;
    }

    const uniqueRefs = new Map<string, TaskRefDto>();
    for (const ref of taskRefs) {
      uniqueRefs.set(ref.taskId, ref);
    }

    await this.taskContextRepository.save(
      [...uniqueRefs.values()].map((ref) =>
        this.taskContextRepository.create({
          conversationId,
          taskId: ref.taskId,
          organizationId: ref.organizationId,
          projectId: ref.projectId,
          title: ref.title.trim(),
        }),
      ),
    );
  }

  private async maybeUpdateTitleFromFirstMessage(
    conversationId: string,
    content: string,
  ): Promise<void> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation || conversation.title !== 'New conversation') {
      return;
    }

    conversation.title = this.formatTitleFromMessageContent(content);
    await this.conversationRepository.save(conversation);
  }

  private formatTitleFromMessageContent(content: string): string {
    const refPattern =
      /\[\[ref:([^|\]]+)\|([^|\]]+)\|([^|\]]+)\|([^\]]+)\]\]/g;
    let text = content;

    for (const match of content.matchAll(refPattern)) {
      const rawTitle = match[4]?.trim() ?? '';
      if (!rawTitle) {
        continue;
      }

      try {
        text = text.replace(match[0], decodeURIComponent(rawTitle));
      } catch {
        text = text.replace(match[0], rawTitle);
      }
    }

    const normalized = text.trim().replace(/\s+/g, ' ');
    if (!normalized) {
      const refs = [...content.matchAll(refPattern)].map((match) => {
        const rawTitle = match[4]?.trim() ?? '';
        try {
          return decodeURIComponent(rawTitle);
        } catch {
          return rawTitle;
        }
      }).filter(Boolean);

      if (refs.length > 0) {
        const joined = refs.join(' · ');
        return joined.length > 60 ? `${joined.slice(0, 57)}...` : joined;
      }

      return 'New conversation';
    }

    return normalized.length > 60 ? `${normalized.slice(0, 57)}...` : normalized;
  }

  private toSummaryResponse(
    conversation: Conversation,
  ): ConversationSummaryResponse {
    return {
      id: conversation.id,
      title: conversation.title,
      organizationId: conversation.organizationId,
      projectId: conversation.projectId,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    };
  }

  private toMessageResponse(
    message: ConversationMessage,
  ): ConversationMessageResponse {
    return {
      id: message.id,
      role: message.role,
      content: message.content,
      usedTools: message.usedTools ?? [],
      createdAt: message.createdAt.toISOString(),
    };
  }

  private toTaskRefResponse(
    context: ConversationTaskContext,
  ): TaskRefResponse {
    return {
      taskId: context.taskId,
      organizationId: context.organizationId,
      projectId: context.projectId,
      title: context.title,
    };
  }

  private toDetailResponse(
    conversation: Conversation,
  ): ConversationDetailResponse {
    return {
      ...this.toSummaryResponse(conversation),
      messages: (conversation.messages ?? []).map((message) =>
        this.toMessageResponse(message),
      ),
      taskRefs: (conversation.taskContexts ?? []).map((context) =>
        this.toTaskRefResponse(context),
      ),
    };
  }
}
