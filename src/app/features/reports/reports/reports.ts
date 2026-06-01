import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { PeriodService } from '../../../core/layout/period.service';
import { DashboardFacade } from '../../dashboard/dashboard.facade';
import { IncomeFacade } from '../../income/income.facade';
import { VariableExpenseFacade } from '../../variable-expenses/variable-expense.facade';
import { FixedExpenseFacade } from '../../fixed-expenses/fixed-expense.facade';
import { ExportService } from '../../../data/services/export.service';
import { formatIsoToDdMmYyyy } from '../../../shared/utils/date.util';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatCardModule, MatSnackBarModule, PageHeader],
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

  readonly loading = signal(false);

  private async gatherData() {
    const month = this.period.month();
    const year = this.period.year();
    const [kpis, reservations, variableExpenses, fixedExpenses] = await Promise.all([
      this.dashboardFacade.getKpis(month, year),
      this.incomeFacade.findAll({ month, year }),
      this.variableFacade.findAll({ month, year }),
      this.fixedFacade.findAll({ month, year }),
    ]);
    return { month, year, kpis, reservations, variableExpenses, fixedExpenses };
  }

  async exportPdfMonthly(): Promise<void> {
    this.loading.set(true);
    try {
      const { month, year, kpis, reservations, variableExpenses, fixedExpenses } =
        await this.gatherData();
      this.exportService.exportPdfMonthly(
        `Reporte_Mensual_${month}_${year}`,
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

  async exportPdfAnnual(): Promise<void> {
    this.loading.set(true);
    try {
      const year = this.period.year();
      const kpis = await this.dashboardFacade.getKpis(12, year);
      const reservations = await this.incomeFacade.findAll({ year });
      const variableExpenses = await this.variableFacade.findAll({ year });
      const fixedExpenses = await this.fixedFacade.findAll({ year });
      this.exportService.exportPdfMonthly(
        `Reporte_Anual_${year}`,
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
      const { month, year, kpis, reservations, variableExpenses, fixedExpenses } =
        await this.gatherData();
      this.exportService.exportExcel(
        kpis,
        reservations,
        variableExpenses,
        fixedExpenses,
        `Reporte_${month}_${year}`,
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
      const { month, year, reservations } = await this.gatherData();
      this.exportService.exportCsv(
        reservations.map((r) => ({
          fecha: formatIsoToDdMmYyyy(r.checkInDate),
          propiedad: r.propertyName,
          plataforma: r.platform,
          cobrado: r.amountCharged,
          comisionFran: r.franCommission,
          gananciaNeta: r.netProfit,
        })),
        `Ingresos_${month}_${year}`,
      );
    } catch {
      this.snackBar.open('Error al exportar CSV', 'Cerrar', { duration: 3000 });
    } finally {
      this.loading.set(false);
    }
  }
}
