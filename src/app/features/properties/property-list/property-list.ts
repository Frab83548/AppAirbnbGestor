import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { LoadingState } from '../../../shared/ui/loading-state/loading-state';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { PropertyFacade } from '../property.facade';
import { Property } from '../../../domain/models/property.model';
import { PROPERTY_STATUS_LABELS } from '../../../domain/enums';
import { PropertyFormDialog } from '../property-form-dialog/property-form-dialog';
import { ConfirmService } from '../../../shared/ui/confirm-dialog/confirm.service';

@Component({
  selector: 'app-property-list',
  standalone: true,
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatDialogModule,
    MatSnackBarModule,
    PageHeader,
    LoadingState,
    EmptyState,
  ],
  templateUrl: './property-list.html',
  styleUrl: './property-list.scss',
})
export class PropertyList implements OnInit {
  private readonly facade = inject(PropertyFacade);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly confirmService = inject(ConfirmService);

  readonly loading = signal(true);
  readonly properties = signal<Property[]>([]);
  readonly statusLabels = PROPERTY_STATUS_LABELS;
  statusLabel(status: Property['status']): string {
    return this.statusLabels[status];
  }
  readonly displayedColumns = ['name', 'address', 'status', 'registeredAt', 'actions'];

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.properties.set(await this.facade.findAll());
    } catch {
      this.snackBar.open('Error al cargar propiedades', 'Cerrar', { duration: 3000 });
    } finally {
      this.loading.set(false);
    }
  }

  openCreate(): void {
    const ref = this.dialog.open(PropertyFormDialog, { width: '520px', data: null });
    ref.afterClosed().subscribe((saved) => saved && void this.load());
  }

  openEdit(property: Property): void {
    const ref = this.dialog.open(PropertyFormDialog, { width: '520px', data: property });
    ref.afterClosed().subscribe((saved) => saved && void this.load());
  }

  async deleteProperty(property: Property): Promise<void> {
    const confirmed = await this.confirmService.confirm({
      title: 'Eliminar propiedad',
      message: `¿Seguro que querés eliminar "${property.name}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await this.facade.delete(property.id);
      this.snackBar.open('Propiedad eliminada', 'Cerrar', { duration: 3000 });
      await this.load();
    } catch {
      this.snackBar.open('No se pudo eliminar. Puede tener registros asociados.', 'Cerrar', {
        duration: 4000,
      });
    }
  }
}
