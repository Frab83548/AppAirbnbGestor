import { Injectable } from '@angular/core';
import { getSupabaseClient } from '../config/supabase.client';
import { Profile } from '../../domain/models/profile.model';
import { AppRole } from '../../domain/enums';

interface ProfileRow {
  id: string;
  full_name: string;
  role: AppRole;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = getSupabaseClient();

  readonly session$ = this.supabase.auth.onAuthStateChange;

  async getSession() {
    const { data } = await this.supabase.auth.getSession();
    return data.session;
  }

  async getUserId(): Promise<string | null> {
    const session = await this.getSession();
    return session?.user?.id ?? null;
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async signOut() {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
  }

  async getProfile(): Promise<Profile | null> {
    const userId = await this.getUserId();
    if (!userId) return null;

    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return this.mapProfile(data as ProfileRow);
  }

  private mapProfile(row: ProfileRow): Profile {
    return {
      id: row.id,
      fullName: row.full_name,
      role: row.role,
      avatarUrl: row.avatar_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
