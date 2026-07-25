import { TitleCasePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
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
import { PropertyFacade } from '../../properties/property.facade';
import { ExportService } from '../../../data/services/export.service';
import { ReportKpiCalculator } from '../../../domain/services/report-kpi.calculator';
import { Property } from '../../../domain/models/property.model';
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
export class Reports implements OnInit {
  readonly period = inject(PeriodService);
  private readonly dashboardFacade = inject(DashboardFacade);
  private readonly incomeFacade = inject(IncomeFacade);
  private readonly variableFacade = inject(VariableExpenseFacade);
  private readonly fixedFacade = inject(FixedExpenseFacade);
  private readonly propertyFacade = inject(PropertyFacade);
  private readonly exportService = inject(ExportService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly periodMode = signal<ReportPeriodMode>('monthly');
  readonly weekAnchor = signal(new Date());
  readonly properties = signal<Property[]>([]);
  readonly ALL_PROPERTIES = '';
  readonly selectedPropertyId = signal('');

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

  readonly selectedPropertyName = computed(() => {
    const id = this.selectedPropertyId();
    if (!id) return null;
    return this.properties().find((p) => p.id === id)?.name ?? null;
  });

  readonly periodLabel = computed(() => {
    const mode = this.periodMode();
    if (mode === 'monthly') return this.period.getMonthLabel();
    const { dateFrom, dateTo } = this.activeRange();
    if (mode === 'weekly') return `Semana ${formatRangeLabel(dateFrom, dateTo)}`;
    return formatRangeLabel(dateFrom, dateTo);
  });

  readonly exportSubtitle = computed(() => {
    const property = this.selectedPropertyName();
    const base = this.periodLabel();
    return property ? `${base} — ${property}` : base;
  });

  readonly periodHint = computed(() => {
    const mode = this.periodMode();
    if (mode === 'monthly') {
      return 'Usa el selector de mes/año del encabezado o cambialo acá.';
    }
    if (mode === 'weekly') {
      return 'Semana de lunes a domingo. Se suman las cargas de gastos fijos con fecha de ingreso dentro del rango.';
    }
    return 'Elegí fecha desde y hasta. Se suman las cargas de gastos fijos con fecha de ingreso dentro del rango.';
  });

  ngOnInit(): void {
    void this.propertyFacade.findAll().then((properties) => this.properties.set(properties));
  }

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

  onPropertyChange(propertyId: string): void {
    this.selectedPropertyId.set(propertyId);
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

  private propertyFilter(): { propertyId?: string } {
    const propertyId = this.selectedPropertyId();
    return propertyId ? { propertyId } : {};
  }

  private async gatherData() {
    const range = this.activeRange();
    if (!this.validateRange(range)) {
      throw new Error('Rango invalido');
    }

    const mode = this.periodMode();
    const propertyFilter = this.propertyFilter();
    const dateFilters = { dateFrom: range.dateFrom, dateTo: range.dateTo, ...propertyFilter };

    // Mensual: por periodo contable; semanal/rango: por fecha de ingreso (entry_date).
    const fixedQuery = mode === 'monthly'
      ? this.fixedFacade.findAll({
        month: this.period.month(),
        year: this.period.year(),
        ...propertyFilter,
      })
      : this.fixedFacade.findAll({
        entryDateFrom: range.dateFrom,
        entryDateTo: range.dateTo,
        ...propertyFilter,
      });

    const [reservations, variableExpenses, fixedExpenses] = await Promise.all([
      this.incomeFacade.findAll(dateFilters),
      this.variableFacade.findAll(dateFilters),
      fixedQuery,
    ]);

    let kpis;
    if (mode === 'monthly' && !propertyFilter.propertyId) {
      kpis = await this.dashboardFacade.getKpis(this.period.month(), this.period.year());
    } else {
      const fixedTotal = fixedExpenses.reduce((sum, e) => sum + e.total, 0);
      kpis = ReportKpiCalculator.fromData(reservations, variableExpenses, fixedTotal);
    }

    return {
      range,
      label: this.exportSubtitle(),
      propertyName: this.selectedPropertyName(),
      kpis,
      reservations,
      variableExpenses,
      fixedExpenses,
    };
  }

  private reportTitle(): string {
    const mode = this.periodMode();
    const propertySuffix = this.selectedPropertyName()
      ? ` — ${this.selectedPropertyName()}`
      : '';
    if (mode === 'monthly') return `Reporte Mensual ${this.periodLabel()}${propertySuffix}`;
    if (mode === 'weekly') return `Reporte Semanal ${this.periodLabel()}${propertySuffix}`;
    return `Reporte ${this.periodLabel()}${propertySuffix}`;
  }

  async exportPdf(): Promise<void> {
    this.loading.set(true);
    try {
      const { kpis, reservations, variableExpenses, fixedExpenses } = await this.gatherData();
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
      const propertyFilter = this.propertyFilter();
      const [reservations, variableExpenses, fixedExpenses] = await Promise.all([
        this.incomeFacade.findAll({ year, ...propertyFilter }),
        this.variableFacade.findAll({ year, ...propertyFilter }),
        this.fixedFacade.findAll({ year, ...propertyFilter }),
      ]);

      let kpis;
      if (!propertyFilter.propertyId) {
        kpis = await this.dashboardFacade.getKpis(12, year);
      } else {
        const fixedTotal = fixedExpenses.reduce((sum, e) => sum + e.total, 0);
        kpis = ReportKpiCalculator.fromData(reservations, variableExpenses, fixedTotal);
      }

      const propertySuffix = this.selectedPropertyName()
        ? ` — ${this.selectedPropertyName()}`
        : '';
      this.exportService.exportPdfMonthly(
        `Reporte Anual ${year}${propertySuffix}`,
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
      const { range, propertyName, kpis, reservations, variableExpenses, fixedExpenses } =
        await this.gatherData();
      const filename = buildExportFilename(
        'Reporte',
        range.dateFrom,
        range.dateTo,
        propertyName ?? undefined,
      );
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
      const { range, propertyName, reservations } = await this.gatherData();
      const filename = buildExportFilename(
        'Ingresos',
        range.dateFrom,
        range.dateTo,
        propertyName ?? undefined,
      );
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
