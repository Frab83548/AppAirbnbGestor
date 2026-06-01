import { Provider } from '@angular/core';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE } from '@angular/material/core';
import { DD_MM_YYYY_DATE_FORMATS } from './date-formats';
import { EsArDateAdapter } from './es-ar-date.adapter';

export const dateProviders: Provider[] = [
  { provide: MAT_DATE_LOCALE, useValue: 'es-AR' },
  { provide: DateAdapter, useClass: EsArDateAdapter },
  { provide: MAT_DATE_FORMATS, useValue: DD_MM_YYYY_DATE_FORMATS },
];
