/**
 * Genera environment.production.ts desde variables de entorno (Vercel).
 */
import fs from 'fs';

function cleanEnv(value) {
  let v = String(value ?? '').trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v.replace(/\r?\n/g, '');
}

const url = cleanEnv(process.env.SUPABASE_URL ?? process.env.NG_APP_SUPABASE_URL);
const key = cleanEnv(process.env.SUPABASE_ANON_KEY ?? process.env.NG_APP_SUPABASE_ANON_KEY);

if (!url || !key) {
  console.error('Missing SUPABASE_URL and SUPABASE_ANON_KEY (or NG_APP_* variants)');
  process.exit(1);
}

if (key.length < 100) {
  console.error('SUPABASE_ANON_KEY looks truncated — paste the full anon key in Vercel (one line, no quotes).');
  process.exit(1);
}

const content = `export const environment = {
  production: true,
  supabaseUrl: ${JSON.stringify(url)},
  supabaseAnonKey: ${JSON.stringify(key)},
};
`;

fs.writeFileSync('src/environments/environment.production.ts', content, 'utf8');
console.log('Generated src/environments/environment.production.ts');
