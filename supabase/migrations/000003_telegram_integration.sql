-- App Finanzas - Telegram Bot Integration
-- Tablas para autorizar usuarios de Telegram, guardar borradores pendientes
-- de confirmacion y auditar mensajes recibidos por el bot.

-- Usuarios de Telegram autorizados (whitelist). Cada telegram_id mapea a un
-- profile para atribuir created_by en los inserts hechos por el bot.
CREATE TABLE telegram_allowed_users (
  telegram_id BIGINT PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Borradores pendientes de confirmacion. El bot guarda aca lo que interpreto
-- y, al confirmar el usuario, se inserta en la tabla de negocio correspondiente.
CREATE TABLE telegram_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT NOT NULL,
  chat_id BIGINT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('ingreso', 'gasto')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 hour')
);

CREATE INDEX idx_telegram_drafts_telegram_id ON telegram_drafts(telegram_id);
CREATE INDEX idx_telegram_drafts_expires_at ON telegram_drafts(expires_at);

-- Auditoria de mensajes recibidos (opcional pero util para debug).
CREATE TABLE telegram_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT NOT NULL,
  chat_id BIGINT,
  content_type TEXT NOT NULL DEFAULT 'text',
  raw_text TEXT,
  parsed JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_telegram_messages_telegram_id ON telegram_messages(telegram_id);

-- RLS: estas tablas solo se acceden desde la Edge Function con service_role
-- (que bypassa RLS). Habilitamos RLS sin policies para bloquear acceso via
-- anon/authenticated keys.
ALTER TABLE telegram_allowed_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_messages ENABLE ROW LEVEL SECURITY;

-- Permitir al equipo leer/gestionar la whitelist desde la app (opcional).
CREATE POLICY telegram_allowed_users_select ON telegram_allowed_users
  FOR SELECT TO authenticated USING (is_team_member());
CREATE POLICY telegram_allowed_users_write ON telegram_allowed_users
  FOR ALL TO authenticated USING (is_not_viewer()) WITH CHECK (is_not_viewer());

-- Limpieza de borradores vencidos.
CREATE OR REPLACE FUNCTION cleanup_telegram_drafts()
RETURNS void AS $$
  DELETE FROM telegram_drafts WHERE expires_at < now();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;
