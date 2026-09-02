import { createHmac, timingSafeEqual } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { google } from 'googleapis';
import { Repository } from 'typeorm';
import { appError } from '../errors/app-errors';
import { SeoKeywordsDto } from './dto/seo-keywords.dto';
import { ProjectSeoGscRow, SeoGscDimension } from './project-seo-gsc-row.entity';
import { ProjectSeoSite } from './project-seo-site.entity';

const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const STATE_TTL_MS = 15 * 60 * 1000;

type GscState = {
  siteId: string;
  orgId: string;
  projectId: string;
  exp: number;
};

export type SeoGscRowView = {
  id: string;
  siteId: string;
  dimension: SeoGscDimension;
  value: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  rangeStart: string;
  rangeEnd: string;
  fetchedAt: Date;
};

@Injectable()
export class SeoGscService {
  constructor(
    @InjectRepository(ProjectSeoSite)
    private readonly sitesRepository: Repository<ProjectSeoSite>,
    @InjectRepository(ProjectSeoGscRow)
    private readonly gscRowsRepository: Repository<ProjectSeoGscRow>,
    private readonly configService: ConfigService,
  ) {}

  createAuthorizationUrl(params: {
    siteId: string;
    orgId: string;
    projectId: string;
  }): string {
    const oauth2 = this.createOAuthClient();
    const state = this.signState({
      siteId: params.siteId,
      orgId: params.orgId,
      projectId: params.projectId,
      exp: Date.now() + STATE_TTL_MS,
    });
    return oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: GSC_SCOPE,
      state,
    });
  }

  async handleCallback(
    code: string | undefined,
    state: string | undefined,
    oauthError: string | undefined,
  ): Promise<{ orgId: string; projectId: string; siteId: string }> {
    if (oauthError || !code || !state) {
      throw appError('SEO_GSC_OAUTH_FAILED');
    }
    const payload = this.verifyState(state);
    const oauth2 = this.createOAuthClient();
    let tokens;
    try {
      const result = await oauth2.getToken(code);
      tokens = result.tokens;
    } catch {
      throw appError('SEO_GSC_OAUTH_FAILED');
    }
    if (!tokens.refresh_token) {
      throw appError('SEO_GSC_OAUTH_FAILED');
    }
    oauth2.setCredentials(tokens);
    const site = await this.sitesRepository.findOne({
      where: { id: payload.siteId, projectId: payload.projectId },
    });
    if (!site) {
      throw appError('SEO_SITE_NOT_FOUND');
    }
    const propertyUri = await this.matchPropertyUri(oauth2, site.hostname);
    await this.sitesRepository.update(site.id, {
      gscRefreshToken: tokens.refresh_token,
      gscPropertyUri: propertyUri,
    });
    return {
      orgId: payload.orgId,
      projectId: payload.projectId,
      siteId: site.id,
    };
  }

  async fetchKeywords(
    siteId: string,
    dto: SeoKeywordsDto,
  ): Promise<{ rows: SeoGscRowView[]; rangeStart: string; rangeEnd: string }> {
    const site = await this.sitesRepository
      .createQueryBuilder('site')
      .addSelect('site.gscRefreshToken')
      .where('site.id = :siteId', { siteId })
      .getOne();
    if (!site) throw appError('SEO_SITE_NOT_FOUND');
    if (!site.gscRefreshToken) {
      throw appError('SEO_GSC_NOT_CONNECTED');
    }

    const { rangeStart, rangeEnd } = this.resolveRange(dto);
    const oauth2 = this.createOAuthClient();
    oauth2.setCredentials({ refresh_token: site.gscRefreshToken });

    const searchconsole = google.searchconsole({ version: 'v1', auth: oauth2 });
    const siteUrl =
      site.gscPropertyUri ??
      `https://${site.hostname}/`;

    const fetchedAt = new Date();
    const rows: ProjectSeoGscRow[] = [];
    for (const dimension of ['query', 'page'] as const) {
      let data;
      try {
        data = await searchconsole.searchanalytics.query({
          siteUrl,
          requestBody: {
            startDate: rangeStart,
            endDate: rangeEnd,
            dimensions: [dimension],
            rowLimit: 1000,
          },
        });
      } catch {
        throw appError('SEO_GSC_OAUTH_FAILED');
      }
      for (const row of data.data.rows ?? []) {
        const value = row.keys?.[0] ?? '';
        rows.push(
          this.gscRowsRepository.create({
            siteId,
            dimension,
            value,
            clicks: Math.round(row.clicks ?? 0),
            impressions: Math.round(row.impressions ?? 0),
            ctr: row.ctr ?? 0,
            position: row.position ?? 0,
            rangeStart,
            rangeEnd,
            fetchedAt,
          }),
        );
      }
    }

    await this.gscRowsRepository.delete({
      siteId,
      rangeStart,
      rangeEnd,
    });
    const saved = rows.length ? await this.gscRowsRepository.save(rows) : [];
    return {
      rangeStart,
      rangeEnd,
      rows: saved.map((row) => ({
        id: row.id,
        siteId: row.siteId,
        dimension: row.dimension,
        value: row.value,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
        rangeStart: row.rangeStart,
        rangeEnd: row.rangeEnd,
        fetchedAt: row.fetchedAt,
      })),
    };
  }

  frontendRedirectUrl(params: {
    orgId: string;
    projectId: string;
    siteId: string;
  }): string {
    const origin =
      this.configService.get<string>('CORS_ORIGIN') ?? 'http://localhost:5173';
    return `${origin.replace(/\/+$/, '')}/organizations/${params.orgId}/projects/${params.projectId}/seo/${params.siteId}`;
  }

  private createOAuthClient() {
    const clientId = this.configService.get<string>('GOOGLE_GSC_CLIENT_ID');
    const clientSecret = this.configService.get<string>(
      'GOOGLE_GSC_CLIENT_SECRET',
    );
    const redirectUri = this.configService.get<string>(
      'GOOGLE_GSC_REDIRECT_URI',
    );
    if (!clientId || !clientSecret || !redirectUri) {
      throw appError('SEO_GSC_NOT_CONFIGURED');
    }
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  private signState(payload: GscState): string {
    const body = Buffer.from(JSON.stringify(payload), 'utf8').toString(
      'base64url',
    );
    const sig = createHmac('sha256', this.stateSecret()).update(body).digest('base64url');
    return `${body}.${sig}`;
  }

  private verifyState(state: string): GscState {
    const [body, sig] = state.split('.');
    if (!body || !sig) throw appError('SEO_GSC_OAUTH_FAILED');
    const expected = createHmac('sha256', this.stateSecret())
      .update(body)
      .digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expected);
    if (
      sigBuf.length !== expectedBuf.length ||
      !timingSafeEqual(sigBuf, expectedBuf)
    ) {
      throw appError('SEO_GSC_OAUTH_FAILED');
    }
    let payload: GscState;
    try {
      payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    } catch {
      throw appError('SEO_GSC_OAUTH_FAILED');
    }
    if (
      !payload.siteId ||
      !payload.orgId ||
      !payload.projectId ||
      payload.exp < Date.now()
    ) {
      throw appError('SEO_GSC_OAUTH_FAILED');
    }
    return payload;
  }

  private stateSecret(): string {
    return this.configService.get<string>('JWT_SECRET', 'change-me');
  }

  private resolveRange(dto: SeoKeywordsDto): {
    rangeStart: string;
    rangeEnd: string;
  } {
    if (dto.rangeStart && dto.rangeEnd) {
      return {
        rangeStart: dto.rangeStart.slice(0, 10),
        rangeEnd: dto.rangeEnd.slice(0, 10),
      };
    }
    const end = new Date();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 28);
    return {
      rangeStart: start.toISOString().slice(0, 10),
      rangeEnd: end.toISOString().slice(0, 10),
    };
  }

  private async matchPropertyUri(
    oauth2: InstanceType<typeof google.auth.OAuth2>,
    hostname: string,
  ): Promise<string | null> {
    try {
      const searchconsole = google.searchconsole({ version: 'v1', auth: oauth2 });
      const listed = await searchconsole.sites.list();
      const entries = listed.data.siteEntry ?? [];
      const httpsUri = `https://${hostname}/`;
      const scDomain = `sc-domain:${hostname}`;
      const match = entries.find((entry) => {
        const url = (entry.siteUrl ?? '').toLowerCase();
        return (
          url === httpsUri.toLowerCase() ||
          url === `http://${hostname}/` ||
          url === scDomain.toLowerCase()
        );
      });
      return match?.siteUrl ?? httpsUri;
    } catch {
      return `https://${hostname}/`;
    }
  }
}
