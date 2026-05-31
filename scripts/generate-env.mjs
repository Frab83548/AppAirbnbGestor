/**
 * Genera environment.production.ts desde variables de entorno (Vercel).
 */
import fs from 'fs';

const url = process.env.SUPABASE_URL ?? process.env.NG_APP_SUPABASE_URL ?? '';
const key = process.env.SUPABASE_ANON_KEY ?? process.env.NG_APP_SUPABASE_ANON_KEY ?? '';

if (!url || !key) {
  console.error('Missing SUPABASE_URL and SUPABASE_ANON_KEY (or NG_APP_* variants)');
  process.exit(1);
}

const content = `export const environment = {
  production: true,
  supabaseUrl: '${url.replace(/'/g, "\\'")}',
  supabaseAnonKey: '${key.replace(/'/g, "\\'")}',
};
`;

fs.writeFileSync('src/environments/environment.production.ts', content, 'utf8');
console.log('Generated src/environments/environment.production.ts');
