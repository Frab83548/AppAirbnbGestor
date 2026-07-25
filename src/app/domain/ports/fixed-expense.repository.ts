import { InjectionToken } from '@angular/core';
import {
  CreateFixedExpenseDto,
  FixedExpense,
  UpdateFixedExpenseDto,
} from '../models/expense.model';

export interface FixedExpenseFilters {
  propertyId?: string;
  month?: number;
  year?: number;
  entryDateFrom?: string;
  entryDateTo?: string;
  /** @deprecated Usar entryDateFrom */
  createdFrom?: string;
  /** @deprecated Usar entryDateTo */
  createdTo?: string;
}

export interface IFixedExpenseRepository {
  findAll(filters?: FixedExpenseFilters): Promise<FixedExpense[]>;
  findById(id: string): Promise<FixedExpense | null>;
  create(dto: CreateFixedExpenseDto): Promise<FixedExpense>;
  update(dto: UpdateFixedExpenseDto): Promise<FixedExpense>;
  delete(id: string): Promise<void>;
  duplicateFromPreviousMonth(
    sourceMonth: number,
    sourceYear: number,
    targetMonth: number,
    targetYear: number,
    propertyId?: string,
  ): Promise<number>;
}

export const FIXED_EXPENSE_REPOSITORY = new InjectionToken<IFixedExpenseRepository>(
  'FIXED_EXPENSE_REPOSITORY',
);
