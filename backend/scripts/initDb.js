/**
 * Create the application role and database (if missing), then apply database/schema.sql.
 *
 *   npm run db:init
 *
 * Uses ADMIN_DATABASE_URL (a superuser) to create the role/database named in
 * DATABASE_URL, then connects as that role to apply the schema.
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const localSchema = fileURLToPath(new URL('../database/schema.sql', import.meta.url));
const parentSchema = fileURLToPath(new URL('../../database/schema.sql', import.meta.url));
const schemaPath = existsSync(localSchema) ? localSchema : parentSchema;
const appUrl = process.env.DATABASE_URL;
const adminUrl = process.env.ADMIN_DATABASE_URL;

if (!appUrl) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env first.');
  process.exit(1);
}

const target = new URL(appUrl);
const role = decodeURIComponent(target.username);
const password = decodeURIComponent(target.password);
const database = target.pathname.replace(/^\//, '');
const ident = (s) => `"${s.replaceAll('"', '""')}"`;

if (adminUrl) {
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  const roleExists = (await admin.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role])).rowCount > 0;
  if (!roleExists) {
    await admin.query(`CREATE ROLE ${ident(role)} LOGIN PASSWORD ${admin.escapeLiteral(password)}`);
    console.log(`Created role ${role}`);
  }
  const dbExists = (await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [database])).rowCount > 0;
  if (!dbExists) {
    await admin.query(`CREATE DATABASE ${ident(database)} OWNER ${ident(role)}`);
    console.log(`Created database ${database}`);
  }
  await admin.end();
} else {
  console.log('ADMIN_DATABASE_URL not set: assuming the role and database already exist.');
}

const client = new pg.Client({ connectionString: appUrl });
await client.connect();
await client.query(await readFile(schemaPath, 'utf8'));
const { rows } = await client.query(
  "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
);
await client.end();
console.log(`Schema applied to ${database}: ${rows.map((r) => r.table_name).join(', ')}`);
