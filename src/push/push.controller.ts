import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreatePushSubscriptionDto } from './dto/create-push-subscription.dto';
import { DeletePushSubscriptionDto } from './dto/delete-push-subscription.dto';
import { UpdatePushPreferencesDto } from './dto/update-push-preferences.dto';
import { PushService } from './push.service';

interface AuthRequest extends Request {
  user: { id: string; username: string };
}

@Controller('push')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Get('vapid-public-key')
  getVapidPublicKey() {
    return this.pushService.getVapidPublicKey();
  }

  @Post('subscriptions')
  createSubscription(
    @Req() req: AuthRequest,
    @Body() dto: CreatePushSubscriptionDto,
  ) {
    return this.pushService.upsertSubscription(req.user.id, dto);
  }

  @Delete('subscriptions')
  deleteSubscription(
    @Req() req: AuthRequest,
    @Body() dto: DeletePushSubscriptionDto,
  ) {
    return this.pushService
      .deleteSubscription(req.user.id, dto.endpoint)
      .then(() => ({ ok: true }));
  }

  @Get('preferences')
  getPreferences(@Req() req: AuthRequest) {
    return this.pushService.getPreferences(req.user.id);
  }

  @Patch('preferences')
  updatePreferences(
    @Req() req: AuthRequest,
    @Body() dto: UpdatePushPreferencesDto,
  ) {
    return this.pushService.updatePreferences(req.user.id, dto);
  }
}
