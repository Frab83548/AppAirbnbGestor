import { Component, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { LoadingState } from '../../../shared/ui/loading-state/loading-state';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { CurrencyArsPipe } from '../../../shared/pipes/currency-ars.pipe';
import { FixedExpenseFacade } from '../fixed-expense.facade';
import { PeriodService } from '../../../core/layout/period.service';
import { FixedExpense } from '../../../domain/models/expense.model';
import { FixedExpenseFormDialog } from '../fixed-expense-form-dialog/fixed-expense-form-dialog';

@Component({
  selector: 'app-fixed-expense-list',
  standalone: true,
  imports: [
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
  templateUrl: './fixed-expense-list.html',
  styleUrl: './fixed-expense-list.scss',
})
export class FixedExpenseList {
  private readonly facade = inject(FixedExpenseFacade);
  private readonly period = inject(PeriodService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly loading = signal(true);
  readonly duplicating = signal(false);
  readonly expenses = signal<FixedExpense[]>([]);
  readonly displayedColumns = ['property', 'total', 'building', 'electricity', 'actions'];

  constructor() {
    effect(() => {
      void this.load(this.period.month(), this.period.year());
    });
  }

  async load(month: number, year: number): Promise<void> {
    this.loading.set(true);
    try {
      this.expenses.set(await this.facade.findAll({ month, year }));
    } catch {
      this.snackBar.open('Error al cargar gastos fijos', 'Cerrar', { duration: 3000 });
    } finally {
      this.loading.set(false);
    }
  }

  openCreate(): void {
    const ref = this.dialog.open(FixedExpenseFormDialog, { width: '640px', data: null });
    ref.afterClosed().subscribe(
      (saved) => saved && void this.load(this.period.month(), this.period.year()),
    );
  }

  openEdit(expense: FixedExpense): void {
    const ref = this.dialog.open(FixedExpenseFormDialog, { width: '640px', data: expense });
    ref.afterClosed().subscribe(
      (saved) => saved && void this.load(this.period.month(), this.period.year()),
    );
  }

  async deleteExpense(expense: FixedExpense): Promise<void> {
    if (!confirm('¿Eliminar gastos fijos de esta propiedad?')) return;
    await this.facade.delete(expense.id);
    await this.load(this.period.month(), this.period.year());
  }

  async duplicatePrevious(): Promise<void> {
    const month = this.period.month();
    const year = this.period.year();
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;

    this.duplicating.set(true);
    try {
      const count = await this.facade.duplicateFromPreviousMonth(
        prevMonth,
        prevYear,
        month,
        year,
      );
      this.snackBar.open(`${count} registro(s) duplicado(s)`, 'Cerrar', { duration: 3000 });
      await this.load(this.period.month(), this.period.year());
    } catch {
      this.snackBar.open('Error al duplicar gastos', 'Cerrar', { duration: 3000 });
    } finally {
      this.duplicating.set(false);
    }
  }
}
