import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DevicesService } from '../devices/devices.service';
import { appError } from '../errors/app-errors';
import {
  assertRemoteAction,
  mergeDeviceControlPresence,
  payloadAllowed,
  type DeviceControlPresence,
} from './device-control.util';

@Injectable()
export class DeviceControlService {
  constructor(
    private readonly config: ConfigService,
    private readonly devices: DevicesService,
  ) {}

  async listDevices() {
    const apiRows = await this.devices.listIdePresence();
    const hubRows = await this.hubPresenceOrEmpty();
    const merged = mergeDeviceControlPresence(hubRows, apiRows);
    if (merged.length > 0) return merged;
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

  async revoke(deviceId: string) {
    await this.devices.revokeBySourceIdIfPresent(deviceId);
    return this.hub('POST', `/v1/devices/${encodeURIComponent(deviceId)}/revoke`, {});
  }

  private hubConfigured(): boolean {
    const base = this.config.get<string>('ARC_HUB_URL')?.replace(/\/$/, '');
    const token = this.config.get<string>('ARC_HUB_TOKEN');
    return !!base && !!token;
  }

  private async hubPresenceOrEmpty(): Promise<DeviceControlPresence[]> {
    if (!this.hubConfigured()) return [];
    try {
      const rows = await this.hub('GET', '/v1/devices/presence');
      return Array.isArray(rows) ? (rows as DeviceControlPresence[]) : [];
    } catch {
      return [];
    }
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
