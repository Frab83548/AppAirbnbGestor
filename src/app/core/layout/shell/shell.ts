import { Component, computed, effect, inject, signal } from '@angular/core';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { AuthService } from '../../auth/auth.service';
import { ThemeService } from '../theme.service';
import { PeriodSelector } from '../../../shared/ui/period-selector/period-selector';

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatTooltipModule,
    PeriodSelector,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly theme = inject(ThemeService);
  private readonly bp = inject(BreakpointObserver);

  readonly isMobile = toSignal(
    this.bp.observe([Breakpoints.Handset]).pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  readonly sidenavOpened = signal(true);

  constructor() {
    // Close the overlay drawer by default on mobile; open the side drawer on desktop.
    effect(() => {
      this.sidenavOpened.set(!this.isMobile());
    });
  }

  readonly navItems: NavItem[] = [
    { label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
    { label: 'Finanzas', icon: 'show_chart', route: '/finanzas' },
    { label: 'Propiedades', icon: 'apartment', route: '/propiedades' },
    { label: 'Ingresos', icon: 'payments', route: '/ingresos' },
    { label: 'Gastos Variables', icon: 'receipt_long', route: '/gastos-variables' },
    { label: 'Gastos Fijos', icon: 'calendar_month', route: '/gastos-fijos' },
    { label: 'Reportes', icon: 'description', route: '/reportes' },
  ];

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  readonly currentTitle = computed(() => {
    const url = this.currentUrl();
    return this.navItems.find((item) => url.startsWith(item.route))?.label ?? 'App Finanzas';
  });

  toggleTheme(): void {
    this.theme.toggle();
  }

  toggleSidenav(): void {
    this.sidenavOpened.update((open) => !open);
  }

  onNavClick(): void {
    if (this.isMobile()) {
      this.sidenavOpened.set(false);
    }
  }

  async logout(): Promise<void> {
    await this.auth.signOut();
    window.location.href = '/login';
  }
}
