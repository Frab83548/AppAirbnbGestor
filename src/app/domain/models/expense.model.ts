import { ExpenseCategory } from '../enums';

export interface VariableExpense {
  id: string;
  propertyId: string;
  propertyName?: string;
  expenseDate: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVariableExpenseDto {
  propertyId: string;
  expenseDate: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
}

export interface UpdateVariableExpenseDto extends Partial<CreateVariableExpenseDto> {
  id: string;
}

export interface FixedExpense {
  id: string;
  propertyId: string;
  propertyName?: string;
  month: number;
  year: number;
  entryDate: string;
  buildingExpenses: number;
  electricity: number;
  water: number;
  gas: number;
  internet: number;
  municipality: number;
  others: number;
  total: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFixedExpenseDto {
  propertyId: string;
  month: number;
  year: number;
  entryDate: string;
  buildingExpenses: number;
  electricity: number;
  water: number;
  gas: number;
  internet: number;
  municipality: number;
  others: number;
}

export interface UpdateFixedExpenseDto extends Partial<CreateFixedExpenseDto> {
  id: string;
}
