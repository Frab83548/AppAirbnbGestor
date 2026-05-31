import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div class="empty-state">
      <mat-icon>{{ icon() }}</mat-icon>
      <h3>{{ title() }}</h3>
      <p>{{ message() }}</p>
      <ng-content />
    </div>
  `,
  styles: `
    .empty-state {
      text-align: center;
      padding: 3rem 1rem;
      color: var(--text-muted);

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        opacity: 0.5;
      }

      h3 {
        margin: 1rem 0 0.5rem;
        color: var(--text-primary);
      }

      p {
        margin: 0 0 1rem;
      }
    }
  `,
})
export class EmptyState {
  readonly icon = input('inbox');
  readonly title = input('Sin datos');
  readonly message = input('No hay registros para mostrar.');
}
