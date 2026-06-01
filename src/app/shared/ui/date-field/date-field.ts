import { Component, forwardRef, input, OnDestroy } from '@angular/core';
import {
  ControlValueAccessor,
  FormControl,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-date-field',
  standalone: true,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatDatepickerModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DateFieldComponent),
      multi: true,
    },
  ],
  template: `
    <mat-form-field [appearance]="appearance()" [class]="fieldClass()">
      <mat-label>{{ label() }}</mat-label>
      <input
        matInput
        [matDatepicker]="picker"
        [formControl]="control"
        [placeholder]="placeholder()"
        (blur)="onTouched()"
      />
      <mat-datepicker-toggle matIconSuffix [for]="picker" />
      <mat-datepicker #picker />
    </mat-form-field>
  `,
})
export class DateFieldComponent implements ControlValueAccessor, OnDestroy {
  readonly label = input.required<string>();
  readonly appearance = input<'outline' | 'fill'>('outline');
  readonly fieldClass = input('');
  readonly placeholder = input('dd/mm/aaaa');

  readonly control = new FormControl<Date | null>(null);
  onTouched: () => void = () => {};

  private onChange: (value: Date | null) => void = () => {};
  private readonly sub: Subscription;

  constructor() {
    this.sub = this.control.valueChanges.subscribe((value) => this.onChange(value));
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  writeValue(value: Date | null): void {
    this.control.setValue(value, { emitEvent: false });
  }

  registerOnChange(fn: (value: Date | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    if (isDisabled) {
      this.control.disable({ emitEvent: false });
      return;
    }
    this.control.enable({ emitEvent: false });
  }
}
