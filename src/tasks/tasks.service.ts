import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import {
  formatTaskDisplayId,
  parseTaskDisplayId,
} from '../common/utils/acronym.util';
import { OrganizationsService } from '../organizations/organizations.service';
import { Project } from '../projects/project.entity';
import { ProjectsService } from '../projects/projects.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task } from './task.entity';
import { TaskCriticity, TaskStatus } from './task.enums';
import { TaskHistoryEntry } from './task-history-entry.entity';
import { buildTaskHistoryDrafts } from './task-history.util';
import {
  computeSubtaskProgress,
  shouldCompleteParent,
  shouldReopenParent,
  SubtaskProgress,
} from './task-hierarchy.util';

export interface TaskResponse {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  criticity: TaskCriticity;
  dueDate: string | null;
  projectId: string;
  createdById: string | null;
  parentTaskId: string | null;
  taskNumber: number;
  displayId: string;
  createdAt: string;
  updatedAt: string;
  subtaskProgress?: SubtaskProgress | null;
  subtasks?: TaskResponse[];
}

export interface TaskResolveResponse {
  id: string;
  displayId: string;
  taskNumber: number;
  organizationId: string;
  projectId: string;
  title: string;
  task: TaskResponse;
}

export interface TaskWithContextResponse extends TaskResponse {
  project: {
    id: string;
    name: string;
    organizationId: string;
    color: string;
    acronym: string;
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
    private readonly organizationsService: OrganizationsService,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(
    userId: string,
    orgId: string,
    projectId: string,
  ): Promise<TaskResponse[]> {
    await this.projectsService.findOne(userId, orgId, projectId);
    const tasks = await this.tasksRepository.find({
      where: { projectId, archivedInCycleId: IsNull() },
      order: { createdAt: 'DESC' },
    });
    return this.enrichTaskResponses(tasks);
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
      .where('member.userId = :userId', { userId })
      .andWhere('task.archivedInCycleId IS NULL');

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

    if (query.parentTaskId) {
      qb.andWhere('task.parentTaskId = :parentTaskId', {
        parentTaskId: query.parentTaskId,
      });
    }

    qb.orderBy('task.updatedAt', 'DESC');

    const tasks = await qb.getMany();
    const enriched = await this.enrichTaskResponses(tasks);

    return tasks.map((task, index) => ({
      ...enriched[index],
      project: {
        id: task.project.id,
        name: task.project.name,
        organizationId: task.project.organizationId,
        color: task.project.color,
        acronym: task.project.acronym,
      },
      organization: {
        id: task.project.organization.id,
        name: task.project.organization.name,
        slug: task.project.organization.slug,
      },
    }));
  }

  async create(
    userId: string,
    orgId: string,
    projectId: string,
    dto: CreateTaskDto,
  ): Promise<TaskResponse> {
    await this.projectsService.findOne(userId, orgId, projectId);

    if (dto.parentTaskId) {
      await this.validateParentTask(dto.parentTaskId, projectId);
    }

    const { saved, acronym } = await this.dataSource.transaction(
      async (manager) => {
        const project = await manager.findOne(Project, {
          where: { id: projectId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!project) {
          throw new NotFoundException('Project not found');
        }

        const taskNumber = project.nextTaskNumber;
        project.nextTaskNumber = taskNumber + 1;
        await manager.save(project);

        const task = manager.create(Task, {
          title: dto.title,
          description: dto.description ?? null,
          status: dto.status ?? TaskStatus.TODO,
          criticity: dto.criticity ?? TaskCriticity.MEDIUM,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          projectId,
          createdById: userId,
          parentTaskId: dto.parentTaskId ?? null,
          taskNumber,
        });

        const savedTask = await manager.save(task);
        return { saved: savedTask, acronym: project.acronym };
      },
    );

    return this.toTaskResponse(saved, acronym);
  }

  async resolveByIdentifier(
    userId: string,
    identifier: string,
  ): Promise<TaskResolveResponse> {
    const parsed = parseTaskDisplayId(identifier);
    if (!parsed) {
      throw new BadRequestException(
        'Invalid task identifier. Expected format like arc-1 or #arc-1',
      );
    }

    const project = await this.projectsService.findByAcronym(parsed.acronym);
    if (!project) {
      throw new NotFoundException('Task not found');
    }

    await this.organizationsService.assertMember(userId, project.organizationId);

    const task = await this.tasksRepository.findOne({
      where: {
        projectId: project.id,
        taskNumber: parsed.taskNumber,
      },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const [enriched] = await this.enrichTaskResponses([task], {
      includeSubtasks: true,
    });

    return {
      id: task.id,
      displayId: formatTaskDisplayId(project.acronym, task.taskNumber),
      taskNumber: task.taskNumber,
      organizationId: project.organizationId,
      projectId: project.id,
      title: task.title,
      task: enriched,
    };
  }

  async findOne(
    userId: string,
    orgId: string,
    projectId: string,
    taskId: string,
  ): Promise<TaskResponse> {
    await this.projectsService.findOne(userId, orgId, projectId);

    const task = await this.tasksRepository.findOne({
      where: { id: taskId, projectId },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const [enriched] = await this.enrichTaskResponses([task], {
      includeSubtasks: true,
    });
    return enriched;
  }

  async update(
    userId: string,
    orgId: string,
    projectId: string,
    taskId: string,
    dto: UpdateTaskDto,
  ): Promise<TaskResponse> {
    const task = await this.findTaskEntity(userId, orgId, projectId, taskId);
    const previousStatus = task.status;

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
    if (dto.criticity !== undefined) task.criticity = dto.criticity;
    if (dto.dueDate !== undefined) {
      task.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    }

    if (dto.parentTaskId !== undefined) {
      if (dto.parentTaskId === task.id) {
        throw new BadRequestException('A task cannot be its own parent');
      }
      if (dto.parentTaskId === null) {
        task.parentTaskId = null;
      } else {
        await this.validateParentTask(dto.parentTaskId, task.projectId, taskId);
        task.parentTaskId = dto.parentTaskId;
      }
    }

    if (dto.projectId !== undefined && dto.projectId !== projectId) {
      if (task.parentTaskId) {
        throw new BadRequestException(
          'Detach subtask from parent before moving to another project',
        );
      }
      await this.projectsService.findOne(userId, orgId, dto.projectId);
      task.projectId = dto.projectId;
      await this.moveSubtasksWithParent(taskId, dto.projectId);
    }

    if (dto.status !== undefined) {
      task.status = dto.status;
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

    if (dto.status !== undefined) {
      if (task.parentTaskId) {
        await this.syncParentStatusFromSubtask(
          task.parentTaskId,
          previousStatus,
          dto.status,
        );
      } else if (dto.status === TaskStatus.DONE) {
        await this.completeAllSubtasks(taskId);
      }
    }

    const [enriched] = await this.enrichTaskResponses([saved], {
      includeSubtasks: !saved.parentTaskId,
    });
    return enriched;
  }

  async remove(
    userId: string,
    orgId: string,
    projectId: string,
    taskId: string,
  ): Promise<void> {
    const task = await this.findTaskEntity(userId, orgId, projectId, taskId);
    const subtasks = await this.tasksRepository.find({
      where: { parentTaskId: taskId },
    });
    if (subtasks.length > 0) {
      await this.tasksRepository.remove(subtasks);
    }
    await this.tasksRepository.remove(task);
  }

  private async findTaskEntity(
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

  private async validateParentTask(
    parentTaskId: string,
    projectId: string,
    taskId?: string,
  ): Promise<Task> {
    const parent = await this.tasksRepository.findOne({
      where: { id: parentTaskId, projectId },
    });
    if (!parent) {
      throw new BadRequestException('Parent task not found in this project');
    }
    if (parent.parentTaskId) {
      throw new BadRequestException('Subtasks cannot have subtasks');
    }
    if (taskId && parentTaskId === taskId) {
      throw new BadRequestException('A task cannot be its own parent');
    }
    return parent;
  }

  private async moveSubtasksWithParent(
    parentTaskId: string,
    projectId: string,
  ): Promise<void> {
    await this.tasksRepository.update(
      { parentTaskId },
      { projectId },
    );
  }

  private async completeAllSubtasks(parentTaskId: string): Promise<void> {
    const subtasks = await this.tasksRepository.find({
      where: { parentTaskId },
    });
    const openSubtasks = subtasks.filter(
      (subtask) => subtask.status !== TaskStatus.DONE,
    );
    if (openSubtasks.length === 0) {
      return;
    }
    for (const subtask of openSubtasks) {
      subtask.status = TaskStatus.DONE;
    }
    await this.tasksRepository.save(openSubtasks);
  }

  private async syncParentStatusFromSubtask(
    parentTaskId: string,
    previousSubtaskStatus: TaskStatus,
    nextSubtaskStatus: TaskStatus,
  ): Promise<void> {
    const parent = await this.tasksRepository.findOne({
      where: { id: parentTaskId },
    });
    if (!parent) {
      return;
    }

    const siblings = await this.tasksRepository.find({
      where: { parentTaskId },
    });

    if (shouldCompleteParent(siblings)) {
      if (parent.status !== TaskStatus.DONE) {
        parent.status = TaskStatus.DONE;
        await this.tasksRepository.save(parent);
      }
      return;
    }

    if (
      shouldReopenParent(previousSubtaskStatus, nextSubtaskStatus) &&
      parent.status === TaskStatus.DONE
    ) {
      parent.status = TaskStatus.IN_PROGRESS;
      await this.tasksRepository.save(parent);
    }
  }

  private toTaskResponse(task: Task, projectAcronym: string): TaskResponse {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      criticity: task.criticity,
      dueDate: task.dueDate ? task.dueDate.toISOString() : null,
      projectId: task.projectId,
      createdById: task.createdById,
      parentTaskId: task.parentTaskId,
      taskNumber: task.taskNumber,
      displayId: formatTaskDisplayId(projectAcronym, task.taskNumber),
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }

  private async enrichTaskResponses(
    tasks: Task[],
    options: { includeSubtasks?: boolean } = {},
  ): Promise<TaskResponse[]> {
    if (tasks.length === 0) {
      return [];
    }

    const parentIds = tasks
      .filter((task) => !task.parentTaskId)
      .map((task) => task.id);

    const subtasksByParent = new Map<string, Task[]>();
    let allSubtasks: Task[] = [];
    if (parentIds.length > 0) {
      allSubtasks = await this.tasksRepository.find({
        where: { parentTaskId: In(parentIds) },
        order: { createdAt: 'ASC' },
      });
      for (const subtask of allSubtasks) {
        const parentId = subtask.parentTaskId!;
        const group = subtasksByParent.get(parentId) ?? [];
        group.push(subtask);
        subtasksByParent.set(parentId, group);
      }
    }

    const projectIds = [
      ...new Set([
        ...tasks.map((task) => task.projectId),
        ...allSubtasks.map((subtask) => subtask.projectId),
      ]),
    ];
    const acronymsByProjectId =
      await this.projectsService.findAcronymsByIds(projectIds);

    return tasks.map((task) => {
      const acronym = acronymsByProjectId.get(task.projectId);
      if (!acronym) {
        throw new NotFoundException('Project not found for task');
      }

      const response = this.toTaskResponse(task, acronym);
      if (task.parentTaskId) {
        return response;
      }

      const children = subtasksByParent.get(task.id) ?? [];
      if (children.length === 0) {
        return response;
      }

      response.subtaskProgress = computeSubtaskProgress(children);
      if (options.includeSubtasks) {
        response.subtasks = children.map((child) => {
          const childAcronym = acronymsByProjectId.get(child.projectId);
          if (!childAcronym) {
            throw new NotFoundException('Project not found for task');
          }
          return this.toTaskResponse(child, childAcronym);
        });
      }
      return response;
    });
  }
}
