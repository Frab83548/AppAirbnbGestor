import { InjectionToken } from '@angular/core';
import {
  AnnualComparisonPoint,
  DashboardKpis,
  ExpenseBreakdownPoint,
  MonthlyChartPoint,
  PropertyProfitPoint,
} from '../models/dashboard.model';

export interface IDashboardRepository {
  getKpis(month: number, year: number): Promise<DashboardKpis>;
  getMonthlyChart(year?: number): Promise<MonthlyChartPoint[]>;
  getPropertyProfitability(month: number, year: number): Promise<PropertyProfitPoint[]>;
  getExpenseBreakdown(month: number, year: number): Promise<ExpenseBreakdownPoint[]>;
  getAnnualComparison(year: number): Promise<AnnualComparisonPoint[]>;
  getPropertyRanking(month: number, year: number): Promise<PropertyProfitPoint[]>;
}

export const DASHBOARD_REPOSITORY = new InjectionToken<IDashboardRepository>(
  'DASHBOARD_REPOSITORY',
);
