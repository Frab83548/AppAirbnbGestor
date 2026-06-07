import { InjectionToken } from '@angular/core';
import {
  CreateVariableExpenseDto,
  UpdateVariableExpenseDto,
  VariableExpense,
} from '../models/expense.model';

export interface ExpenseFilters {
  propertyId?: string;
  month?: number;
  year?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface IVariableExpenseRepository {
  findAll(filters?: ExpenseFilters): Promise<VariableExpense[]>;
  findById(id: string): Promise<VariableExpense | null>;
  create(dto: CreateVariableExpenseDto): Promise<VariableExpense>;
  update(dto: UpdateVariableExpenseDto): Promise<VariableExpense>;
  delete(id: string): Promise<void>;
}

export const VARIABLE_EXPENSE_REPOSITORY = new InjectionToken<IVariableExpenseRepository>(
  'VARIABLE_EXPENSE_REPOSITORY',
);
