import { Component, effect, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { KpiCard } from '../../../shared/ui/kpi-card/kpi-card';
import { LoadingState } from '../../../shared/ui/loading-state/loading-state';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { CurrencyArsPipe } from '../../../shared/pipes/currency-ars.pipe';
import { DashboardFacade } from '../dashboard.facade';
import { PeriodService } from '../../../core/layout/period.service';
import { DashboardKpis } from '../../../domain/models/dashboard.model';
import { PropertyProfitPoint } from '../../../domain/models/dashboard.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, PageHeader, KpiCard, LoadingState, EmptyState, CurrencyArsPipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly facade = inject(DashboardFacade);
  readonly period = inject(PeriodService);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly kpis = signal<DashboardKpis | null>(null);
  readonly ranking = signal<PropertyProfitPoint[]>([]);

  constructor() {
    effect(() => {
      const month = this.period.month();
      const year = this.period.year();
      void this.load(month, year);
    });
  }

  async load(month: number, year: number): Promise<void> {
    this.loading.set(true);
    this.error.set(false);
    try {
      const [kpis, ranking] = await Promise.all([
        this.facade.getKpis(month, year),
        this.facade.getPropertyRanking(month, year),
      ]);
      this.kpis.set(kpis);
      this.ranking.set(ranking);
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  retry(): void {
    void this.load(this.period.month(), this.period.year());
  }
}
