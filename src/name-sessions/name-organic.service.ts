import { Injectable } from '@nestjs/common';
import {
  HANDLE_PLATFORMS,
  handleProbeFromHttp,
  handleProfileUrl,
  handleSlug,
  isGatedHandleRedirect,
  parseAutocompleteBody,
  type AutocompleteEvidence,
  type HandleCheck,
  type HandlePlatform,
} from './name-organic.util';

const AUTOCOMPLETE_TIMEOUT_MS = 3000;
const HANDLE_TIMEOUT_MS = 3000;
const USER_AGENT = 'ArcTodo-NameCheck/1.0 (https://arc-todo)';

@Injectable()
export class NameOrganicService {
  /**
   * Free DuckDuckGo autocomplete — coarse proxy for “is this word already owned”.
   * ponytail: this is undiscriminating (no volume, no SERP rank). Upgrade path:
   * a keyed search API such as Brave’s free tier. Never scrape search result pages.
   */
  async lookupAutocomplete(name: string): Promise<AutocompleteEvidence> {
    const checkedAt = new Date().toISOString();
    const empty: AutocompleteEvidence = {
      status: 'unknown',
      suggestions: [],
      checkedAt,
    };
    const trimmed = name.trim();
    if (!trimmed) return empty;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AUTOCOMPLETE_TIMEOUT_MS);
    try {
      const url =
        `https://duckduckgo.com/ac/?q=${encodeURIComponent(trimmed)}&type=list`;
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      });
      if (!response.ok) {
        return empty;
      }
      const body: unknown = await response.json();
      const parsed = parseAutocompleteBody(body, trimmed);
      return {
        status: parsed.status,
        suggestions: parsed.suggestions,
        checkedAt,
      };
    } catch {
      return empty;
    } finally {
      clearTimeout(timer);
    }
  }

  async probeHandles(name: string): Promise<HandleCheck[]> {
    const handle = handleSlug(name);
    if (!handle) return [];
    const checkedAt = new Date().toISOString();
    return Promise.all(
      HANDLE_PLATFORMS.map((platform) =>
        this.probeHandle(platform, handle, checkedAt),
      ),
    );
  }

  private async probeHandle(
    platform: HandlePlatform,
    handle: string,
    checkedAt: string,
  ): Promise<HandleCheck> {
    const profileUrl = handleProfileUrl(platform, handle);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HANDLE_TIMEOUT_MS);
    try {
      const response = await fetch(profileUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      });
      const location = response.headers.get('location');
      const gated = isGatedHandleRedirect(location);
      return {
        platform,
        handle,
        profileUrl,
        availability: handleProbeFromHttp({
          platform,
          status: response.status,
          gated,
        }),
        checkedAt,
      };
    } catch {
      return {
        platform,
        handle,
        profileUrl,
        availability: handleProbeFromHttp({ platform, status: null }),
        checkedAt,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
