import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { CloudService } from '../cloud/cloud.service';
import { MetricsService } from '../metrics/metrics.service';
import { ObserverService } from '../observer/observer.service';
import { QaInfoService } from '../qa-info/qa-info.service';
import {
  asCloudApps,
  asIdList,
  attachBugRuntimeEvidence,
  type BugRuntimeEvidenceContext,
  type BugRuntimeEvidenceDeps,
} from './bug-runtime-evidence.util';
import { TASK_LOG_MIME } from './task-log.util';
import { TaskLogService } from './task-log.service';

@Injectable()
export class BugRuntimeEvidenceService {
  private readonly logger = new Logger(BugRuntimeEvidenceService.name);

  constructor(
    @Inject(forwardRef(() => TaskLogService))
    private readonly taskLogs: TaskLogService,
    private readonly qaInfo: QaInfoService,
    private readonly cloud: CloudService,
    private readonly observer: ObserverService,
    private readonly metrics: MetricsService,
  ) {}

  attach(ctx: BugRuntimeEvidenceContext): Promise<void> {
    return attachBugRuntimeEvidence(this.deps(ctx), ctx);
  }

  private deps(ctx: BugRuntimeEvidenceContext): BugRuntimeEvidenceDeps {
    return {
      getQaEnvironments: async () => {
        const profile = await this.qaInfo.get(
          ctx.userId,
          ctx.orgId,
          ctx.projectId,
        );
        return profile.environments ?? [];
      },
      listCloudApps: async () =>
        asCloudApps(await this.cloud.listApps(ctx.userId, 'ui')),
      searchObserver: (query) => this.observer.search(query),
      listMetricsServers: async () => asIdList(await this.metrics.listServers()),
      getServerResources: (serverId) =>
        this.metrics.getServerResources(serverId, '1h'),
      getResourceSeries: (resourceId) =>
        this.metrics.getResourceSeries(resourceId, '1h'),
      uploadJson: async (filename, body) => {
        const buffer = Buffer.from(JSON.stringify(body), 'utf8');
        await this.taskLogs.upload(
          ctx.userId,
          ctx.orgId,
          ctx.projectId,
          ctx.taskId,
          {
            originalname: filename,
            mimetype: TASK_LOG_MIME,
            size: buffer.length,
            buffer,
          },
        );
      },
      logWarn: (message) => this.logger.warn(message),
    };
  }
}
