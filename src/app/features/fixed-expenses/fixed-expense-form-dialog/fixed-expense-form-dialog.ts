import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { FixedExpenseFacade } from '../fixed-expense.facade';
import { PropertyFacade } from '../../properties/property.facade';
import { PeriodService } from '../../../core/layout/period.service';
import { FixedExpense } from '../../../domain/models/expense.model';
import { Property } from '../../../domain/models/property.model';

@Component({
  selector: 'app-fixed-expense-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
  ],
  templateUrl: './fixed-expense-form-dialog.html',
  styles: `.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 1rem; } .full { grid-column: 1 / -1; }`,
})
export class FixedExpenseFormDialog implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly facade = inject(FixedExpenseFacade);
  private readonly propertyFacade = inject(PropertyFacade);
  private readonly period = inject(PeriodService);
  private readonly dialogRef = inject(MatDialogRef<FixedExpenseFormDialog>);
  readonly data = inject<FixedExpense | null>(MAT_DIALOG_DATA);

  readonly loading = signal(false);
  readonly properties = signal<Property[]>([]);

  readonly form = this.fb.nonNullable.group({
    propertyId: [this.data?.propertyId ?? '', Validators.required],
    month: [this.data?.month ?? this.period.month(), Validators.required],
    year: [this.data?.year ?? this.period.year(), Validators.required],
    buildingExpenses: [this.data?.buildingExpenses ?? 0, Validators.min(0)],
    electricity: [this.data?.electricity ?? 0, Validators.min(0)],
    water: [this.data?.water ?? 0, Validators.min(0)],
    gas: [this.data?.gas ?? 0, Validators.min(0)],
    internet: [this.data?.internet ?? 0, Validators.min(0)],
    municipality: [this.data?.municipality ?? 0, Validators.min(0)],
    others: [this.data?.others ?? 0, Validators.min(0)],
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
    try {
      if (this.data) {
        await this.facade.update({ id: this.data.id, ...v });
      } else {
        await this.facade.create(v);
      }
      this.dialogRef.close(true);
    } finally {
      this.loading.set(false);
    }
  }
}
