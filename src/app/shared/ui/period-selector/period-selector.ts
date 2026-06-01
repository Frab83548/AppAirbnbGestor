import { TitleCasePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { PeriodService } from '../../../core/layout/period.service';

@Component({
  selector: 'app-period-selector',
  standalone: true,
  imports: [MatFormFieldModule, MatSelectModule, TitleCasePipe],
  template: `
    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="period-field">
      <mat-select
        [value]="period.month()"
        (selectionChange)="onMonthChange($event.value)"
        aria-label="Seleccionar mes"
      >
        @for (m of period.getMonths(); track m.value) {
          <mat-option [value]="m.value">{{ m.label | titlecase }}</mat-option>
        }
      </mat-select>
    </mat-form-field>
    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="period-field">
      <mat-select
        [value]="period.year()"
        (selectionChange)="onYearChange($event.value)"
        aria-label="Seleccionar año"
      >
        @for (y of period.getYears(); track y) {
          <mat-option [value]="y">{{ y }}</mat-option>
        }
      </mat-select>
    </mat-form-field>
  `,
  styles: `
    :host {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }
    .period-field {
      width: 120px;
      font-size: 0.875rem;
    }
    @media (max-width: 600px) {
      :host {
        gap: 0.25rem;
      }
      .period-field {
        width: 96px;
        font-size: 0.8125rem;
      }
    }
    @media (max-width: 400px) {
      .period-field {
        width: 80px;
      }
    }
  `,
})
export class PeriodSelector {
  readonly period = inject(PeriodService);

  onMonthChange(month: number): void {
    this.period.setPeriod(month, this.period.year());
  }

  onYearChange(year: number): void {
    this.period.setPeriod(this.period.month(), year);
  }
}
