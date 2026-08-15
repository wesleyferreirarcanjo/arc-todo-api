import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import {
  APP_ERRORS,
  AppHttpException,
  isAppErrorPayload,
} from './app-errors';

function nestMessage(raw: unknown): string | string[] | undefined {
  if (typeof raw === 'string') {
    return raw;
  }
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === 'string');
  }
  if (typeof raw === 'object' && raw !== null && 'message' in raw) {
    const message = (raw as { message?: unknown }).message;
    if (typeof message === 'string' || Array.isArray(message)) {
      return message as string | string[];
    }
  }
  return undefined;
}

function fallbackForStatus(status: number): (typeof APP_ERRORS)[keyof typeof APP_ERRORS] {
  if (status === HttpStatus.UNAUTHORIZED) return APP_ERRORS.AUTH_SESSION_EXPIRED;
  if (status === HttpStatus.FORBIDDEN) return APP_ERRORS.ACL_PROJECT_DENIED;
  if (status === HttpStatus.NOT_FOUND) return APP_ERRORS.SYS_NOT_FOUND;
  if (status === HttpStatus.CONFLICT) return APP_ERRORS.SYS_CONFLICT;
  if (status === HttpStatus.BAD_REQUEST) return APP_ERRORS.VAL_REQUEST;
  if (status === HttpStatus.SERVICE_UNAVAILABLE) return APP_ERRORS.SYS_UNAVAILABLE;
  return APP_ERRORS.SYS_UNEXPECTED;
}

const GENERIC_NEST_MESSAGES = new Set([
  'Unauthorized',
  'Forbidden',
  'Not Found',
  'Bad Request',
  'Conflict',
  'Internal Server Error',
  'Service Unavailable',
]);

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof AppHttpException) {
      const payload = exception.getResponse();
      if (isAppErrorPayload(payload)) {
        response.status(exception.getStatus()).json(payload);
        return;
      }
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      if (isAppErrorPayload(raw)) {
        response.status(status).json(raw);
        return;
      }

      const fallback = fallbackForStatus(status);
      const extracted = nestMessage(raw);
      const first =
        typeof extracted === 'string'
          ? extracted
          : Array.isArray(extracted)
            ? extracted[0]
            : undefined;
      const message =
        first && !GENERIC_NEST_MESSAGES.has(first) ? first : fallback.message;

      response.status(status).json({
        statusCode: status,
        code: fallback.code,
        message,
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: APP_ERRORS.SYS_UNEXPECTED.code,
      message: APP_ERRORS.SYS_UNEXPECTED.message,
    });
  }
}
