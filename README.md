# App Finanzas

Mini ERP financiero para administrar la rentabilidad de propiedades de alquileres temporarios (Airbnb, Booking, directo).

## Stack

- **Frontend:** Angular 20, Standalone Components, Angular Material, Signals, ApexCharts
- **Backend:** Supabase (PostgreSQL, Auth, RLS)

## Requisitos

- Node.js 20+
- Cuenta en [Supabase](https://supabase.com)

## Configuración Supabase

1. Crear un proyecto nuevo en Supabase.
2. En el SQL Editor, ejecutar el contenido de [`supabase/migrations/000001_initial_schema.sql`](supabase/migrations/000001_initial_schema.sql).
3. (Opcional) Ejecutar [`supabase/seed.sql`](supabase/seed.sql) para propiedades demo.
4. Crear usuarios en **Authentication → Users** (Francisco, Agostina, Camilo). Deshabilitar signup público.
5. Copiar **Project URL** y **anon public key** desde Settings → API.

## Configuración local

1. Instalar dependencias:

```bash
npm install
```

2. Copiar el ejemplo y completar credenciales de Supabase:

```bash
cp src/environments/environment.development.example.ts src/environments/environment.development.ts
```

Editar [`src/environments/environment.development.ts`](src/environments/environment.development.ts) (este archivo **no** se sube a Git):

```typescript
export const environment = {
  production: false,
  supabaseUrl: 'https://TU_PROYECTO.supabase.co',
  supabaseAnonKey: 'TU_ANON_KEY',
};
```

3. Iniciar la app:

```bash
npm start
```

Abrir http://localhost:4200

## Módulos

| Ruta | Descripción |
|------|-------------|
| `/dashboard` | KPIs del mes, punto de equilibrio, ranking |
| `/finanzas` | 4 gráficos ApexCharts |
| `/propiedades` | CRUD propiedades |
| `/ingresos` | CRUD reservas con cálculo automático comisión Fran |
| `/gastos-variables` | CRUD gastos operativos |
| `/gastos-fijos` | CRUD mensual + duplicar mes anterior |
| `/reportes` | PDF, Excel, CSV |

## Reglas de negocio

- **Comisión Fran:** `(montoCobrado - costoLimpieza) × 20%`
- **Ganancia neta (período):** `ingresos - comisiónFran - gastosVariables - gastosFijos`
- **Rentabilidad %:** `(gananciaNeta / ingresos) × 100`

## Arquitectura

```
src/app/
├── core/          # Auth, layout, Supabase client
├── domain/        # Models, enums, ports, FinancialCalculator
├── data/          # Supabase repositories
├── features/      # Pantallas por módulo (lazy loaded)
└── shared/        # UI reutilizable, pipes, charts
```

## Build producción

```bash
npm run build
```

Salida en `dist/app-finanzas/`.

## Importar datos desde Excel (→ SQL)

Los datos **no** van hardcodeados en el repo. El script lee tu `.xlsx` y genera un `.sql` para ejecutar en Supabase.

```bash
# Un departamento (todos los meses del config)
npm run import:excel -- "C:\ruta\Departamento Trejo.xlsx" --config scripts/excel-import.trejo.config.json

# Abril + Mayo de los 3 departamentos (busca Excel en Downloads)
npm run import:abril-mayo
```

Genera SQL en `output/` (gitignored). Luego:

1. Supabase → **SQL Editor**
2. Pegar el contenido del archivo generado (`output/todos_abril_mayo_import.sql` o el individual)
3. **Run**

Configs por propiedad en `scripts/excel-import.*.config.json` y manifest en `scripts/departments.manifest.json` (solo estructura, no datos).

## Deploy en Vercel

1. Conectar repo [AppAirbnbGestor](https://github.com/Frab83548/AppAirbnbGestor) en Vercel
2. Variables de entorno en Vercel → Settings → Environment Variables:

| Variable | Valor |
|----------|--------|
| `SUPABASE_URL` | `https://pxabohgqaialclxczfrq.supabase.co` |
| `SUPABASE_ANON_KEY` | tu anon public key |

3. Build command: `npm run build:vercel` (ya configurado en `vercel.json`)
4. En Supabase → Authentication → URL Configuration, agregar tu dominio Vercel:
   - Site URL: `https://tu-app.vercel.app`
   - Redirect URLs: `https://tu-app.vercel.app/**`

## Usuarios y roles

Workspace compartido: todos los usuarios autenticados ven y editan el mismo portafolio. La tabla `profiles` incluye roles (`admin`, `member`, `viewer`) preparados para políticas RLS futuras.
