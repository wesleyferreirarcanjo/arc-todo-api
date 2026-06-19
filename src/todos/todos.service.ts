import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { Todo } from './todo.entity';
import { TodoPriority, TodoStatus } from './todo.enums';

@Injectable()
export class TodosService {
  constructor(
    @InjectRepository(Todo)
    private readonly todosRepository: Repository<Todo>,
  ) {}

  async findAll(userId: string): Promise<Todo[]> {
    return this.todosRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<Todo> {
    const todo = await this.todosRepository.findOne({ where: { id } });
    if (!todo) {
      throw new NotFoundException('Todo not found');
    }
    if (todo.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    return todo;
  }

  async create(userId: string, dto: CreateTodoDto): Promise<Todo> {
    const todo = this.todosRepository.create({
      title: dto.title,
      description: dto.description ?? null,
      status: dto.status ?? TodoStatus.TODO,
      priority: dto.priority ?? TodoPriority.MEDIUM,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      userId,
    });
    return this.todosRepository.save(todo);
  }

  async update(id: string, userId: string, dto: UpdateTodoDto): Promise<Todo> {
    const todo = await this.findOne(id, userId);

    if (dto.title !== undefined) todo.title = dto.title;
    if (dto.description !== undefined) todo.description = dto.description;
    if (dto.status !== undefined) todo.status = dto.status;
    if (dto.priority !== undefined) todo.priority = dto.priority;
    if (dto.dueDate !== undefined) {
      todo.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    }

    return this.todosRepository.save(todo);
  }

  async remove(id: string, userId: string): Promise<void> {
    const todo = await this.findOne(id, userId);
    await this.todosRepository.remove(todo);
  }
}
