import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { OrganizationsService } from '../organizations/organizations.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { Person } from './person.entity';

@Injectable()
export class PersonsService {
  constructor(
    @InjectRepository(Person)
    private readonly personsRepository: Repository<Person>,
    private readonly organizationsService: OrganizationsService,
  ) {}

  async findAllGeneral(userId: string): Promise<Person[]> {
    return this.personsRepository.find({
      where: { organizationId: IsNull(), createdById: userId },
      order: { name: 'ASC' },
    });
  }

  async createGeneral(userId: string, dto: CreatePersonDto): Promise<Person> {
    const person = this.personsRepository.create({
      organizationId: null,
      createdById: userId,
      name: dto.name,
      email: dto.email ?? null,
      title: dto.title ?? null,
      notes: dto.notes ?? null,
    });

    return this.personsRepository.save(person);
  }

  async findOneGeneral(userId: string, personId: string): Promise<Person> {
    const person = await this.personsRepository.findOne({
      where: { id: personId, organizationId: IsNull(), createdById: userId },
    });
    if (!person) {
      throw new NotFoundException('Person not found');
    }

    return person;
  }

  async updateGeneral(
    userId: string,
    personId: string,
    dto: UpdatePersonDto,
  ): Promise<Person> {
    const person = await this.findOneGeneral(userId, personId);
    return this.applyUpdate(person, dto);
  }

  async removeGeneral(userId: string, personId: string): Promise<void> {
    const person = await this.findOneGeneral(userId, personId);
    await this.personsRepository.remove(person);
  }

  async findAll(userId: string, orgId: string): Promise<Person[]> {
    await this.organizationsService.assertOrgAccess(userId, orgId);
    return this.personsRepository.find({
      where: { organizationId: orgId },
      order: { name: 'ASC' },
    });
  }

  async create(
    userId: string,
    orgId: string,
    dto: CreatePersonDto,
  ): Promise<Person> {
    await this.organizationsService.assertOrgAccess(userId, orgId);

    const person = this.personsRepository.create({
      organizationId: orgId,
      createdById: userId,
      name: dto.name,
      email: dto.email ?? null,
      title: dto.title ?? null,
      notes: dto.notes ?? null,
    });

    return this.personsRepository.save(person);
  }

  async findOne(
    userId: string,
    orgId: string,
    personId: string,
  ): Promise<Person> {
    await this.organizationsService.assertOrgAccess(userId, orgId);

    const person = await this.personsRepository.findOne({
      where: { id: personId, organizationId: orgId },
    });
    if (!person) {
      throw new NotFoundException('Person not found');
    }

    return person;
  }

  async update(
    userId: string,
    orgId: string,
    personId: string,
    dto: UpdatePersonDto,
  ): Promise<Person> {
    const person = await this.findOne(userId, orgId, personId);
    return this.applyUpdate(person, dto);
  }

  async remove(userId: string, orgId: string, personId: string): Promise<void> {
    const person = await this.findOne(userId, orgId, personId);
    await this.personsRepository.remove(person);
  }

  private async applyUpdate(
    person: Person,
    dto: UpdatePersonDto,
  ): Promise<Person> {
    if (dto.name !== undefined) person.name = dto.name;
    if (dto.email !== undefined) person.email = dto.email ?? null;
    if (dto.title !== undefined) person.title = dto.title ?? null;
    if (dto.notes !== undefined) person.notes = dto.notes ?? null;

    return this.personsRepository.save(person);
  }
}
