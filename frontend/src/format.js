export const fmt = (v, digits = 2) => (v == null || Number.isNaN(v) ? '–' : Number(v).toFixed(digits));
export const signed = (v, digits = 2) => (v == null ? '–' : `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(digits)}`);
export const pct = (v, digits = 1) => (v == null ? '–' : `${(v * 100).toFixed(digits)}%`);

export function monthName(period) {
  if (!period) return '';
  const [y, m] = period.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' });
}

export function fmtDriverValue(v, unit = '') {
  if (v == null) return '–';
  const digits = Math.abs(v) >= 100 ? 0 : 2;
  return `${Number(v).toLocaleString('en-GB', { maximumFractionDigits: digits, minimumFractionDigits: digits })}${unit ? ` ${unit}` : ''}`;
}

export function evidenceValue(v) {
  if (typeof v === 'number') return Math.abs(v) < 1 && v !== 0 ? v.toFixed(3) : v.toFixed(2);
  if (Array.isArray(v)) return v.length ? v.join('; ') : 'none';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  return String(v);
}
