import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { DashboardKpis } from '../../domain/models/dashboard.model';
import { Reservation } from '../../domain/models/reservation.model';
import { VariableExpense } from '../../domain/models/expense.model';
import { FixedExpense } from '../../domain/models/expense.model';

@Injectable({ providedIn: 'root' })
export class ExportService {
  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value);
  }

  exportPdfMonthly(
    title: string,
    kpis: DashboardKpis,
    reservations: Reservation[],
    variableExpenses: VariableExpense[],
    fixedExpenses: FixedExpense[],
  ): void {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(title, 14, 20);
    doc.setFontSize(11);
    doc.text(`Ingresos: ${this.formatCurrency(kpis.totalIncome)}`, 14, 32);
    doc.text(`Gastos fijos: ${this.formatCurrency(kpis.fixedExpenses)}`, 14, 40);
    doc.text(`Gastos variables: ${this.formatCurrency(kpis.variableExpenses)}`, 14, 48);
    doc.text(`Comisión Fran: ${this.formatCurrency(kpis.franCommission)}`, 14, 56);
    doc.text(`Ganancia neta: ${this.formatCurrency(kpis.netProfit)}`, 14, 64);
    doc.text(`Rentabilidad: ${kpis.profitabilityPct.toFixed(1)}%`, 14, 72);

    autoTable(doc, {
      startY: 80,
      head: [['Fecha', 'Propiedad', 'Cobrado', 'Com. Fran', 'Gan. Neta']],
      body: reservations.map((r) => [
        r.checkInDate,
        r.propertyName ?? '',
        this.formatCurrency(r.amountCharged),
        this.formatCurrency(r.franCommission),
        this.formatCurrency(r.netProfit),
      ]),
    });

    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? 120;
    autoTable(doc, {
      startY: finalY + 10,
      head: [['Gastos variables', 'Categoría', 'Monto']],
      body: variableExpenses.map((e) => [e.description, e.category, this.formatCurrency(e.amount)]),
    });

    autoTable(doc, {
      startY: ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? finalY) + 10,
      head: [['Gastos fijos', 'Propiedad', 'Total']],
      body: fixedExpenses.map((e) => [`${e.month}/${e.year}`, e.propertyName ?? '', this.formatCurrency(e.total)]),
    });

    doc.save(`${title.replace(/\s/g, '_')}.pdf`);
  }

  exportExcel(
    kpis: DashboardKpis,
    reservations: Reservation[],
    variableExpenses: VariableExpense[],
    fixedExpenses: FixedExpense[],
    filename: string,
  ): void {
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        { Metrica: 'Ingresos', Valor: kpis.totalIncome },
        { Metrica: 'Gastos fijos', Valor: kpis.fixedExpenses },
        { Metrica: 'Gastos variables', Valor: kpis.variableExpenses },
        { Metrica: 'Comisión Fran', Valor: kpis.franCommission },
        { Metrica: 'Ganancia neta', Valor: kpis.netProfit },
        { Metrica: 'Rentabilidad %', Valor: kpis.profitabilityPct },
      ]),
      'Resumen',
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        reservations.map((r) => ({
          Fecha: r.checkInDate,
          Propiedad: r.propertyName,
          Plataforma: r.platform,
          Cobrado: r.amountCharged,
          'Com. Fran': r.franCommission,
          'Gan. Neta': r.netProfit,
        })),
      ),
      'Ingresos',
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        variableExpenses.map((e) => ({
          Fecha: e.expenseDate,
          Propiedad: e.propertyName,
          Categoria: e.category,
          Descripcion: e.description,
          Monto: e.amount,
        })),
      ),
      'Gastos Variables',
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        fixedExpenses.map((e) => ({
          Propiedad: e.propertyName,
          Mes: e.month,
          Anio: e.year,
          Expensas: e.buildingExpenses,
          Luz: e.electricity,
          Agua: e.water,
          Gas: e.gas,
          Internet: e.internet,
          Municipalidad: e.municipality,
          Otros: e.others,
          Total: e.total,
        })),
      ),
      'Gastos Fijos',
    );

    XLSX.writeFile(wb, `${filename}.xlsx`);
  }

  exportCsv(data: Record<string, unknown>[], filename: string): void {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const rows = data.map((row) =>
      headers.map((h) => JSON.stringify(row[h] ?? '')).join(','),
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
}
