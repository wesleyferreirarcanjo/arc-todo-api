import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { appError } from '../errors/app-errors';
import { Organization } from '../organizations/organization.entity';
import { User } from '../users/user.entity';
import { ProjectMember } from './project-member.entity';
import { Project } from './project.entity';

@Injectable()
export class ProjectAccessService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(ProjectMember)
    private readonly projectMembersRepository: Repository<ProjectMember>,
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    @InjectRepository(Organization)
    private readonly organizationsRepository: Repository<Organization>,
  ) {}

  async isAdmin(userId: string): Promise<boolean> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      select: ['id', 'isAdmin'],
    });
    return user?.isAdmin ?? false;
  }

  async assertAdmin(userId: string): Promise<void> {
    if (!(await this.isAdmin(userId))) {
      throw appError('ACL_ADMIN_REQUIRED');
    }
  }

  async assertProjectAccess(userId: string, projectId: string): Promise<Project> {
    if (await this.isAdmin(userId)) {
      const project = await this.projectsRepository.findOne({
        where: { id: projectId },
        relations: ['organization'],
      });
      if (!project) {
        throw appError('PROJ_NOT_FOUND');
      }
      return project;
    }

    const membership = await this.projectMembersRepository.findOne({
      where: { userId, projectId },
      relations: ['project', 'project.organization'],
    });
    if (!membership) {
      throw appError('ACL_PROJECT_DENIED');
    }

    return membership.project;
  }

  async assertOrgAccess(userId: string, orgId: string): Promise<void> {
    if (await this.isAdmin(userId)) {
      return;
    }

    const count = await this.projectMembersRepository
      .createQueryBuilder('member')
      .innerJoin('member.project', 'project')
      .where('member.userId = :userId', { userId })
      .andWhere('project.organizationId = :orgId', { orgId })
      .getCount();

    if (count === 0) {
      throw appError('ACL_PROJECT_DENIED');
    }
  }

  async listAccessibleProjects(
    userId: string,
    organizationId?: string,
  ): Promise<Project[]> {
    if (await this.isAdmin(userId)) {
      return this.projectsRepository.find({
        where: organizationId ? { organizationId } : {},
        relations: ['organization'],
        order: { createdAt: 'DESC' },
      });
    }

    const qb = this.projectMembersRepository
      .createQueryBuilder('member')
      .innerJoinAndSelect('member.project', 'project')
      .innerJoinAndSelect('project.organization', 'organization')
      .where('member.userId = :userId', { userId });

    if (organizationId) {
      qb.andWhere('project.organizationId = :organizationId', {
        organizationId,
      });
    }

    const memberships = await qb.orderBy('project.createdAt', 'DESC').getMany();
    return memberships.map((membership) => membership.project);
  }

  async listAccessibleOrganizations(userId: string): Promise<Organization[]> {
    if (await this.isAdmin(userId)) {
      return this.organizationsRepository.find({
        order: { createdAt: 'ASC' },
      });
    }

    const projects = await this.listAccessibleProjects(userId);
    const organizations = new Map<string, Organization>();
    for (const project of projects) {
      if (project.organization) {
        organizations.set(project.organization.id, project.organization);
      }
    }

    return [...organizations.values()].sort(
      (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
    );
  }

  async getProjectIdsForUser(userId: string): Promise<string[]> {
    const memberships = await this.projectMembersRepository.find({
      where: { userId },
      select: ['projectId'],
    });
    return memberships.map((membership) => membership.projectId);
  }

  async setProjectAssignments(
    userId: string,
    projectIds: string[],
  ): Promise<void> {
    const uniqueProjectIds = [...new Set(projectIds)];

    if (uniqueProjectIds.length > 0) {
      const projects = await this.projectsRepository.find({
        where: { id: In(uniqueProjectIds) },
        select: ['id'],
      });
      if (projects.length !== uniqueProjectIds.length) {
        throw appError('PROJ_BULK_NOT_FOUND');
      }
    }

    await this.projectMembersRepository.delete({ userId });

    if (uniqueProjectIds.length === 0) {
      return;
    }

    const memberships = uniqueProjectIds.map((projectId) =>
      this.projectMembersRepository.create({ userId, projectId }),
    );
    await this.projectMembersRepository.save(memberships);
  }

  async listAssignableUsers(
    userId: string,
    projectId: string,
  ): Promise<Array<{ id: string; username: string }>> {
    await this.assertProjectAccess(userId, projectId);

    const members = await this.projectMembersRepository.find({
      where: { projectId },
      relations: ['user'],
    });
    const admins = await this.usersRepository.find({
      where: { isAdmin: true },
      select: ['id', 'username'],
      order: { username: 'ASC' },
    });

    const byId = new Map<string, { id: string; username: string }>();
    for (const member of members) {
      if (member.user) {
        byId.set(member.user.id, {
          id: member.user.id,
          username: member.user.username,
        });
      }
    }
    for (const admin of admins) {
      byId.set(admin.id, { id: admin.id, username: admin.username });
    }

    return [...byId.values()].sort((left, right) =>
      left.username.localeCompare(right.username),
    );
  }

  async assertUserAssignableToProject(
    projectId: string,
    assigneeId: string,
  ): Promise<{ id: string; username: string }> {
    const user = await this.usersRepository.findOne({
      where: { id: assigneeId },
      select: ['id', 'username', 'isAdmin'],
    });
    if (!user) {
      throw appError('TASK_ASSIGNEE_INVALID');
    }
    if (user.isAdmin) {
      return { id: user.id, username: user.username };
    }

    const membership = await this.projectMembersRepository.findOne({
      where: { projectId, userId: assigneeId },
    });
    if (!membership) {
      throw appError('TASK_ASSIGNEE_INVALID');
    }
    return { id: user.id, username: user.username };
  }

  async findPublicUsersByIds(
    userIds: string[],
  ): Promise<Map<string, { id: string; username: string }>> {
    const uniqueIds = [...new Set(userIds.filter(Boolean))];
    if (uniqueIds.length === 0) {
      return new Map();
    }
    const users = await this.usersRepository.find({
      where: { id: In(uniqueIds) },
      select: ['id', 'username'],
    });
    return new Map(users.map((user) => [user.id, { id: user.id, username: user.username }]));
  }
}
