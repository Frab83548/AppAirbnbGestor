import { DashboardKpis } from '../models/dashboard.model';
import { VariableExpense } from '../models/expense.model';
import { Reservation } from '../models/reservation.model';

export class ReportKpiCalculator {
  static fromData(
    reservations: Reservation[],
    variableExpenses: VariableExpense[],
    fixedExpensesTotal: number,
  ): DashboardKpis {
    const totalIncome = reservations.reduce((sum, r) => sum + r.amountCharged, 0);
    const franCommission = reservations.reduce((sum, r) => sum + r.franCommission, 0);
    const variableTotal = variableExpenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = totalIncome - franCommission - variableTotal - fixedExpensesTotal;
    const reservationCount = reservations.length;
    const totalNights = reservations.reduce((sum, r) => sum + r.nights, 0);

    return {
      totalIncome,
      fixedExpenses: fixedExpensesTotal,
      variableExpenses: variableTotal,
      franCommission,
      netProfit,
      profitabilityPct: totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0,
      breakEvenAmount: fixedExpensesTotal,
      reservationCount,
      totalNights,
      avgTicket: reservationCount > 0 ? totalIncome / reservationCount : 0,
      profitPerNight: totalNights > 0 ? netProfit / totalNights : 0,
    };
  }
}
