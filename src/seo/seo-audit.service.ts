import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { APP_ERRORS, appError } from '../errors/app-errors';
import { ProjectSeoAuditPage } from './project-seo-audit-page.entity';
import { ProjectSeoAuditRun } from './project-seo-audit-run.entity';
import { ProjectSeoLighthouseRun } from './project-seo-lighthouse-run.entity';
import { ProjectSeoSite } from './project-seo-site.entity';
import { SeoCrawlError, SeoCrawlService } from './seo-crawl.service';
import { homepageUrl } from './seo-host.util';
import { SeoLighthouseService } from './seo-lighthouse.service';
import { SeoSettingsService } from './seo-settings.service';

export type SeoAuditView = {
  id: string;
  siteId: string;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  robotsTxt: string | null;
  sitemapUrls: string[];
  createdAt: Date;
  pages: ProjectSeoAuditPage[];
  lighthouse: ProjectSeoLighthouseRun | null;
};

@Injectable()
export class SeoAuditService {
  private readonly logger = new Logger(SeoAuditService.name);
  private busy = false;

  constructor(
    @InjectRepository(ProjectSeoAuditRun)
    private readonly runsRepository: Repository<ProjectSeoAuditRun>,
    @InjectRepository(ProjectSeoAuditPage)
    private readonly pagesRepository: Repository<ProjectSeoAuditPage>,
    @InjectRepository(ProjectSeoLighthouseRun)
    private readonly lighthouseRepository: Repository<ProjectSeoLighthouseRun>,
    private readonly crawlService: SeoCrawlService,
    private readonly lighthouseService: SeoLighthouseService,
    private readonly settingsService: SeoSettingsService,
  ) {}

  enqueue(site: ProjectSeoSite): Promise<{ id: string; status: string }> {
    if (this.busy) {
      throw appError('SEO_AUDIT_BUSY');
    }
    this.busy = true;
    return this.startRun(site).catch((error) => {
      this.busy = false;
      throw error;
    });
  }

  async getRun(siteId: string, runId: string): Promise<SeoAuditView> {
    const run = await this.runsRepository.findOne({
      where: { id: runId, siteId },
    });
    if (!run) throw appError('SEO_AUDIT_NOT_FOUND');
    const pages = await this.pagesRepository.find({
      where: { runId: run.id },
      order: { createdAt: 'ASC' },
    });
    const lighthouse =
      (await this.lighthouseRepository.findOne({
        where: { runId: run.id },
      })) ?? null;
    return this.toView(run, pages, lighthouse);
  }

  private async startRun(
    site: ProjectSeoSite,
  ): Promise<{ id: string; status: string }> {
    const run = await this.runsRepository.save(
      this.runsRepository.create({
        siteId: site.id,
        status: 'queued',
        errorCode: null,
        errorMessage: null,
        startedAt: null,
        finishedAt: null,
        robotsTxt: null,
        sitemapUrls: [],
      }),
    );
    void this.processRun(site, run.id).finally(() => {
      this.busy = false;
    });
    return { id: run.id, status: run.status };
  }

  private async processRun(site: ProjectSeoSite, runId: string): Promise<void> {
    const run = await this.runsRepository.findOne({ where: { id: runId } });
    if (!run) return;
    run.status = 'running';
    run.startedAt = new Date();
    await this.runsRepository.save(run);

    try {
      const maxPages = await this.settingsService.getMaxPagesPerAudit();
      const crawl = await this.crawlService.crawlSite(site.hostname, maxPages);
      run.robotsTxt = crawl.robotsTxt;
      run.sitemapUrls = crawl.sitemapUrls;
      if (crawl.pages.length) {
        await this.pagesRepository.save(
          crawl.pages.map((page) =>
            this.pagesRepository.create({
              runId: run.id,
              ...page,
            }),
          ),
        );
      }

      const lighthouse = await this.lighthouseService.runHomepage(
        homepageUrl(site.hostname),
      );
      await this.lighthouseRepository.save(
        this.lighthouseRepository.create({
          runId: run.id,
          url: lighthouse.url,
          lcp: lighthouse.lcp,
          cls: lighthouse.cls,
          inp: lighthouse.inp,
          categories: lighthouse.categories,
          keyAudits: lighthouse.keyAudits,
          errorCode: lighthouse.errorCode,
        }),
      );

      run.status = 'complete';
      run.finishedAt = new Date();
      await this.runsRepository.save(run);
    } catch (error) {
      const mapped = this.mapError(error);
      run.status = 'failed';
      run.errorCode = mapped.code;
      run.errorMessage = mapped.message;
      run.finishedAt = new Date();
      await this.runsRepository.save(run);
      this.logger.warn(`SEO audit ${run.id} failed: ${mapped.code}`);
    }
  }

  private mapError(error: unknown): { code: string; message: string } {
    if (error instanceof SeoCrawlError) {
      const def = APP_ERRORS[error.code];
      return { code: def.code, message: def.message };
    }
    const def = APP_ERRORS.SEO_CRAWL_FAILED;
    return { code: def.code, message: def.message };
  }

  private toView(
    run: ProjectSeoAuditRun,
    pages: ProjectSeoAuditPage[],
    lighthouse: ProjectSeoLighthouseRun | null,
  ): SeoAuditView {
    return {
      id: run.id,
      siteId: run.siteId,
      status: run.status,
      errorCode: run.errorCode,
      errorMessage: run.errorMessage,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      robotsTxt: run.robotsTxt,
      sitemapUrls: run.sitemapUrls,
      createdAt: run.createdAt,
      pages,
      lighthouse,
    };
  }
}
