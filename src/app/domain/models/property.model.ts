import { PropertyStatus } from '../enums';

export interface Property {
  id: string;
  name: string;
  address: string;
  description: string;
  status: PropertyStatus;
  registeredAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePropertyDto {
  name: string;
  address: string;
  description: string;
  status: PropertyStatus;
  registeredAt: string;
}

export interface UpdatePropertyDto extends Partial<CreatePropertyDto> {
  id: string;
}
