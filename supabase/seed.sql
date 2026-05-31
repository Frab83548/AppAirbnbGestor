-- Seed data (run after creating users in Supabase Auth)
-- Properties demo data

INSERT INTO properties (name, address, description, status, registered_at) VALUES
  ('Departamento Trejo', 'Trejo 450, Córdoba', 'Departamento céntrico de 2 ambientes', 'activa', '2024-01-15'),
  ('Nueva Córdoba 1', 'Av. Vélez Sarsfield 800, Córdoba', 'Monoambiente en Nueva Córdoba', 'activa', '2024-03-01'),
  ('Nueva Córdoba 2', 'Av. Vélez Sarsfield 820, Córdoba', 'Departamento amplio con balcón', 'activa', '2024-06-01')
ON CONFLICT DO NOTHING;
