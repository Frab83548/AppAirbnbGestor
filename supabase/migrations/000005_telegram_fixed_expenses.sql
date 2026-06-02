-- Soporte para gastos fijos y borradores de aclaracion en el bot de Telegram.

ALTER TABLE telegram_drafts DROP CONSTRAINT IF EXISTS telegram_drafts_kind_check;
ALTER TABLE telegram_drafts ADD CONSTRAINT telegram_drafts_kind_check
  CHECK (kind IN ('ingreso', 'gasto', 'gasto_fijo', 'aclaracion'));
