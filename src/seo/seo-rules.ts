import robotsParser from 'robots-parser';
import { SEO_CRAWL_UA } from './seo-crawl.service';
import type { SeoSiteProbe } from './seo-site-probe';

export type SeoFindingBucket = 'fix-now' | 'watch' | 'passed' | 'not-evaluated';

export type SeoFinding = {
  ruleId: string;
  bucket: SeoFindingBucket;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  why: string;
  fix: string;
  affected: Array<{ url: string; detail: string }>;
  note: string | null;
};

export type SeoRulePage = {
  url: string;
  statusCode: number | null;
  title: string;
  metaDescription: string;
  ogOk: boolean;
  jsonldOk: boolean;
  robotsAllowed: boolean;
  inSitemap: boolean;
  brokenLink: boolean;
  h1Count: number | null;
  canonical: string | null;
  wordCount: number | null;
  noindex: boolean | null;
};

export type SeoRuleLighthouse = {
  lcp: number | null;
  cls: number | null;
  categories: Record<string, unknown>;
  errorCode: string | null;
};

export type SeoRuleInput = {
  pages: SeoRulePage[];
  sitemapUrls: string[];
  robotsTxt: string | null;
  siteProbe: SeoSiteProbe | null;
  lighthouse: SeoRuleLighthouse | null;
};

const LEGACY_NOTE = 'Run a new audit to check this.';

const COPY: Record<string, { title: string; why: string; fix: string }> = {
  'sitemap-conflicts': {
    title: 'Sitemap entries conflict with crawling rules.',
    why: 'A URL listed in the sitemap but blocked or marked noindex sends mixed signals about whether it should be indexed.',
    fix: 'Remove blocked or noindex URLs from the sitemap, or allow those URLs to be crawled and indexed.',
  },
  'broken-pages': {
    title: 'Some crawled pages return an error.',
    why: 'Broken URLs waste crawl attention and can drop those pages from search results.',
    fix: 'Restore each broken URL or redirect it to a working page, then run the audit again.',
  },
  'title-missing-or-weak': {
    title: 'Page titles are missing, the wrong length, or repeated.',
    why: 'The title is the main line people see in search results, so a weak one earns fewer clicks.',
    fix: 'Give each indexable page one unique title between 10 and 60 characters.',
  },
  'meta-description-weak': {
    title: 'Meta descriptions are missing, too long, or repeated.',
    why: 'The meta description is the snippet under the title, and a weak one is often rewritten or ignored.',
    fix: 'Write a unique description of at most 160 characters for each indexable page.',
  },
  'headings-weak': {
    title: 'Pages are missing a single H1 heading.',
    why: 'One clear H1 tells readers and search engines what the page is about.',
    fix: 'Use exactly one H1 that states the page topic, and use lower headings for sections.',
  },
  'canonical-issues': {
    title: 'Canonical links are missing or point at another host.',
    why: 'A missing or cross-host canonical leaves it unclear which URL should be indexed.',
    fix: 'Add a canonical link on each page that points at that page on the same host.',
  },
  'thin-content': {
    title: 'Some pages have very little text.',
    why: 'Pages under 200 words rarely answer a search query well enough to rank.',
    fix: 'Expand thin pages with useful original text, or noindex them if they should not rank.',
  },
  'structured-data-missing': {
    title: 'Some pages have no JSON-LD structured data.',
    why: 'Structured data helps search engines understand the page and can enable rich results.',
    fix: 'Add a valid JSON-LD script that describes the main content of each page.',
  },
  'open-graph-missing': {
    title: 'Some pages have no Open Graph tags.',
    why: 'Without Open Graph tags, links shared on social sites show a plain or wrong preview.',
    fix: 'Add og:title, og:description, and og:image tags to each page.',
  },
  'not-in-sitemap': {
    title: 'Indexable pages are missing from the sitemap.',
    why: 'Pages left out of the sitemap are discovered more slowly.',
    fix: 'Add every indexable URL to the sitemap.',
  },
  'sitemap-missing-or-weak': {
    title: 'The site has no sitemap, or robots.txt does not advertise one.',
    why: 'Search engines use a sitemap, and a Sitemap line in robots.txt, to find pages.',
    fix: 'Publish a sitemap and add a Sitemap line in robots.txt that points at it.',
  },
  'llms-txt-missing': {
    title: 'The site has no llms.txt file.',
    why: 'llms.txt is a plain-text index that tells AI crawlers which pages you want them to read.',
    fix: 'Publish /llms.txt as plain text with links to the pages that matter.',
  },
  'https-redirects': {
    title: 'Not every address variant ends on the canonical site.',
    why: 'http and www variants that do not land on one https origin split ranking signals.',
    fix: 'Redirect every http and www variant to the single https origin.',
  },
  'page-speed-lab': {
    title: 'The homepage lab estimate looks slow.',
    why: 'This lab estimate shows a performance score under 0.5, an LCP over 4 seconds, or a CLS over 0.25.',
    fix: 'Speed up the largest element and reduce layout shifts on the homepage, then audit again.',
  },
  'accessibility-lab': {
    title: 'The homepage accessibility lab score is low.',
    why: 'A low accessibility score means some people cannot use the homepage reliably.',
    fix: 'Fix the failed accessibility checks and aim for a lab score of at least 0.9.',
  },
};

const BUCKET_RANK: Record<SeoFindingBucket, number> = {
  'fix-now': 0,
  watch: 1,
  'not-evaluated': 2,
  passed: 3,
};

const SEVERITY_RANK: Record<SeoFinding['severity'], number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

type Issue = { url: string; detail: string; level: 'critical' | 'warning' };

function isIndexable(page: SeoRulePage): boolean {
  return (
    page.statusCode !== null &&
    page.statusCode >= 200 &&
    page.statusCode <= 299 &&
    page.robotsAllowed &&
    page.noindex !== true
  );
}

function parsed(page: SeoRulePage): boolean {
  return page.wordCount !== null;
}

function severityFor(
  ruleId: string,
  bucket: SeoFindingBucket,
): SeoFinding['severity'] {
  if (ruleId === 'llms-txt-missing') return 'info';
  if (bucket === 'fix-now') return 'critical';
  if (bucket === 'watch') return 'warning';
  return 'info';
}

function make(
  ruleId: string,
  bucket: SeoFindingBucket,
  affected: Array<{ url: string; detail: string }>,
  note: string | null,
): SeoFinding {
  const copy = COPY[ruleId];
  return {
    ruleId,
    bucket,
    severity: severityFor(ruleId, bucket),
    title: copy.title,
    why: copy.why,
    fix: copy.fix,
    affected: bucket === 'passed' || bucket === 'not-evaluated' ? [] : affected,
    note,
  };
}

function fromIssues(ruleId: string, issues: Issue[]): SeoFinding {
  const bucket = issues.some((issue) => issue.level === 'critical')
    ? 'fix-now'
    : issues.length
      ? 'watch'
      : 'passed';
  return make(
    ruleId,
    bucket,
    issues.map(({ url, detail }) => ({ url, detail })),
    null,
  );
}

function legacyOr(ruleId: string, legacy: boolean, issues: Issue[]): SeoFinding {
  if (legacy) return make(ruleId, 'not-evaluated', [], LEGACY_NOTE);
  return fromIssues(ruleId, issues);
}

function categoryScore(
  categories: Record<string, unknown> | undefined,
  key: string,
): number | null {
  const cat = categories?.[key];
  if (!cat || typeof cat !== 'object') return null;
  const score = (cat as { score?: unknown }).score;
  return typeof score === 'number' ? score : null;
}

function siteOrigin(input: SeoRuleInput): string {
  const sample =
    input.pages[0]?.url ??
    input.sitemapUrls[0] ??
    input.siteProbe?.canonicalOrigin ??
    '';
  try {
    return new URL(sample).origin;
  } catch {
    return 'https://invalid.invalid';
  }
}

function sitemapConflicts(input: SeoRuleInput): SeoFinding {
  const robots = robotsParser(
    `${siteOrigin(input)}/robots.txt`,
    input.robotsTxt ?? '',
  );
  const reasons = new Map<string, string[]>();
  const add = (url: string, reason: string) => {
    const list = reasons.get(url) ?? [];
    if (!list.includes(reason)) list.push(reason);
    reasons.set(url, list);
  };
  for (const url of input.sitemapUrls) {
    if (robots.isDisallowed(url, SEO_CRAWL_UA) === true) {
      add(url, 'disallowed by robots.txt');
    }
  }
  for (const page of input.pages) {
    if (page.inSitemap && page.noindex === true) {
      add(page.url, 'noindex but listed in the sitemap');
    }
  }
  const affected = [...reasons.entries()].map(([url, list]) => ({
    url,
    detail: list.join('; '),
  }));
  return fromIssues(
    'sitemap-conflicts',
    affected.map((item) => ({ ...item, level: 'critical' as const })),
  );
}

function titleIssues(pages: SeoRulePage[]): Issue[] {
  const indexable = pages.filter(isIndexable);
  const counts = new Map<string, number>();
  for (const page of indexable) {
    const title = page.title.trim();
    if (!title) continue;
    counts.set(title, (counts.get(title) ?? 0) + 1);
  }
  const issues: Issue[] = [];
  for (const page of indexable) {
    const title = page.title.trim();
    if (!title) {
      issues.push({ url: page.url, detail: 'missing', level: 'critical' });
      continue;
    }
    const reasons: string[] = [];
    if (title.length < 10) reasons.push(`too short (${title.length} chars)`);
    else if (title.length > 60) reasons.push(`too long (${title.length} chars)`);
    if ((counts.get(title) ?? 0) >= 2) reasons.push('duplicate title');
    if (!reasons.length) continue;
    issues.push({ url: page.url, detail: reasons.join('; '), level: 'warning' });
  }
  return issues;
}

function metaIssues(pages: SeoRulePage[]): Issue[] {
  const indexable = pages.filter(isIndexable);
  const counts = new Map<string, number>();
  for (const page of indexable) {
    const description = page.metaDescription.trim();
    if (!description) continue;
    counts.set(description, (counts.get(description) ?? 0) + 1);
  }
  const issues: Issue[] = [];
  for (const page of indexable) {
    const description = page.metaDescription.trim();
    const reasons: string[] = [];
    if (!description) reasons.push('missing');
    else if (description.length > 160) {
      reasons.push(`too long (${description.length} chars)`);
    }
    if (description && (counts.get(description) ?? 0) >= 2) {
      reasons.push('duplicate description');
    }
    if (!reasons.length) continue;
    issues.push({ url: page.url, detail: reasons.join('; '), level: 'warning' });
  }
  return issues;
}

function headingIssues(pages: SeoRulePage[]): Issue[] {
  const issues: Issue[] = [];
  for (const page of pages) {
    if (!parsed(page) || page.h1Count === null) continue;
    if (page.h1Count === 0) {
      issues.push({ url: page.url, detail: '0 H1 tags', level: 'critical' });
    } else if (page.h1Count >= 2) {
      issues.push({
        url: page.url,
        detail: `${page.h1Count} H1 tags`,
        level: 'warning',
      });
    }
  }
  return issues;
}

function canonicalIssues(pages: SeoRulePage[]): Issue[] {
  const issues: Issue[] = [];
  for (const page of pages) {
    if (!parsed(page)) continue;
    if (!page.canonical) {
      issues.push({ url: page.url, detail: 'missing', level: 'warning' });
      continue;
    }
    let canonicalHost: string;
    try {
      canonicalHost = new URL(page.canonical).hostname;
    } catch {
      issues.push({ url: page.url, detail: 'unparseable', level: 'critical' });
      continue;
    }
    let pageHost: string;
    try {
      pageHost = new URL(page.url).hostname;
    } catch {
      issues.push({ url: page.url, detail: 'unparseable', level: 'critical' });
      continue;
    }
    if (canonicalHost !== pageHost) {
      issues.push({
        url: page.url,
        detail: `canonical → ${canonicalHost}`,
        level: 'critical',
      });
    }
  }
  return issues;
}

function thinIssues(pages: SeoRulePage[]): Issue[] {
  const issues: Issue[] = [];
  for (const page of pages) {
    if (page.wordCount === null || page.wordCount >= 200) continue;
    issues.push({
      url: page.url,
      detail: `${page.wordCount} words`,
      level: 'warning',
    });
  }
  return issues;
}

function flagIssues(
  pages: SeoRulePage[],
  flag: 'jsonldOk' | 'ogOk',
  detail: string,
): Issue[] {
  return pages
    .filter(
      (page) =>
        parsed(page) &&
        page.statusCode !== null &&
        page.statusCode >= 200 &&
        page.statusCode <= 299 &&
        !page[flag],
    )
    .map((page) => ({ url: page.url, detail, level: 'warning' as const }));
}

function notInSitemap(input: SeoRuleInput): SeoFinding {
  if (input.sitemapUrls.length === 0) {
    return make('not-in-sitemap', 'not-evaluated', [], null);
  }
  const affected = input.pages
    .filter((page) => isIndexable(page) && !page.inSitemap)
    .map((page) => ({ url: page.url, detail: 'not in sitemap' }));
  return make(
    'not-in-sitemap',
    affected.length ? 'watch' : 'passed',
    affected,
    null,
  );
}

function sitemapFile(input: SeoRuleInput): SeoFinding {
  if (input.sitemapUrls.length === 0) {
    return make('sitemap-missing-or-weak', 'fix-now', [], null);
  }
  const advertised =
    input.robotsTxt !== null && /^\s*sitemap\s*:/im.test(input.robotsTxt);
  return make(
    'sitemap-missing-or-weak',
    advertised ? 'passed' : 'watch',
    [],
    null,
  );
}

function llmsFinding(probe: SeoSiteProbe | null): SeoFinding {
  if (!probe || probe.llmsTxt === 'unknown') {
    return make('llms-txt-missing', 'not-evaluated', [], null);
  }
  return make(
    'llms-txt-missing',
    probe.llmsTxt === 'missing' ? 'watch' : 'passed',
    [],
    null,
  );
}

function httpsFinding(probe: SeoSiteProbe | null): SeoFinding {
  const variants = probe?.addressVariants;
  if (!variants) return make('https-redirects', 'not-evaluated', [], null);
  const bad = variants.filter((variant) => variant.ok === false);
  if (!bad.length) return make('https-redirects', 'passed', [], null);
  const critical = bad.some((variant) => variant.url.startsWith('http://'));
  return make(
    'https-redirects',
    critical ? 'fix-now' : 'watch',
    bad.map((variant) => ({
      url: variant.url,
      detail: `${variant.url} → ${variant.finalUrl ?? 'unknown'} (${variant.status ?? 'unknown'})`,
    })),
    null,
  );
}

function speedFinding(lighthouse: SeoRuleLighthouse | null): SeoFinding {
  if (!lighthouse || lighthouse.errorCode) {
    return make('page-speed-lab', 'not-evaluated', [], null);
  }
  const score = categoryScore(lighthouse.categories, 'performance');
  if (score === null && lighthouse.lcp === null && lighthouse.cls === null) {
    return make('page-speed-lab', 'not-evaluated', [], null);
  }
  const slow =
    (score !== null && score < 0.5) ||
    (lighthouse.lcp !== null && lighthouse.lcp > 4000) ||
    (lighthouse.cls !== null && lighthouse.cls > 0.25);
  return make('page-speed-lab', slow ? 'watch' : 'passed', [], null);
}

function a11yFinding(lighthouse: SeoRuleLighthouse | null): SeoFinding {
  if (!lighthouse || lighthouse.errorCode) {
    return make('accessibility-lab', 'not-evaluated', [], null);
  }
  const score = categoryScore(lighthouse.categories, 'accessibility');
  if (score === null) return make('accessibility-lab', 'not-evaluated', [], null);
  const bucket: SeoFindingBucket =
    score < 0.7 ? 'fix-now' : score < 0.9 ? 'watch' : 'passed';
  return make('accessibility-lab', bucket, [], null);
}

export function evaluateSeoRules(input: SeoRuleInput): SeoFinding[] {
  const legacy = !input.pages.some((page) => page.wordCount !== null);
  const findings: SeoFinding[] = [
    sitemapConflicts(input),
    fromIssues(
      'broken-pages',
      input.pages
        .filter((page) => page.brokenLink)
        .map((page) => ({ url: page.url, detail: 'broken', level: 'critical' as const })),
    ),
    fromIssues('title-missing-or-weak', titleIssues(input.pages)),
    fromIssues('meta-description-weak', metaIssues(input.pages)),
    legacyOr('headings-weak', legacy, headingIssues(input.pages)),
    legacyOr('canonical-issues', legacy, canonicalIssues(input.pages)),
    legacyOr('thin-content', legacy, thinIssues(input.pages)),
    fromIssues(
      'structured-data-missing',
      flagIssues(input.pages, 'jsonldOk', 'missing'),
    ),
    fromIssues('open-graph-missing', flagIssues(input.pages, 'ogOk', 'missing')),
    notInSitemap(input),
    sitemapFile(input),
    llmsFinding(input.siteProbe),
    httpsFinding(input.siteProbe),
    speedFinding(input.lighthouse),
    a11yFinding(input.lighthouse),
  ];
  findings.sort((a, b) => {
    const byBucket = BUCKET_RANK[a.bucket] - BUCKET_RANK[b.bucket];
    if (byBucket) return byBucket;
    const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (bySeverity) return bySeverity;
    const byCount = b.affected.length - a.affected.length;
    if (byCount) return byCount;
    return a.ruleId.localeCompare(b.ruleId);
  });
  return findings;
}

if (require.main === module) {
  const HOME = 'https://example.com/';
  const ABOUT = 'https://example.com/about';
  const RULES = [
    'sitemap-conflicts',
    'broken-pages',
    'title-missing-or-weak',
    'meta-description-weak',
    'headings-weak',
    'canonical-issues',
    'thin-content',
    'structured-data-missing',
    'open-graph-missing',
    'not-in-sitemap',
    'sitemap-missing-or-weak',
    'llms-txt-missing',
    'https-redirects',
    'page-speed-lab',
    'accessibility-lab',
  ];

  const probe: SeoSiteProbe = {
    llmsTxt: 'found',
    canonicalOrigin: 'https://example.com',
    addressVariants: [
      { url: 'http://example.com/', finalUrl: 'https://example.com/', status: 301, ok: true },
      { url: 'http://www.example.com/', finalUrl: 'https://example.com/', status: 301, ok: true },
      { url: 'https://example.com/', finalUrl: 'https://example.com/', status: 200, ok: true },
      { url: 'https://www.example.com/', finalUrl: 'https://example.com/', status: 301, ok: true },
    ],
  };
  const lighthouse: SeoRuleLighthouse = {
    lcp: 1800,
    cls: 0.05,
    categories: {
      performance: { score: 0.91 },
      accessibility: { score: 0.95 },
    },
    errorCode: null,
  };
  const robots =
    'User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml\n';

  function page(url: string, overrides: Partial<SeoRulePage> = {}): SeoRulePage {
    const about = url.endsWith('/about');
    return {
      url,
      statusCode: 200,
      title: about ? 'Example about page title' : 'Example home page title',
      metaDescription: about
        ? 'Unique about meta description for example.com pages.'
        : 'Unique home meta description for example.com pages.',
      ogOk: true,
      jsonldOk: true,
      robotsAllowed: true,
      inSitemap: true,
      brokenLink: false,
      h1Count: 1,
      canonical: url,
      wordCount: 400,
      noindex: false,
      ...overrides,
    };
  }

  function run(overrides: Partial<SeoRuleInput> = {}): SeoFinding[] {
    return evaluateSeoRules({
      pages: [page(HOME), page(ABOUT)],
      sitemapUrls: [HOME, ABOUT],
      robotsTxt: robots,
      siteProbe: probe,
      lighthouse,
      ...overrides,
    });
  }

  function finding(list: SeoFinding[], ruleId: string): SeoFinding | undefined {
    return list.find((item) => item.ruleId === ruleId);
  }

  function bucket(list: SeoFinding[], ruleId: string): string {
    return finding(list, ruleId)?.bucket ?? 'missing';
  }

  const checks: Array<[string, boolean]> = [];
  const healthy = run();
  checks.push(['healthy emits every rule', healthy.length === RULES.length]);
  for (const ruleId of RULES) {
    const item = finding(healthy, ruleId);
    checks.push([
      `${ruleId} passes on a healthy site`,
      item?.bucket === 'passed' && item.affected.length === 0,
    ]);
  }

  const noindex = run({
    pages: [page(HOME, { noindex: true }), page(ABOUT)],
  });
  checks.push([
    'sitemap-conflicts fails when a sitemap page is noindex',
    bucket(noindex, 'sitemap-conflicts') === 'fix-now' &&
      finding(noindex, 'sitemap-conflicts')?.affected.some((item) => item.url === HOME) ===
        true,
  ]);

  const disallowed = run({
    robotsTxt: 'User-agent: *\nDisallow: /secret\nSitemap: https://example.com/sitemap.xml\n',
    sitemapUrls: [HOME, 'https://example.com/secret'],
  });
  checks.push([
    'sitemap-conflicts fails when robots blocks a sitemap URL',
    bucket(disallowed, 'sitemap-conflicts') === 'fix-now',
  ]);

  const broken = run({
    pages: [page(HOME, { brokenLink: true, statusCode: 500 }), page(ABOUT)],
  });
  checks.push(['broken-pages fails', bucket(broken, 'broken-pages') === 'fix-now']);

  const missingTitle = run({ pages: [page(HOME, { title: '  ' }), page(ABOUT)] });
  checks.push([
    'empty title is fix now',
    bucket(missingTitle, 'title-missing-or-weak') === 'fix-now' &&
      finding(missingTitle, 'title-missing-or-weak')?.affected[0]?.detail === 'missing',
  ]);
  const shortTitle = run({ pages: [page(HOME, { title: 'Short' }), page(ABOUT)] });
  checks.push([
    'short title is watch',
    bucket(shortTitle, 'title-missing-or-weak') === 'watch',
  ]);
  const titleTen = run({ pages: [page(HOME, { title: 'Ten chars!' }), page(ABOUT)] });
  const titleNine = run({ pages: [page(HOME, { title: 'Nine char' }), page(ABOUT)] });
  const titleSixty = run({ pages: [page(HOME, { title: 'A'.repeat(60) }), page(ABOUT)] });
  const titleLong = run({ pages: [page(HOME, { title: 'A'.repeat(61) }), page(ABOUT)] });
  checks.push([
    'title length bounds',
    bucket(titleTen, 'title-missing-or-weak') === 'passed' &&
      bucket(titleNine, 'title-missing-or-weak') === 'watch' &&
      bucket(titleSixty, 'title-missing-or-weak') === 'passed' &&
      bucket(titleLong, 'title-missing-or-weak') === 'watch' &&
      finding(titleLong, 'title-missing-or-weak')?.affected[0]?.detail ===
        'too long (61 chars)',
  ]);

  const missingMeta = run({
    pages: [page(HOME, { metaDescription: ' ' }), page(ABOUT)],
  });
  checks.push([
    'missing meta description is watch',
    bucket(missingMeta, 'meta-description-weak') === 'watch',
  ]);
  const meta160 = 'M'.repeat(160);
  const meta161 = 'M'.repeat(161);
  checks.push([
    'meta description length bound',
    bucket(
      run({ pages: [page(HOME, { metaDescription: meta160 }), page(ABOUT)] }),
      'meta-description-weak',
    ) === 'passed' &&
      bucket(
        run({ pages: [page(HOME, { metaDescription: meta161 }), page(ABOUT)] }),
        'meta-description-weak',
      ) === 'watch',
  ]);

  checks.push([
    'missing H1 is fix now',
    bucket(run({ pages: [page(HOME, { h1Count: 0 }), page(ABOUT)] }), 'headings-weak') ===
      'fix-now',
  ]);
  checks.push([
    'two H1s is watch',
    bucket(run({ pages: [page(HOME, { h1Count: 2 }), page(ABOUT)] }), 'headings-weak') ===
      'watch' &&
      finding(run({ pages: [page(HOME, { h1Count: 2 }), page(ABOUT)] }), 'headings-weak')
        ?.affected[0]?.detail === '2 H1 tags',
  ]);

  const otherHost = run({
    pages: [page(HOME, { canonical: 'https://other.com/page' }), page(ABOUT)],
  });
  checks.push([
    'cross-host canonical is fix now',
    bucket(otherHost, 'canonical-issues') === 'fix-now' &&
      finding(otherHost, 'canonical-issues')?.affected[0]?.detail === 'canonical → other.com',
  ]);
  checks.push([
    'missing canonical is watch',
    bucket(
      run({ pages: [page(HOME, { canonical: null }), page(ABOUT)] }),
      'canonical-issues',
    ) === 'watch',
  ]);
  checks.push([
    'unparseable canonical is fix now',
    bucket(
      run({ pages: [page(HOME, { canonical: '::::' }), page(ABOUT)] }),
      'canonical-issues',
    ) === 'fix-now',
  ]);

  checks.push([
    'thin content is watch under 200 words',
    bucket(run({ pages: [page(HOME, { wordCount: 199 }), page(ABOUT)] }), 'thin-content') ===
      'watch' &&
      finding(run({ pages: [page(HOME, { wordCount: 148 }), page(ABOUT)] }), 'thin-content')
        ?.affected[0]?.detail === '148 words' &&
      bucket(run({ pages: [page(HOME, { wordCount: 200 }), page(ABOUT)] }), 'thin-content') ===
        'passed',
  ]);

  checks.push([
    'missing JSON-LD is watch',
    bucket(
      run({ pages: [page(HOME, { jsonldOk: false }), page(ABOUT)] }),
      'structured-data-missing',
    ) === 'watch',
  ]);
  checks.push([
    'missing Open Graph is watch',
    bucket(run({ pages: [page(HOME, { ogOk: false }), page(ABOUT)] }), 'open-graph-missing') ===
      'watch',
  ]);
  const unparsed = run({
    pages: [
      page(HOME, {
        statusCode: 500,
        brokenLink: true,
        jsonldOk: false,
        ogOk: false,
        wordCount: null,
        h1Count: null,
        canonical: null,
      }),
      page(ABOUT),
    ],
  });
  checks.push([
    'unparsed pages are not invented JSON-LD or Open Graph failures',
    bucket(unparsed, 'structured-data-missing') === 'passed' &&
      bucket(unparsed, 'open-graph-missing') === 'passed',
  ]);

  checks.push([
    'indexable page missing from sitemap is watch',
    bucket(run({ pages: [page(HOME, { inSitemap: false }), page(ABOUT)] }), 'not-in-sitemap') ===
      'watch',
  ]);
  const noSitemap = run({ sitemapUrls: [] });
  checks.push([
    'empty sitemap is fix now and not-in-sitemap is not evaluated',
    bucket(noSitemap, 'sitemap-missing-or-weak') === 'fix-now' &&
      bucket(noSitemap, 'not-in-sitemap') === 'not-evaluated',
  ]);
  const quietRobots = run({ robotsTxt: 'User-agent: *\nAllow: /\n' });
  checks.push([
    'sitemap with no robots Sitemap line is watch',
    bucket(quietRobots, 'sitemap-missing-or-weak') === 'watch' &&
      finding(quietRobots, 'sitemap-missing-or-weak')?.affected.length === 0,
  ]);

  const llmsMissing = run({ siteProbe: { ...probe, llmsTxt: 'missing' } });
  checks.push([
    'missing llms.txt is watch info',
    bucket(llmsMissing, 'llms-txt-missing') === 'watch' &&
      finding(llmsMissing, 'llms-txt-missing')?.severity === 'info',
  ]);
  checks.push([
    'unknown llms.txt is not evaluated',
    bucket(run({ siteProbe: { ...probe, llmsTxt: 'unknown' } }), 'llms-txt-missing') ===
      'not-evaluated' &&
      bucket(run({ siteProbe: null }), 'llms-txt-missing') === 'not-evaluated',
  ]);

  const httpBad = run({
    siteProbe: {
      ...probe,
      addressVariants: [
        { url: 'http://example.com/', finalUrl: 'http://example.com/', status: 200, ok: false },
        { url: 'http://www.example.com/', finalUrl: 'https://example.com/', status: 301, ok: true },
        { url: 'https://example.com/', finalUrl: 'https://example.com/', status: 200, ok: true },
        { url: 'https://www.example.com/', finalUrl: 'https://example.com/', status: 301, ok: true },
      ],
    },
  });
  checks.push([
    'http variant that misses the origin is fix now',
    bucket(httpBad, 'https-redirects') === 'fix-now' &&
      finding(httpBad, 'https-redirects')?.affected[0]?.detail ===
        'http://example.com/ → http://example.com/ (200)',
  ]);
  const httpsBad = run({
    siteProbe: {
      ...probe,
      addressVariants: probe.addressVariants!.map((variant) =>
        variant.url.startsWith('https://www.')
          ? { ...variant, finalUrl: 'https://www.example.com/', status: 200, ok: false }
          : variant,
      ),
    },
  });
  checks.push([
    'https variant that misses the origin is watch',
    bucket(httpsBad, 'https-redirects') === 'watch',
  ]);
  checks.push([
    'missing address variants are not evaluated',
    bucket(run({ siteProbe: { ...probe, addressVariants: null } }), 'https-redirects') ===
      'not-evaluated',
  ]);

  checks.push([
    'slow lab performance is watch',
    bucket(
      run({
        lighthouse: { ...lighthouse, categories: { ...lighthouse.categories, performance: { score: 0.4 } } },
      }),
      'page-speed-lab',
    ) === 'watch' &&
      bucket(run({ lighthouse: { ...lighthouse, lcp: 4001 } }), 'page-speed-lab') === 'watch' &&
      bucket(run({ lighthouse: { ...lighthouse, cls: 0.25 } }), 'page-speed-lab') === 'passed' &&
      bucket(run({ lighthouse: { ...lighthouse, cls: 0.26 } }), 'page-speed-lab') === 'watch',
  ]);
  checks.push([
    'accessibility score bands',
    bucket(
      run({
        lighthouse: {
          ...lighthouse,
          categories: { ...lighthouse.categories, accessibility: { score: 0.69 } },
        },
      }),
      'accessibility-lab',
    ) === 'fix-now' &&
      bucket(
        run({
          lighthouse: {
            ...lighthouse,
            categories: { ...lighthouse.categories, accessibility: { score: 0.7 } },
          },
        }),
        'accessibility-lab',
      ) === 'watch' &&
      bucket(
        run({
          lighthouse: {
            ...lighthouse,
            categories: { ...lighthouse.categories, accessibility: { score: 0.9 } },
          },
        }),
        'accessibility-lab',
      ) === 'passed',
  ]);
  checks.push([
    'lab rules are not evaluated without lighthouse data',
    bucket(run({ lighthouse: null }), 'page-speed-lab') === 'not-evaluated' &&
      bucket(
        run({ lighthouse: { ...lighthouse, categories: {}, lcp: null, cls: null } }),
        'page-speed-lab',
      ) === 'not-evaluated' &&
      bucket(
        run({
          lighthouse: { ...lighthouse, categories: { performance: { score: 0.2 } } },
        }),
        'accessibility-lab',
      ) === 'not-evaluated',
  ]);

  const chromeMissing = run({
    lighthouse: {
      lcp: 9000,
      cls: 1,
      categories: {
        performance: { score: 0.1 },
        accessibility: { score: 0.1 },
      },
      errorCode: 'ERR-ARC-SEO-05',
    },
  });
  checks.push([
    'chrome missing does not invent lab scores',
    bucket(chromeMissing, 'page-speed-lab') === 'not-evaluated' &&
      bucket(chromeMissing, 'accessibility-lab') === 'not-evaluated',
  ]);

  const legacyPage = (url: string): SeoRulePage =>
    page(url, { h1Count: null, canonical: null, wordCount: null, noindex: null });
  const legacy = run({ pages: [legacyPage(HOME), legacyPage(ABOUT)] });
  for (const ruleId of ['headings-weak', 'canonical-issues', 'thin-content']) {
    const item = finding(legacy, ruleId);
    checks.push([
      `${ruleId} is not evaluated on a legacy run`,
      item?.bucket === 'not-evaluated' &&
        item.note === LEGACY_NOTE &&
        item.affected.length === 0,
    ]);
  }
  checks.push([
    'legacy run still passes title checks from stored titles',
    bucket(legacy, 'title-missing-or-weak') === 'passed',
  ]);

  const sorted = run({
    pages: [
      page(HOME, { title: '   ', metaDescription: '' }),
      page(ABOUT, { title: '   ', metaDescription: '', brokenLink: true }),
    ],
    siteProbe: { ...probe, llmsTxt: 'missing' },
    lighthouse: null,
  });
  const ids = sorted.map((item) => item.ruleId);
  const ranks = sorted.map((item) => BUCKET_RANK[item.bucket]);
  const grouped = ranks.every((rank, index) => index === 0 || rank >= ranks[index - 1]);
  checks.push([
    'findings sort by bucket, severity, affected count, then rule id',
    grouped &&
      ids.indexOf('title-missing-or-weak') < ids.indexOf('broken-pages') &&
      ids.indexOf('meta-description-weak') < ids.indexOf('llms-txt-missing') &&
      ids.indexOf('llms-txt-missing') < ids.indexOf('accessibility-lab') &&
      ids.indexOf('accessibility-lab') < ids.indexOf('page-speed-lab') &&
      ids.indexOf('page-speed-lab') < ids.indexOf('canonical-issues'),
  ]);

  const failed = checks.filter(([, ok]) => !ok);
  if (failed.length) {
    console.error(
      'seo-rules failed:',
      failed.map(([name]) => name).join(', '),
    );
    process.exit(1);
  }
  console.log(`seo-rules ok (${checks.length})`);
}
