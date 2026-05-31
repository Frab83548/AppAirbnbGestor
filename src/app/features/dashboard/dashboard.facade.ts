import { Injectable, inject } from '@angular/core';
import { DASHBOARD_REPOSITORY } from '../../domain/ports/dashboard.repository';
import { DashboardKpis } from '../../domain/models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardFacade {
  private readonly repo = inject(DASHBOARD_REPOSITORY);

  getKpis(month: number, year: number): Promise<DashboardKpis> {
    return this.repo.getKpis(month, year);
  }

  getMonthlyChart(year?: number) {
    return this.repo.getMonthlyChart(year);
  }

  getPropertyProfitability(month: number, year: number) {
    return this.repo.getPropertyProfitability(month, year);
  }

  getExpenseBreakdown(month: number, year: number) {
    return this.repo.getExpenseBreakdown(month, year);
  }

  getAnnualComparison(year: number) {
    return this.repo.getAnnualComparison(year);
  }

  getPropertyRanking(month: number, year: number) {
    return this.repo.getPropertyRanking(month, year);
  }
}
