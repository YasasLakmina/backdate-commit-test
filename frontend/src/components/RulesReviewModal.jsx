import { useState, useEffect } from 'react';
import { api } from '../api.js';

export default function RulesReviewModal({ isOpen, onClose }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRule, setSelectedRule] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState(null);

  const [reviewForm, setReviewForm] = useState({
    reviewer_role: 'Tea Broker',
    years_experience: '8',
    verdict: 'agree',
    suggested_wording: '',
    comment: '',
    reviewer_code: 'EXP-REV',
  });

  const loadRules = async () => {
    try {
      setLoading(true);
      const data = await api.rules();
      setRules(data.rules || []);
      if (!selectedRule && data.rules?.length) {
        setSelectedRule(data.rules[0]);
      } else if (selectedRule) {
        const updated = data.rules?.find((r) => r.id === selectedRule.id);
        if (updated) setSelectedRule(updated);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadRules();
      setFormSuccess(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRule) return;
    setSubmitting(true);
    setFormSuccess(null);
    setError(null);

    try {
      await api.addReview(selectedRule.id, {
        reviewer_role: reviewForm.reviewer_role,
        years_experience: Number(reviewForm.years_experience),
        verdict: reviewForm.verdict,
        suggested_wording: reviewForm.suggested_wording.trim() || undefined,
        comment: reviewForm.comment.trim() || undefined,
      });
      setFormSuccess(`Review recorded for rule ${selectedRule.id}.`);
      await loadRules();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Decision Rules Catalogue &amp; Domain Expert Review</h2>
          <button type="button" className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <p className="muted small">
          All 15 decision rules are soft prompts grounded in calibration history. Rules remain labelled <strong>DRAFT</strong> until verified by a tea sector professional.
        </p>

        {error && <div className="alert alert-error">{error}</div>}
        {formSuccess && <div className="alert alert-success">{formSuccess}</div>}

        <div className="rules-layout">
          <div className="rules-list-pane">
            <h3>Rules ({rules.length})</h3>
            <ul className="rules-nav">
              {rules.map((r) => (
                <li
                  key={r.id}
                  className={`rule-nav-item ${selectedRule?.id === r.id ? 'active' : ''}`}
                  onClick={() => { setSelectedRule(r); setFormSuccess(null); }}
                >
                  <div className="rule-nav-head">
                    <span className={`pill pill-${r.severity}`}>{r.severity}</span>
                    <span className={`pill ${r.status === 'REVIEWED' ? 'pill-reviewed' : 'pill-draft'}`}>{r.status}</span>
                  </div>
                  <strong>{r.title}</strong>
                  <span className="muted small">{r.id} v{r.version}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rule-detail-pane">
            {selectedRule ? (
              <div>
                <div className="card-head">
                  <h3>{selectedRule.title}</h3>
                  <span className={`pill ${selectedRule.status === 'REVIEWED' ? 'pill-reviewed' : 'pill-draft'}`}>
                    {selectedRule.status}
                  </span>
                </div>
                <dl className="evidence">
                  <dt>Rule ID</dt><dd><code>{selectedRule.id}</code> (v{selectedRule.version} · {selectedRule.family})</dd>
                  <dt>Trigger Condition</dt><dd>{selectedRule.trigger}</dd>
                  <dt>Research Limitation</dt><dd>{selectedRule.limitation}</dd>
                  <dt>Existing Expert Reviews</dt>
                  <dd>
                    {selectedRule.reviews ? (
                      <span>Agree: {selectedRule.reviews.agree} · Partly: {selectedRule.reviews.partly} · Disagree: {selectedRule.reviews.disagree}</span>
                    ) : 'No reviews recorded in database yet (running in memory/no-db mode).'}
                  </dd>
                </dl>

                <hr />

                <h4>Submit Expert Review</h4>
                <form onSubmit={handleReviewSubmit} className="review-form">
                  <div className="form-grid">
                    <label className="field">
                      <span className="field-label">Reviewer Role *</span>
                      <select
                        value={reviewForm.reviewer_role}
                        onChange={(e) => setReviewForm({ ...reviewForm, reviewer_role: e.target.value })}
                        required
                      >
                        <option value="Tea Broker">Tea Broker</option>
                        <option value="Export Manager">Export Manager</option>
                        <option value="Tea Trader / Buyer">Tea Trader / Buyer</option>
                        <option value="Market Analyst">Market Analyst</option>
                        <option value="Agricultural Economist">Agricultural Economist</option>
                      </select>
                    </label>

                    <label className="field">
                      <span className="field-label">Years of Experience</span>
                      <input
                        type="number"
                        min="0"
                        value={reviewForm.years_experience}
                        onChange={(e) => setReviewForm({ ...reviewForm, years_experience: e.target.value })}
                      />
                    </label>

                    <label className="field">
                      <span className="field-label">Verdict *</span>
                      <select
                        value={reviewForm.verdict}
                        onChange={(e) => setReviewForm({ ...reviewForm, verdict: e.target.value })}
                        required
                      >
                        <option value="agree">Agree (Rule is realistic &amp; useful)</option>
                        <option value="partly">Partly Agree (Needs wording adjustment)</option>
                        <option value="disagree">Disagree (Rule trigger or wording unhelpful)</option>
                      </select>
                    </label>

                    <label className="field">
                      <span className="field-label">Anonymous Participant Code</span>
                      <input
                        type="text"
                        value={reviewForm.reviewer_code}
                        onChange={(e) => setReviewForm({ ...reviewForm, reviewer_code: e.target.value })}
                      />
                    </label>
                  </div>

                  <label className="field" style={{ marginTop: '0.6rem' }}>
                    <span className="field-label">Suggested Better Wording</span>
                    <input
                      type="text"
                      placeholder="Optional recommendation for prompt phrasing"
                      value={reviewForm.suggested_wording}
                      onChange={(e) => setReviewForm({ ...reviewForm, suggested_wording: e.target.value })}
                    />
                  </label>

                  <label className="field" style={{ marginTop: '0.6rem' }}>
                    <span className="field-label">Domain Comment</span>
                    <textarea
                      rows={2}
                      placeholder="Comments on operational applicability"
                      value={reviewForm.comment}
                      onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                    />
                  </label>

                  <div className="modal-actions" style={{ marginTop: '1rem' }}>
                    <button type="submit" className="button button-primary" disabled={submitting}>
                      {submitting ? 'Submitting...' : 'Record Expert Review'}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <p className="muted">Select a rule to view details.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
