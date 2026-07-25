import { Component, inject, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FixedExpenseFacade } from '../fixed-expense.facade';
import { PropertyFacade } from '../../properties/property.facade';
import { PeriodService } from '../../../core/layout/period.service';
import { FixedExpense } from '../../../domain/models/expense.model';
import { Property } from '../../../domain/models/property.model';
import { DateFieldComponent } from '../../../shared/ui/date-field/date-field';
import { parseIsoDateLocal, toIsoDateLocal } from '../../../shared/utils/date.util';

function hasPositiveConcept(control: AbstractControl): ValidationErrors | null {
  const keys = [
    'buildingExpenses',
    'electricity',
    'water',
    'gas',
    'internet',
    'municipality',
    'others',
  ] as const;
  const hasAmount = keys.some((key) => Number(control.get(key)?.value ?? 0) > 0);
  return hasAmount ? null : { noConcept: true };
}

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
    MatSnackBarModule,
    DateFieldComponent,
  ],
  templateUrl: './fixed-expense-form-dialog.html',
  styles: `.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 1rem; } .full { grid-column: 1 / -1; }`,
})
export class FixedExpenseFormDialog implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly facade = inject(FixedExpenseFacade);
  private readonly propertyFacade = inject(PropertyFacade);
  private readonly period = inject(PeriodService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialogRef = inject(MatDialogRef<FixedExpenseFormDialog>);
  readonly data = inject<FixedExpense | null>(MAT_DIALOG_DATA);

  readonly loading = signal(false);
  readonly properties = signal<Property[]>([]);

  readonly form = this.fb.nonNullable.group(
    {
      propertyId: [this.data?.propertyId ?? '', Validators.required],
      month: [this.data?.month ?? this.period.month(), Validators.required],
      year: [this.data?.year ?? this.period.year(), Validators.required],
      entryDate: [
        this.data ? parseIsoDateLocal(this.data.entryDate) : new Date(),
        Validators.required,
      ],
      buildingExpenses: [this.data?.buildingExpenses ?? 0, Validators.min(0)],
      electricity: [this.data?.electricity ?? 0, Validators.min(0)],
      water: [this.data?.water ?? 0, Validators.min(0)],
      gas: [this.data?.gas ?? 0, Validators.min(0)],
      internet: [this.data?.internet ?? 0, Validators.min(0)],
      municipality: [this.data?.municipality ?? 0, Validators.min(0)],
      others: [this.data?.others ?? 0, Validators.min(0)],
    },
    { validators: hasPositiveConcept },
  );

  get isEdit(): boolean {
    return !!this.data;
  }

  ngOnInit(): void {
    void this.propertyFacade.findAll().then((p) => this.properties.set(p));
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      if (this.form.hasError('noConcept')) {
        this.snackBar.open('Ingresá al menos un concepto con monto mayor a 0', 'Cerrar', {
          duration: 4000,
        });
      }
      return;
    }
    this.loading.set(true);
    const v = this.form.getRawValue();
    const entryDate =
      v.entryDate instanceof Date ? toIsoDateLocal(v.entryDate) : toIsoDateLocal(new Date());
    const payload = {
      propertyId: v.propertyId,
      month: v.month,
      year: v.year,
      entryDate,
      buildingExpenses: v.buildingExpenses,
      electricity: v.electricity,
      water: v.water,
      gas: v.gas,
      internet: v.internet,
      municipality: v.municipality,
      others: v.others,
    };
    try {
      if (this.data) {
        await this.facade.update({ id: this.data.id, ...payload });
      } else {
        await this.facade.create(payload);
      }
      this.dialogRef.close(true);
    } finally {
      this.loading.set(false);
    }
  }
}
