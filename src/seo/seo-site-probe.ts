import { SEO_CRAWL_UA } from './seo-crawl.service';
import { assertPublicHttpUrl } from './seo-host.util';

export type SeoAddressVariant = {
  url: string;
  finalUrl: string | null;
  status: number | null;
  ok: boolean | null;
};

export type SeoSiteProbe = {
  llmsTxt: 'found' | 'missing' | 'unknown';
  canonicalOrigin: string | null;
  addressVariants: SeoAddressVariant[] | null;
};

const MAX_HOPS = 5;
const TIMEOUT_MS = 8000;

type ProbeHit = {
  status: number;
  finalUrl: string;
  contentType: string | null;
};

async function probeUrl(startUrl: string): Promise<ProbeHit | null> {
  let url = startUrl;
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const check = await assertPublicHttpUrl(url);
    if (!check.ok) return null;
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        headers: { 'user-agent': SEO_CRAWL_UA },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      return null;
    }
    try {
      const status = response.status;
      const contentType = response.headers.get('content-type');
      const location = response.headers.get('location');
      if (status >= 300 && status < 400 && location) {
        try {
          url = new URL(location, url).href;
        } catch {
          return null;
        }
        continue;
      }
      return { status, finalUrl: url, contentType };
    } finally {
      await response.body?.cancel().catch(() => undefined);
    }
  }
  return null;
}

function classifyLlms(hit: ProbeHit | null): SeoSiteProbe['llmsTxt'] {
  if (!hit) return 'unknown';
  if (hit.status === 404 || hit.status === 410) return 'missing';
  if (hit.status !== 200) return 'unknown';
  const type = (hit.contentType ?? '').toLowerCase();
  if (!type) return 'unknown';
  if (type.includes('text/html') || type.includes('application/xhtml')) {
    return 'missing';
  }
  return 'found';
}

function variantFrom(
  url: string,
  hit: ProbeHit | null,
  origin: string,
): SeoAddressVariant {
  if (!hit) return { url, finalUrl: null, status: null, ok: null };
  let finalOrigin: string | null = null;
  try {
    finalOrigin = new URL(hit.finalUrl).origin;
  } catch {
    finalOrigin = null;
  }
  return {
    url,
    finalUrl: hit.finalUrl,
    status: hit.status,
    ok: finalOrigin === origin && hit.status < 400,
  };
}

export async function probeSite(hostname: string): Promise<SeoSiteProbe> {
  const homeUrl = `https://${hostname}/`;
  const home = await probeUrl(homeUrl);
  const homeOk = home !== null && home.status < 400;
  let origin = `https://${hostname}`;
  if (homeOk) {
    try {
      origin = new URL(home.finalUrl).origin;
    } catch {
      origin = `https://${hostname}`;
    }
  }

  const llmsTxt = classifyLlms(await probeUrl(`${origin}/llms.txt`));
  const originIsHttps = (() => {
    try {
      return new URL(origin).protocol === 'https:';
    } catch {
      return false;
    }
  })();

  if (!homeOk || !originIsHttps) {
    return {
      llmsTxt,
      canonicalOrigin: homeOk ? origin : null,
      addressVariants: null,
    };
  }

  const apex = hostname.replace(/^www\./i, '');
  const urls = [
    `http://${apex}/`,
    `http://www.${apex}/`,
    `https://${apex}/`,
    `https://www.${apex}/`,
  ];
  const addressVariants: SeoAddressVariant[] = [];
  for (const url of urls) {
    const hit = url === homeUrl ? home : await probeUrl(url);
    addressVariants.push(variantFrom(url, hit, origin));
  }

  return { llmsTxt, canonicalOrigin: origin, addressVariants };
}
