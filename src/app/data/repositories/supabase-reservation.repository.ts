import { Injectable } from '@angular/core';
import { getSupabaseClient } from '../../core/config/supabase.client';
import { AuthService } from '../../core/auth/auth.service';
import { Platform } from '../../domain/enums';
import {
  CreateReservationDto,
  Reservation,
  UpdateReservationDto,
} from '../../domain/models/reservation.model';
import {
  IReservationRepository,
  ReservationFilters,
} from '../../domain/ports/reservation.repository';

interface ReservationRow {
  id: string;
  property_id: string;
  check_in_date: string;
  check_out_date: string;
  platform: Platform;
  amount_charged: number;
  cleaning_cost: number;
  extra_expenses: number;
  notes: string;
  nights: number;
  fran_commission: number;
  gross_profit: number;
  net_profit: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  properties?: { name: string };
}

@Injectable({ providedIn: 'root' })
export class SupabaseReservationRepository implements IReservationRepository {
  private readonly supabase = getSupabaseClient();

  constructor(private readonly auth: AuthService) {}

  async findAll(filters?: ReservationFilters): Promise<Reservation[]> {
    let query = this.supabase
      .from('reservations')
      .select('*, properties(name)')
      .order('check_in_date', { ascending: false });

    if (filters?.propertyId) query = query.eq('property_id', filters.propertyId);
    if (filters?.year) {
      if (filters.month) {
        const start = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`;
        const endMonth = filters.month === 12 ? 1 : filters.month + 1;
        const endYear = filters.month === 12 ? filters.year + 1 : filters.year;
        const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
        query = query.gte('check_in_date', start).lt('check_in_date', end);
      } else {
        query = query
          .gte('check_in_date', `${filters.year}-01-01`)
          .lt('check_in_date', `${filters.year + 1}-01-01`);
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data as ReservationRow[]).map((r) => this.toDomain(r));
  }

  async findById(id: string): Promise<Reservation | null> {
    const { data, error } = await this.supabase
      .from('reservations')
      .select('*, properties(name)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? this.toDomain(data as ReservationRow) : null;
  }

  async create(dto: CreateReservationDto): Promise<Reservation> {
    const userId = await this.auth.getUserId();
    const { data, error } = await this.supabase
      .from('reservations')
      .insert({
        property_id: dto.propertyId,
        check_in_date: dto.checkInDate,
        check_out_date: dto.checkOutDate,
        platform: dto.platform,
        amount_charged: dto.amountCharged,
        cleaning_cost: dto.cleaningCost,
        extra_expenses: dto.extraExpenses,
        notes: dto.notes,
        created_by: userId,
        updated_by: userId,
      })
      .select('*, properties(name)')
      .single();
    if (error) throw error;
    const row = data as ReservationRow;
    await this.syncCleaningExpense(row, userId);
    return this.toDomain(row);
  }

  async update(dto: UpdateReservationDto): Promise<Reservation> {
    const userId = await this.auth.getUserId();
    const payload: Record<string, unknown> = { updated_by: userId };
    if (dto.propertyId !== undefined) payload['property_id'] = dto.propertyId;
    if (dto.checkInDate !== undefined) payload['check_in_date'] = dto.checkInDate;
    if (dto.checkOutDate !== undefined) payload['check_out_date'] = dto.checkOutDate;
    if (dto.platform !== undefined) payload['platform'] = dto.platform;
    if (dto.amountCharged !== undefined) payload['amount_charged'] = dto.amountCharged;
    if (dto.cleaningCost !== undefined) payload['cleaning_cost'] = dto.cleaningCost;
    if (dto.extraExpenses !== undefined) payload['extra_expenses'] = dto.extraExpenses;
    if (dto.notes !== undefined) payload['notes'] = dto.notes;

    const { data, error } = await this.supabase
      .from('reservations')
      .update(payload)
      .eq('id', dto.id)
      .select('*, properties(name)')
      .single();
    if (error) throw error;
    const row = data as ReservationRow;
    await this.syncCleaningExpense(row, userId);
    return this.toDomain(row);
  }

  async delete(id: string): Promise<void> {
    // El gasto de limpieza vinculado se borra solo (FK ON DELETE CASCADE).
    const { error } = await this.supabase.from('reservations').delete().eq('id', id);
    if (error) throw error;
  }

  // Mantiene sincronizado el gasto variable de limpieza asociado a la reserva.
  // La limpieza se computa como gasto variable (categoria 'limpieza') ademas de
  // descontarse en la comision; el ajuste de la vista evita el doble conteo.
  private async syncCleaningExpense(
    row: ReservationRow,
    userId: string | null,
  ): Promise<void> {
    const cleaning = Number(row.cleaning_cost) || 0;

    const { data: existing } = await this.supabase
      .from('variable_expenses')
      .select('id')
      .eq('reservation_id', row.id)
      .eq('category', 'limpieza')
      .maybeSingle();
    const existingId = (existing as { id: string } | null)?.id ?? null;

    if (cleaning <= 0) {
      if (existingId) {
        await this.supabase.from('variable_expenses').delete().eq('id', existingId);
      }
      return;
    }

    const payload = {
      property_id: row.property_id,
      expense_date: row.check_in_date,
      category: 'limpieza',
      description: 'Limpieza',
      amount: cleaning,
      reservation_id: row.id,
      updated_by: userId,
    };

    if (existingId) {
      await this.supabase.from('variable_expenses').update(payload).eq('id', existingId);
    } else {
      await this.supabase
        .from('variable_expenses')
        .insert({ ...payload, created_by: userId });
    }
  }

  private toDomain(row: ReservationRow): Reservation {
    return {
      id: row.id,
      propertyId: row.property_id,
      propertyName: row.properties?.name,
      checkInDate: row.check_in_date,
      checkOutDate: row.check_out_date,
      platform: row.platform,
      amountCharged: Number(row.amount_charged),
      cleaningCost: Number(row.cleaning_cost),
      extraExpenses: Number(row.extra_expenses),
      notes: row.notes,
      nights: row.nights,
      franCommission: Number(row.fran_commission),
      grossProfit: Number(row.gross_profit),
      netProfit: Number(row.net_profit),
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
