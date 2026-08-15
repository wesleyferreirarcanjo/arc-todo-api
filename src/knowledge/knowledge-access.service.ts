import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { appError } from '../errors/app-errors';
import { Organization } from '../organizations/organization.entity';
import { ProjectAccessService } from '../projects/project-access.service';
import { ProjectMember } from '../projects/project-member.entity';
import { Project } from '../projects/project.entity';
import { User } from '../users/user.entity';
import { KnowledgeAccessGrant } from './knowledge-access-grant.entity';

export interface KnowledgeGrantUserResponse {
  userId: string;
  username: string;
  createdAt: string;
}

@Injectable()
export class KnowledgeAccessService {
  constructor(
    @InjectRepository(KnowledgeAccessGrant)
    private readonly grantsRepository: Repository<KnowledgeAccessGrant>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Organization)
    private readonly organizationsRepository: Repository<Organization>,
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    @InjectRepository(ProjectMember)
    private readonly projectMembersRepository: Repository<ProjectMember>,
    private readonly projectAccessService: ProjectAccessService,
  ) {}

  async hasOrgKnowledgeAccess(
    userId: string,
    organizationId: string,
  ): Promise<boolean> {
    if (await this.projectAccessService.isAdmin(userId)) {
      return true;
    }
    const grant = await this.grantsRepository.findOne({
      where: { userId, organizationId },
      select: ['id'],
    });
    return Boolean(grant);
  }

  async hasProjectKnowledgeAccess(
    userId: string,
    projectId: string,
  ): Promise<boolean> {
    if (await this.projectAccessService.isAdmin(userId)) {
      return true;
    }
    const grant = await this.grantsRepository.findOne({
      where: { userId, projectId },
      select: ['id'],
    });
    return Boolean(grant);
  }

  async assertOrgKnowledgeAccess(
    userId: string,
    organizationId: string,
  ): Promise<void> {
    if (await this.hasOrgKnowledgeAccess(userId, organizationId)) {
      return;
    }
    throw appError('ACL_KNOWLEDGE_DENIED');
  }

  async assertProjectKnowledgeAccess(
    userId: string,
    projectId: string,
  ): Promise<void> {
    if (await this.hasProjectKnowledgeAccess(userId, projectId)) {
      return;
    }
    throw appError('ACL_KNOWLEDGE_DENIED');
  }

  async listOrgGrants(
    organizationId: string,
  ): Promise<KnowledgeGrantUserResponse[]> {
    await this.ensureOrganization(organizationId);
    const grants = await this.grantsRepository.find({
      where: { organizationId },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
    return grants.map((grant) => this.toGrantResponse(grant));
  }

  async listProjectGrants(
    projectId: string,
  ): Promise<KnowledgeGrantUserResponse[]> {
    await this.ensureProject(projectId);
    const grants = await this.grantsRepository.find({
      where: { projectId },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
    return grants.map((grant) => this.toGrantResponse(grant));
  }

  async setOrgGrants(
    organizationId: string,
    userIds: string[],
    createdById: string,
  ): Promise<KnowledgeGrantUserResponse[]> {
    await this.ensureOrganization(organizationId);
    const uniqueUserIds = await this.validateUsers(userIds);

    await this.grantsRepository.delete({ organizationId });

    if (uniqueUserIds.length > 0) {
      const grants = uniqueUserIds.map((userId) =>
        this.grantsRepository.create({
          userId,
          organizationId,
          projectId: null,
          createdById,
        }),
      );
      await this.grantsRepository.save(grants);
    }

    return this.listOrgGrants(organizationId);
  }

  async setProjectGrants(
    projectId: string,
    userIds: string[],
    createdById: string,
  ): Promise<KnowledgeGrantUserResponse[]> {
    await this.ensureProject(projectId);
    const uniqueUserIds = await this.validateUsers(userIds);

    await this.grantsRepository.delete({ projectId });

    if (uniqueUserIds.length > 0) {
      const grants = uniqueUserIds.map((userId) =>
        this.grantsRepository.create({
          userId,
          organizationId: null,
          projectId,
          createdById,
        }),
      );
      await this.grantsRepository.save(grants);
    }

    return this.listProjectGrants(projectId);
  }

  async grantAllProjectMembers(
    projectId: string,
    createdById: string,
  ): Promise<KnowledgeGrantUserResponse[]> {
    await this.ensureProject(projectId);
    const members = await this.projectMembersRepository.find({
      where: { projectId },
      select: ['userId'],
    });
    const userIds = members.map((member) => member.userId);
    return this.setProjectGrants(projectId, userIds, createdById);
  }

  private async ensureOrganization(organizationId: string): Promise<void> {
    const org = await this.organizationsRepository.findOne({
      where: { id: organizationId },
      select: ['id'],
    });
    if (!org) {
      throw appError('ORG_NOT_FOUND');
    }
  }

  private async ensureProject(projectId: string): Promise<Project> {
    const project = await this.projectsRepository.findOne({
      where: { id: projectId },
      select: ['id', 'organizationId'],
    });
    if (!project) {
      throw appError('PROJ_NOT_FOUND');
    }
    return project;
  }

  private async validateUsers(userIds: string[]): Promise<string[]> {
    const uniqueUserIds = [...new Set(userIds)];
    if (uniqueUserIds.length === 0) {
      return [];
    }
    const users = await this.usersRepository.find({
      where: { id: In(uniqueUserIds) },
      select: ['id'],
    });
    if (users.length !== uniqueUserIds.length) {
      throw appError('ORG_USERS_NOT_FOUND');
    }
    return uniqueUserIds;
  }

  private toGrantResponse(
    grant: KnowledgeAccessGrant,
  ): KnowledgeGrantUserResponse {
    return {
      userId: grant.userId,
      username: grant.user?.username ?? '',
      createdAt: grant.createdAt.toISOString(),
    };
  }
}
