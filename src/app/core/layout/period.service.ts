import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PeriodService {
  private readonly now = new Date();

  readonly month = signal(this.now.getMonth() + 1);
  readonly year = signal(this.now.getFullYear());

  setPeriod(month: number, year: number): void {
    this.month.set(month);
    this.year.set(year);
  }

  getMonthLabel(): string {
    const date = new Date(this.year(), this.month() - 1, 1);
    return date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  }

  getMonths(): { value: number; label: string }[] {
    return Array.from({ length: 12 }, (_, i) => ({
      value: i + 1,
      label: new Date(2000, i, 1).toLocaleDateString('es-AR', { month: 'long' }),
    }));
  }

  getYears(): number[] {
    const current = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => current - i);
  }
}
