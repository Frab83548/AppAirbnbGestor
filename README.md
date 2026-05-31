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

2. Editar [`src/environments/environment.development.ts`](src/environments/environment.development.ts):

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

## Usuarios y roles

Workspace compartido: todos los usuarios autenticados ven y editan el mismo portafolio. La tabla `profiles` incluye roles (`admin`, `member`, `viewer`) preparados para políticas RLS futuras.
