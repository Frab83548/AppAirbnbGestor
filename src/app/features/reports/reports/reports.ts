import { TitleCasePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { map, startWith } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { DateFieldComponent } from '../../../shared/ui/date-field/date-field';
import { PeriodService } from '../../../core/layout/period.service';
import { DashboardFacade } from '../../dashboard/dashboard.facade';
import { IncomeFacade } from '../../income/income.facade';
import { VariableExpenseFacade } from '../../variable-expenses/variable-expense.facade';
import { FixedExpenseFacade } from '../../fixed-expenses/fixed-expense.facade';
import { ExportService } from '../../../data/services/export.service';
import { ReportKpiCalculator } from '../../../domain/services/report-kpi.calculator';
import { formatIsoToDdMmYyyy, toIsoDateLocal } from '../../../shared/utils/date.util';
import {
  buildExportFilename,
  formatRangeLabel,
  getMonthRange,
  getWeekRange,
  ReportDateRange,
  ReportPeriodMode,
  shiftWeek,
} from '../report-period.util';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatSnackBarModule,
    PageHeader,
    DateFieldComponent,
    TitleCasePipe,
  ],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
})
export class Reports {
  readonly period = inject(PeriodService);
  private readonly dashboardFacade = inject(DashboardFacade);
  private readonly incomeFacade = inject(IncomeFacade);
  private readonly variableFacade = inject(VariableExpenseFacade);
  private readonly fixedFacade = inject(FixedExpenseFacade);
  private readonly exportService = inject(ExportService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly periodMode = signal<ReportPeriodMode>('monthly');
  readonly weekAnchor = signal(new Date());

  readonly customRangeForm = this.fb.nonNullable.group({
    dateFrom: [new Date(new Date().getFullYear(), new Date().getMonth(), 1), Validators.required],
    dateTo: [new Date(), Validators.required],
  });

  private readonly customRange = toSignal(
    this.customRangeForm.valueChanges.pipe(
      startWith(this.customRangeForm.getRawValue()),
      map(() => this.customRangeForm.getRawValue()),
    ),
    { initialValue: this.customRangeForm.getRawValue() },
  );

  readonly activeRange = computed<ReportDateRange>(() => {
    const mode = this.periodMode();
    if (mode === 'monthly') {
      return getMonthRange(this.period.month(), this.period.year());
    }
    if (mode === 'weekly') {
      return getWeekRange(this.weekAnchor());
    }
    const v = this.customRange();
    return {
      dateFrom: toIsoDateLocal(v.dateFrom),
      dateTo: toIsoDateLocal(v.dateTo),
    };
  });

  readonly periodLabel = computed(() => {
    const mode = this.periodMode();
    if (mode === 'monthly') return this.period.getMonthLabel();
    const { dateFrom, dateTo } = this.activeRange();
    if (mode === 'weekly') return `Semana ${formatRangeLabel(dateFrom, dateTo)}`;
    return formatRangeLabel(dateFrom, dateTo);
  });

  readonly periodHint = computed(() => {
    const mode = this.periodMode();
    if (mode === 'monthly') {
      return 'Usa el selector de mes/año del encabezado o cambialo acá.';
    }
    if (mode === 'weekly') {
      return 'Semana de lunes a domingo. Se suman los gastos fijos cargados dentro del rango.';
    }
    return 'Elegí fecha desde y hasta. Se suman los gastos fijos cargados dentro del rango.';
  });

  onModeChange(mode: ReportPeriodMode): void {
    this.periodMode.set(mode);
    if (mode === 'weekly') {
      this.weekAnchor.set(new Date());
    }
  }

  onMonthChange(month: number): void {
    this.period.setPeriod(month, this.period.year());
  }

  onYearChange(year: number): void {
    this.period.setPeriod(this.period.month(), year);
  }

  shiftWeek(delta: number): void {
    this.weekAnchor.set(shiftWeek(this.weekAnchor(), delta));
  }

  goToCurrentWeek(): void {
    this.weekAnchor.set(new Date());
  }

  private validateRange(range: ReportDateRange): boolean {
    if (range.dateFrom > range.dateTo) {
      this.snackBar.open('La fecha desde no puede ser posterior a la fecha hasta', 'Cerrar', {
        duration: 4000,
      });
      return false;
    }
    return true;
  }

  private async gatherData() {
    const range = this.activeRange();
    if (!this.validateRange(range)) {
      throw new Error('Rango invalido');
    }

    const mode = this.periodMode();
    const dateFilters = { dateFrom: range.dateFrom, dateTo: range.dateTo };

    // Mensual: gastos fijos del mes (periodo); semanal/rango: por fecha de carga.
    const fixedQuery = mode === 'monthly'
      ? this.fixedFacade.findAll({ month: this.period.month(), year: this.period.year() })
      : this.fixedFacade.findAll({ createdFrom: range.dateFrom, createdTo: range.dateTo });

    const [reservations, variableExpenses, fixedExpenses] = await Promise.all([
      this.incomeFacade.findAll(dateFilters),
      this.variableFacade.findAll(dateFilters),
      fixedQuery,
    ]);

    let kpis;
    if (mode === 'monthly') {
      kpis = await this.dashboardFacade.getKpis(this.period.month(), this.period.year());
    } else {
      const fixedTotal = fixedExpenses.reduce((sum, e) => sum + e.total, 0);
      kpis = ReportKpiCalculator.fromData(reservations, variableExpenses, fixedTotal);
    }

    return {
      range,
      label: this.periodLabel(),
      kpis,
      reservations,
      variableExpenses,
      fixedExpenses,
    };
  }

  private reportTitle(): string {
    const mode = this.periodMode();
    if (mode === 'monthly') return `Reporte Mensual ${this.periodLabel()}`;
    if (mode === 'weekly') return `Reporte Semanal ${this.periodLabel()}`;
    return `Reporte ${this.periodLabel()}`;
  }

  async exportPdf(): Promise<void> {
    this.loading.set(true);
    try {
      const { range, kpis, reservations, variableExpenses, fixedExpenses } =
        await this.gatherData();
      this.exportService.exportPdfMonthly(
        this.reportTitle(),
        kpis,
        reservations,
        variableExpenses,
        fixedExpenses,
      );
    } catch {
      this.snackBar.open('Error al generar PDF', 'Cerrar', { duration: 3000 });
    } finally {
      this.loading.set(false);
    }
  }

  async exportAnnualPdf(): Promise<void> {
    this.loading.set(true);
    try {
      const year = this.period.year();
      const [reservations, variableExpenses, fixedExpenses, kpis] = await Promise.all([
        this.incomeFacade.findAll({ year }),
        this.variableFacade.findAll({ year }),
        this.fixedFacade.findAll({ year }),
        this.dashboardFacade.getKpis(12, year),
      ]);
      this.exportService.exportPdfMonthly(
        `Reporte Anual ${year}`,
        kpis,
        reservations,
        variableExpenses,
        fixedExpenses,
      );
    } catch {
      this.snackBar.open('Error al generar PDF anual', 'Cerrar', { duration: 3000 });
    } finally {
      this.loading.set(false);
    }
  }

  async exportExcel(): Promise<void> {
    this.loading.set(true);
    try {
      const { range, kpis, reservations, variableExpenses, fixedExpenses } =
        await this.gatherData();
      const filename = buildExportFilename('Reporte', range.dateFrom, range.dateTo);
      this.exportService.exportExcel(
        kpis,
        reservations,
        variableExpenses,
        fixedExpenses,
        filename,
      );
    } catch {
      this.snackBar.open('Error al exportar Excel', 'Cerrar', { duration: 3000 });
    } finally {
      this.loading.set(false);
    }
  }

  async exportCsv(): Promise<void> {
    this.loading.set(true);
    try {
      const { range, reservations } = await this.gatherData();
      const filename = buildExportFilename('Ingresos', range.dateFrom, range.dateTo);
      this.exportService.exportCsv(
        reservations.map((r) => ({
          fecha: formatIsoToDdMmYyyy(r.checkInDate),
          propiedad: r.propertyName,
          plataforma: r.platform,
          cobrado: r.amountCharged,
          comisionFran: r.franCommission,
          gananciaNeta: r.netProfit,
        })),
        filename,
      );
    } catch {
      this.snackBar.open('Error al exportar CSV', 'Cerrar', { duration: 3000 });
    } finally {
      this.loading.set(false);
    }
  }
}
