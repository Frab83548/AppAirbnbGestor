import { ReservationPreview } from '../models/reservation.model';

export interface ReservationInput {
  checkInDate: string;
  checkOutDate: string;
  amountCharged: number;
  cleaningCost: number;
  extraExpenses: number;
}

export class FinancialCalculator {
  static calculateNights(checkInDate: string, checkOutDate: string): number {
    if (!checkInDate || !checkOutDate) return 0;
    const start = new Date(checkInDate);
    const end = new Date(checkOutDate);
    const diff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(diff, 0);
  }

  static calculateFranCommission(amountCharged: number, cleaningCost: number): number {
    return Math.max((amountCharged - cleaningCost) * 0.2, 0);
  }

  static calculateGrossProfit(
    amountCharged: number,
    cleaningCost: number,
    extraExpenses: number,
  ): number {
    return amountCharged - cleaningCost - extraExpenses;
  }

  static calculateNetProfit(
    amountCharged: number,
    cleaningCost: number,
    extraExpenses: number,
  ): number {
    const gross = this.calculateGrossProfit(amountCharged, cleaningCost, extraExpenses);
    const commission = this.calculateFranCommission(amountCharged, cleaningCost);
    return gross - commission;
  }

  static previewReservation(input: ReservationInput): ReservationPreview {
    const nights = this.calculateNights(input.checkInDate, input.checkOutDate);
    const franCommission = this.calculateFranCommission(input.amountCharged, input.cleaningCost);
    const grossProfit = this.calculateGrossProfit(
      input.amountCharged,
      input.cleaningCost,
      input.extraExpenses,
    );
    const netProfit = grossProfit - franCommission;

    return { nights, franCommission, grossProfit, netProfit };
  }

  static calculateProfitability(netProfit: number, totalIncome: number): number {
    if (totalIncome <= 0) return 0;
    return (netProfit / totalIncome) * 100;
  }

  static calculateAvgTicket(totalIncome: number, reservationCount: number): number {
    if (reservationCount <= 0) return 0;
    return totalIncome / reservationCount;
  }

  static calculateProfitPerNight(netProfit: number, totalNights: number): number {
    if (totalNights <= 0) return 0;
    return netProfit / totalNights;
  }
}
