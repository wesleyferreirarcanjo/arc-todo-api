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
import { AdminGuard } from '../projects/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

interface AuthRequest extends Request {
  user: { id: string; username: string };
}

@Controller('users')
@UseGuards(JwtAuthGuard, AdminGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAllWithProjects();
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.createManagedUser(dto);
  }

  @Patch(':userId')
  update(
    @Param('userId') userId: string,
    @Body() dto: UpdateUserDto,
    @Req() req: AuthRequest,
  ) {
    return this.usersService.updateManagedUser(userId, dto, req.user.id);
  }

  @Delete(':userId')
  remove(@Param('userId') userId: string, @Req() req: AuthRequest) {
    return this.usersService.removeManagedUser(userId, req.user.id);
  }
}
