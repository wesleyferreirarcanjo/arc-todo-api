import { ConfigService } from '@nestjs/config';
import { HttpException } from '@nestjs/common';
import { APP_ERRORS } from '../errors/app-errors';
import { CloudService } from './cloud.service';

/**
 * Runnable self-check (`npm run test:cloud`): upstream master failures must
 * surface their real `message` (SSH auth, panel 401…) instead of the generic
 * ERR-ARC-CLOUD-02 "service unavailable" while keeping the 502 status + code.
 */
if (require.main === module) {
  void (async () => {
    const config = {
      get: (key: string) =>
        key === 'ARC_CLOUD_URL'
          ? 'http://master.test'
          : key === 'ARC_CLOUD_TOKEN'
            ? 'token'
            : undefined,
    } as unknown as ConfigService;
    const service = new CloudService(config);
    type CallFn = (
      actor: string,
      source: 'ui' | 'mcp',
      method: string,
      path: string,
      body?: unknown,
    ) => Promise<unknown>;
    const call = (service as unknown as { call: CallFn }).call.bind(service);

    const stubFetch = (status: number, body?: unknown) => {
      (globalThis as { fetch: unknown }).fetch = () =>
        Promise.resolve(
          new Response(body === undefined ? 'oops' : JSON.stringify(body), {
            status,
          }),
        );
    };

    const capture = async (status: number, body?: unknown) => {
      stubFetch(status, body);
      try {
        return { ok: true as const, body: await call('u1', 'ui', 'GET', '/x') };
      } catch (error) {
        const err = error as HttpException;
        return {
          ok: false as const,
          status: err.getStatus(),
          response: err.getResponse() as { message?: string; code?: string },
        };
      }
    };

    const checks: Array<[string, boolean]> = [];

    const ssh = await capture(502, { message: 'unreachable: ssh auth refused' });
    checks.push(['5xx rejects', !ssh.ok]);
    checks.push([
      '5xx forwards the upstream message',
      !ssh.ok && ssh.response.message === 'unreachable: ssh auth refused',
    ]);
    checks.push(['5xx keeps 502', !ssh.ok && ssh.status === 502]);
    checks.push([
      '5xx keeps ERR-ARC-CLOUD-02',
      !ssh.ok && ssh.response.code === 'ERR-ARC-CLOUD-02',
    ]);

    const panel = await capture(502, {
      message: 'panel api: 401 Unauthorized — check the coolify panel apiUrl/token',
    });
    checks.push([
      'panel failure message forwarded',
      !panel.ok && panel.response.message?.includes('panel api: 401') === true,
    ]);

    const bare = await capture(500);
    checks.push([
      'bodiless 5xx falls back to the catalog message',
      !bare.ok && bare.response.message === APP_ERRORS.CLOUD_UNAVAILABLE.message,
    ]);

    stubFetch(200, []);
    const ok = await call('u1', 'ui', 'GET', '/x');
    checks.push(['2xx passes the body through', Array.isArray(ok)]);

    const failed = checks.filter(([, pass]) => !pass);
    if (failed.length) {
      console.error(failed.map(([name]) => name).join(', '));
      process.exit(1);
    }
    console.log(`cloud.util: ${checks.length} checks passed`);
  })();
}
