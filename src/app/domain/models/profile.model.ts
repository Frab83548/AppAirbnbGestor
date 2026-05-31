import { AppRole } from '../enums';

export interface Profile {
  id: string;
  fullName: string;
  role: AppRole;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}
