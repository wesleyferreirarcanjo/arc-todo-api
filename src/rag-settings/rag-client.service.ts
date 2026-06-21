import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class RagClientService {
  private readonly logger = new Logger(RagClientService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {}

  private getBaseUrl(): string | null {
    const configured = this.configService.get<string>('ARC_TODO_RAG_BASE_URL');
    return configured?.trim() || null;
  }

  async enqueueEntryIndex(knowledgeEntryId: string): Promise<void> {
    await this.enqueueJob({
      jobType: 'entry',
      knowledgeEntryId,
    });
  }

  async enqueueAttachmentIndex(
    knowledgeEntryId: string,
    attachmentId: string,
  ): Promise<void> {
    await this.enqueueJob({
      jobType: 'attachment',
      knowledgeEntryId,
      attachmentId,
    });
  }

  private async enqueueJob(input: {
    jobType: string;
    knowledgeEntryId: string;
    attachmentId?: string;
  }): Promise<void> {
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      return;
    }

    try {
      const token = await this.getServiceToken();
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/index/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          jobType: input.jobType,
          knowledgeEntryId: input.knowledgeEntryId,
          attachmentId: input.attachmentId,
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        this.logger.warn(`Failed to enqueue RAG job: ${response.status} ${text}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to enqueue RAG job: ${String(error)}`);
    }
  }

  private async getServiceToken(): Promise<string> {
    const username = this.configService.get<string>('ADMIN_USERNAME', 'admin');
    const password = this.configService.get<string>('ADMIN_PASSWORD', 'admin123');
    const result = await this.authService.login({ username, password });
    return result.access_token;
  }
}
