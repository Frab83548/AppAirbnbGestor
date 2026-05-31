import { Provider } from '@angular/core';
import { PROPERTY_REPOSITORY } from '../domain/ports/property.repository';
import { RESERVATION_REPOSITORY } from '../domain/ports/reservation.repository';
import { VARIABLE_EXPENSE_REPOSITORY } from '../domain/ports/variable-expense.repository';
import { FIXED_EXPENSE_REPOSITORY } from '../domain/ports/fixed-expense.repository';
import { DASHBOARD_REPOSITORY } from '../domain/ports/dashboard.repository';
import { SupabasePropertyRepository } from './repositories/supabase-property.repository';
import { SupabaseReservationRepository } from './repositories/supabase-reservation.repository';
import { SupabaseVariableExpenseRepository } from './repositories/supabase-variable-expense.repository';
import { SupabaseFixedExpenseRepository } from './repositories/supabase-fixed-expense.repository';
import { SupabaseDashboardRepository } from './repositories/supabase-dashboard.repository';

export const repositoryProviders: Provider[] = [
  { provide: PROPERTY_REPOSITORY, useExisting: SupabasePropertyRepository },
  { provide: RESERVATION_REPOSITORY, useExisting: SupabaseReservationRepository },
  { provide: VARIABLE_EXPENSE_REPOSITORY, useExisting: SupabaseVariableExpenseRepository },
  { provide: FIXED_EXPENSE_REPOSITORY, useExisting: SupabaseFixedExpenseRepository },
  { provide: DASHBOARD_REPOSITORY, useExisting: SupabaseDashboardRepository },
];
