import {
  BadRequestException,
  Injectable,
  NotFoundException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Response } from 'express';
import { Repository } from 'typeorm';
import { MinioStorageService } from '../storage/minio-storage.service';
import {
  buildKnowledgeObjectKey,
  contentDispositionFilename,
  newAttachmentId,
  parseTagsInput,
} from '../storage/storage.utils';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import { ListAttachmentQueryDto } from './dto/list-attachment-query.dto';
import { KnowledgeAttachment } from './knowledge-attachment.entity';
import { KnowledgeEntry } from './knowledge-entry.entity';
import { KnowledgeService } from './knowledge.service';
import { RagClientService } from '../rag-settings/rag-client.service';

export interface KnowledgeAttachmentResponse {
  id: string;
  knowledgeEntryId: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  description: string | null;
  tags: string[];
  uploadedById: string;
  createdAt: string;
}

interface UploadedFilePayload {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class KnowledgeAttachmentService {
  constructor(
    @InjectRepository(KnowledgeAttachment)
    private readonly attachmentRepository: Repository<KnowledgeAttachment>,
    @Inject(forwardRef(() => KnowledgeService))
    private readonly knowledgeService: KnowledgeService,
    private readonly storageService: MinioStorageService,
    private readonly ragClientService: RagClientService,
  ) {}

  uploadGeneral(
    userId: string,
    knowledgeId: string,
    file: UploadedFilePayload,
    dto: CreateAttachmentDto,
  ): Promise<KnowledgeAttachmentResponse> {
    return this.uploadWithAccess(async () =>
      this.knowledgeService.findOneGeneral(userId, knowledgeId),
    )(userId, file, dto);
  }

  uploadOrganization(
    userId: string,
    orgId: string,
    knowledgeId: string,
    file: UploadedFilePayload,
    dto: CreateAttachmentDto,
  ): Promise<KnowledgeAttachmentResponse> {
    return this.uploadWithAccess(async () =>
      this.knowledgeService.findOneOrganization(userId, orgId, knowledgeId),
    )(userId, file, dto);
  }

  uploadProject(
    userId: string,
    orgId: string,
    projectId: string,
    knowledgeId: string,
    file: UploadedFilePayload,
    dto: CreateAttachmentDto,
  ): Promise<KnowledgeAttachmentResponse> {
    return this.uploadWithAccess(async () =>
      this.knowledgeService.findOneProject(userId, orgId, projectId, knowledgeId),
    )(userId, file, dto);
  }

  uploadPerson(
    userId: string,
    orgId: string,
    personId: string,
    knowledgeId: string,
    file: UploadedFilePayload,
    dto: CreateAttachmentDto,
  ): Promise<KnowledgeAttachmentResponse> {
    return this.uploadWithAccess(async () =>
      this.knowledgeService.findOnePerson(userId, orgId, personId, knowledgeId),
    )(userId, file, dto);
  }

  uploadGeneralPerson(
    userId: string,
    personId: string,
    knowledgeId: string,
    file: UploadedFilePayload,
    dto: CreateAttachmentDto,
  ): Promise<KnowledgeAttachmentResponse> {
    return this.uploadWithAccess(async () =>
      this.knowledgeService.findOneGeneralPerson(userId, personId, knowledgeId),
    )(userId, file, dto);
  }

  listGeneral(
    userId: string,
    knowledgeId: string,
    query: ListAttachmentQueryDto,
  ): Promise<KnowledgeAttachmentResponse[]> {
    return this.listWithAccess(async () =>
      this.knowledgeService.findOneGeneral(userId, knowledgeId),
    )(query);
  }

  listOrganization(
    userId: string,
    orgId: string,
    knowledgeId: string,
    query: ListAttachmentQueryDto,
  ): Promise<KnowledgeAttachmentResponse[]> {
    return this.listWithAccess(async () =>
      this.knowledgeService.findOneOrganization(userId, orgId, knowledgeId),
    )(query);
  }

  listProject(
    userId: string,
    orgId: string,
    projectId: string,
    knowledgeId: string,
    query: ListAttachmentQueryDto,
  ): Promise<KnowledgeAttachmentResponse[]> {
    return this.listWithAccess(async () =>
      this.knowledgeService.findOneProject(userId, orgId, projectId, knowledgeId),
    )(query);
  }

  listPerson(
    userId: string,
    orgId: string,
    personId: string,
    knowledgeId: string,
    query: ListAttachmentQueryDto,
  ): Promise<KnowledgeAttachmentResponse[]> {
    return this.listWithAccess(async () =>
      this.knowledgeService.findOnePerson(userId, orgId, personId, knowledgeId),
    )(query);
  }

  listGeneralPerson(
    userId: string,
    personId: string,
    knowledgeId: string,
    query: ListAttachmentQueryDto,
  ): Promise<KnowledgeAttachmentResponse[]> {
    return this.listWithAccess(async () =>
      this.knowledgeService.findOneGeneralPerson(userId, personId, knowledgeId),
    )(query);
  }

  async downloadGeneral(
    userId: string,
    knowledgeId: string,
    attachmentId: string,
    res: Response,
  ): Promise<void> {
    const entry = await this.knowledgeService.findOneGeneral(userId, knowledgeId);
    await this.streamDownload(entry, attachmentId, res);
  }

  async downloadOrganization(
    userId: string,
    orgId: string,
    knowledgeId: string,
    attachmentId: string,
    res: Response,
  ): Promise<void> {
    const entry = await this.knowledgeService.findOneOrganization(
      userId,
      orgId,
      knowledgeId,
    );
    await this.streamDownload(entry, attachmentId, res);
  }

  async downloadProject(
    userId: string,
    orgId: string,
    projectId: string,
    knowledgeId: string,
    attachmentId: string,
    res: Response,
  ): Promise<void> {
    const entry = await this.knowledgeService.findOneProject(
      userId,
      orgId,
      projectId,
      knowledgeId,
    );
    await this.streamDownload(entry, attachmentId, res);
  }

  async downloadPerson(
    userId: string,
    orgId: string,
    personId: string,
    knowledgeId: string,
    attachmentId: string,
    res: Response,
  ): Promise<void> {
    const entry = await this.knowledgeService.findOnePerson(
      userId,
      orgId,
      personId,
      knowledgeId,
    );
    await this.streamDownload(entry, attachmentId, res);
  }

  async downloadGeneralPerson(
    userId: string,
    personId: string,
    knowledgeId: string,
    attachmentId: string,
    res: Response,
  ): Promise<void> {
    const entry = await this.knowledgeService.findOneGeneralPerson(
      userId,
      personId,
      knowledgeId,
    );
    await this.streamDownload(entry, attachmentId, res);
  }

  deleteGeneral(
    userId: string,
    knowledgeId: string,
    attachmentId: string,
  ): Promise<void> {
    return this.deleteWithAccess(async () =>
      this.knowledgeService.findOneGeneral(userId, knowledgeId),
    )(attachmentId);
  }

  deleteOrganization(
    userId: string,
    orgId: string,
    knowledgeId: string,
    attachmentId: string,
  ): Promise<void> {
    return this.deleteWithAccess(async () =>
      this.knowledgeService.findOneOrganization(userId, orgId, knowledgeId),
    )(attachmentId);
  }

  deleteProject(
    userId: string,
    orgId: string,
    projectId: string,
    knowledgeId: string,
    attachmentId: string,
  ): Promise<void> {
    return this.deleteWithAccess(async () =>
      this.knowledgeService.findOneProject(userId, orgId, projectId, knowledgeId),
    )(attachmentId);
  }

  deletePerson(
    userId: string,
    orgId: string,
    personId: string,
    knowledgeId: string,
    attachmentId: string,
  ): Promise<void> {
    return this.deleteWithAccess(async () =>
      this.knowledgeService.findOnePerson(userId, orgId, personId, knowledgeId),
    )(attachmentId);
  }

  deleteGeneralPerson(
    userId: string,
    personId: string,
    knowledgeId: string,
    attachmentId: string,
  ): Promise<void> {
    return this.deleteWithAccess(async () =>
      this.knowledgeService.findOneGeneralPerson(userId, personId, knowledgeId),
    )(attachmentId);
  }

  async cleanupForKnowledgeEntry(knowledgeEntryId: string): Promise<void> {
    const attachments = await this.attachmentRepository.find({
      where: { knowledgeEntryId },
    });

    if (attachments.length === 0) return;

    await this.storageService.deleteObjects(
      attachments.map((attachment) => attachment.objectKey),
    );
  }

  private uploadWithAccess(getEntry: () => Promise<KnowledgeEntry>) {
    return async (
      userId: string,
      file: UploadedFilePayload,
      dto: CreateAttachmentDto,
    ): Promise<KnowledgeAttachmentResponse> => {
      const entry = await getEntry();
      this.validateFile(file);

      const attachmentId = newAttachmentId();
      const objectKey = buildKnowledgeObjectKey(
        entry.id,
        attachmentId,
        file.originalname,
      );
      const bucket = this.storageService.getBucket();

      await this.storageService.putObject(
        objectKey,
        file.buffer,
        file.mimetype || 'application/octet-stream',
      );

      const attachment = this.attachmentRepository.create({
        id: attachmentId,
        knowledgeEntryId: entry.id,
        bucket,
        objectKey,
        originalFilename: file.originalname,
        mimeType: file.mimetype || 'application/octet-stream',
        sizeBytes: String(file.size),
        description: dto.description?.trim() || null,
        tags: parseTagsInput(dto.tags),
        uploadedById: userId,
      });

      try {
        const saved = await this.attachmentRepository.save(attachment);
        await this.ragClientService.enqueueAttachmentIndex(entry.id, saved.id);
        return this.toResponse(saved);
      } catch (error) {
        await this.storageService.deleteObject(objectKey);
        throw error;
      }
    };
  }

  private listWithAccess(getEntry: () => Promise<KnowledgeEntry>) {
    return async (
      query: ListAttachmentQueryDto,
    ): Promise<KnowledgeAttachmentResponse[]> => {
      const entry = await getEntry();
      const qb = this.attachmentRepository
        .createQueryBuilder('attachment')
        .where('attachment.knowledgeEntryId = :knowledgeEntryId', {
          knowledgeEntryId: entry.id,
        })
        .orderBy('attachment.createdAt', 'DESC');

      if (query.fileName?.trim()) {
        qb.andWhere('attachment.originalFilename ILIKE :fileName', {
          fileName: `%${query.fileName.trim()}%`,
        });
      }

      if (query.mimeType?.trim()) {
        qb.andWhere('attachment.mimeType ILIKE :mimeType', {
          mimeType: `%${query.mimeType.trim()}%`,
        });
      }

      if (query.tag?.trim()) {
        qb.andWhere(':tag = ANY(attachment.tags)', { tag: query.tag.trim() });
      }

      const attachments = await qb.getMany();
      return attachments.map((attachment) => this.toResponse(attachment));
    };
  }

  private deleteWithAccess(getEntry: () => Promise<KnowledgeEntry>) {
    return async (attachmentId: string): Promise<void> => {
      const entry = await getEntry();
      const attachment = await this.attachmentRepository.findOne({
        where: { id: attachmentId, knowledgeEntryId: entry.id },
      });

      if (!attachment) {
        throw new NotFoundException('Attachment not found');
      }

      await this.attachmentRepository.remove(attachment);
      await this.storageService.deleteObject(attachment.objectKey);
    };
  }

  private async streamDownload(
    entry: KnowledgeEntry,
    attachmentId: string,
    res: Response,
  ): Promise<void> {
    const attachment = await this.attachmentRepository.findOne({
      where: { id: attachmentId, knowledgeEntryId: entry.id },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    const { stream, stat } = await this.storageService.getObjectStream(
      attachment.objectKey,
    );

    res.setHeader('Content-Type', attachment.mimeType || stat.contentType);
    res.setHeader('Content-Length', stat.size.toString());
    res.setHeader(
      'Content-Disposition',
      contentDispositionFilename(attachment.originalFilename),
    );

    stream.pipe(res);
  }

  private validateFile(file: UploadedFilePayload): void {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (!file.buffer || file.size <= 0) {
      throw new BadRequestException('File cannot be empty');
    }

    const maxBytes = this.storageService.getMaxUploadBytes();
    if (file.size > maxBytes) {
      throw new BadRequestException(
        `File exceeds maximum upload size of ${maxBytes} bytes`,
      );
    }
  }

  private toResponse(attachment: KnowledgeAttachment): KnowledgeAttachmentResponse {
    return {
      id: attachment.id,
      knowledgeEntryId: attachment.knowledgeEntryId,
      originalFilename: attachment.originalFilename,
      mimeType: attachment.mimeType,
      sizeBytes: Number(attachment.sizeBytes),
      description: attachment.description,
      tags: attachment.tags ?? [],
      uploadedById: attachment.uploadedById,
      createdAt: attachment.createdAt.toISOString(),
    };
  }
}
