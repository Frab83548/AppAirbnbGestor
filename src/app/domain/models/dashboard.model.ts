export interface DashboardKpis {
  totalIncome: number;
  fixedExpenses: number;
  variableExpenses: number;
  franCommission: number;
  netProfit: number;
  profitabilityPct: number;
  breakEvenAmount: number;
  reservationCount: number;
  totalNights: number;
  avgTicket: number;
  profitPerNight: number;
}

export interface MonthlyChartPoint {
  year: number;
  month: number;
  income: number;
  expenses: number;
  profit: number;
}

export interface PropertyProfitPoint {
  property_name: string;
  net_profit: number;
  total_income: number;
  profitability_pct?: number;
}

export interface ExpenseBreakdownPoint {
  label: string;
  amount: number;
}

export interface AnnualComparisonPoint {
  month: number;
  income: number;
  costs: number;
  profit: number;
}
