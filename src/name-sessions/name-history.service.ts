import { Injectable } from '@nestjs/common';

const TIMEOUT_MS = 7000;
const USER_AGENT = 'ArcTodo-NameCheck/1.0 (https://arc-todo)';

export type HistoryStatus = 'history_found' | 'no_history_found' | 'unknown';

export type DomainHistory = {
  host: string;
  status: HistoryStatus;
  wayback: {
    status: HistoryStatus;
    firstCapture: string | null;
    lastCapture: string | null;
    captureCount: number | null;
  };
  ct: {
    status: HistoryStatus;
    latest: string | null;
    count: number | null;
  };
  googleSiteUrl: string;
  checkedAt: string;
};

@Injectable()
export class NameHistoryService {
  async checkHistory(hosts: string[]): Promise<DomainHistory[]> {
    const unique = [...new Set(hosts.filter(Boolean))];
    const out: DomainHistory[] = [];
    // ponytail: sequential to stay polite to public CDX/crt.sh; ceiling ~5 hosts
    for (const host of unique.slice(0, 5)) {
      out.push(await this.checkHost(host));
    }
    return out;
  }

  private async checkHost(host: string): Promise<DomainHistory> {
    const [wayback, ct] = await Promise.all([
      this.lookupWayback(host),
      this.lookupCt(host),
    ]);
    let status: HistoryStatus = 'unknown';
    if (wayback.status === 'history_found' || ct.status === 'history_found') {
      status = 'history_found';
    } else if (
      wayback.status === 'no_history_found' &&
      ct.status === 'no_history_found'
    ) {
      status = 'no_history_found';
    }
    return {
      host,
      status,
      wayback,
      ct,
      googleSiteUrl: `https://www.google.com/search?q=${encodeURIComponent(`site:${host}`)}&filter=0`,
      checkedAt: new Date().toISOString(),
    };
  }

  private async lookupWayback(host: string): Promise<DomainHistory['wayback']> {
    const empty: DomainHistory['wayback'] = {
      status: 'unknown',
      firstCapture: null,
      lastCapture: null,
      captureCount: null,
    };
    try {
      const url =
        `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(host)}` +
        `&output=json&fl=timestamp&filter=statuscode:200&limit=20`;
      const data = await this.fetchJson(url);
      if (!Array.isArray(data)) {
        return empty;
      }
      const stamps = data
        .slice(1)
        .map((row) => (Array.isArray(row) ? String(row[0] ?? '') : ''))
        .filter(Boolean)
        .sort();
      if (stamps.length === 0) {
        return {
          status: 'no_history_found',
          firstCapture: null,
          lastCapture: null,
          captureCount: 0,
        };
      }
      return {
        status: 'history_found',
        firstCapture: stamps[0],
        lastCapture: stamps[stamps.length - 1],
        captureCount: stamps.length,
      };
    } catch {
      return empty;
    }
  }

  private async lookupCt(host: string): Promise<DomainHistory['ct']> {
    const empty: DomainHistory['ct'] = {
      status: 'unknown',
      latest: null,
      count: null,
    };
    try {
      const url = `https://crt.sh/?q=${encodeURIComponent(host)}&output=json`;
      const data = await this.fetchJson(url);
      if (!Array.isArray(data)) {
        return empty;
      }
      if (data.length === 0) {
        return { status: 'no_history_found', latest: null, count: 0 };
      }
      const dates = data
        .map((row) => {
          if (!row || typeof row !== 'object') return '';
          const rec = row as { not_before?: string; entry_timestamp?: string };
          return rec.not_before || rec.entry_timestamp || '';
        })
        .filter(Boolean)
        .sort();
      return {
        status: 'history_found',
        latest: dates[dates.length - 1] || null,
        count: data.length,
      };
    } catch {
      return empty;
    }
  }

  private async fetchJson(url: string): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }
}
