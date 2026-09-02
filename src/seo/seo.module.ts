import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectAccessModule } from '../projects/project-access.module';
import { ProjectsModule } from '../projects/projects.module';
import { ProjectSeoAuditPage } from './project-seo-audit-page.entity';
import { ProjectSeoAuditRun } from './project-seo-audit-run.entity';
import { ProjectSeoGscRow } from './project-seo-gsc-row.entity';
import { ProjectSeoLighthouseRun } from './project-seo-lighthouse-run.entity';
import { ProjectSeoSite } from './project-seo-site.entity';
import { SeoAuditService } from './seo-audit.service';
import { SeoCrawlService } from './seo-crawl.service';
import { SeoGscCallbackController } from './seo-gsc-callback.controller';
import { SeoGscService } from './seo-gsc.service';
import { SeoLighthouseService } from './seo-lighthouse.service';
import { SeoSetting } from './seo-setting.entity';
import { SeoSettingsController } from './seo-settings.controller';
import { SeoSettingsService } from './seo-settings.service';
import { SeoSitesController } from './seo-sites.controller';
import { SeoSitesService } from './seo-sites.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProjectSeoSite,
      ProjectSeoAuditRun,
      ProjectSeoAuditPage,
      ProjectSeoLighthouseRun,
      ProjectSeoGscRow,
      SeoSetting,
    ]),
    ProjectsModule,
    ProjectAccessModule,
  ],
  controllers: [
    SeoSitesController,
    SeoSettingsController,
    SeoGscCallbackController,
  ],
  providers: [
    SeoSitesService,
    SeoSettingsService,
    SeoAuditService,
    SeoCrawlService,
    SeoLighthouseService,
    SeoGscService,
  ],
  exports: [SeoSitesService, SeoSettingsService],
})
export class SeoModule {}
