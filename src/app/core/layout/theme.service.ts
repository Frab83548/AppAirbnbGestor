import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storageKey = 'app-finanzas-theme';
  readonly isDark = signal(this.loadInitialTheme());

  toggle(): void {
    this.isDark.update((v) => !v);
    this.apply();
  }

  setDark(dark: boolean): void {
    this.isDark.set(dark);
    this.apply();
  }

  private loadInitialTheme(): boolean {
    const stored = localStorage.getItem(this.storageKey);
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  private apply(): void {
    const dark = this.isDark();
    document.body.classList.toggle('dark-theme', dark);
    localStorage.setItem(this.storageKey, dark ? 'dark' : 'light');
  }

  init(): void {
    this.apply();
  }
}
