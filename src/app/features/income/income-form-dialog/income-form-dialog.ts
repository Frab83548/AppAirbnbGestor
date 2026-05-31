import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { IncomeFacade } from '../income.facade';
import { PropertyFacade } from '../../properties/property.facade';
import { Reservation } from '../../../domain/models/reservation.model';
import { Property } from '../../../domain/models/property.model';
import { Platform, PLATFORM_LABELS } from '../../../domain/enums';
import { FinancialCalculator } from '../../../domain/services/financial-calculator';
import { CurrencyArsPipe } from '../../../shared/pipes/currency-ars.pipe';

@Component({
  selector: 'app-income-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    CurrencyArsPipe,
  ],
  templateUrl: './income-form-dialog.html',
  styles: `
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 1rem; }
    .full { grid-column: 1 / -1; }
    .preview { background: var(--accent-bg); border-radius: 8px; padding: 1rem; margin-top: 1rem; }
    .preview p { margin: 0.25rem 0; font-size: 0.875rem; }
  `,
})
export class IncomeFormDialog implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly facade = inject(IncomeFacade);
  private readonly propertyFacade = inject(PropertyFacade);
  private readonly dialogRef = inject(MatDialogRef<IncomeFormDialog>);
  readonly data = inject<Reservation | null>(MAT_DIALOG_DATA);

  readonly loading = signal(false);
  readonly properties = signal<Property[]>([]);
  readonly platformOptions = Object.entries(PLATFORM_LABELS) as [Platform, string][];

  readonly form = this.fb.nonNullable.group({
    propertyId: [this.data?.propertyId ?? '', Validators.required],
    checkInDate: [this.data ? new Date(this.data.checkInDate) : new Date(), Validators.required],
    checkOutDate: [this.data ? new Date(this.data.checkOutDate) : new Date(), Validators.required],
    platform: [this.data?.platform ?? ('airbnb' as Platform), Validators.required],
    amountCharged: [this.data?.amountCharged ?? 0, [Validators.required, Validators.min(0)]],
    cleaningCost: [this.data?.cleaningCost ?? 0, [Validators.min(0)]],
    extraExpenses: [this.data?.extraExpenses ?? 0, [Validators.min(0)]],
    notes: [this.data?.notes ?? ''],
  });

  readonly preview = computed(() => {
    const v = this.form.getRawValue();
    const checkIn = v.checkInDate instanceof Date ? v.checkInDate.toISOString().split('T')[0] : '';
    const checkOut = v.checkOutDate instanceof Date ? v.checkOutDate.toISOString().split('T')[0] : '';
    return FinancialCalculator.previewReservation({
      checkInDate: checkIn,
      checkOutDate: checkOut,
      amountCharged: v.amountCharged,
      cleaningCost: v.cleaningCost,
      extraExpenses: v.extraExpenses,
    });
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
      checkInDate: (v.checkInDate as Date).toISOString().split('T')[0],
      checkOutDate: (v.checkOutDate as Date).toISOString().split('T')[0],
      platform: v.platform,
      amountCharged: v.amountCharged,
      cleaningCost: v.cleaningCost,
      extraExpenses: v.extraExpenses,
      notes: v.notes,
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
