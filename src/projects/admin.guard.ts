import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { ProjectAccessService } from './project-access.service';

interface AuthRequest {
  user: { id: string; username: string };
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly projectAccessService: ProjectAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    await this.projectAccessService.assertAdmin(request.user.id);
    return true;
  }
}
