import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { SeoGscService } from './seo-gsc.service';

@Controller('seo')
export class SeoGscCallbackController {
  constructor(private readonly gscService: SeoGscService) {}

  @Get('search-console/callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    const redirect = await this.gscService.handleCallback(code, state, error);
    return res.redirect(this.gscService.frontendRedirectUrl(redirect));
  }
}
