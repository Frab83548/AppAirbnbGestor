import { Injectable } from '@angular/core';
import { NativeDateAdapter } from '@angular/material/core';

@Injectable()
export class EsArDateAdapter extends NativeDateAdapter {
  override parse(value: unknown): Date | null {
    if (typeof value === 'string' && value.trim()) {
      const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
      if (match) {
        const day = Number(match[1]);
        const month = Number(match[2]) - 1;
        const year = Number(match[3]);
        const date = new Date(year, month, day);
        return this.isValid(date) ? date : null;
      }
    }
    return super.parse(value);
  }

  override format(date: Date, displayFormat: unknown): string {
    if (!this.isValid(date)) {
      return '';
    }

    // En la app usamos DD/MM/YYYY en todos los inputs de fecha.
    // `displayFormat` puede variar según Material (string u objeto), por eso no lo dependemos.
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
}
