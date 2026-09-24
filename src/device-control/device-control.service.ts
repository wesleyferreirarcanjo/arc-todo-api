import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { appError } from '../errors/app-errors';
import { assertRemoteAction, payloadAllowed } from './device-control.util';

@Injectable()
export class DeviceControlService {
  constructor(private readonly config: ConfigService) {}

  listDevices() {
    return this.hub('GET', '/v1/devices/presence');
  }

  audit(deviceId: string) {
    return this.hub('GET', `/v1/devices/${encodeURIComponent(deviceId)}/audit`);
  }

  enqueue(
    deviceId: string,
    action: string,
    payload: Record<string, unknown> | undefined,
    idempotencyKey: string,
    requestedBy: string,
  ) {
    try {
      assertRemoteAction(action);
    } catch {
      throw appError('DEVICE_ACTION_REFUSED');
    }
    if (!payloadAllowed(action, payload)) {
      throw appError('DEVICE_ACTION_REFUSED');
    }
    return this.hub('POST', `/v1/devices/${encodeURIComponent(deviceId)}/commands`, {
      action,
      payload: payload ?? {},
      idempotencyKey,
      requestedBy,
    });
  }

  revoke(deviceId: string) {
    return this.hub('POST', `/v1/devices/${encodeURIComponent(deviceId)}/revoke`, {});
  }

  private async hub(method: string, path: string, body?: unknown): Promise<unknown> {
    const base = this.config.get<string>('ARC_HUB_URL')?.replace(/\/$/, '');
    const token = this.config.get<string>('ARC_HUB_TOKEN');
    if (!base || !token) {
      throw appError('DEVICE_HUB_NOT_CONFIGURED');
    }
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      throw appError(response.status === 400 || response.status === 403 ? 'DEVICE_ACTION_REFUSED' : 'DEVICE_HUB_NOT_CONFIGURED');
    }
    if (response.status === 204) return {};
    return response.json();
  }
}
