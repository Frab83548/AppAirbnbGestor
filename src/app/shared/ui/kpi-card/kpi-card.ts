import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CurrencyArsPipe } from '../../pipes/currency-ars.pipe';
import { PercentPipe } from '../../pipes/percent.pipe';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [MatIconModule, CurrencyArsPipe, PercentPipe],
  templateUrl: './kpi-card.html',
  styleUrl: './kpi-card.scss',
})
export class KpiCard {
  readonly title = input.required<string>();
  readonly value = input.required<number>();
  readonly icon = input<string>('insights');
  readonly format = input<'currency' | 'percent' | 'number'>('currency');
  readonly subtitle = input<string>('');
  readonly accent = input<'default' | 'success' | 'warning' | 'danger'>('default');
}
