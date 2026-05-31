import { Injectable, inject } from '@angular/core';
import { FIXED_EXPENSE_REPOSITORY } from '../../domain/ports/fixed-expense.repository';
import {
  CreateFixedExpenseDto,
  FixedExpense,
  UpdateFixedExpenseDto,
} from '../../domain/models/expense.model';
import { FixedExpenseFilters } from '../../domain/ports/fixed-expense.repository';

@Injectable({ providedIn: 'root' })
export class FixedExpenseFacade {
  private readonly repo = inject(FIXED_EXPENSE_REPOSITORY);

  findAll(filters?: FixedExpenseFilters): Promise<FixedExpense[]> {
    return this.repo.findAll(filters);
  }

  create(dto: CreateFixedExpenseDto): Promise<FixedExpense> {
    return this.repo.create(dto);
  }

  update(dto: UpdateFixedExpenseDto): Promise<FixedExpense> {
    return this.repo.update(dto);
  }

  delete(id: string): Promise<void> {
    return this.repo.delete(id);
  }

  duplicateFromPreviousMonth(
    sourceMonth: number,
    sourceYear: number,
    targetMonth: number,
    targetYear: number,
    propertyId?: string,
  ): Promise<number> {
    return this.repo.duplicateFromPreviousMonth(
      sourceMonth,
      sourceYear,
      targetMonth,
      targetYear,
      propertyId,
    );
  }
}
