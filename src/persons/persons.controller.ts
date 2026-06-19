import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { PersonsService } from './persons.service';

interface AuthRequest extends Request {
  user: { id: string; username: string };
}

@Controller('organizations/:orgId/persons')
@UseGuards(JwtAuthGuard)
export class PersonsController {
  constructor(private readonly personsService: PersonsService) {}

  @Get()
  findAll(@Param('orgId') orgId: string, @Req() req: AuthRequest) {
    return this.personsService.findAll(req.user.id, orgId);
  }

  @Post()
  create(
    @Param('orgId') orgId: string,
    @Body() dto: CreatePersonDto,
    @Req() req: AuthRequest,
  ) {
    return this.personsService.create(req.user.id, orgId, dto);
  }

  @Get(':personId')
  findOne(
    @Param('orgId') orgId: string,
    @Param('personId') personId: string,
    @Req() req: AuthRequest,
  ) {
    return this.personsService.findOne(req.user.id, orgId, personId);
  }

  @Patch(':personId')
  update(
    @Param('orgId') orgId: string,
    @Param('personId') personId: string,
    @Body() dto: UpdatePersonDto,
    @Req() req: AuthRequest,
  ) {
    return this.personsService.update(req.user.id, orgId, personId, dto);
  }

  @Delete(':personId')
  remove(
    @Param('orgId') orgId: string,
    @Param('personId') personId: string,
    @Req() req: AuthRequest,
  ) {
    return this.personsService.remove(req.user.id, orgId, personId);
  }
}
