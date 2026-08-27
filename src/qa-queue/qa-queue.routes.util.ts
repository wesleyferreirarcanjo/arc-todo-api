import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { QaQueueController } from './qa-queue.controller';

type RouteProbe = {
  path: string;
  method: RequestMethod;
};

function controllerRoutes(ctor: Function): RouteProbe[] {
  const proto = ctor.prototype as Record<string, unknown>;
  const names = Object.getOwnPropertyNames(proto).filter(
    (name) => name !== 'constructor',
  );
  return names.flatMap((name) => {
    const handler = proto[name];
    if (typeof handler !== 'function') {
      return [];
    }
    const method = Reflect.getMetadata(METHOD_METADATA, handler) as
      | RequestMethod
      | undefined;
    if (method === undefined) {
      return [];
    }
    const path = String(Reflect.getMetadata(PATH_METADATA, handler) ?? '');
    return [{ path, method }];
  });
}

if (require.main === module) {
  const prefix = Reflect.getMetadata(PATH_METADATA, QaQueueController);
  const guards = (Reflect.getMetadata(GUARDS_METADATA, QaQueueController) ??
    []) as unknown[];
  const routes = controllerRoutes(QaQueueController);
  const norm = (path: string) => (path === '' ? '/' : path);
  const has = (method: RequestMethod, path: string) =>
    routes.some(
      (route) => route.method === method && norm(route.path) === norm(path),
    );

  const checks: Array<[string, boolean]> = [
    ['prefix', prefix === 'qa-queue'],
    ['jwt guard', guards.includes(JwtAuthGuard)],
    ['GET list', has(RequestMethod.GET, '/')],
    ['POST items', has(RequestMethod.POST, 'items')],
    ['DELETE item', has(RequestMethod.DELETE, 'items/:taskId')],
    ['PATCH reorder', has(RequestMethod.PATCH, '/')],
    ['DELETE clear', has(RequestMethod.DELETE, '/')],
  ];
  const failed = checks.filter(([, ok]) => !ok);
  if (failed.length) {
    console.error(
      'qa-queue.routes.util failed:',
      failed.map(([name]) => name).join(', '),
      JSON.stringify({ prefix, routes }),
    );
    process.exit(1);
  }
  console.log(`qa-queue.routes.util ok (${checks.length})`);
}
