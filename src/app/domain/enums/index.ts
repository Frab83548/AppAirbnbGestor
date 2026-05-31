export type AppRole = 'admin' | 'member' | 'viewer';

export type PropertyStatus = 'activa' | 'inactiva' | 'mantenimiento';

export type Platform = 'airbnb' | 'booking' | 'directo' | 'otra';

export type ExpenseCategory =
  | 'limpieza'
  | 'insumos'
  | 'reparaciones'
  | 'mantenimiento'
  | 'sabanas'
  | 'viaticos'
  | 'otros';

export const PLATFORM_LABELS: Record<Platform, string> = {
  airbnb: 'Airbnb',
  booking: 'Booking',
  directo: 'Directo',
  otra: 'Otra',
};

export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  activa: 'Activa',
  inactiva: 'Inactiva',
  mantenimiento: 'Mantenimiento',
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  limpieza: 'Limpieza',
  insumos: 'Insumos',
  reparaciones: 'Reparaciones',
  mantenimiento: 'Mantenimiento',
  sabanas: 'Sábanas',
  viaticos: 'Viáticos',
  otros: 'Otros',
};
