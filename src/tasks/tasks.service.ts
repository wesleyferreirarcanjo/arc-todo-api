import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectsService } from '../projects/projects.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task } from './task.entity';
import { TaskPriority, TaskStatus } from './task.enums';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
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
      priority: dto.priority ?? TaskPriority.MEDIUM,
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

    if (dto.title !== undefined) task.title = dto.title;
    if (dto.description !== undefined) task.description = dto.description;
    if (dto.status !== undefined) task.status = dto.status;
    if (dto.priority !== undefined) task.priority = dto.priority;
    if (dto.dueDate !== undefined) {
      task.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    }

    return this.tasksRepository.save(task);
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
