import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectsService } from '../projects/projects.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task } from './task.entity';
import { TaskCriticity, TaskStatus } from './task.enums';
import { TaskHistoryEntry } from './task-history-entry.entity';
import { buildTaskHistoryDrafts } from './task-history.util';

export interface TaskWithContextResponse {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  criticity: TaskCriticity;
  dueDate: string | null;
  projectId: string;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  project: {
    id: string;
    name: string;
    organizationId: string;
    color: string;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
  };
}

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
    @InjectRepository(TaskHistoryEntry)
    private readonly historyRepository: Repository<TaskHistoryEntry>,
    private readonly projectsService: ProjectsService,
  ) {}

  async findAll(
    userId: string,
    orgId: string,
    projectId: string,
  ): Promise<Task[]> {
    await this.projectsService.findOne(userId, orgId, projectId);
    return this.tasksRepository.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
    });
  }

  async findAllForUser(
    userId: string,
    query: ListTasksQueryDto,
  ): Promise<TaskWithContextResponse[]> {
    const qb = this.tasksRepository
      .createQueryBuilder('task')
      .innerJoinAndSelect('task.project', 'project')
      .innerJoinAndSelect('project.organization', 'organization')
      .innerJoin('organization.members', 'member')
      .where('member.userId = :userId', { userId });

    if (query.organizationId) {
      qb.andWhere('organization.id = :organizationId', {
        organizationId: query.organizationId,
      });
    }

    if (query.projectId) {
      qb.andWhere('project.id = :projectId', { projectId: query.projectId });
    }

    if (query.status) {
      qb.andWhere('task.status = :status', { status: query.status });
    }

    if (query.criticity) {
      qb.andWhere('task.criticity = :criticity', { criticity: query.criticity });
    }

    qb.orderBy('task.updatedAt', 'DESC');

    const tasks = await qb.getMany();

    return tasks.map((task) => this.toTaskWithContext(task));
  }

  private toTaskWithContext(task: Task): TaskWithContextResponse {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      criticity: task.criticity,
      dueDate: task.dueDate ? task.dueDate.toISOString() : null,
      projectId: task.projectId,
      createdById: task.createdById,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      project: {
        id: task.project.id,
        name: task.project.name,
        organizationId: task.project.organizationId,
        color: task.project.color,
      },
      organization: {
        id: task.project.organization.id,
        name: task.project.organization.name,
        slug: task.project.organization.slug,
      },
    };
  }

  async create(
    userId: string,
    orgId: string,
    projectId: string,
    dto: CreateTaskDto,
  ): Promise<Task> {
    await this.projectsService.findOne(userId, orgId, projectId);

    const task = this.tasksRepository.create({
      title: dto.title,
      description: dto.description ?? null,
      status: dto.status ?? TaskStatus.TODO,
      criticity: dto.criticity ?? TaskCriticity.MEDIUM,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      projectId,
      createdById: userId,
    });

    return this.tasksRepository.save(task);
  }

  async findOne(
    userId: string,
    orgId: string,
    projectId: string,
    taskId: string,
  ): Promise<Task> {
    await this.projectsService.findOne(userId, orgId, projectId);

    const task = await this.tasksRepository.findOne({
      where: { id: taskId, projectId },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return task;
  }

  async update(
    userId: string,
    orgId: string,
    projectId: string,
    taskId: string,
    dto: UpdateTaskDto,
  ): Promise<Task> {
    const task = await this.findOne(userId, orgId, projectId, taskId);

    const historyDrafts = buildTaskHistoryDrafts(
      {
        title: task.title,
        description: task.description,
        dueDate: task.dueDate,
      },
      {
        title: dto.title,
        description: dto.description,
        dueDate: dto.dueDate,
      },
    );

    if (dto.title !== undefined) task.title = dto.title;
    if (dto.description !== undefined) task.description = dto.description;
    if (dto.status !== undefined) task.status = dto.status;
    if (dto.criticity !== undefined) task.criticity = dto.criticity;
    if (dto.dueDate !== undefined) {
      task.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    }

    if (dto.projectId !== undefined && dto.projectId !== projectId) {
      await this.projectsService.findOne(userId, orgId, dto.projectId);
      task.projectId = dto.projectId;
    }

    const saved = await this.tasksRepository.save(task);

    if (historyDrafts.length > 0) {
      const entries = historyDrafts.map((draft) =>
        this.historyRepository.create({
          taskId,
          field: draft.field,
          oldValue: draft.oldValue,
          newValue: draft.newValue,
          changedById: userId,
        }),
      );
      await this.historyRepository.save(entries);
    }

    return saved;
  }

  async remove(
    userId: string,
    orgId: string,
    projectId: string,
    taskId: string,
  ): Promise<void> {
    const task = await this.findOne(userId, orgId, projectId, taskId);
    await this.tasksRepository.remove(task);
  }
}
