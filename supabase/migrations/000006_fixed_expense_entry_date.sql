-- Permite varias cargas de gastos fijos por propiedad/mes con distinta fecha de ingreso.

ALTER TABLE fixed_expenses
  DROP CONSTRAINT IF EXISTS fixed_expenses_property_id_month_year_key;

ALTER TABLE fixed_expenses
  ADD COLUMN IF NOT EXISTS entry_date DATE NOT NULL DEFAULT CURRENT_DATE;

UPDATE fixed_expenses
SET entry_date = created_at::date;

CREATE INDEX IF NOT EXISTS idx_fixed_expenses_entry
  ON fixed_expenses (year, month, property_id, entry_date);

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
    property_id, month, year, entry_date,
    building_expenses, electricity, water, gas, internet, municipality, others,
    created_by, updated_by
  )
  SELECT
    fe.property_id, p_target_month, p_target_year,
    make_date(p_target_year, p_target_month, 1),
    fe.building_expenses, fe.electricity, fe.water, fe.gas, fe.internet, fe.municipality, fe.others,
    auth.uid(), auth.uid()
  FROM fixed_expenses fe
  WHERE fe.month = p_source_month
    AND fe.year = p_source_year
    AND (p_property_id IS NULL OR fe.property_id = p_property_id);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

-- Pasaje España · julio 2026: resto el 1/7, agua el 22/7.
UPDATE fixed_expenses
SET
  entry_date = '2026-07-01',
  building_expenses = 73730,
  electricity = 0,
  water = 0,
  gas = 15200,
  internet = 38500,
  municipality = 0,
  others = 0
WHERE id = '08dd418f-e638-45e2-a499-186d25c36f13';

INSERT INTO fixed_expenses (
  property_id, month, year, entry_date,
  building_expenses, electricity, water, gas, internet, municipality, others,
  created_by, updated_by
)
SELECT
  '3e30a8a0-d613-4865-82c2-a6f99dce33e1',
  7, 2026, '2026-07-22',
  0, 0, 32000, 0, 0, 0, 0,
  created_by, updated_by
FROM fixed_expenses
WHERE id = '08dd418f-e638-45e2-a499-186d25c36f13'
  AND NOT EXISTS (
    SELECT 1 FROM fixed_expenses fe
    WHERE fe.property_id = '3e30a8a0-d613-4865-82c2-a6f99dce33e1'
      AND fe.month = 7 AND fe.year = 2026 AND fe.entry_date = '2026-07-22'
  );
