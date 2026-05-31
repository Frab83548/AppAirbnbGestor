import { Injectable, inject } from '@angular/core';
import { VARIABLE_EXPENSE_REPOSITORY } from '../../domain/ports/variable-expense.repository';
import {
  CreateVariableExpenseDto,
  UpdateVariableExpenseDto,
  VariableExpense,
} from '../../domain/models/expense.model';
import { ExpenseFilters } from '../../domain/ports/variable-expense.repository';

@Injectable({ providedIn: 'root' })
export class VariableExpenseFacade {
  private readonly repo = inject(VARIABLE_EXPENSE_REPOSITORY);

  findAll(filters?: ExpenseFilters): Promise<VariableExpense[]> {
    return this.repo.findAll(filters);
  }

  create(dto: CreateVariableExpenseDto): Promise<VariableExpense> {
    return this.repo.create(dto);
  }

  update(dto: UpdateVariableExpenseDto): Promise<VariableExpense> {
    return this.repo.update(dto);
  }

  delete(id: string): Promise<void> {
    return this.repo.delete(id);
  }
}
