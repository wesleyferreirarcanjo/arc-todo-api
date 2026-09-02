import { existsSync } from 'fs';
import { Injectable } from '@nestjs/common';
import { APP_ERRORS } from '../errors/app-errors';
import { assertPublicHttpUrl } from './seo-host.util';

export type SeoLighthouseResult = {
  url: string;
  lcp: number | null;
  cls: number | null;
  inp: number | null;
  categories: Record<string, unknown>;
  keyAudits: Record<string, unknown>;
  errorCode: string | null;
};

const KEY_AUDIT_IDS = [
  'largest-contentful-paint',
  'cumulative-layout-shift',
  'interaction-to-next-paint',
  'max-potential-fid',
  'first-contentful-paint',
  'speed-index',
  'total-blocking-time',
  'document-title',
  'meta-description',
  'is-crawlable',
] as const;

function chromeMissingResult(url: string): SeoLighthouseResult {
  return {
    url,
    lcp: null,
    cls: null,
    inp: null,
    categories: {},
    keyAudits: {},
    errorCode: APP_ERRORS.SEO_CHROME_MISSING.code,
  };
}

function resolveChromePath(): string | undefined {
  const fromEnv = process.env.CHROME_PATH || process.env.CHROMIUM_PATH;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  for (const candidate of [
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return fromEnv;
}

@Injectable()
export class SeoLighthouseService {
  async runHomepage(url: string): Promise<SeoLighthouseResult> {
    const check = await assertPublicHttpUrl(url);
    if (!check.ok) {
      return chromeMissingResult(url);
    }

    try {
      const [chromeLauncher, lighthouseMod] = await Promise.all([
        import('chrome-launcher'),
        import('lighthouse'),
      ]);
      const lighthouse =
        lighthouseMod.default ??
        (lighthouseMod as unknown as {
          default?: typeof lighthouseMod.default;
        }).default;
      if (typeof lighthouse !== 'function') {
        return chromeMissingResult(url);
      }

      const chromePath = resolveChromePath();
      const chrome = await chromeLauncher.launch({
        chromeFlags: [
          '--headless=new',
          '--no-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
        ],
        ...(chromePath ? { chromePath } : {}),
      });

      try {
        const result = await lighthouse(url, {
          port: chrome.port,
          output: 'json',
          logLevel: 'silent',
        });
        if (!result?.lhr) {
          return chromeMissingResult(url);
        }
        const lhr = result.lhr;
        const audits = lhr.audits ?? {};
        const categories: Record<string, unknown> = {};
        for (const [id, category] of Object.entries(lhr.categories ?? {})) {
          categories[id] = {
            title: category.title,
            score: category.score,
          };
        }
        const keyAudits: Record<string, unknown> = {};
        for (const id of KEY_AUDIT_IDS) {
          const audit = audits[id];
          if (!audit) continue;
          keyAudits[id] = {
            title: audit.title,
            score: audit.score,
            numericValue: audit.numericValue ?? null,
            displayValue: audit.displayValue ?? null,
          };
        }
        return {
          url,
          lcp: audits['largest-contentful-paint']?.numericValue ?? null,
          cls: audits['cumulative-layout-shift']?.numericValue ?? null,
          inp:
            audits['interaction-to-next-paint']?.numericValue ??
            audits['max-potential-fid']?.numericValue ??
            null,
          categories,
          keyAudits,
          errorCode: null,
        };
      } finally {
        await chrome.kill();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        /chrome|chromium|unable to (find|connect)|ENOENT|not installed|Could not find/i.test(
          message,
        )
      ) {
        return chromeMissingResult(url);
      }
      return {
        url,
        lcp: null,
        cls: null,
        inp: null,
        categories: {},
        keyAudits: {},
        errorCode: APP_ERRORS.SEO_CHROME_MISSING.code,
      };
    }
  }
}
