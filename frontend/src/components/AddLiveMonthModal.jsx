import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { monthName } from '../format.js';

const INDUSTRY_PROFILES = [
  {
    id: 'baseline',
    label: 'Seasonal Baseline (Normal Weather & Steady Colombo Auctions)',
    description: 'Typical seasonal performance with stable tea prices (~1,165 LKR/kg) and normal monthly rainfall (215 mm).',
    data: {
      exports_mkg: '22.80',
      price_lkr_kg: '1165.0',
      usd_lkr: '304.5',
      rain_mm: '215.0',
      oni: '-0.15',
      bdi: '2.1',
      bdi_assumed: true,
      source: 'Forbes & Walker Monthly Tea Review / CBSL Indicative',
      entered_by_code: 'TEA_BOARD_OFFICER',
      notes: 'Standard seasonal harvest and regular Colombo auction sales volume.',
    },
  },
  {
    id: 'strong_market',
    label: 'Peak Quality Harvest (Favorable Agro-Climate & Strong Global Demand)',
    description: 'Elevated export shipments (25.4 mkg) supported by strong Western/Nuwara Eliya quality crop and firm Middle East demand.',
    data: {
      exports_mkg: '25.40',
      price_lkr_kg: '1240.0',
      usd_lkr: '307.0',
      rain_mm: '255.0',
      oni: '-0.40',
      bdi: '2.3',
      bdi_assumed: false,
      source: 'Sri Lanka Customs Export Statistics / Colombo Tea Traders',
      entered_by_code: 'BROKER_ANALYST',
      notes: 'Bumper crop across High and Medium elevations with active offshore buyer competition.',
    },
  },
  {
    id: 'dry_drought',
    label: 'Drought Impact Profile (Low Catchment Rainfall & Supply Contraction)',
    description: 'Severe dry spell curtailing green leaf intake (18.1 mkg); auction prices firming upwards (1,320 LKR/kg).',
    data: {
      exports_mkg: '18.10',
      price_lkr_kg: '1320.0',
      usd_lkr: '303.5',
      rain_mm: '85.0',
      oni: '0.65',
      bdi: '1.9',
      bdi_assumed: true,
      source: 'Tea Research Institute (TRI) Weather Station & Forbes & Walker',
      entered_by_code: 'ESTATE_DIRECTOR',
      notes: 'Severe dry spell curtailing green leaf intake; lower national export volume.',
    },
  },
  {
    id: 'currency_depreciation',
    label: 'Macroeconomic Realignment (Depreciated USD/LKR & Firm Rupee Bidding)',
    description: 'Rupee depreciation against USD driving competitive offshore buyer bidding and higher rupee realizations.',
    data: {
      exports_mkg: '21.90',
      price_lkr_kg: '1295.0',
      usd_lkr: '325.0',
      rain_mm: '190.0',
      oni: '0.00',
      bdi: '2.0',
      bdi_assumed: true,
      source: 'Central Bank of Sri Lanka (CBSL) Daily FX / Forbes & Walker',
      entered_by_code: 'TRADE_ECONOMIST',
      notes: 'Rupee depreciation against USD driving competitive offshore buyer bidding.',
    },
  },
  {
    id: 'heavy_monsoon',
    label: 'Monsoon Excess Profile (Heavy Catchment Rain & Logistics Delays)',
    description: 'Heavy precipitation causing transport delays and temporary auction dispatch backlogs (19.4 mkg).',
    data: {
      exports_mkg: '19.40',
      price_lkr_kg: '1180.0',
      usd_lkr: '305.0',
      rain_mm: '440.0',
      oni: '-0.85',
      bdi: '2.1',
      bdi_assumed: true,
      source: 'Department of Meteorology Bulletin & SLPA Port Logistics Report',
      entered_by_code: 'LOGISTICS_MNGR',
      notes: 'Incessant monsoon rainfall affecting plucking rounds and shipment schedules.',
    },
  },
];

export default function AddLiveMonthModal({ isOpen, onClose, onMonthAdded, existingMonths = [] }) {
  const lastBaseline = '2024-12';
  const latestMonth = existingMonths.length > 0 ? existingMonths[existingMonths.length - 1] : lastBaseline;

  // Compute next continuous month (e.g. 2024-12 -> 2025-01)
  const computeNext = (m) => {
    if (!m) return '';
    const [y, mon] = m.split('-').map(Number);
    const date = new Date(Date.UTC(y, mon, 1));
    const nextY = date.getUTCFullYear();
    const nextM = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${nextY}-${nextM}`;
  };

  const nextExpectedMonth = computeNext(latestMonth);

  const [selectedPreset, setSelectedPreset] = useState('');

  const [formData, setFormData] = useState({
    month: nextExpectedMonth,
    exports_mkg: '',
    price_lkr_kg: '1150.0',
    usd_lkr: '305.0',
    rain_mm: '220.0',
    oni: '-0.2',
    bdi: '2.1',
    bdi_assumed: true,
    source: 'Forbes & Walker Tea Market Report / CBSL / NOAA',
    entered_by_code: 'TEA_BOARD_OFFICER',
    notes: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [warnings, setWarnings] = useState([]);

  useEffect(() => {
    setFormData((prev) => ({ ...prev, month: nextExpectedMonth }));
  }, [nextExpectedMonth]);

  if (!isOpen) return null;

  const handlePresetChange = (presetId) => {
    setSelectedPreset(presetId);
    if (!presetId) return;

    const preset = INDUSTRY_PROFILES.find((p) => p.id === presetId);
    if (preset) {
      setFormData((prev) => ({
        ...prev,
        ...preset.data,
        month: nextExpectedMonth, // keep continuity
      }));
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setWarnings([]);

    try {
      if (formData.month !== nextExpectedMonth) {
        throw new Error(
          `Time-series continuity required: next expected month is ${nextExpectedMonth} (${monthName(nextExpectedMonth)}). Gaps would invalidate feature lag calculations.`
        );
      }

      const payload = {
        month: formData.month.trim(),
        exports_mkg: Number(formData.exports_mkg),
        price_lkr_kg: Number(formData.price_lkr_kg),
        usd_lkr: Number(formData.usd_lkr),
        rain_mm: Number(formData.rain_mm),
        oni: Number(formData.oni),
        bdi: Number(formData.bdi),
        bdi_assumed: Boolean(formData.bdi_assumed),
        source: formData.source.trim(),
        entered_by_code: formData.entered_by_code.trim(),
        notes: formData.notes.trim(),
      };

      if (!payload.exports_mkg || payload.exports_mkg <= 0) {
        throw new Error('Export volume must be a valid positive number in million kg.');
      }

      const res = await api.addLiveMonth(payload);
      if (res.warnings && res.warnings.length > 0) {
        setWarnings(res.warnings);
      }
      onMonthAdded(payload.month);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const targetPeriod = formData.month ? computeNext(formData.month) : '';

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-icon-badge" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </span>
            <div>
              <h2>Ingest Verified Actual Month (Live Extension)</h2>
              <p className="modal-sub">
                Record official customs and Colombo auction figures to advance the forecasting horizon.
              </p>
            </div>
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close dialog">
            &times;
          </button>
        </div>

        {error && (
          <div className="alert alert-error" role="alert">
            <strong>Data validation error:</strong> {error}
          </div>
        )}
        {warnings.length > 0 && (
          <div className="alert alert-warn">
            <strong>Recorded with observations:</strong>
            <ul>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Market & Climate Reference Profile Bar */}
          <div className="profile-preset-bar">
            <div className="profile-preset-header">
              <div className="profile-preset-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                </svg>
                <span>Industry Reference Profiles</span>
              </div>
              <span className="profile-badge">Pre-Calibrated Market Data</span>
            </div>
            <div className="profile-select-wrap">
              <select
                className="profile-select"
                value={selectedPreset}
                onChange={(e) => handlePresetChange(e.target.value)}
                aria-label="Select industry reference profile"
              >
                <option value="">-- Load Pre-Calibrated Market &amp; Climate Profile (Optional) --</option>
                {INDUSTRY_PROFILES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            {selectedPreset && (
              <div className="preset-applied-info">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 14 14"></polyline>
                </svg>
                <span>
                  <strong>Profile parameters applied:</strong> {INDUSTRY_PROFILES.find((p) => p.id === selectedPreset)?.description} (Figures loaded into form; individual values remain editable).
                </span>
              </div>
            )}
          </div>

          <div className="modal-section-grid">
            
            {/* Section 1: Period & Export Volume */}
            <div className="form-section-card">
              <div className="section-title">1. Operational Period & National Exports</div>
              
              <div className="field-group">
                <label className="field">
                  <span className="field-label">
                    Reporting Month <span className="req">*</span>
                  </span>
                  <div className="date-input-wrap">
                    <input
                      type="month"
                      name="month"
                      className="input-month"
                      value={formData.month}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="seq-badge">
                    Next sequential period: <strong>{monthName(nextExpectedMonth)} ({nextExpectedMonth})</strong>
                  </div>
                </label>

                <label className="field">
                  <span className="field-label">
                    National Tea Exports <span className="req">*</span>
                  </span>
                  <div className="input-with-unit">
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      max="70"
                      name="exports_mkg"
                      value={formData.exports_mkg}
                      onChange={handleChange}
                      placeholder="e.g. 23.50"
                      required
                      autoFocus
                    />
                    <span className="unit-tag">Million kg</span>
                  </div>
                  <span className="field-hint">Sri Lanka Customs official export volume</span>
                </label>
              </div>
            </div>

            {/* Section 2: Market & Currency Dynamics */}
            <div className="form-section-card">
              <div className="section-title">2. Colombo Auction & Macro Drivers</div>

              <div className="field-group">
                <label className="field">
                  <span className="field-label">
                    Colombo Auction Average <span className="req">*</span>
                  </span>
                  <div className="input-with-unit">
                    <input
                      type="number"
                      step="0.5"
                      name="price_lkr_kg"
                      value={formData.price_lkr_kg}
                      onChange={handleChange}
                      required
                    />
                    <span className="unit-tag">LKR / kg</span>
                  </div>
                  <span className="field-hint">All-elevations sales average</span>
                </label>

                <label className="field">
                  <span className="field-label">
                    Exchange Rate <span className="req">*</span>
                  </span>
                  <div className="input-with-unit">
                    <input
                      type="number"
                      step="0.1"
                      name="usd_lkr"
                      value={formData.usd_lkr}
                      onChange={handleChange}
                      required
                    />
                    <span className="unit-tag">LKR / USD</span>
                  </div>
                  <span className="field-hint">CBSL monthly average spot/indicative</span>
                </label>
              </div>

              <div className="field-group single-field">
                <label className="field">
                  <span className="field-label">
                    Buyer Demand Index (BDI) <span className="req">*</span>
                  </span>
                  <div className="input-with-unit">
                    <input
                      type="number"
                      step="0.1"
                      name="bdi"
                      value={formData.bdi}
                      onChange={handleChange}
                      required
                    />
                    <span className="unit-tag">% Index</span>
                  </div>
                </label>
                <label className="check compact-check">
                  <input
                    type="checkbox"
                    name="bdi_assumed"
                    checked={formData.bdi_assumed}
                    onChange={handleChange}
                  />
                  <span>BDI value carried forward from previous quarterly trade stats</span>
                </label>
              </div>
            </div>

            {/* Section 3: Agro-Climatic Indicators */}
            <div className="form-section-card">
              <div className="section-title">3. Climate & Ocean Indicators</div>

              <div className="field-group">
                <label className="field">
                  <span className="field-label">
                    National Rainfall <span className="req">*</span>
                  </span>
                  <div className="input-with-unit">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="2000"
                      name="rain_mm"
                      value={formData.rain_mm}
                      onChange={handleChange}
                      required
                    />
                    <span className="unit-tag">mm / month</span>
                  </div>
                  <span className="field-hint">Key plantation catchment area rainfall</span>
                </label>

                <label className="field">
                  <span className="field-label">
                    ENSO ONI Anomaly <span className="req">*</span>
                  </span>
                  <div className="input-with-unit">
                    <input
                      type="number"
                      step="0.05"
                      min="-4"
                      max="4"
                      name="oni"
                      value={formData.oni}
                      onChange={handleChange}
                      required
                    />
                    <span className="unit-tag">°C Anomaly</span>
                  </div>
                  <span className="field-hint">NOAA Climate Prediction Center (lag-safe)</span>
                </label>
              </div>
            </div>

            {/* Section 4: Audit & Data Governance */}
            <div className="form-section-card">
              <div className="section-title">4. Verification & Audit Trail</div>

              <div className="field-group">
                <label className="field">
                  <span className="field-label">
                    Source Document / Gazette <span className="req">*</span>
                  </span>
                  <input
                    type="text"
                    name="source"
                    value={formData.source}
                    onChange={handleChange}
                    required
                  />
                </label>

                <label className="field">
                  <span className="field-label">Officer / Reference Code</span>
                  <input
                    type="text"
                    name="entered_by_code"
                    value={formData.entered_by_code}
                    onChange={handleChange}
                  />
                </label>
              </div>

              <label className="field full-width">
                <span className="field-label">Operational Notes (Optional)</span>
                <input
                  type="text"
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="e.g. Verified against Forbes & Walker Monthly Tea Review, table 4"
                />
              </label>
            </div>
          </div>

          {/* Forecast Target Unlock Banner */}
          <div className="forecast-unlock-callout">
            <div className="callout-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
            <div className="callout-body">
              <strong>Forward Forecast Horizon:</strong> Saving verified actuals for <strong>{monthName(formData.month)}</strong> unlocks forward prediction for <strong>{monthName(targetPeriod)} ({targetPeriod})</strong> with full SHAP driver explanations and What-If simulation.
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="button button-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="button button-primary" disabled={submitting}>
              {submitting ? 'Verifying & Saving...' : `Save Actuals & Forecast ${monthName(targetPeriod)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

