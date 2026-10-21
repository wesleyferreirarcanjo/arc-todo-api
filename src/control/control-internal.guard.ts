import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { appError } from '../errors/app-errors';

const MIN_TOKEN_LENGTH = 32;

/**
 * Internal service-token gate for `/internal/control/*` — the same pattern as
 * the cloud `CLOUD_INTERNAL_TOKEN` listener: Bearer + constant-time compare,
 * and the service must be configured with a 32+ char secret.
 *
 * In production a missing/short token refuses boot (constructor throws while
 * Nest instantiates providers); elsewhere the route answers 503 so local dev
 * still works without the env.
 */
@Injectable()
export class ControlInternalGuard implements CanActivate {
  private readonly expected: Buffer | null;

  constructor(config: ConfigService) {
    const token = config.get<string>('ARC_CONTROL_INTERNAL_TOKEN') ?? '';
    this.expected =
      token.length >= MIN_TOKEN_LENGTH ? Buffer.from(token) : null;
    if (!this.expected && config.get<string>('NODE_ENV') === 'production') {
      throw new Error(
        'ARC_CONTROL_INTERNAL_TOKEN must be set to at least 32 characters',
      );
    }
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.expected) {
      throw appError('CONTROL_INTERNAL_NOT_CONFIGURED');
    }
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined> }>();
    const header = request.headers['authorization'] ?? '';
    const presented = header.startsWith('Bearer ')
      ? header.slice('Bearer '.length)
      : '';
    const presentedBuf = Buffer.from(presented);
    if (
      presentedBuf.length !== this.expected.length ||
      !timingSafeEqual(presentedBuf, this.expected)
    ) {
      throw appError('CONTROL_INTERNAL_UNAUTHORIZED');
    }
    return true;
  }
}
