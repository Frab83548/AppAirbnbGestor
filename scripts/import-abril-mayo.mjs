/**
 * Genera SQL de Abril (4) y Mayo (5) para todos los departamentos del manifest.
 * Busca Excel en Downloads (o --dir=ruta).
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { runImport, generateSql } from './excel-to-sql.mjs';

const MONTHS = [4, 5];
const DEFAULT_DIR = path.join(os.homedir(), 'Downloads');

function findExcel(dir, candidates) {
  for (const name of candidates) {
    const full = path.join(dir, name);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

function main() {
  const dirArg = process.argv.find((a) => a.startsWith('--dir='))?.slice(6) ?? DEFAULT_DIR;
  const manifest = JSON.parse(fs.readFileSync('scripts/departments.manifest.json', 'utf8'));

  const sections = [
    `-- Import Abril + Mayo — ${new Date().toISOString()}`,
    '-- Ejecutar UNA sola vez en Supabase → SQL Editor',
    '',
  ];
  const missing = [];

  for (const dept of manifest) {
    const xlsx = findExcel(dirArg, dept.excelFiles);
    if (!xlsx) {
      missing.push({ id: dept.id, expected: dept.excelFiles });
      continue;
    }

    const outIndividual = path.join('output', `${dept.id}_abril_mayo_import.sql`);
    const { data, config } = runImport({
      xlsxPath: xlsx,
      configPath: dept.config,
      outPath: outIndividual,
      monthFilter: MONTHS,
    });

    sections.push(generateSql(data, config, xlsx));
    console.log(
      `✓ ${config.propertyName}: ${data.reservations.length} reservas, ${data.fixedExpenses.length} gastos fijos → ${outIndividual}`,
    );
  }

  if (sections.length > 3) {
    const combined = path.join('output', 'todos_abril_mayo_import.sql');
    fs.mkdirSync('output', { recursive: true });
    fs.writeFileSync(combined, sections.join('\n'), 'utf8');
    console.log(`\nSQL combinado → ${combined}`);
  }

  if (missing.length) {
    console.log('\n⚠ Excel no encontrados (copiá a Downloads):');
    for (const m of missing) {
      console.log(`  ${m.id}: ${m.expected.join(' | ')}`);
    }
  }

  if (sections.length <= 3) {
    process.exit(1);
  }
}

main();
