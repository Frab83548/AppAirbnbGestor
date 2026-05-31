import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./core/layout/shell/shell').then((m) => m.Shell),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'finanzas',
        loadComponent: () =>
          import('./features/financial-dashboard/financial-dashboard/financial-dashboard').then(
            (m) => m.FinancialDashboard,
          ),
      },
      {
        path: 'propiedades',
        loadComponent: () =>
          import('./features/properties/property-list/property-list').then((m) => m.PropertyList),
      },
      {
        path: 'ingresos',
        loadComponent: () =>
          import('./features/income/income-list/income-list').then((m) => m.IncomeList),
      },
      {
        path: 'gastos-variables',
        loadComponent: () =>
          import('./features/variable-expenses/variable-expense-list/variable-expense-list').then(
            (m) => m.VariableExpenseList,
          ),
      },
      {
        path: 'gastos-fijos',
        loadComponent: () =>
          import('./features/fixed-expenses/fixed-expense-list/fixed-expense-list').then(
            (m) => m.FixedExpenseList,
          ),
      },
      {
        path: 'reportes',
        loadComponent: () => import('./features/reports/reports/reports').then((m) => m.Reports),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
