import { Platform } from '../enums';

export interface Reservation {
  id: string;
  propertyId: string;
  propertyName?: string;
  checkInDate: string;
  checkOutDate: string;
  platform: Platform;
  amountCharged: number;
  cleaningCost: number;
  extraExpenses: number;
  notes: string;
  nights: number;
  franCommission: number;
  grossProfit: number;
  netProfit: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReservationDto {
  propertyId: string;
  checkInDate: string;
  checkOutDate: string;
  platform: Platform;
  amountCharged: number;
  cleaningCost: number;
  extraExpenses: number;
  notes: string;
}

export interface UpdateReservationDto extends Partial<CreateReservationDto> {
  id: string;
}

export interface ReservationPreview {
  nights: number;
  franCommission: number;
  grossProfit: number;
  netProfit: number;
}
