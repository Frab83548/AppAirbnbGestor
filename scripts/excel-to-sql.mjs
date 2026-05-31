/**
 * Lee Excel → genera SQL para Supabase SQL Editor (sin hardcodear datos).
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import XLSX from 'xlsx';

export function loadConfig(configPath) {
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function excelDateToIso(serial) {
  if (typeof serial !== 'number' || !serial) return null;
  return new Date((serial - 25569) * 86400000).toISOString().slice(0, 10);
}

function addDay(isoDate) {
  const d = new Date(isoDate + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function esc(s) {
  return String(s ?? '').replace(/'/g, "''");
}

function monthFromSheetName(sheetName, monthNames) {
  for (const [name, month] of Object.entries(monthNames)) {
    if (sheetName.includes(name)) return month;
  }
  return null;
}

function inferYearForMonth(reservations, month) {
  const years = reservations
    .filter((r) => new Date(r.checkIn + 'T12:00:00').getMonth() + 1 === month)
    .map((r) => new Date(r.checkIn + 'T12:00:00').getFullYear());
  return years.length ? years[0] : null;
}

function sheetAllowed(sheetMonths, monthFilter) {
  if (!monthFilter?.length) return true;
  if (!sheetMonths?.length) return true;
  return sheetMonths.some((m) => monthFilter.includes(m));
}

function rowMonthAllowed(checkIn, monthFilter) {
  if (!monthFilter?.length) return true;
  const m = new Date(checkIn + 'T12:00:00').getMonth() + 1;
  return monthFilter.includes(m);
}

export function parseWorkbook(wb, config, monthFilter = null) {
  const reservations = [];

  for (const sheetCfg of config.incomeSheets) {
    if (!sheetAllowed(sheetCfg.months, monthFilter)) continue;
    const ws = wb.Sheets[sheetCfg.sheet];
    if (!ws) continue;

    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const cols = sheetCfg.columns;

    for (const r of rows.slice(1)) {
      if (typeof r[cols.date] !== 'number' || !r[cols.amount]) continue;
      const checkIn = excelDateToIso(r[cols.date]);
      if (!rowMonthAllowed(checkIn, monthFilter)) continue;

      const cleaning = cols.cleaning != null ? num(r[cols.cleaning]) : 0;
      const rawNote = cols.notes != null ? String(r[cols.notes] ?? '').trim() : '';
      reservations.push({
        checkIn,
        checkOut: addDay(checkIn),
        amount: num(r[cols.amount]),
        cleaning,
        extra: 0,
        notes: rawNote ? `Importado desde Excel — ${rawNote}` : 'Importado desde Excel',
        sourceSheet: sheetCfg.sheet,
      });
    }
  }

  const fixedExpenses = [];
  const fixedCfg = config.fixedExpenseSheets;
  if (fixedCfg) {
    for (const sheetName of wb.SheetNames) {
      if (!sheetName.startsWith(fixedCfg.prefix)) continue;
      const month = monthFromSheetName(sheetName, fixedCfg.monthNames);
      if (!month) continue;
      if (monthFilter?.length && !monthFilter.includes(month)) continue;

      const year = inferYearForMonth(reservations, month);
      if (!year) continue;

      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
      const r = rows[fixedCfg.dataRow];
      if (!r) continue;
      const c = fixedCfg.columns;
      fixedExpenses.push({
        month,
        year,
        building: num(r[c.building]),
        water: num(r[c.water]),
        electricity: num(r[c.electricity]),
        municipality: num(r[c.municipality]),
        internet: num(r[c.internet]),
        gas: 0,
        others: 0,
        sourceSheet: sheetName,
      });
    }
  }

  const variableExpenses = [];
  const varCfg = config.variableExpenseSheets;
  if (varCfg) {
    for (const sheetName of wb.SheetNames) {
      if (!sheetName.startsWith(varCfg.prefix)) continue;
      const month = monthFromSheetName(sheetName, fixedCfg.monthNames);
      if (!month) continue;
      if (monthFilter?.length && !monthFilter.includes(month)) continue;

      const monthKey = Object.keys(varCfg.categoryByMonth ?? {}).find((k) => sheetName.includes(k));
      const monthCfg = monthKey ? varCfg.categoryByMonth[monthKey] : null;
      if (!monthCfg) continue;

      const year = inferYearForMonth(reservations, month);
      if (!year) continue;

      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
      const amount = num(rows[monthCfg.amountRow]?.[monthCfg.amountCol]);
      if (amount <= 0) continue;

      variableExpenses.push({
        date: `${year}-${String(month).padStart(2, '0')}-15`,
        category: monthCfg.category,
        description: String(rows[monthCfg.descriptionRow]?.[monthCfg.descriptionCol] ?? 'Gasto variable'),
        amount,
        sourceSheet: sheetName,
      });
    }
  }

  return { reservations, fixedExpenses, variableExpenses };
}

export function generateSql(data, config, sourceFile) {
  const propertyName = config.propertyName;
  const platform = config.platform ?? 'directo';

  const lines = [
    `-- ${config.propertyName} ← ${path.basename(sourceFile)}`,
    `-- Reservas: ${data.reservations.length} | Fijos: ${data.fixedExpenses.length} | Variables: ${data.variableExpenses.length}`,
    'DO $$',
    'DECLARE',
    '  v_property_id UUID;',
    'BEGIN',
    `  SELECT id INTO v_property_id FROM properties WHERE name = '${esc(propertyName)}' LIMIT 1;`,
    '  IF v_property_id IS NULL THEN',
    `    RAISE EXCEPTION 'Propiedad "${esc(propertyName)}" no encontrada.';`,
    '  END IF;',
    '',
  ];

  for (const r of data.reservations) {
    lines.push(
      `  -- ${r.sourceSheet} ${r.checkIn}`,
      `  INSERT INTO reservations (property_id, check_in_date, check_out_date, platform, amount_charged, cleaning_cost, extra_expenses, notes)`,
      `  VALUES (v_property_id, '${r.checkIn}', '${r.checkOut}', '${platform}', ${r.amount}, ${r.cleaning}, ${r.extra}, '${esc(r.notes)}');`,
    );
  }

  for (const f of data.fixedExpenses) {
    lines.push(
      `  -- Gastos fijos ${f.sourceSheet} ${f.month}/${f.year}`,
      `  INSERT INTO fixed_expenses (property_id, month, year, building_expenses, electricity, water, gas, internet, municipality, others)`,
      `  VALUES (v_property_id, ${f.month}, ${f.year}, ${f.building}, ${f.electricity}, ${f.water}, ${f.gas}, ${f.internet}, ${f.municipality}, ${f.others})`,
      `  ON CONFLICT (property_id, month, year) DO UPDATE SET`,
      `    building_expenses = EXCLUDED.building_expenses, electricity = EXCLUDED.electricity,`,
      `    water = EXCLUDED.water, internet = EXCLUDED.internet, municipality = EXCLUDED.municipality;`,
    );
  }

  for (const v of data.variableExpenses) {
    lines.push(
      `  INSERT INTO variable_expenses (property_id, expense_date, category, description, amount)`,
      `  VALUES (v_property_id, '${v.date}', '${v.category}', '${esc(v.description)}', ${v.amount});`,
    );
  }

  lines.push('END $$;', '');
  return lines.join('\n');
}

export function runImport({ xlsxPath, configPath, outPath, monthFilter = null }) {
  const config = loadConfig(configPath);
  const wb = XLSX.readFile(xlsxPath);
  const data = parseWorkbook(wb, config, monthFilter);
  const sql = generateSql(data, config, xlsxPath);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, sql, 'utf8');

  return { config, data, outPath };
}

function parseArgs(argv) {
  const args = { xlsx: null, config: 'scripts/excel-import.trejo.config.json', out: null, months: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--config') args.config = argv[++i];
    else if (argv[i] === '--out') args.out = argv[++i];
    else if (argv[i] === '--months') args.months = argv[++i].split(',').map(Number);
    else if (argv[i].endsWith('.xlsx') || argv[i].endsWith('.xls')) args.xlsx = argv[i];
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.xlsx) {
    console.error('Uso: npm run import:excel -- "ruta.xlsx" [--config ...] [--months 4,5] [--out output/x.sql]');
    console.error('Batch abril/mayo: npm run import:abril-mayo');
    process.exit(1);
  }
  if (!fs.existsSync(args.xlsx)) {
    console.error(`No se encontró: ${args.xlsx}`);
    process.exit(1);
  }

  const base = path.basename(args.xlsx, path.extname(args.xlsx)).replace(/[^a-zA-Z0-9-_]/g, '_').toLowerCase();
  const suffix = args.months ? `_mes_${args.months.join('_')}` : '';
  const outPath = args.out ?? path.join('output', `${base}${suffix}_import.sql`);

  const { data } = runImport({ xlsxPath: args.xlsx, configPath: args.config, outPath, monthFilter: args.months });

  console.log(`Reservas: ${data.reservations.length} | Fijos: ${data.fixedExpenses.length} | Variables: ${data.variableExpenses.length}`);
  console.log(`SQL → ${outPath}`);
}

const isMain = process.argv[1]?.endsWith('excel-to-sql.mjs');
if (isMain) main();
