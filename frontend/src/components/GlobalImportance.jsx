import { useEffect, useState } from 'react';

import { api } from '../api.js';
import { fmt } from '../format.js';

/** What the model relies on overall across the held-out months (mean |contribution|). */
export default function GlobalImportance() {
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || rows) return;
    api.globalImportance().then((d) => setRows(d.drivers)).catch(() => setRows([]));
  }, [open, rows]);

  const max = Math.max(0.05, ...(rows ?? []).map((r) => r.mean_abs_contribution));
  return (
    <details className="card" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary><h2 className="inline">What the model relies on overall</h2></summary>
      <p className="muted small">Average size of each driver's contribution over the held-out months 2022–2024. This describes the model, not real-world causes.</p>
      {!rows && <p className="muted">Loading…</p>}
      {rows?.length === 0 && <p className="muted">Not available.</p>}
      {rows?.map((r) => (
        <div className="bar-row" key={r.driver}>
          <span className="bar-label">{r.driver}</span>
          <span className="bar-track"><span className="bar bar-neutral" style={{ left: 0, width: `${(r.mean_abs_contribution / max) * 100}%` }} /></span>
          <span className="bar-value">{fmt(r.mean_abs_contribution)}</span>
        </div>
      ))}
    </details>
  );
}
