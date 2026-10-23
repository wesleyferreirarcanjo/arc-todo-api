import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { appError } from '../errors/app-errors';
import {
  DEVICE_INTERNAL_TOKEN_ENVS,
  collectInternalTokens,
  presentedInternalTokenMatches,
} from './device.util';

/**
 * Service-token gate for `/internal/devices/*`. Accepts any of
 * ARC_CONTROL_INTERNAL_TOKEN, ARC_BROWSER_INTERNAL_TOKEN, or
 * ARC_HUB_INTERNAL_TOKEN (32+ chars, constant-time compare). Never a
 * user JWT — relays write here; the web does not.
 */
@Injectable()
export class DevicesInternalGuard implements CanActivate {
  private readonly expected: string[];

  constructor(config: ConfigService) {
    const env: Record<string, string | undefined> = {};
    for (const key of DEVICE_INTERNAL_TOKEN_ENVS) {
      env[key] = config.get<string>(key);
    }
    this.expected = collectInternalTokens(env);
    if (
      this.expected.length === 0 &&
      config.get<string>('NODE_ENV') === 'production'
    ) {
      throw new Error(
        'ARC_CONTROL_INTERNAL_TOKEN, ARC_BROWSER_INTERNAL_TOKEN, or ARC_HUB_INTERNAL_TOKEN must be set to at least 32 characters',
      );
    }
  }

  canActivate(context: ExecutionContext): boolean {
    if (this.expected.length === 0) {
      throw appError('DEVICE_INTERNAL_NOT_CONFIGURED');
    }
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined> }>();
    const header = request.headers['authorization'] ?? '';
    const presented = header.startsWith('Bearer ')
      ? header.slice('Bearer '.length)
      : '';
    if (!presentedInternalTokenMatches(presented, this.expected)) {
      throw appError('DEVICE_INTERNAL_UNAUTHORIZED');
    }
    return true;
  }
}
