import { Component, effect, inject, signal, ViewChild } from '@angular/core';
import {
  ChartComponent,
  NgApexchartsModule,
  ApexAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexStroke,
  ApexDataLabels,
  ApexYAxis,
  ApexLegend,
  ApexFill,
  ApexPlotOptions,
  ApexNonAxisChartSeries,
} from 'ng-apexcharts';
import { MatButtonModule } from '@angular/material/button';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { LoadingState } from '../../../shared/ui/loading-state/loading-state';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { DashboardFacade } from '../../dashboard/dashboard.facade';
import { PeriodService } from '../../../core/layout/period.service';

export type LineChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  stroke: ApexStroke;
  dataLabels: ApexDataLabels;
  yaxis: ApexYAxis;
  legend: ApexLegend;
  colors: string[];
};

export type BarChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  plotOptions: ApexPlotOptions;
  dataLabels: ApexDataLabels;
  colors: string[];
};

export type PieChartOptions = {
  series: ApexNonAxisChartSeries;
  chart: ApexChart;
  labels: string[];
  legend: ApexLegend;
  fill: ApexFill;
  colors: string[];
};

@Component({
  selector: 'app-financial-dashboard',
  standalone: true,
  imports: [NgApexchartsModule, MatButtonModule, PageHeader, LoadingState, EmptyState],
  templateUrl: './financial-dashboard.html',
  styleUrl: './financial-dashboard.scss',
})
export class FinancialDashboard {
  private readonly facade = inject(DashboardFacade);
  readonly period = inject(PeriodService);

  readonly loading = signal(true);
  readonly error = signal(false);

  lineChart = signal<Partial<LineChartOptions> | null>(null);
  barChart = signal<Partial<BarChartOptions> | null>(null);
  pieChart = signal<Partial<PieChartOptions> | null>(null);
  annualChart = signal<Partial<BarChartOptions> | null>(null);

  @ViewChild('lineChartRef') lineChartRef?: ChartComponent;

  constructor() {
    effect(() => {
      const month = this.period.month();
      const year = this.period.year();
      void this.load(month, year);
    });
  }

  retry(): void {
    void this.load(this.period.month(), this.period.year());
  }

  async load(month: number, year: number): Promise<void> {
    this.loading.set(true);
    this.error.set(false);
    try {
      const [monthly, properties, breakdown, annual] = await Promise.all([
        this.facade.getMonthlyChart(year),
        this.facade.getPropertyProfitability(month, year),
        this.facade.getExpenseBreakdown(month, year),
        this.facade.getAnnualComparison(year),
      ]);

      const monthLabels = monthly.map(
        (m) =>
          new Date(m.year, m.month - 1).toLocaleDateString('es-AR', { month: 'short' }),
      );

      this.lineChart.set({
        series: [
          { name: 'Ingresos', data: monthly.map((m) => m.income) },
          { name: 'Gastos', data: monthly.map((m) => m.expenses) },
          { name: 'Ganancia', data: monthly.map((m) => m.profit) },
        ],
        chart: { type: 'line', height: 320, toolbar: { show: false }, background: 'transparent' },
        xaxis: { categories: monthLabels },
        stroke: { curve: 'smooth', width: 2 },
        dataLabels: { enabled: false },
        yaxis: { labels: { formatter: (v) => `$${(v / 1000).toFixed(0)}k` } },
        legend: { position: 'top' },
        colors: ['#2563eb', '#dc2626', '#16a34a'],
      });

      this.barChart.set({
        series: [{ name: 'Ganancia neta', data: properties.map((p) => p.net_profit) }],
        chart: { type: 'bar', height: 320, toolbar: { show: false }, background: 'transparent' },
        xaxis: { categories: properties.map((p) => p.property_name) },
        plotOptions: { bar: { borderRadius: 6, columnWidth: '50%' } },
        dataLabels: { enabled: false },
        colors: ['#2563eb'],
      });

      this.pieChart.set({
        series: breakdown.map((b) => b.amount),
        chart: { type: 'donut', height: 320, background: 'transparent' },
        labels: breakdown.map((b) => b.label),
        legend: { position: 'bottom' },
        fill: { type: 'solid' },
        colors: ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#64748b'],
      });

      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      this.annualChart.set({
        series: [
          { name: 'Ingresos', data: annual.map((a) => a.income) },
          { name: 'Costos', data: annual.map((a) => a.costs) },
          { name: 'Ganancia', data: annual.map((a) => a.profit) },
        ],
        chart: { type: 'bar', height: 320, toolbar: { show: false }, background: 'transparent' },
        xaxis: { categories: annual.map((a) => monthNames[a.month - 1]) },
        plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } },
        dataLabels: { enabled: false },
        colors: ['#2563eb', '#dc2626', '#16a34a'],
      });
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
