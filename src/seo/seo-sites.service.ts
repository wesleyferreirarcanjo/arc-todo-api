import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { appError } from '../errors/app-errors';
import { ProjectsService } from '../projects/projects.service';
import { CreateSeoSiteDto } from './dto/create-seo-site.dto';
import { SeoKeywordsDto } from './dto/seo-keywords.dto';
import { UpdateSeoOfferingsDto } from './dto/update-seo-offerings.dto';
import { UpdateSeoSiteDto } from './dto/update-seo-site.dto';
import { ProjectSeoSite } from './project-seo-site.entity';
import { SeoAuditService } from './seo-audit.service';
import { SeoGscService } from './seo-gsc.service';
import { parseSiteHostname } from './seo-host.util';

export type SeoSiteView = {
  id: string;
  projectId: string;
  hostname: string;
  title: string;
  createdById: string;
  gscConnected: boolean;
  gscPropertyUri: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class SeoSitesService {
  constructor(
    @InjectRepository(ProjectSeoSite)
    private readonly sitesRepository: Repository<ProjectSeoSite>,
    private readonly projectsService: ProjectsService,
    private readonly auditService: SeoAuditService,
    private readonly gscService: SeoGscService,
  ) {}

  async findAll(
    userId: string,
    orgId: string,
    projectId: string,
  ): Promise<SeoSiteView[]> {
    await this.projectsService.findOne(userId, orgId, projectId);
    const sites = await this.sitesWithToken({ projectId });
    return sites.map((site) => this.toView(site));
  }

  async create(
    userId: string,
    orgId: string,
    projectId: string,
    dto: CreateSeoSiteDto,
  ): Promise<SeoSiteView> {
    await this.projectsService.findOne(userId, orgId, projectId);
    const hostname = this.requireHostname(dto.hostname ?? '');
    const site = this.sitesRepository.create({
      projectId,
      hostname,
      title: dto.title?.trim() || hostname,
      createdById: userId,
      gscRefreshToken: null,
      gscPropertyUri: null,
      offerings: [],
    });
    try {
      const saved = await this.sitesRepository.save(site);
      return this.toView({ ...saved, gscRefreshToken: null });
    } catch {
      throw appError('SYS_CONFLICT');
    }
  }

  async findOne(
    userId: string,
    orgId: string,
    projectId: string,
    siteId: string,
  ): Promise<SeoSiteView> {
    const site = await this.requireSite(userId, orgId, projectId, siteId);
    return this.toView(site);
  }

  async update(
    userId: string,
    orgId: string,
    projectId: string,
    siteId: string,
    dto: UpdateSeoSiteDto,
  ): Promise<SeoSiteView> {
    const site = await this.requireSite(userId, orgId, projectId, siteId);
    if (dto.hostname !== undefined) {
      site.hostname = this.requireHostname(dto.hostname);
    }
    if (dto.title !== undefined) {
      site.title = dto.title.trim() || site.hostname;
    }
    try {
      const saved = await this.sitesRepository.save(site);
      return this.toView(saved);
    } catch {
      throw appError('SYS_CONFLICT');
    }
  }

  async remove(
    userId: string,
    orgId: string,
    projectId: string,
    siteId: string,
  ): Promise<{ deleted: true }> {
    const site = await this.requireSite(userId, orgId, projectId, siteId);
    await this.sitesRepository.remove(site);
    return { deleted: true };
  }

  async enqueueAudit(
    userId: string,
    orgId: string,
    projectId: string,
    siteId: string,
  ) {
    const site = await this.requireSite(userId, orgId, projectId, siteId);
    return this.auditService.enqueue(site);
  }

  async getAudit(
    userId: string,
    orgId: string,
    projectId: string,
    siteId: string,
    runId: string,
  ) {
    await this.requireSite(userId, orgId, projectId, siteId);
    return this.auditService.getRun(siteId, runId);
  }

  async getLatestAudit(
    userId: string,
    orgId: string,
    projectId: string,
    siteId: string,
  ) {
    await this.requireSite(userId, orgId, projectId, siteId);
    return this.auditService.getLatest(siteId);
  }

  async connectSearchConsole(
    userId: string,
    orgId: string,
    projectId: string,
    siteId: string,
  ): Promise<{ authorizationUrl: string }> {
    await this.requireSite(userId, orgId, projectId, siteId);
    return {
      authorizationUrl: this.gscService.createAuthorizationUrl({
        siteId,
        orgId,
        projectId,
      }),
    };
  }

  async fetchKeywords(
    userId: string,
    orgId: string,
    projectId: string,
    siteId: string,
    dto: SeoKeywordsDto,
  ) {
    await this.requireSite(userId, orgId, projectId, siteId);
    return this.gscService.fetchKeywords(siteId, dto);
  }

  async getOfferings(
    userId: string,
    orgId: string,
    projectId: string,
    siteId: string,
  ): Promise<{ offerings: string[] }> {
    const site = await this.requireSite(userId, orgId, projectId, siteId);
    return { offerings: this.normalizeOfferings(site.offerings) };
  }

  async putOfferings(
    userId: string,
    orgId: string,
    projectId: string,
    siteId: string,
    dto: UpdateSeoOfferingsDto,
  ): Promise<{ offerings: string[] }> {
    const site = await this.requireSite(userId, orgId, projectId, siteId);
    const offerings = this.normalizeOfferings(dto.offerings);
    if (offerings.length > 5) {
      throw appError('SEO_TOO_MANY_OFFERINGS');
    }
    site.offerings = offerings;
    await this.sitesRepository.save(site);
    return { offerings };
  }

  private async requireSite(
    userId: string,
    orgId: string,
    projectId: string,
    siteId: string,
  ): Promise<ProjectSeoSite> {
    await this.projectsService.findOne(userId, orgId, projectId);
    const site = await this.sitesWithToken({ id: siteId, projectId }).then(
      (rows) => rows[0] ?? null,
    );
    if (!site) throw appError('SEO_SITE_NOT_FOUND');
    return site;
  }

  private async sitesWithToken(
    where: { projectId: string; id?: string },
  ): Promise<ProjectSeoSite[]> {
    const qb = this.sitesRepository
      .createQueryBuilder('site')
      .addSelect('site.gscRefreshToken')
      .where('site.projectId = :projectId', { projectId: where.projectId })
      .orderBy('site.createdAt', 'DESC');
    if (where.id) {
      qb.andWhere('site.id = :id', { id: where.id });
    }
    return qb.getMany();
  }

  private normalizeOfferings(values: string[] | null | undefined): string[] {
    if (!Array.isArray(values)) return [];
    return values
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean);
  }

  private requireHostname(input: string): string {
    const parsed = parseSiteHostname(input);
    if (!parsed.ok) {
      throw appError(
        parsed.reason === 'ssrf' ? 'SEO_SSRF_BLOCKED' : 'SEO_INVALID_HOST',
      );
    }
    return parsed.hostname;
  }

  private toView(site: ProjectSeoSite): SeoSiteView {
    return {
      id: site.id,
      projectId: site.projectId,
      hostname: site.hostname,
      title: site.title,
      createdById: site.createdById,
      gscConnected: Boolean(site.gscRefreshToken),
      gscPropertyUri: site.gscPropertyUri,
      createdAt: site.createdAt,
      updatedAt: site.updatedAt,
    };
  }
}
