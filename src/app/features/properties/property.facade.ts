import { Injectable, inject } from '@angular/core';
import { PROPERTY_REPOSITORY } from '../../domain/ports/property.repository';
import { CreatePropertyDto, Property, UpdatePropertyDto } from '../../domain/models/property.model';

@Injectable({ providedIn: 'root' })
export class PropertyFacade {
  private readonly repo = inject(PROPERTY_REPOSITORY);

  findAll(): Promise<Property[]> {
    return this.repo.findAll();
  }

  findById(id: string): Promise<Property | null> {
    return this.repo.findById(id);
  }

  create(dto: CreatePropertyDto): Promise<Property> {
    return this.repo.create(dto);
  }

  update(dto: UpdatePropertyDto): Promise<Property> {
    return this.repo.update(dto);
  }

  delete(id: string): Promise<void> {
    return this.repo.delete(id);
  }
}
