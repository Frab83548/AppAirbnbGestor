import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { PropertyFacade } from '../property.facade';
import { Property } from '../../../domain/models/property.model';
import { PropertyStatus, PROPERTY_STATUS_LABELS } from '../../../domain/enums';

@Component({
  selector: 'app-property-form-dialog',
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
  ],
  templateUrl: './property-form-dialog.html',
})
export class PropertyFormDialog {
  private readonly fb = inject(FormBuilder);
  private readonly facade = inject(PropertyFacade);
  private readonly dialogRef = inject(MatDialogRef<PropertyFormDialog>);
  readonly data = inject<Property | null>(MAT_DIALOG_DATA);

  readonly loading = signal(false);
  readonly statusOptions = Object.entries(PROPERTY_STATUS_LABELS) as [PropertyStatus, string][];

  readonly form = this.fb.nonNullable.group({
    name: [this.data?.name ?? '', Validators.required],
    address: [this.data?.address ?? ''],
    description: [this.data?.description ?? ''],
    status: [this.data?.status ?? ('activa' as PropertyStatus), Validators.required],
    registeredAt: [this.data?.registeredAt ? new Date(this.data.registeredAt) : new Date(), Validators.required],
  });

  get isEdit(): boolean {
    return !!this.data;
  }

  async save(): Promise<void> {
    if (this.form.invalid) return;
    this.loading.set(true);
    const v = this.form.getRawValue();
    const registeredAt = v.registeredAt.toISOString().split('T')[0];

    try {
      if (this.data) {
        await this.facade.update({
          id: this.data.id,
          name: v.name,
          address: v.address,
          description: v.description,
          status: v.status,
          registeredAt,
        });
      } else {
        await this.facade.create({
          name: v.name,
          address: v.address,
          description: v.description,
          status: v.status,
          registeredAt,
        });
      }
      this.dialogRef.close(true);
    } finally {
      this.loading.set(false);
    }
  }
}
