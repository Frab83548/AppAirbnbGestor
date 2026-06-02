-- La limpieza de cada reserva pasa a registrarse tambien como gasto variable
-- (categoria 'limpieza'), vinculado a la reserva. Asi la limpieza queda visible
-- en el modulo de gastos variables y se computa como gasto en los KPIs.
-- Para no contarla dos veces, ajustamos v_property_profitability.

-- 1) Vinculo opcional entre un gasto variable y la reserva que lo origino.
--    ON DELETE CASCADE: si se borra la reserva, se borra su gasto de limpieza.
ALTER TABLE variable_expenses
  ADD COLUMN IF NOT EXISTS reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_variable_expenses_reservation
  ON variable_expenses(reservation_id);

-- 2) Backfill: por cada reserva existente con cleaning_cost > 0 que aun no tenga
--    su gasto de limpieza vinculado, creamos el gasto variable correspondiente.
INSERT INTO variable_expenses (
  property_id, expense_date, category, description, amount,
  reservation_id, created_by, updated_by
)
SELECT
  r.property_id, r.check_in_date, 'limpieza', 'Limpieza', r.cleaning_cost,
  r.id, r.created_by, r.updated_by
FROM reservations r
WHERE r.cleaning_cost > 0
  AND NOT EXISTS (
    SELECT 1 FROM variable_expenses ve WHERE ve.reservation_id = r.id
  );

-- 3) Ajuste de v_property_profitability para evitar doble conteo de la limpieza.
--    El net_profit de la reserva ya descuenta cleaning_cost; como ahora la
--    limpieza vive en variable_expenses, la sumamos de nuevo al neto de reservas
--    para que se reste una sola vez (via variable_expenses).
CREATE OR REPLACE VIEW v_property_profitability
WITH (security_invoker = true) AS
WITH reservation_totals AS (
  SELECT
    property_id,
    EXTRACT(YEAR FROM check_in_date)::INT AS year,
    EXTRACT(MONTH FROM check_in_date)::INT AS month,
    SUM(amount_charged) AS total_income,
    SUM(net_profit + cleaning_cost) AS reservation_net_profit
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
