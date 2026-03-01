import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createCampaign } from '../api/client'

const EXAMPLES = [
  'Promote a new home loan product targeting salaried professionals in Maharashtra with competitive interest rates.',
  'Launch a term insurance awareness campaign for working professionals aged 25–40 across metro cities in India.',
  'Drive credit card applications among high-income IT professionals in Bangalore and Hyderabad.',
  'Promote mutual fund SIP plans targeting first-time investors with monthly income above ₹50,000.',
]

const S = {
  page: { maxWidth: 680, margin: '0 auto', padding: '40px 24px' },
  back: { fontSize: 13, color: '#6b7280', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 4 },
  backBtn: { background: 'none', border: 'none', padding: 0, color: '#6b7280', fontSize: 13, cursor: 'pointer' },
  title: { fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 6px' },
  subtitle: { fontSize: 14, color: '#6b7280', margin: '0 0 28px' },
  cohortBox: { background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '14px 16px', marginBottom: 24 },
  cohortText: { fontSize: 13, color: '#166534', fontWeight: 600, marginBottom: 2 },
  cohortSub: { fontSize: 12, color: '#15803d' },
  card: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 24 },
  label: { display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 },
  textarea: { width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '10px 12px', fontSize: 14, color: '#111827', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6 },
  charCount: { fontSize: 12, color: '#9ca3af', marginTop: 6, marginBottom: 20 },
  exLabel: { fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 },
  exBtn: { display: 'block', width: '100%', textAlign: 'left', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#374151', marginBottom: 6, cursor: 'pointer' },
  error: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: '#b91c1c', marginTop: 16 },
  submit: { width: '100%', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 6, padding: '11px 0', fontSize: 15, fontWeight: 600, marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  submitDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  pipeline: { marginTop: 28, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '18px 20px' },
  pipelineTitle: { fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 },
  pipelineRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  pipelineStep: { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 14px', fontSize: 13, color: '#374151' },
  pipelineArrow: { color: '#9ca3af', fontSize: 14 },
}

export default function CreateCampaign() {
  const [objective, setObjective] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!objective.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await createCampaign(objective.trim())
      navigate(`/campaign/${res.data.campaign_id}/preview`)
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const disabled = loading || objective.trim().length < 10

  return (
    <div style={S.page}>
      <div style={S.back}>
        <button style={S.backBtn} onClick={() => navigate('/')}>Campaigns</button>
        <span>/</span>
        <span>New Campaign</span>
      </div>

      <h1 style={S.title}>New Campaign</h1>
      <p style={S.subtitle}>
        Describe your objective in plain English. The AI agents will plan, write, and validate the campaign automatically.
      </p>

      {/* Cohort info */}
      <div style={S.cohortBox}>
        <p style={S.cohortText}>5,000-customer cohort loaded live from CampaignX API</p>
        <p style={S.cohortSub}>Segmentation agent will select the best-fit recipients from the real cohort at send time.</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={S.card}>
        <label style={S.label}>
          Campaign Objective <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <textarea
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          rows={5}
          placeholder="e.g. Promote a new home loan product targeting salaried professionals in Maharashtra..."
          style={S.textarea}
        />
        <p style={S.charCount}>{objective.length} characters — minimum 10</p>

        <p style={S.exLabel}>Example objectives</p>
        {EXAMPLES.map((ex, i) => (
          <button key={i} type="button" style={S.exBtn} onClick={() => setObjective(ex)}>
            {ex}
          </button>
        ))}

        {error && <div style={S.error}>{error}</div>}

        <button
          type="submit"
          disabled={disabled}
          style={{ ...S.submit, ...(disabled ? S.submitDisabled : {}) }}
        >
          {loading ? 'Running AI agents — please wait...' : 'Run Campaign Pipeline'}
        </button>
      </form>

      {/* Pipeline steps */}
      <div style={S.pipeline}>
        <p style={S.pipelineTitle}>What happens when you submit</p>
        <div style={S.pipelineRow}>
          {['Strategy Agent', 'Content Agent', 'Compliance Agent', 'Segmentation Agent', 'Human Approval'].map((step, i, arr) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={S.pipelineStep}>{step}</span>
              {i < arr.length - 1 && <span style={S.pipelineArrow}>→</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
