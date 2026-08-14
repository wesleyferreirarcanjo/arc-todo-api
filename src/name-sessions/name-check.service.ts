import { Injectable } from '@nestjs/common';
import { promises as dns } from 'dns';
import {
  Availability,
  NAME_TLDS,
  combineAvailability,
  dnsErrorToAvailability,
  slugifyName,
} from './name-check.util';

const RDAP_TIMEOUT_MS = 6000;
const USER_AGENT = 'ArcTodo-NameCheck/1.0 (https://arc-todo)';

export type DomainCheck = {
  host: string;
  tld: string;
  dnsStatus: Availability;
  rdapStatus: Availability;
  availability: Availability;
  checkedAt: string;
};

@Injectable()
export class NameCheckService {
  async checkName(name: string): Promise<DomainCheck[]> {
    const slug = slugifyName(name);
    if (!slug) {
      return [];
    }
    const results: DomainCheck[] = [];
    for (const tld of NAME_TLDS) {
      const host = `${slug}.${tld}`;
      const [dnsStatus, rdapStatus] = await Promise.all([
        this.lookupDns(host),
        this.lookupRdap(host),
      ]);
      results.push({
        host,
        tld,
        dnsStatus,
        rdapStatus,
        availability: combineAvailability(dnsStatus, rdapStatus),
        checkedAt: new Date().toISOString(),
      });
    }
    return results;
  }

  private async lookupDns(host: string): Promise<Availability> {
    const settled = await Promise.allSettled([
      dns.resolveNs(host),
      dns.resolve4(host),
    ]);
    const fulfilled = settled.some((item) => item.status === 'fulfilled');
    if (fulfilled) {
      return 'taken';
    }
    const availabilities = settled.map((item) =>
      item.status === 'rejected'
        ? dnsErrorToAvailability(item.reason)
        : 'unknown',
    );
    if (availabilities.every((status) => status === 'available')) {
      return 'available';
    }
    return 'unknown';
  }

  private async lookupRdap(host: string): Promise<Availability> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RDAP_TIMEOUT_MS);
    try {
      const response = await fetch(`https://rdap.org/domain/${host}`, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/rdap+json, application/json' },
      });
      if (response.status === 404) {
        return 'available';
      }
      if (response.status === 200) {
        return 'taken';
      }
      return 'unknown';
    } catch {
      return 'unknown';
    } finally {
      clearTimeout(timer);
    }
  }
}
