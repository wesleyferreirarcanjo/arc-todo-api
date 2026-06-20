import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../organizations/organization.entity';
import { OrganizationsService } from '../organizations/organizations.service';
import { Project } from '../projects/project.entity';
import {
  matchProjectFromMessage,
  matchScopeCandidates,
  pickUniqueCandidate,
  projectHintVariants,
  ScopeMatchCandidate,
  ScopeMatchItem,
} from './scope-match.util';

export interface ScopeOrganizationSummary {
  id: string;
  name: string;
  slug: string;
}

export interface ScopeProjectSummary {
  id: string;
  name: string;
  organizationId: string;
}

export interface ScopeCandidate {
  organization: ScopeOrganizationSummary;
  project: ScopeProjectSummary;
}

export type ScopeResolveStatus = 'resolved' | 'ambiguous' | 'not_found';

export interface ScopeResolveResponse {
  status: ScopeResolveStatus;
  organization?: ScopeOrganizationSummary;
  project?: ScopeProjectSummary;
  candidates?: ScopeCandidate[];
}

interface ProjectScopeItem extends ScopeMatchItem {
  project: Project;
  organization: Organization;
}

@Injectable()
export class ScopeResolverService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    private readonly organizationsService: OrganizationsService,
  ) {}

  async resolveForUser(
    userId: string,
    query: {
      organizationHint?: string;
      projectHint?: string;
      message?: string;
    },
  ): Promise<ScopeResolveResponse> {
    const organizations = await this.organizationsService.findForUser(userId);
    const orgItems = organizations.map((organization) => ({
      id: organization.id,
      labels: [organization.name, organization.slug],
      organization,
    }));

    const resolvedOrgItem = pickUniqueCandidate(
      matchScopeCandidates(orgItems, query.organizationHint),
    );

    const scopedOrgId = resolvedOrgItem?.organization.id;
    const accessibleProjects = await this.loadAccessibleProjects(userId, scopedOrgId);
    const projectHints = [
      ...projectHintVariants(query.projectHint),
      ...(query.organizationHint && !resolvedOrgItem ? [query.organizationHint] : []),
    ];

    const projectCandidates = this.collectProjectCandidates(
      accessibleProjects,
      projectHints,
      query.message,
    );
    const uniqueProject = pickUniqueCandidate(projectCandidates);

    if (uniqueProject) {
      return {
        status: 'resolved',
        organization: this.toOrganizationSummary(uniqueProject.organization),
        project: this.toProjectSummary(uniqueProject.project),
      };
    }

    if (projectCandidates.length > 1) {
      return {
        status: 'ambiguous',
        candidates: this.toCandidates(projectCandidates),
      };
    }

    return { status: 'not_found' };
  }

  private async loadAccessibleProjects(
    userId: string,
    organizationId?: string,
  ): Promise<ProjectScopeItem[]> {
    const qb = this.projectsRepository
      .createQueryBuilder('project')
      .innerJoinAndSelect('project.organization', 'organization')
      .innerJoin('organization.members', 'member')
      .where('member.userId = :userId', { userId });

    if (organizationId) {
      qb.andWhere('organization.id = :organizationId', { organizationId });
    }

    const projects = await qb.orderBy('project.createdAt', 'DESC').getMany();
    return projects.map((project) => ({
      id: project.id,
      project,
      organization: project.organization,
      labels: [project.name],
    }));
  }

  private collectProjectCandidates(
    projects: ProjectScopeItem[],
    hints: string[],
    message?: string,
  ): ScopeMatchCandidate<ProjectScopeItem>[] {
    const seen = new Map<string, ScopeMatchCandidate<ProjectScopeItem>>();

    for (const hint of hints) {
      for (const candidate of matchScopeCandidates(projects, hint)) {
        const existing = seen.get(candidate.item.project.id);
        if (!existing || candidate.score > existing.score) {
          seen.set(candidate.item.project.id, candidate);
        }
      }
    }

    for (const candidate of matchProjectFromMessage(message, projects)) {
      const existing = seen.get(candidate.item.project.id);
      if (!existing || candidate.score > existing.score) {
        seen.set(candidate.item.project.id, candidate);
      }
    }

    return [...seen.values()].sort((left, right) => right.score - left.score);
  }

  private toCandidates(
    candidates: ScopeMatchCandidate<ProjectScopeItem>[],
  ): ScopeCandidate[] {
    return candidates.map((candidate) => ({
      organization: this.toOrganizationSummary(candidate.item.organization),
      project: this.toProjectSummary(candidate.item.project),
    }));
  }

  private toOrganizationSummary(
    organization: Organization,
  ): ScopeOrganizationSummary {
    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    };
  }

  private toProjectSummary(project: Project): ScopeProjectSummary {
    return {
      id: project.id,
      name: project.name,
      organizationId: project.organizationId,
    };
  }
}
