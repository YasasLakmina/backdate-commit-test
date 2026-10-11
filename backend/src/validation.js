import { badRequest } from './errors.js';

const ORIGIN_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const CODE_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function origin(value) {
  if (typeof value !== 'string' || !ORIGIN_RE.test(value)) throw badRequest('origin must be a month in YYYY-MM format.');
  return value;
}

export function overrides(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw badRequest('overrides must be an object of driver: number.');
  const entries = Object.entries(value);
  if (entries.length === 0 || entries.length > 5) throw badRequest('overrides must contain 1 to 5 drivers.');
  for (const [k, v] of entries) {
    if (typeof v !== 'number' || !Number.isFinite(v)) throw badRequest(`override '${k}' must be a finite number.`);
  }
  return value;
}

export function optionalCode(value, name) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !CODE_RE.test(value)) throw badRequest(`${name} must be 1-64 letters, digits, '-' or '_'.`);
  return value;
}

export function requiredCode(value, name) {
  const v = optionalCode(value, name);
  if (!v) throw badRequest(`${name} is required.`);
  return v;
}

export function oneOf(value, allowed, name) {
  if (!allowed.includes(value)) throw badRequest(`${name} must be one of: ${allowed.join(', ')}.`);
  return value;
}

export function optionalText(value, name, max = 1000) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || value.length > max) throw badRequest(`${name} must be text up to ${max} characters.`);
  return value;
}

export function intInRange(value, name, min, max, { optional = false } = {}) {
  if (optional && (value == null || value === '')) return null;
  if (!Number.isInteger(value) || value < min || value > max) throw badRequest(`${name} must be an integer from ${min} to ${max}.`);
  return value;
}
