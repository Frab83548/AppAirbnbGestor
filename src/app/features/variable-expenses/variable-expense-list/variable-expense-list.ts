import { Component, effect, inject, signal } from '@angular/core';
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
import { VariableExpenseFacade } from '../variable-expense.facade';
import { PeriodService } from '../../../core/layout/period.service';
import { VariableExpense } from '../../../domain/models/expense.model';
import { EXPENSE_CATEGORY_LABELS } from '../../../domain/enums';
import { VariableExpenseFormDialog } from '../variable-expense-form-dialog/variable-expense-form-dialog';
import { ConfirmService } from '../../../shared/ui/confirm-dialog/confirm.service';

@Component({
  selector: 'app-variable-expense-list',
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
  templateUrl: './variable-expense-list.html',
  styleUrl: './variable-expense-list.scss',
})
export class VariableExpenseList {
  private readonly facade = inject(VariableExpenseFacade);
  private readonly period = inject(PeriodService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly confirmService = inject(ConfirmService);

  readonly loading = signal(true);
  readonly expenses = signal<VariableExpense[]>([]);
  readonly categoryLabels = EXPENSE_CATEGORY_LABELS;
  readonly displayedColumns = ['expenseDate', 'property', 'category', 'description', 'amount', 'actions'];

  constructor() {
    effect(() => {
      void this.load(this.period.month(), this.period.year());
    });
  }

  categoryLabel(category: VariableExpense['category']): string {
    return this.categoryLabels[category];
  }

  async load(month: number, year: number): Promise<void> {
    this.loading.set(true);
    try {
      this.expenses.set(await this.facade.findAll({ month, year }));
    } catch {
      this.snackBar.open('Error al cargar gastos', 'Cerrar', { duration: 3000 });
    } finally {
      this.loading.set(false);
    }
  }

  openCreate(): void {
    const ref = this.dialog.open(VariableExpenseFormDialog, { width: '520px', data: null });
    ref.afterClosed().subscribe(
      (saved) => saved && void this.load(this.period.month(), this.period.year()),
    );
  }

  openEdit(expense: VariableExpense): void {
    const ref = this.dialog.open(VariableExpenseFormDialog, { width: '520px', data: expense });
    ref.afterClosed().subscribe(
      (saved) => saved && void this.load(this.period.month(), this.period.year()),
    );
  }

  async deleteExpense(expense: VariableExpense): Promise<void> {
    const confirmed = await this.confirmService.confirm({
      title: 'Eliminar gasto',
      message: '¿Seguro que querés eliminar este gasto? Esta acción no se puede deshacer.',
      confirmText: 'Eliminar',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await this.facade.delete(expense.id);
      this.snackBar.open('Gasto eliminado', 'Cerrar', { duration: 3000 });
      await this.load(this.period.month(), this.period.year());
    } catch {
      this.snackBar.open('Error al eliminar el gasto', 'Cerrar', { duration: 3000 });
    }
  }
}
