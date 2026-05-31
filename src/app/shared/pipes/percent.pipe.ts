import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'percent', standalone: true })
export class PercentPipe implements PipeTransform {
  transform(value: number | null | undefined, digits = 1): string {
    const num = value ?? 0;
    return `${num.toFixed(digits)}%`;
  }
}
