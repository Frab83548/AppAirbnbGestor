import { Injectable } from '@angular/core';
import { getSupabaseClient } from '../../core/config/supabase.client';
import { AuthService } from '../../core/auth/auth.service';
import { ExpenseCategory } from '../../domain/enums';
import {
  CreateVariableExpenseDto,
  UpdateVariableExpenseDto,
  VariableExpense,
} from '../../domain/models/expense.model';
import {
  ExpenseFilters,
  IVariableExpenseRepository,
} from '../../domain/ports/variable-expense.repository';

interface VariableExpenseRow {
  id: string;
  property_id: string;
  expense_date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  properties?: { name: string };
}

@Injectable({ providedIn: 'root' })
export class SupabaseVariableExpenseRepository implements IVariableExpenseRepository {
  private readonly supabase = getSupabaseClient();

  constructor(private readonly auth: AuthService) {}

  async findAll(filters?: ExpenseFilters): Promise<VariableExpense[]> {
    let query = this.supabase
      .from('variable_expenses')
      .select('*, properties(name)')
      .order('expense_date', { ascending: false });

    if (filters?.propertyId) query = query.eq('property_id', filters.propertyId);
    if (filters?.dateFrom) query = query.gte('expense_date', filters.dateFrom);
    if (filters?.dateTo) query = query.lte('expense_date', filters.dateTo);
    if (filters?.year && !filters.dateFrom && !filters.dateTo) {
      if (filters.month) {
        const start = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`;
        const endMonth = filters.month === 12 ? 1 : filters.month + 1;
        const endYear = filters.month === 12 ? filters.year + 1 : filters.year;
        const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
        query = query.gte('expense_date', start).lt('expense_date', end);
      } else {
        query = query
          .gte('expense_date', `${filters.year}-01-01`)
          .lt('expense_date', `${filters.year + 1}-01-01`);
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data as VariableExpenseRow[]).map((r) => this.toDomain(r));
  }

  async findById(id: string): Promise<VariableExpense | null> {
    const { data, error } = await this.supabase
      .from('variable_expenses')
      .select('*, properties(name)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? this.toDomain(data as VariableExpenseRow) : null;
  }

  async create(dto: CreateVariableExpenseDto): Promise<VariableExpense> {
    const userId = await this.auth.getUserId();
    const { data, error } = await this.supabase
      .from('variable_expenses')
      .insert({
        property_id: dto.propertyId,
        expense_date: dto.expenseDate,
        category: dto.category,
        description: dto.description,
        amount: dto.amount,
        created_by: userId,
        updated_by: userId,
      })
      .select('*, properties(name)')
      .single();
    if (error) throw error;
    return this.toDomain(data as VariableExpenseRow);
  }

  async update(dto: UpdateVariableExpenseDto): Promise<VariableExpense> {
    const userId = await this.auth.getUserId();
    const payload: Record<string, unknown> = { updated_by: userId };
    if (dto.propertyId !== undefined) payload['property_id'] = dto.propertyId;
    if (dto.expenseDate !== undefined) payload['expense_date'] = dto.expenseDate;
    if (dto.category !== undefined) payload['category'] = dto.category;
    if (dto.description !== undefined) payload['description'] = dto.description;
    if (dto.amount !== undefined) payload['amount'] = dto.amount;

    const { data, error } = await this.supabase
      .from('variable_expenses')
      .update(payload)
      .eq('id', dto.id)
      .select('*, properties(name)')
      .single();
    if (error) throw error;
    return this.toDomain(data as VariableExpenseRow);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from('variable_expenses').delete().eq('id', id);
    if (error) throw error;
  }

  private toDomain(row: VariableExpenseRow): VariableExpense {
    return {
      id: row.id,
      propertyId: row.property_id,
      propertyName: row.properties?.name,
      expenseDate: row.expense_date,
      category: row.category,
      description: row.description,
      amount: Number(row.amount),
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
