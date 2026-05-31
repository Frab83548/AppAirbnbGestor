import { Injectable } from '@angular/core';
import { getSupabaseClient } from '../../core/config/supabase.client';
import {
  AnnualComparisonPoint,
  DashboardKpis,
  ExpenseBreakdownPoint,
  MonthlyChartPoint,
  PropertyProfitPoint,
} from '../../domain/models/dashboard.model';
import { IDashboardRepository } from '../../domain/ports/dashboard.repository';

@Injectable({ providedIn: 'root' })
export class SupabaseDashboardRepository implements IDashboardRepository {
  private readonly supabase = getSupabaseClient();

  async getKpis(month: number, year: number): Promise<DashboardKpis> {
    const { data, error } = await this.supabase.rpc('get_dashboard_kpis', {
      p_month: month,
      p_year: year,
    });
    if (error) throw error;
    const k = data as Record<string, number>;
    return {
      totalIncome: Number(k['totalIncome'] ?? 0),
      fixedExpenses: Number(k['fixedExpenses'] ?? 0),
      variableExpenses: Number(k['variableExpenses'] ?? 0),
      franCommission: Number(k['franCommission'] ?? 0),
      netProfit: Number(k['netProfit'] ?? 0),
      profitabilityPct: Number(k['profitabilityPct'] ?? 0),
      breakEvenAmount: Number(k['breakEvenAmount'] ?? 0),
      reservationCount: Number(k['reservationCount'] ?? 0),
      totalNights: Number(k['totalNights'] ?? 0),
      avgTicket: Number(k['avgTicket'] ?? 0),
      profitPerNight: Number(k['profitPerNight'] ?? 0),
    };
  }

  async getMonthlyChart(year?: number): Promise<MonthlyChartPoint[]> {
    const { data, error } = await this.supabase.rpc('get_monthly_chart_data', {
      p_year: year ?? null,
    });
    if (error) throw error;
    return ((data as MonthlyChartPoint[]) ?? []).reverse();
  }

  async getPropertyProfitability(month: number, year: number): Promise<PropertyProfitPoint[]> {
    const { data, error } = await this.supabase.rpc('get_property_profitability_chart', {
      p_month: month,
      p_year: year,
    });
    if (error) throw error;
    return (data as PropertyProfitPoint[]) ?? [];
  }

  async getExpenseBreakdown(month: number, year: number): Promise<ExpenseBreakdownPoint[]> {
    const { data, error } = await this.supabase.rpc('get_expense_breakdown_chart', {
      p_month: month,
      p_year: year,
    });
    if (error) throw error;
    return (data as ExpenseBreakdownPoint[]) ?? [];
  }

  async getAnnualComparison(year: number): Promise<AnnualComparisonPoint[]> {
    const { data, error } = await this.supabase.rpc('get_annual_comparison_chart', {
      p_year: year,
    });
    if (error) throw error;
    return (data as AnnualComparisonPoint[]) ?? [];
  }

  async getPropertyRanking(month: number, year: number): Promise<PropertyProfitPoint[]> {
    const { data, error } = await this.supabase.rpc('get_property_ranking', {
      p_month: month,
      p_year: year,
    });
    if (error) throw error;
    return (data as PropertyProfitPoint[]) ?? [];
  }
}
