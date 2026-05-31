-- Fix v_property_profitability: subqueries referenced ungrouped r.check_in_date
DROP VIEW IF EXISTS v_annual_comparison;
DROP VIEW IF EXISTS v_property_profitability;

CREATE OR REPLACE VIEW v_property_profitability
WITH (security_invoker = true) AS
WITH reservation_totals AS (
  SELECT
    property_id,
    EXTRACT(YEAR FROM check_in_date)::INT AS year,
    EXTRACT(MONTH FROM check_in_date)::INT AS month,
    SUM(amount_charged) AS total_income,
    SUM(net_profit) AS reservation_net_profit
  FROM reservations
  GROUP BY property_id, 2, 3
),
variable_totals AS (
  SELECT
    property_id,
    EXTRACT(YEAR FROM expense_date)::INT AS year,
    EXTRACT(MONTH FROM expense_date)::INT AS month,
    SUM(amount) AS variable_expenses
  FROM variable_expenses
  GROUP BY property_id, 2, 3
),
fixed_totals AS (
  SELECT
    property_id,
    year,
    month,
    SUM(total) AS fixed_expenses
  FROM fixed_expenses
  GROUP BY property_id, year, month
),
periods AS (
  SELECT property_id, year, month FROM reservation_totals
  UNION
  SELECT property_id, year, month FROM variable_totals
  UNION
  SELECT property_id, year, month FROM fixed_totals
)
SELECT
  p.id AS property_id,
  p.name AS property_name,
  per.year,
  per.month,
  COALESCE(rt.total_income, 0) AS total_income,
  COALESCE(rt.reservation_net_profit, 0) AS reservation_net_profit,
  COALESCE(vt.variable_expenses, 0) AS variable_expenses,
  COALESCE(ft.fixed_expenses, 0) AS fixed_expenses,
  COALESCE(rt.reservation_net_profit, 0)
    - COALESCE(vt.variable_expenses, 0)
    - COALESCE(ft.fixed_expenses, 0) AS net_profit
FROM properties p
JOIN periods per ON per.property_id = p.id
LEFT JOIN reservation_totals rt
  ON rt.property_id = p.id AND rt.year = per.year AND rt.month = per.month
LEFT JOIN variable_totals vt
  ON vt.property_id = p.id AND vt.year = per.year AND vt.month = per.month
LEFT JOIN fixed_totals ft
  ON ft.property_id = p.id AND ft.year = per.year AND ft.month = per.month;

CREATE OR REPLACE VIEW v_annual_comparison
WITH (security_invoker = true) AS
SELECT
  year,
  month,
  total_income AS income,
  variable_expenses + fixed_expenses AS costs,
  total_income - fran_commission - variable_expenses - fixed_expenses AS profit
FROM v_monthly_summary;
