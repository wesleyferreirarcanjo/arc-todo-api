import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateProjectVideoDto } from './dto/create-project-video.dto';
import { UpdateProjectVideoDto } from './dto/update-project-video.dto';
import { VideosService } from './videos.service';

interface AuthRequest extends Request {
  user: { id: string; username: string };
}

@Controller('organizations/:orgId/projects/:projectId/videos')
@UseGuards(JwtAuthGuard)
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Get()
  findAll(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Req() req: AuthRequest,
  ) {
    return this.videosService.findAll(req.user.id, orgId, projectId);
  }

  @Post()
  create(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Body() dto: CreateProjectVideoDto,
    @Req() req: AuthRequest,
  ) {
    return this.videosService.create(req.user.id, orgId, projectId, dto);
  }

  @Get(':videoId')
  findOne(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('videoId') videoId: string,
    @Req() req: AuthRequest,
  ) {
    return this.videosService.findOne(req.user.id, orgId, projectId, videoId);
  }

  @Patch(':videoId')
  update(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('videoId') videoId: string,
    @Body() dto: UpdateProjectVideoDto,
    @Req() req: AuthRequest,
  ) {
    return this.videosService.update(
      req.user.id,
      orgId,
      projectId,
      videoId,
      dto,
    );
  }

  @Delete(':videoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('videoId') videoId: string,
    @Req() req: AuthRequest,
  ) {
    return this.videosService.remove(req.user.id, orgId, projectId, videoId);
  }

  @Post(':videoId/files/:kind')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('videoId') videoId: string,
    @Param('kind') kind: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('durationMs') durationMs: string | undefined,
    @Req() req: AuthRequest,
  ) {
    return this.videosService.uploadFile(
      req.user.id,
      orgId,
      projectId,
      videoId,
      kind,
      file,
      durationMs,
    );
  }

  @Get(':videoId/files/:kind')
  async downloadFile(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('videoId') videoId: string,
    @Param('kind') kind: string,
    @Req() req: AuthRequest,
    @Res() res: Response,
  ) {
    await this.videosService.downloadFile(
      req.user.id,
      orgId,
      projectId,
      videoId,
      kind,
      res,
    );
  }
}
