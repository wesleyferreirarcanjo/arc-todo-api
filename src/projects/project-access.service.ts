import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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
      throw new ForbiddenException('Admin access required');
    }
  }

  async assertProjectAccess(userId: string, projectId: string): Promise<Project> {
    if (await this.isAdmin(userId)) {
      const project = await this.projectsRepository.findOne({
        where: { id: projectId },
        relations: ['organization'],
      });
      if (!project) {
        throw new NotFoundException('Project not found');
      }
      return project;
    }

    const membership = await this.projectMembersRepository.findOne({
      where: { userId, projectId },
      relations: ['project', 'project.organization'],
    });
    if (!membership) {
      throw new ForbiddenException('Access denied');
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
      throw new ForbiddenException('Access denied');
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
        throw new NotFoundException('One or more projects not found');
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
}
