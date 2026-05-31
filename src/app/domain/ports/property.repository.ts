import { InjectionToken } from '@angular/core';
import { CreatePropertyDto, Property, UpdatePropertyDto } from '../models/property.model';

export interface IPropertyRepository {
  findAll(): Promise<Property[]>;
  findById(id: string): Promise<Property | null>;
  create(dto: CreatePropertyDto): Promise<Property>;
  update(dto: UpdatePropertyDto): Promise<Property>;
  delete(id: string): Promise<void>;
}

export const PROPERTY_REPOSITORY = new InjectionToken<IPropertyRepository>('PROPERTY_REPOSITORY');
