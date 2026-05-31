-- App Finanzas - Initial Schema
-- ERP financiero para alquileres temporarios

-- Enums
CREATE TYPE app_role AS ENUM ('admin', 'member', 'viewer');
CREATE TYPE property_status AS ENUM ('activa', 'inactiva', 'mantenimiento');
CREATE TYPE platform AS ENUM ('airbnb', 'booking', 'directo', 'otra');
CREATE TYPE expense_category AS ENUM (
  'limpieza', 'insumos', 'reparaciones', 'mantenimiento', 'sabanas', 'viaticos', 'otros'
);

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'member',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_app_meta_data->>'role')::app_role, 'member')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Properties
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  status property_status NOT NULL DEFAULT 'activa',
  registered_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_properties_status ON properties(status) WHERE status = 'activa';

-- Reservations / Income
CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  platform platform NOT NULL DEFAULT 'airbnb',
  amount_charged NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount_charged >= 0),
  cleaning_cost NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (cleaning_cost >= 0),
  extra_expenses NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (extra_expenses >= 0),
  notes TEXT NOT NULL DEFAULT '',
  nights INTEGER GENERATED ALWAYS AS (
    GREATEST((check_out_date - check_in_date), 0)
  ) STORED,
  fran_commission NUMERIC(12, 2) GENERATED ALWAYS AS (
    GREATEST((amount_charged - cleaning_cost) * 0.20, 0)
  ) STORED,
  gross_profit NUMERIC(12, 2) GENERATED ALWAYS AS (
    amount_charged - cleaning_cost - extra_expenses
  ) STORED,
  net_profit NUMERIC(12, 2) GENERATED ALWAYS AS (
    (amount_charged - cleaning_cost - extra_expenses) - GREATEST((amount_charged - cleaning_cost) * 0.20, 0)
  ) STORED,
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reservations_dates_check CHECK (check_out_date >= check_in_date)
);

CREATE TRIGGER reservations_updated_at
  BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_reservations_property_date ON reservations(property_id, check_in_date);
CREATE INDEX idx_reservations_check_in ON reservations(check_in_date);

-- Variable Expenses
CREATE TABLE variable_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  expense_date DATE NOT NULL,
  category expense_category NOT NULL DEFAULT 'otros',
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER variable_expenses_updated_at
  BEFORE UPDATE ON variable_expenses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_variable_expenses_property_date ON variable_expenses(property_id, expense_date);
CREATE INDEX idx_variable_expenses_date ON variable_expenses(expense_date);

-- Fixed Monthly Expenses
CREATE TABLE fixed_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  month SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year SMALLINT NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  building_expenses NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (building_expenses >= 0),
  electricity NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (electricity >= 0),
  water NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (water >= 0),
  gas NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (gas >= 0),
  internet NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (internet >= 0),
  municipality NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (municipality >= 0),
  others NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (others >= 0),
  total NUMERIC(12, 2) GENERATED ALWAYS AS (
    building_expenses + electricity + water + gas + internet + municipality + others
  ) STORED,
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_id, month, year)
);

CREATE TRIGGER fixed_expenses_updated_at
  BEFORE UPDATE ON fixed_expenses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_fixed_expenses_period ON fixed_expenses(year, month, property_id);

-- Helper: check if user is team member
CREATE OR REPLACE FUNCTION is_team_member()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid());
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_not_viewer()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'member')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE variable_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_expenses ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY profiles_select ON profiles FOR SELECT TO authenticated
  USING (is_team_member());

CREATE POLICY profiles_update_own ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Business tables policies (shared workspace)
CREATE POLICY properties_select ON properties FOR SELECT TO authenticated
  USING (is_team_member());
CREATE POLICY properties_insert ON properties FOR INSERT TO authenticated
  WITH CHECK (is_not_viewer());
CREATE POLICY properties_update ON properties FOR UPDATE TO authenticated
  USING (is_not_viewer()) WITH CHECK (is_not_viewer());
CREATE POLICY properties_delete ON properties FOR DELETE TO authenticated
  USING (is_not_viewer());

CREATE POLICY reservations_select ON reservations FOR SELECT TO authenticated
  USING (is_team_member());
CREATE POLICY reservations_insert ON reservations FOR INSERT TO authenticated
  WITH CHECK (is_not_viewer());
CREATE POLICY reservations_update ON reservations FOR UPDATE TO authenticated
  USING (is_not_viewer()) WITH CHECK (is_not_viewer());
CREATE POLICY reservations_delete ON reservations FOR DELETE TO authenticated
  USING (is_not_viewer());

CREATE POLICY variable_expenses_select ON variable_expenses FOR SELECT TO authenticated
  USING (is_team_member());
CREATE POLICY variable_expenses_insert ON variable_expenses FOR INSERT TO authenticated
  WITH CHECK (is_not_viewer());
CREATE POLICY variable_expenses_update ON variable_expenses FOR UPDATE TO authenticated
  USING (is_not_viewer()) WITH CHECK (is_not_viewer());
CREATE POLICY variable_expenses_delete ON variable_expenses FOR DELETE TO authenticated
  USING (is_not_viewer());

CREATE POLICY fixed_expenses_select ON fixed_expenses FOR SELECT TO authenticated
  USING (is_team_member());
CREATE POLICY fixed_expenses_insert ON fixed_expenses FOR INSERT TO authenticated
  WITH CHECK (is_not_viewer());
CREATE POLICY fixed_expenses_update ON fixed_expenses FOR UPDATE TO authenticated
  USING (is_not_viewer()) WITH CHECK (is_not_viewer());
CREATE POLICY fixed_expenses_delete ON fixed_expenses FOR DELETE TO authenticated
  USING (is_not_viewer());

-- Views (security invoker)
CREATE OR REPLACE VIEW v_reservation_financials
WITH (security_invoker = true) AS
SELECT
  r.*,
  p.name AS property_name
FROM reservations r
JOIN properties p ON p.id = r.property_id;

CREATE OR REPLACE VIEW v_monthly_summary
WITH (security_invoker = true) AS
SELECT
  EXTRACT(YEAR FROM d.month_date)::INT AS year,
  EXTRACT(MONTH FROM d.month_date)::INT AS month,
  COALESCE(SUM(r.amount_charged), 0) AS total_income,
  COALESCE(SUM(r.fran_commission), 0) AS fran_commission,
  COALESCE(SUM(r.gross_profit), 0) AS gross_profit,
  COALESCE((
    SELECT SUM(ve.amount)
    FROM variable_expenses ve
    WHERE EXTRACT(YEAR FROM ve.expense_date) = EXTRACT(YEAR FROM d.month_date)
      AND EXTRACT(MONTH FROM ve.expense_date) = EXTRACT(MONTH FROM d.month_date)
  ), 0) AS variable_expenses,
  COALESCE((
    SELECT SUM(fe.total)
    FROM fixed_expenses fe
    WHERE fe.year = EXTRACT(YEAR FROM d.month_date)::INT
      AND fe.month = EXTRACT(MONTH FROM d.month_date)::INT
  ), 0) AS fixed_expenses
FROM (
  SELECT DISTINCT date_trunc('month', check_in_date)::DATE AS month_date
  FROM reservations
  UNION
  SELECT DISTINCT date_trunc('month', expense_date)::DATE FROM variable_expenses
  UNION
  SELECT DISTINCT make_date(year, month, 1) FROM fixed_expenses
) d
LEFT JOIN reservations r ON date_trunc('month', r.check_in_date) = d.month_date
GROUP BY d.month_date;

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

CREATE OR REPLACE VIEW v_expense_breakdown
WITH (security_invoker = true) AS
SELECT
  EXTRACT(YEAR FROM COALESCE(ve.expense_date, make_date(fe.year, fe.month, 1)))::INT AS year,
  EXTRACT(MONTH FROM COALESCE(ve.expense_date, make_date(fe.year, fe.month, 1)))::INT AS month,
  ve.category::TEXT AS category,
  COALESCE(SUM(ve.amount), 0) AS amount
FROM variable_expenses ve
FULL OUTER JOIN fixed_expenses fe ON false
GROUP BY 1, 2, ve.category

UNION ALL

SELECT
  fe.year,
  fe.month,
  unnest(ARRAY['expensas','luz','agua','gas','internet','municipalidad','otros']) AS category,
  unnest(ARRAY[fe.building_expenses, fe.electricity, fe.water, fe.gas, fe.internet, fe.municipality, fe.others]) AS amount
FROM fixed_expenses fe;

CREATE OR REPLACE VIEW v_annual_comparison
WITH (security_invoker = true) AS
SELECT
  year,
  month,
  total_income AS income,
  variable_expenses + fixed_expenses AS costs,
  total_income - fran_commission - variable_expenses - fixed_expenses AS profit
FROM v_monthly_summary;

-- RPC: Dashboard KPIs
CREATE OR REPLACE FUNCTION get_dashboard_kpis(p_month INT, p_year INT)
RETURNS JSON AS $$
DECLARE
  v_income NUMERIC(12,2);
  v_fran NUMERIC(12,2);
  v_variable NUMERIC(12,2);
  v_fixed NUMERIC(12,2);
  v_net NUMERIC(12,2);
  v_profitability NUMERIC(8,2);
  v_reservations INT;
  v_nights INT;
BEGIN
  SELECT COALESCE(SUM(amount_charged), 0), COALESCE(SUM(fran_commission), 0), COUNT(*), COALESCE(SUM(nights), 0)
  INTO v_income, v_fran, v_reservations, v_nights
  FROM reservations
  WHERE EXTRACT(MONTH FROM check_in_date) = p_month
    AND EXTRACT(YEAR FROM check_in_date) = p_year;

  SELECT COALESCE(SUM(amount), 0) INTO v_variable
  FROM variable_expenses
  WHERE EXTRACT(MONTH FROM expense_date) = p_month
    AND EXTRACT(YEAR FROM expense_date) = p_year;

  SELECT COALESCE(SUM(total), 0) INTO v_fixed
  FROM fixed_expenses
  WHERE month = p_month AND year = p_year;

  v_net := v_income - v_fran - v_variable - v_fixed;
  v_profitability := CASE WHEN v_income > 0 THEN (v_net / v_income) * 100 ELSE 0 END;

  RETURN json_build_object(
    'totalIncome', v_income,
    'fixedExpenses', v_fixed,
    'variableExpenses', v_variable,
    'franCommission', v_fran,
    'netProfit', v_net,
    'profitabilityPct', v_profitability,
    'breakEvenAmount', v_fixed,
    'reservationCount', v_reservations,
    'totalNights', v_nights,
    'avgTicket', CASE WHEN v_reservations > 0 THEN v_income / v_reservations ELSE 0 END,
    'profitPerNight', CASE WHEN v_nights > 0 THEN v_net / v_nights ELSE 0 END
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public;

-- RPC: Break even
CREATE OR REPLACE FUNCTION get_break_even(p_month INT, p_year INT)
RETURNS NUMERIC AS $$
  SELECT COALESCE(SUM(total), 0) FROM fixed_expenses WHERE month = p_month AND year = p_year;
$$ LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public;

-- RPC: Duplicate fixed expenses
CREATE OR REPLACE FUNCTION duplicate_fixed_expenses(
  p_source_month INT,
  p_source_year INT,
  p_target_month INT,
  p_target_year INT,
  p_property_id UUID DEFAULT NULL
)
RETURNS INT AS $$
DECLARE
  v_count INT := 0;
BEGIN
  IF NOT is_not_viewer() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  INSERT INTO fixed_expenses (
    property_id, month, year,
    building_expenses, electricity, water, gas, internet, municipality, others,
    created_by, updated_by
  )
  SELECT
    fe.property_id, p_target_month, p_target_year,
    fe.building_expenses, fe.electricity, fe.water, fe.gas, fe.internet, fe.municipality, fe.others,
    auth.uid(), auth.uid()
  FROM fixed_expenses fe
  WHERE fe.month = p_source_month
    AND fe.year = p_source_year
    AND (p_property_id IS NULL OR fe.property_id = p_property_id)
  ON CONFLICT (property_id, month, year) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

-- RPC: Monthly chart data (last 12 months)
CREATE OR REPLACE FUNCTION get_monthly_chart_data(p_year INT DEFAULT NULL)
RETURNS JSON AS $$
  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.year, t.month), '[]'::json)
  FROM (
    SELECT year, month, total_income AS income,
      variable_expenses + fixed_expenses AS expenses,
      total_income - fran_commission - variable_expenses - fixed_expenses AS profit
    FROM v_monthly_summary
    WHERE p_year IS NULL OR year = p_year
    ORDER BY year DESC, month DESC
    LIMIT 12
  ) t;
$$ LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public;

-- RPC: Property profitability chart
CREATE OR REPLACE FUNCTION get_property_profitability_chart(p_month INT, p_year INT)
RETURNS JSON AS $$
  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.net_profit DESC), '[]'::json)
  FROM (
    SELECT property_name, net_profit, total_income
    FROM v_property_profitability
    WHERE month = p_month AND year = p_year
  ) t;
$$ LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public;

-- RPC: Expense breakdown chart
CREATE OR REPLACE FUNCTION get_expense_breakdown_chart(p_month INT, p_year INT)
RETURNS JSON AS $$
  WITH breakdown AS (
    SELECT
      CASE ve.category::TEXT
        WHEN 'limpieza' THEN 'Limpieza'
        WHEN 'insumos' THEN 'Insumos'
        WHEN 'reparaciones' THEN 'Reparaciones'
        WHEN 'mantenimiento' THEN 'Mantenimiento'
        WHEN 'sabanas' THEN 'Sábanas'
        WHEN 'viaticos' THEN 'Viáticos'
        ELSE 'Otros'
      END AS label,
      SUM(ve.amount) AS amount
    FROM variable_expenses ve
    WHERE EXTRACT(MONTH FROM ve.expense_date) = p_month
      AND EXTRACT(YEAR FROM ve.expense_date) = p_year
    GROUP BY ve.category
    UNION ALL
    SELECT 'Expensas', SUM(building_expenses) FROM fixed_expenses WHERE month = p_month AND year = p_year
    UNION ALL
    SELECT 'Luz', SUM(electricity) FROM fixed_expenses WHERE month = p_month AND year = p_year
    UNION ALL
    SELECT 'Agua', SUM(water) FROM fixed_expenses WHERE month = p_month AND year = p_year
    UNION ALL
    SELECT 'Gas', SUM(gas) FROM fixed_expenses WHERE month = p_month AND year = p_year
    UNION ALL
    SELECT 'Internet', SUM(internet) FROM fixed_expenses WHERE month = p_month AND year = p_year
    UNION ALL
    SELECT 'Municipalidad', SUM(municipality) FROM fixed_expenses WHERE month = p_month AND year = p_year
  )
  SELECT COALESCE(json_agg(row_to_json(b) ORDER BY b.amount DESC), '[]'::json)
  FROM (
    SELECT label, SUM(amount) AS amount
    FROM breakdown
    WHERE amount > 0
    GROUP BY label
  ) b;
$$ LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public;

-- RPC: Annual comparison
CREATE OR REPLACE FUNCTION get_annual_comparison_chart(p_year INT)
RETURNS JSON AS $$
  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.month), '[]'::json)
  FROM (
    SELECT month,
      total_income AS income,
      variable_expenses + fixed_expenses AS costs,
      total_income - fran_commission - variable_expenses - fixed_expenses AS profit
    FROM v_monthly_summary
    WHERE year = p_year
    ORDER BY month
  ) t;
$$ LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public;

-- RPC: Property ranking
CREATE OR REPLACE FUNCTION get_property_ranking(p_month INT, p_year INT)
RETURNS JSON AS $$
  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.net_profit DESC), '[]'::json)
  FROM (
    SELECT property_name, net_profit, total_income,
      CASE WHEN total_income > 0 THEN (net_profit / total_income) * 100 ELSE 0 END AS profitability_pct
    FROM v_property_profitability
    WHERE month = p_month AND year = p_year
  ) t;
$$ LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public;
