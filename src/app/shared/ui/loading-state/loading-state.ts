import { Component, input } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-loading-state',
  standalone: true,
  imports: [MatProgressSpinnerModule],
  template: `
    <div class="loading-state">
      <mat-spinner diameter="40" />
      <p>{{ message() }}</p>
    </div>
  `,
  styles: `
    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem;
      gap: 1rem;
      color: var(--text-muted);
    }
  `,
})
export class LoadingState {
  readonly message = input('Cargando...');
}
