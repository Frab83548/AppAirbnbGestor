import { DashboardKpis } from '../models/dashboard.model';
import { FixedExpense, VariableExpense } from '../models/expense.model';
import { Reservation } from '../models/reservation.model';
import { parseIsoDateLocal } from '../../shared/utils/date.util';

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

  /** Prorratea gastos fijos mensuales segun los dias del rango que caen en cada mes. */
  static prorateFixedExpenses(
    fixedExpenses: FixedExpense[],
    dateFrom: string,
    dateTo: string,
  ): number {
    const from = parseIsoDateLocal(dateFrom);
    const to = parseIsoDateLocal(dateTo);
    let total = 0;

    for (const expense of fixedExpenses) {
      const monthStart = new Date(expense.year, expense.month - 1, 1);
      const monthEnd = new Date(expense.year, expense.month, 0);
      const overlapStart = from > monthStart ? from : monthStart;
      const overlapEnd = to < monthEnd ? to : monthEnd;
      if (overlapStart > overlapEnd) continue;

      const overlapDays =
        Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / 86_400_000) + 1;
      const daysInMonth = monthEnd.getDate();
      total += expense.total * (overlapDays / daysInMonth);
    }

    return total;
  }
}
