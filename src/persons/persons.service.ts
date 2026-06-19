import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  async findAll(userId: string, orgId: string): Promise<Person[]> {
    await this.organizationsService.assertMember(userId, orgId);
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
    await this.organizationsService.assertMember(userId, orgId);

    const person = this.personsRepository.create({
      organizationId: orgId,
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
    await this.organizationsService.assertMember(userId, orgId);

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

    if (dto.name !== undefined) person.name = dto.name;
    if (dto.email !== undefined) person.email = dto.email ?? null;
    if (dto.title !== undefined) person.title = dto.title ?? null;
    if (dto.notes !== undefined) person.notes = dto.notes ?? null;

    return this.personsRepository.save(person);
  }

  async remove(userId: string, orgId: string, personId: string): Promise<void> {
    const person = await this.findOne(userId, orgId, personId);
    await this.personsRepository.remove(person);
  }
}
