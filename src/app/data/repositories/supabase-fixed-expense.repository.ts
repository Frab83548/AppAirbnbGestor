import { Injectable } from '@angular/core';
import { getSupabaseClient } from '../../core/config/supabase.client';
import { AuthService } from '../../core/auth/auth.service';
import {
  CreateFixedExpenseDto,
  FixedExpense,
  UpdateFixedExpenseDto,
} from '../../domain/models/expense.model';
import {
  FixedExpenseFilters,
  IFixedExpenseRepository,
} from '../../domain/ports/fixed-expense.repository';

interface FixedExpenseRow {
  id: string;
  property_id: string;
  month: number;
  year: number;
  building_expenses: number;
  electricity: number;
  water: number;
  gas: number;
  internet: number;
  municipality: number;
  others: number;
  total: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  properties?: { name: string };
}

@Injectable({ providedIn: 'root' })
export class SupabaseFixedExpenseRepository implements IFixedExpenseRepository {
  private readonly supabase = getSupabaseClient();

  constructor(private readonly auth: AuthService) {}

  async findAll(filters?: FixedExpenseFilters): Promise<FixedExpense[]> {
    let query = this.supabase
      .from('fixed_expenses')
      .select('*, properties(name)')
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (filters?.propertyId) query = query.eq('property_id', filters.propertyId);
    if (filters?.month) query = query.eq('month', filters.month);
    if (filters?.year) query = query.eq('year', filters.year);

    const { data, error } = await query;
    if (error) throw error;
    return (data as FixedExpenseRow[]).map((r) => this.toDomain(r));
  }

  async findById(id: string): Promise<FixedExpense | null> {
    const { data, error } = await this.supabase
      .from('fixed_expenses')
      .select('*, properties(name)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? this.toDomain(data as FixedExpenseRow) : null;
  }

  async create(dto: CreateFixedExpenseDto): Promise<FixedExpense> {
    const userId = await this.auth.getUserId();
    const { data, error } = await this.supabase
      .from('fixed_expenses')
      .insert({
        property_id: dto.propertyId,
        month: dto.month,
        year: dto.year,
        building_expenses: dto.buildingExpenses,
        electricity: dto.electricity,
        water: dto.water,
        gas: dto.gas,
        internet: dto.internet,
        municipality: dto.municipality,
        others: dto.others,
        created_by: userId,
        updated_by: userId,
      })
      .select('*, properties(name)')
      .single();
    if (error) throw error;
    return this.toDomain(data as FixedExpenseRow);
  }

  async update(dto: UpdateFixedExpenseDto): Promise<FixedExpense> {
    const userId = await this.auth.getUserId();
    const payload: Record<string, unknown> = { updated_by: userId };
    if (dto.propertyId !== undefined) payload['property_id'] = dto.propertyId;
    if (dto.month !== undefined) payload['month'] = dto.month;
    if (dto.year !== undefined) payload['year'] = dto.year;
    if (dto.buildingExpenses !== undefined) payload['building_expenses'] = dto.buildingExpenses;
    if (dto.electricity !== undefined) payload['electricity'] = dto.electricity;
    if (dto.water !== undefined) payload['water'] = dto.water;
    if (dto.gas !== undefined) payload['gas'] = dto.gas;
    if (dto.internet !== undefined) payload['internet'] = dto.internet;
    if (dto.municipality !== undefined) payload['municipality'] = dto.municipality;
    if (dto.others !== undefined) payload['others'] = dto.others;

    const { data, error } = await this.supabase
      .from('fixed_expenses')
      .update(payload)
      .eq('id', dto.id)
      .select('*, properties(name)')
      .single();
    if (error) throw error;
    return this.toDomain(data as FixedExpenseRow);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from('fixed_expenses').delete().eq('id', id);
    if (error) throw error;
  }

  async duplicateFromPreviousMonth(
    sourceMonth: number,
    sourceYear: number,
    targetMonth: number,
    targetYear: number,
    propertyId?: string,
  ): Promise<number> {
    const { data, error } = await this.supabase.rpc('duplicate_fixed_expenses', {
      p_source_month: sourceMonth,
      p_source_year: sourceYear,
      p_target_month: targetMonth,
      p_target_year: targetYear,
      p_property_id: propertyId ?? null,
    });
    if (error) throw error;
    return data as number;
  }

  private toDomain(row: FixedExpenseRow): FixedExpense {
    return {
      id: row.id,
      propertyId: row.property_id,
      propertyName: row.properties?.name,
      month: row.month,
      year: row.year,
      buildingExpenses: Number(row.building_expenses),
      electricity: Number(row.electricity),
      water: Number(row.water),
      gas: Number(row.gas),
      internet: Number(row.internet),
      municipality: Number(row.municipality),
      others: Number(row.others),
      total: Number(row.total),
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
