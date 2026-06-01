import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { VariableExpenseFacade } from '../variable-expense.facade';
import { PropertyFacade } from '../../properties/property.facade';
import { VariableExpense } from '../../../domain/models/expense.model';
import { Property } from '../../../domain/models/property.model';
import { ExpenseCategory, EXPENSE_CATEGORY_LABELS } from '../../../domain/enums';
import { DateFieldComponent } from '../../../shared/ui/date-field/date-field';
import { parseIsoDateLocal, toIsoDateLocal } from '../../../shared/utils/date.util';

@Component({
  selector: 'app-variable-expense-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    DateFieldComponent,
  ],
  templateUrl: './variable-expense-form-dialog.html',
})
export class VariableExpenseFormDialog implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly facade = inject(VariableExpenseFacade);
  private readonly propertyFacade = inject(PropertyFacade);
  private readonly dialogRef = inject(MatDialogRef<VariableExpenseFormDialog>);
  readonly data = inject<VariableExpense | null>(MAT_DIALOG_DATA);

  readonly loading = signal(false);
  readonly properties = signal<Property[]>([]);
  readonly categoryOptions = Object.entries(EXPENSE_CATEGORY_LABELS) as [ExpenseCategory, string][];

  readonly form = this.fb.nonNullable.group({
    propertyId: [this.data?.propertyId ?? '', Validators.required],
    expenseDate: [
      this.data ? parseIsoDateLocal(this.data.expenseDate) : new Date(),
      Validators.required,
    ],
    category: [this.data?.category ?? ('otros' as ExpenseCategory), Validators.required],
    description: [this.data?.description ?? ''],
    amount: [this.data?.amount ?? 0, [Validators.required, Validators.min(0)]],
  });

  get isEdit(): boolean {
    return !!this.data;
  }

  ngOnInit(): void {
    void this.propertyFacade.findAll().then((p) => this.properties.set(p));
  }

  async save(): Promise<void> {
    if (this.form.invalid) return;
    this.loading.set(true);
    const v = this.form.getRawValue();
    const dto = {
      propertyId: v.propertyId,
      expenseDate: toIsoDateLocal(v.expenseDate as Date),
      category: v.category,
      description: v.description,
      amount: v.amount,
    };
    try {
      if (this.data) {
        await this.facade.update({ id: this.data.id, ...dto });
      } else {
        await this.facade.create(dto);
      }
      this.dialogRef.close(true);
    } finally {
      this.loading.set(false);
    }
  }
}
