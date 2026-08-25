import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { appError } from '../errors/app-errors';
import { ProjectsService } from '../projects/projects.service';
import { UpdateProjectQaInfoDto } from './dto/update-project-qa-info.dto';
import { ProjectQaProfile } from './project-qa-profile.entity';
import {
  emptyQaProfile,
  normalizeQaProfile,
  type EmptyQaProfile,
} from './qa-info.util';

@Injectable()
export class QaInfoService {
  constructor(
    @InjectRepository(ProjectQaProfile)
    private readonly profileRepository: Repository<ProjectQaProfile>,
    private readonly projectsService: ProjectsService,
  ) {}

  async get(
    userId: string,
    orgId: string,
    projectId: string,
  ): Promise<ProjectQaProfile | EmptyQaProfile> {
    await this.projectsService.findOne(userId, orgId, projectId);
    const profile = await this.profileRepository.findOne({
      where: { projectId },
    });
    return profile ?? emptyQaProfile(projectId);
  }

  async upsert(
    userId: string,
    orgId: string,
    projectId: string,
    dto: UpdateProjectQaInfoDto,
  ): Promise<ProjectQaProfile> {
    await this.projectsService.findOne(userId, orgId, projectId);

    const existing = await this.profileRepository.findOne({
      where: { projectId },
    });
    const normalized = normalizeQaProfile({
      environments: dto.environments ?? existing?.environments ?? [],
      users: dto.users ?? existing?.users ?? [],
      notes: dto.notes !== undefined ? dto.notes : (existing?.notes ?? null),
    });
    if (!normalized.ok) {
      throw appError(normalized.error);
    }

    if (existing) {
      existing.environments = normalized.value.environments;
      existing.users = normalized.value.users;
      existing.notes = normalized.value.notes;
      existing.updatedById = userId;
      return this.profileRepository.save(existing);
    }

    const created = this.profileRepository.create({
      projectId,
      environments: normalized.value.environments,
      users: normalized.value.users,
      notes: normalized.value.notes,
      updatedById: userId,
    });
    return this.profileRepository.save(created);
  }
}
