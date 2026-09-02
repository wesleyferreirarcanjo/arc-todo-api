import { Injectable } from '@nestjs/common';
import { CheerioCrawler } from '@crawlee/cheerio';
import { log } from '@crawlee/core';
import type { CheerioAPI } from 'cheerio';
import { mkdtempSync } from 'fs';
import ogs from 'open-graph-scraper';
import { tmpdir } from 'os';
import { join } from 'path';
import robotsParser from 'robots-parser';
import type { Graph, Thing, WithContext } from 'schema-dts';
import { Readable } from 'stream';
import {
  assertPublicHttpUrl,
  homepageUrl,
  isSameHostname,
} from './seo-host.util';

export const SEO_CRAWL_UA = 'ArcTodoSeoBot/1.0';

export type SeoPageRecord = {
  url: string;
  statusCode: number | null;
  redirectTo: string | null;
  title: string;
  metaDescription: string;
  ogOk: boolean;
  jsonldOk: boolean;
  robotsAllowed: boolean;
  inSitemap: boolean;
  brokenLink: boolean;
};

export type SeoCrawlResult = {
  robotsTxt: string | null;
  sitemapUrls: string[];
  pages: SeoPageRecord[];
};

export class SeoCrawlError extends Error {
  constructor(
    readonly code: 'SEO_ROBOTS_DISALLOWED' | 'SEO_CRAWL_FAILED' | 'SEO_SSRF_BLOCKED',
  ) {
    super(code);
  }
}

type JsonLdDoc = Thing | WithContext<Thing> | Graph;

function isJsonLdDoc(value: unknown): value is JsonLdDoc {
  return typeof value === 'object' && value !== null;
}

function parseJsonLd($: CheerioAPI): boolean {
  const scripts = $('script[type="application/ld+json"]')
    .toArray()
    .map((el) => $(el).contents().text())
    .filter(Boolean);
  for (const text of scripts) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (Array.isArray(parsed) ? parsed.some(isJsonLdDoc) : isJsonLdDoc(parsed)) {
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

async function ogOkFromHtml(url: string, html: string): Promise<boolean> {
  try {
    const scraped = await ogs({ url, html, timeout: 5 });
    if (scraped.error) return false;
    const result = scraped.result;
    return Boolean(result.ogTitle || result.ogImage || result.ogDescription);
  } catch {
    return false;
  }
}

async function fetchPublicText(url: string): Promise<{
  status: number;
  body: string;
  redirectTo: string | null;
}> {
  const check = await assertPublicHttpUrl(url);
  if (!check.ok) {
    throw new SeoCrawlError(
      check.reason === 'ssrf' ? 'SEO_SSRF_BLOCKED' : 'SEO_CRAWL_FAILED',
    );
  }
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'manual',
    headers: { 'user-agent': SEO_CRAWL_UA },
    signal: AbortSignal.timeout(15000),
  });
  const location = response.headers.get('location');
  let redirectTo: string | null = null;
  if (location && response.status >= 300 && response.status < 400) {
    try {
      redirectTo = new URL(location, url).href;
    } catch {
      redirectTo = location;
    }
  }
  const body = await response.text();
  return { status: response.status, body, redirectTo };
}

async function loadSitemapUrls(
  xml: string,
  hostname: string,
  remaining: number,
): Promise<string[]> {
  const { parseSitemap, parseSitemapIndex } = await import('sitemap');
  const collect: string[] = [];
  try {
    const items = await parseSitemap(Readable.from([xml]));
    for (const item of items) {
      if (item.url && isSameHostname(item.url, hostname)) {
        collect.push(item.url);
      }
    }
    if (collect.length) return collect.slice(0, remaining);
  } catch {
    // try index
  }
  try {
    const index = await parseSitemapIndex(Readable.from([xml]));
    for (const entry of index) {
      if (!entry.url || collect.length >= remaining) break;
      if (!isSameHostname(entry.url, hostname)) continue;
      try {
        const child = await fetchPublicText(entry.url);
        if (child.status >= 400) continue;
        const nested = await loadSitemapUrls(
          child.body,
          hostname,
          remaining - collect.length,
        );
        collect.push(...nested);
      } catch {
        continue;
      }
    }
  } catch {
    return collect;
  }
  return collect.slice(0, remaining);
}

@Injectable()
export class SeoCrawlService {
  async crawlSite(
    hostname: string,
    maxPages: number,
  ): Promise<SeoCrawlResult> {
    const startUrl = homepageUrl(hostname);
    const startCheck = await assertPublicHttpUrl(startUrl);
    if (!startCheck.ok) {
      throw new SeoCrawlError(
        startCheck.reason === 'ssrf' ? 'SEO_SSRF_BLOCKED' : 'SEO_CRAWL_FAILED',
      );
    }

    let robotsTxt: string | null = null;
    let robots = robotsParser(new URL('/robots.txt', startUrl).href, '');
    try {
      const robotsRes = await fetchPublicText(new URL('/robots.txt', startUrl).href);
      if (robotsRes.status < 400) {
        robotsTxt = robotsRes.body;
        robots = robotsParser(new URL('/robots.txt', startUrl).href, robotsTxt);
      }
    } catch (error) {
      if (error instanceof SeoCrawlError && error.code === 'SEO_SSRF_BLOCKED') {
        throw error;
      }
    }

    if (robots.isDisallowed(startUrl, SEO_CRAWL_UA)) {
      throw new SeoCrawlError('SEO_ROBOTS_DISALLOWED');
    }

    const sitemapSeeds = new Set<string>(robots.getSitemaps());
    sitemapSeeds.add(new URL('/sitemap.xml', startUrl).href);
    sitemapSeeds.add(new URL('/sitemap_index.xml', startUrl).href);

    const sitemapUrls: string[] = [];
    for (const seed of sitemapSeeds) {
      if (!isSameHostname(seed, hostname)) continue;
      if (sitemapUrls.length >= maxPages) break;
      try {
        const res = await fetchPublicText(seed);
        if (res.status >= 400) continue;
        const found = await loadSitemapUrls(
          res.body,
          hostname,
          maxPages - sitemapUrls.length,
        );
        for (const url of found) {
          if (!sitemapUrls.includes(url)) sitemapUrls.push(url);
        }
      } catch {
        continue;
      }
    }

    const sitemapSet = new Set(
      sitemapUrls.map((url) => url.replace(/\/+$/, '') || url),
    );
    const pages: SeoPageRecord[] = [];
    const seen = new Set<string>();

    const storageDir = mkdtempSync(join(tmpdir(), 'arc-seo-'));
    process.env.CRAWLEE_STORAGE_DIR = storageDir;

    log.setLevel(log.LEVELS.OFF);

    const crawler = new CheerioCrawler({
      maxRequestsPerCrawl: maxPages,
      maxConcurrency: 2,
      requestHandlerTimeoutSecs: 30,
      navigationTimeoutSecs: 20,
      additionalHttpErrorStatusCodes: [],
      ignoreSslErrors: false,
      additionalMimeTypes: ['application/xml', 'text/xml', 'text/plain'],
      preNavigationHooks: [
        async ({ request }) => {
          const check = await assertPublicHttpUrl(request.url);
          if (!check.ok) {
            throw new SeoCrawlError('SEO_SSRF_BLOCKED');
          }
          if (!isSameHostname(request.url, hostname)) {
            throw new Error('off-host');
          }
        },
      ],
      async requestHandler({ request, $, response, enqueueLinks }) {
        if (pages.length >= maxPages) return;
        const url = request.loadedUrl ?? request.url;
        if (seen.has(url)) return;
        seen.add(url);
        const statusCode = response.statusCode ?? null;
        const html = $.root().html() ?? '';
        const title = $('title').first().text().trim();
        const metaDescription = (
          $('meta[name="description"]').attr('content') ??
          $('meta[property="og:description"]').attr('content') ??
          ''
        ).trim();
        const robotsAllowed = robots.isAllowed(url, SEO_CRAWL_UA) !== false;
        const inSitemap = sitemapSet.has(url.replace(/\/+$/, '') || url);
        const brokenLink = statusCode !== null && statusCode >= 400;
        pages.push({
          url,
          statusCode,
          redirectTo: request.loadedUrl && request.loadedUrl !== request.url
            ? request.loadedUrl
            : null,
          title,
          metaDescription,
          ogOk: await ogOkFromHtml(url, html),
          jsonldOk: parseJsonLd($),
          robotsAllowed,
          inSitemap,
          brokenLink,
        });

        if (pages.length >= maxPages) return;
        await enqueueLinks({
          strategy: 'same-hostname',
          transformRequestFunction: (req) => {
            if (!robotsAllowed || robots.isDisallowed(req.url, SEO_CRAWL_UA)) {
              return false;
            }
            if (!isSameHostname(req.url, hostname)) return false;
            return req;
          },
        });
      },
      async failedRequestHandler({ request }, error) {
        if (pages.length >= maxPages) return;
        const url = request.url;
        if (seen.has(url)) return;
        if (error instanceof SeoCrawlError && error.code === 'SEO_SSRF_BLOCKED') {
          return;
        }
        seen.add(url);
        pages.push({
          url,
          statusCode: null,
          redirectTo: null,
          title: '',
          metaDescription: '',
          ogOk: false,
          jsonldOk: false,
          robotsAllowed: robots.isAllowed(url, SEO_CRAWL_UA) !== false,
          inSitemap: sitemapSet.has(url.replace(/\/+$/, '') || url),
          brokenLink: true,
        });
      },
    });

    try {
      const startRequests = [{ url: startUrl }];
      for (const url of sitemapUrls) {
        if (startRequests.length >= maxPages) break;
        if (robots.isDisallowed(url, SEO_CRAWL_UA)) continue;
        if (!startRequests.some((item) => item.url === url)) {
          startRequests.push({ url });
        }
      }
      await crawler.run(startRequests);
    } catch (error) {
      if (error instanceof SeoCrawlError) throw error;
      throw new SeoCrawlError('SEO_CRAWL_FAILED');
    }

    if (!pages.length) {
      throw new SeoCrawlError('SEO_CRAWL_FAILED');
    }

    return { robotsTxt, sitemapUrls, pages };
  }
}
