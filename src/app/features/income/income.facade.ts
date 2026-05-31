import { Injectable, inject } from '@angular/core';
import { RESERVATION_REPOSITORY } from '../../domain/ports/reservation.repository';
import {
  CreateReservationDto,
  Reservation,
  UpdateReservationDto,
} from '../../domain/models/reservation.model';
import { ReservationFilters } from '../../domain/ports/reservation.repository';

@Injectable({ providedIn: 'root' })
export class IncomeFacade {
  private readonly repo = inject(RESERVATION_REPOSITORY);

  findAll(filters?: ReservationFilters): Promise<Reservation[]> {
    return this.repo.findAll(filters);
  }

  create(dto: CreateReservationDto): Promise<Reservation> {
    return this.repo.create(dto);
  }

  update(dto: UpdateReservationDto): Promise<Reservation> {
    return this.repo.update(dto);
  }

  delete(id: string): Promise<void> {
    return this.repo.delete(id);
  }
}
