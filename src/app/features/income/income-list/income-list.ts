import { Component, computed, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DatePipe } from '@angular/common';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { LoadingState } from '../../../shared/ui/loading-state/loading-state';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { CurrencyArsPipe } from '../../../shared/pipes/currency-ars.pipe';
import { IncomeFacade } from '../income.facade';
import { PeriodService } from '../../../core/layout/period.service';
import { Reservation } from '../../../domain/models/reservation.model';
import { PLATFORM_LABELS } from '../../../domain/enums';
import { IncomeFormDialog } from '../income-form-dialog/income-form-dialog';
import { ConfirmService } from '../../../shared/ui/confirm-dialog/confirm.service';

@Component({
  selector: 'app-income-list',
  standalone: true,
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatDialogModule,
    MatSnackBarModule,
    PageHeader,
    LoadingState,
    EmptyState,
    CurrencyArsPipe,
  ],
  templateUrl: './income-list.html',
  styleUrl: './income-list.scss',
})
export class IncomeList {
  private readonly facade = inject(IncomeFacade);
  private readonly period = inject(PeriodService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly confirmService = inject(ConfirmService);

  readonly loading = signal(true);
  readonly reservations = signal<Reservation[]>([]);
  readonly platformLabels = PLATFORM_LABELS;
  readonly displayedColumns = [
    'checkInDate',
    'property',
    'platform',
    'amountCharged',
    'franCommission',
    'netProfit',
    'actions',
  ];

  readonly totals = computed(() => {
    const items = this.reservations();
    return {
      income: items.reduce((s, r) => s + r.amountCharged, 0),
      commission: items.reduce((s, r) => s + r.franCommission, 0),
      net: items.reduce((s, r) => s + r.netProfit, 0),
    };
  });

  constructor() {
    effect(() => {
      const month = this.period.month();
      const year = this.period.year();
      void this.load(month, year);
    });
  }

  platformLabel(platform: Reservation['platform']): string {
    return this.platformLabels[platform];
  }

  async load(month: number, year: number): Promise<void> {
    this.loading.set(true);
    try {
      this.reservations.set(await this.facade.findAll({ month, year }));
    } catch {
      this.snackBar.open('Error al cargar ingresos', 'Cerrar', { duration: 3000 });
    } finally {
      this.loading.set(false);
    }
  }

  openCreate(): void {
    const ref = this.dialog.open(IncomeFormDialog, { width: '600px', data: null });
    ref.afterClosed().subscribe((saved) => saved && void this.load(this.period.month(), this.period.year()));
  }

  openEdit(reservation: Reservation): void {
    const ref = this.dialog.open(IncomeFormDialog, { width: '600px', data: reservation });
    ref.afterClosed().subscribe((saved) => saved && void this.load(this.period.month(), this.period.year()));
  }

  async deleteReservation(r: Reservation): Promise<void> {
    const confirmed = await this.confirmService.confirm({
      title: 'Eliminar ingreso',
      message: '¿Seguro que querés eliminar este ingreso? Esta acción no se puede deshacer.',
      confirmText: 'Eliminar',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await this.facade.delete(r.id);
      this.snackBar.open('Ingreso eliminado', 'Cerrar', { duration: 3000 });
      await this.load(this.period.month(), this.period.year());
    } catch {
      this.snackBar.open('Error al eliminar', 'Cerrar', { duration: 3000 });
    }
  }
}
