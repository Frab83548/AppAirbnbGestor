import { Injectable } from '@angular/core';
import { getSupabaseClient } from '../../core/config/supabase.client';
import { AuthService } from '../../core/auth/auth.service';
import { PropertyStatus } from '../../domain/enums';
import {
  CreatePropertyDto,
  Property,
  UpdatePropertyDto,
} from '../../domain/models/property.model';
import { IPropertyRepository } from '../../domain/ports/property.repository';

interface PropertyRow {
  id: string;
  name: string;
  address: string;
  description: string;
  status: PropertyStatus;
  registered_at: string;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

@Injectable({ providedIn: 'root' })
export class SupabasePropertyRepository implements IPropertyRepository {
  private readonly supabase = getSupabaseClient();

  constructor(private readonly auth: AuthService) {}

  async findAll(): Promise<Property[]> {
    const { data, error } = await this.supabase
      .from('properties')
      .select('*')
      .order('name');
    if (error) throw error;
    return (data as PropertyRow[]).map((r) => this.toDomain(r));
  }

  async findById(id: string): Promise<Property | null> {
    const { data, error } = await this.supabase.from('properties').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? this.toDomain(data as PropertyRow) : null;
  }

  async create(dto: CreatePropertyDto): Promise<Property> {
    const userId = await this.auth.getUserId();
    const { data, error } = await this.supabase
      .from('properties')
      .insert({
        name: dto.name,
        address: dto.address,
        description: dto.description,
        status: dto.status,
        registered_at: dto.registeredAt,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();
    if (error) throw error;
    return this.toDomain(data as PropertyRow);
  }

  async update(dto: UpdatePropertyDto): Promise<Property> {
    const userId = await this.auth.getUserId();
    const payload: Record<string, unknown> = { updated_by: userId };
    if (dto.name !== undefined) payload['name'] = dto.name;
    if (dto.address !== undefined) payload['address'] = dto.address;
    if (dto.description !== undefined) payload['description'] = dto.description;
    if (dto.status !== undefined) payload['status'] = dto.status;
    if (dto.registeredAt !== undefined) payload['registered_at'] = dto.registeredAt;

    const { data, error } = await this.supabase
      .from('properties')
      .update(payload)
      .eq('id', dto.id)
      .select()
      .single();
    if (error) throw error;
    return this.toDomain(data as PropertyRow);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from('properties').delete().eq('id', id);
    if (error) throw error;
  }

  private toDomain(row: PropertyRow): Property {
    return {
      id: row.id,
      name: row.name,
      address: row.address,
      description: row.description,
      status: row.status,
      registeredAt: row.registered_at,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
