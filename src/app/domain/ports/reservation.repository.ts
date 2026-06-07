import { InjectionToken } from '@angular/core';
import {
  CreateReservationDto,
  Reservation,
  UpdateReservationDto,
} from '../models/reservation.model';

export interface ReservationFilters {
  propertyId?: string;
  month?: number;
  year?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface IReservationRepository {
  findAll(filters?: ReservationFilters): Promise<Reservation[]>;
  findById(id: string): Promise<Reservation | null>;
  create(dto: CreateReservationDto): Promise<Reservation>;
  update(dto: UpdateReservationDto): Promise<Reservation>;
  delete(id: string): Promise<void>;
}

export const RESERVATION_REPOSITORY = new InjectionToken<IReservationRepository>(
  'RESERVATION_REPOSITORY',
);
