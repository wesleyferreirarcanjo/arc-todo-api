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

@Controller('persons')
@UseGuards(JwtAuthGuard)
export class PersonsGlobalController {
  constructor(private readonly personsService: PersonsService) {}

  @Get()
  findAll(@Req() req: AuthRequest) {
    return this.personsService.findAllGeneral(req.user.id);
  }

  @Post()
  create(@Body() dto: CreatePersonDto, @Req() req: AuthRequest) {
    return this.personsService.createGeneral(req.user.id, dto);
  }

  @Get(':personId')
  findOne(@Param('personId') personId: string, @Req() req: AuthRequest) {
    return this.personsService.findOneGeneral(req.user.id, personId);
  }

  @Patch(':personId')
  update(
    @Param('personId') personId: string,
    @Body() dto: UpdatePersonDto,
    @Req() req: AuthRequest,
  ) {
    return this.personsService.updateGeneral(req.user.id, personId, dto);
  }

  @Delete(':personId')
  remove(@Param('personId') personId: string, @Req() req: AuthRequest) {
    return this.personsService.removeGeneral(req.user.id, personId);
  }
}
