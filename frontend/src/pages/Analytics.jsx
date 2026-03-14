import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getCampaignAnalytics, sendCampaign, optimizeCampaign } from '../api/client'
import StatusBadge from '../components/StatusBadge'

const S = {
  page: { maxWidth: 900, margin: '0 auto', padding: '32px 24px' },
  breadcrumb: { fontSize: 13, color: '#6b7280', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 },
  breadBtn: { background: 'none', border: 'none', padding: 0, color: '#6b7280', fontSize: 13, cursor: 'pointer' },
  titleRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24 },
  title: { fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 },
  objective: { fontSize: 14, color: '#6b7280', marginTop: 6, lineHeight: 1.6 },

  alertGreen: { marginBottom: 16, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', fontSize: 13, borderRadius: 6, padding: '12px 16px' },
  alertRed: { marginBottom: 16, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13, borderRadius: 6, padding: '12px 16px' },

  sendPanel: { background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  sendPanelText: { fontSize: 14, fontWeight: 600, color: '#1e40af', margin: 0 },
  sendPanelSub: { fontSize: 13, color: '#3b82f6', marginTop: 4 },
  btnSend: { background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 6, padding: '9px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', minWidth: 130 },
  btnDisabled: { background: '#93c5fd', color: '#fff', border: 'none', borderRadius: 6, padding: '9px 20px', fontSize: 14, fontWeight: 600, cursor: 'not-allowed', minWidth: 130 },

  optPanel: { background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 8, padding: '16px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20 },
  optLeft: { flex: 1 },
  optTitle: { fontSize: 14, fontWeight: 600, color: '#6b21a8', margin: '0 0 4px' },
  optSub: { fontSize: 13, color: '#7c3aed', lineHeight: 1.5 },
  btnOpt: { background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 6, padding: '9px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', minWidth: 160, whiteSpace: 'nowrap' },
  btnOptDisabled: { background: '#a78bfa', color: '#fff', border: 'none', borderRadius: 6, padding: '9px 20px', fontSize: 14, fontWeight: 600, cursor: 'not-allowed', minWidth: 160, whiteSpace: 'nowrap' },
  optApproverRow: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 },
  optApproverInput: { border: '1px solid #d8b4fe', borderRadius: 5, padding: '7px 10px', fontSize: 13, outline: 'none', width: 180 },

  optResult: { background: '#fff', border: '1px solid #e9d5ff', borderRadius: 8, marginBottom: 16 },
  optResultHead: { padding: '12px 18px', borderBottom: '1px solid #f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  optResultTitle: { fontSize: 14, fontWeight: 600, color: '#6b21a8', margin: 0 },
  optResultBody: { padding: '16px 18px' },
  optResultGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', marginBottom: 12 },
  optReasonBox: { background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: '#374151', lineHeight: 1.6 },
  optNavBtn: { background: 'none', border: '1px solid #d8b4fe', borderRadius: 5, padding: '6px 14px', fontSize: 13, color: '#7c3aed', cursor: 'pointer' },

  section: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 16 },
  sectionHead: { padding: '14px 20px', borderBottom: '1px solid #f3f4f6' },
  sectionTitle: { fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 },
  sectionBody: { padding: '20px' },

  statsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 },
  statCard: { borderRadius: 8, padding: '16px', textAlign: 'center' },
  statValue: { fontSize: 30, fontWeight: 700, lineHeight: 1, margin: 0 },
  statLabel: { fontSize: 12, color: '#6b7280', marginTop: 6, fontWeight: 500 },

  scoreRow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 },
  scoreCard: { borderRadius: 8, padding: '16px', textAlign: 'center', background: 'linear-gradient(135deg, #1d4ed8 0%, #7c3aed 100%)' },
  scoreValue: { fontSize: 36, fontWeight: 700, color: '#fff', lineHeight: 1, margin: 0 },
  scoreLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' },

  gaugeRow: { marginBottom: 16 },
  gaugeTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  gaugeLabel: { fontSize: 13, color: '#374151', fontWeight: 500 },
  gaugeValue: { fontSize: 13, fontWeight: 700, color: '#111827' },
  gaugeTrack: { width: '100%', height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' },
  gaugeFill: { height: '100%', borderRadius: 4, transition: 'width 0.6s ease' },

  empty: { textAlign: 'center', padding: '40px 20px' },
  emptyTitle: { fontSize: 15, fontWeight: 600, color: '#6b7280', margin: 0 },
  emptySub: { fontSize: 13, color: '#9ca3af', marginTop: 6 },

  insightGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 },
  insightCard: { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '14px' },
  insightTitle: { fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 },
  insightValue: { fontSize: 13, color: '#111827', lineHeight: 1.6 },
  engagementBadge: { fontSize: 12, padding: '2px 10px', borderRadius: 20, fontWeight: 600, display: 'inline-block', marginLeft: 10 },
  thresholdNote: { fontSize: 12, color: '#6b7280', marginBottom: 16 },

  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px 24px' },
  fieldLabel: { fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 },
  fieldValue: { fontSize: 14, color: '#111827', lineHeight: 1.5 },
  approvalNote: { marginTop: 16, paddingTop: 14, borderTop: '1px solid #f3f4f6', fontSize: 12, color: '#9ca3af' },

  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 },
  spinner: { textAlign: 'center', padding: '80px 0', color: '#9ca3af', fontSize: 14 },
  errorFull: { textAlign: 'center', padding: '80px 0', color: '#ef4444', fontSize: 14 },
}

function GaugeBar({ label, value, color }) {
  const pct = Math.min(Math.round(value * 100), 100)
  return (
    <div style={S.gaugeRow}>
      <div style={S.gaugeTop}>
        <span style={S.gaugeLabel}>{label}</span>
        <span style={S.gaugeValue}>{(value * 100).toFixed(1)}%</span>
      </div>
      <div style={S.gaugeTrack}>
        <div style={{ ...S.gaugeFill, width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

function StatCard({ value, label, bg, color, sub }) {
  return (
    <div style={{ ...S.statCard, background: bg }}>
      <p style={{ ...S.statValue, color }}>{value}</p>
      <p style={S.statLabel}>{label}</p>
      {sub && <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{sub}</p>}
    </div>
  )
}

function InsightCard({ title, value }) {
  return (
    <div style={S.insightCard}>
      <p style={S.insightTitle}>{title}</p>
      <p style={S.insightValue}>{value || '—'}</p>
    </div>
  )
}

function InfoCell({ label, value }) {
  return (
    <div>
      <p style={S.fieldLabel}>{label}</p>
      <p style={S.fieldValue}>{value || '—'}</p>
    </div>
  )
}

export default function Analytics() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [sendMsg, setSendMsg] = useState(null)

  const [optimizing, setOptimizing] = useState(false)
  const [optApprover, setOptApprover] = useState('')
  const [optResult, setOptResult] = useState(null)
  const [optError, setOptError] = useState(null)

  const fetchAnalytics = () => {
    setLoading(true)
    getCampaignAnalytics(id)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.detail || err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchAnalytics() }, [id])

  const handleSend = async () => {
    setSending(true)
    setError(null)
    try {
      const res = await sendCampaign(id)
      setSendMsg(res.data.message)
      fetchAnalytics()
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
    } finally {
      setSending(false)
    }
  }

  const handleOptimize = async () => {
    if (!optApprover.trim()) { setOptError('Enter approver name before running optimization.'); return }
    setOptimizing(true); setOptError(null); setOptResult(null)
    try {
      const res = await optimizeCampaign(id, { approved_by: optApprover })
      setOptResult(res.data)
    } catch (err) {
      setOptError(err.response?.data?.detail || err.message)
    } finally {
      setOptimizing(false)
    }
  }

  if (loading) return <div style={S.spinner}>Loading...</div>
  if (error && !data) return <div style={S.errorFull}>{error}</div>

  const campaign = data?.campaign || {}
  const perf = data?.performance
  const insights = data?.learning_insights

  return (
    <div style={S.page}>
      <div style={S.breadcrumb}>
        <button style={S.breadBtn} onClick={() => navigate('/')}>Dashboard</button>
        <span>/</span>
        <button style={S.breadBtn} onClick={() => navigate(`/campaign/${id}/preview`)}>Campaign #{id}</button>
        <span>/</span>
        <span style={{ color: '#111827' }}>Analytics</span>
      </div>

      <div style={S.titleRow}>
        <div>
          <h1 style={S.title}>Campaign Analytics</h1>
          <p style={S.objective}>{campaign.objective}</p>
        </div>
        <StatusBadge status={campaign.status} />
      </div>

      {sendMsg && <div style={S.alertGreen}>{sendMsg}</div>}
      {error && <div style={S.alertRed}>{error}</div>}

      {/* Send Panel */}
      {campaign.status === 'approved' && (
        <div style={S.sendPanel}>
          <div>
            <p style={S.sendPanelText}>Campaign approved — ready to send via CampaignX API</p>
            <p style={S.sendPanelSub}>
              Will be sent to {campaign.segmentation_json?.selected_user_count ?? '—'} recipients.
              {campaign.send_time && ` Scheduled: ${campaign.send_time} IST`}
            </p>
          </div>
          <button onClick={handleSend} disabled={sending} style={sending ? S.btnDisabled : S.btnSend}>
            {sending ? 'Sending...' : 'Send Campaign'}
          </button>
        </div>
      )}

      {/* Performance */}
      {perf ? (
        <>
          {/* EO+EC score row */}
          <div style={{ ...S.section, marginBottom: 12 }}>
            <div style={S.sectionHead}><p style={S.sectionTitle}>Hackathon Score Contribution — Raw Counts</p></div>
            <div style={{ ...S.sectionBody, padding: '16px' }}>
              <div style={S.scoreRow}>
                <div style={S.scoreCard}>
                  <p style={S.scoreValue}>{(perf.emails_opened || 0) + (perf.emails_clicked || 0)}</p>
                  <p style={S.scoreLabel}>EO + EC Score</p>
                </div>
                <div style={{ ...S.statCard, background: '#f0fdf4' }}>
                  <p style={{ ...S.statValue, color: '#15803d', fontSize: 36 }}>{perf.emails_opened}</p>
                  <p style={S.statLabel}>Opens (EO=Y)</p>
                  <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                    {perf.emails_sent > 0 ? `${((perf.emails_opened / perf.emails_sent) * 100).toFixed(1)}% open rate` : ''}
                  </p>
                </div>
                <div style={{ ...S.statCard, background: '#faf5ff' }}>
                  <p style={{ ...S.statValue, color: '#7e22ce', fontSize: 36 }}>{perf.emails_clicked}</p>
                  <p style={S.statLabel}>Clicks (EC=Y)</p>
                  <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                    {perf.emails_sent > 0 ? `${((perf.emails_clicked / perf.emails_sent) * 100).toFixed(1)}% click rate` : ''}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div style={S.twoCol}>
            <div style={S.section}>
              <div style={S.sectionHead}><p style={S.sectionTitle}>Delivery Metrics</p></div>
              <div style={{ ...S.sectionBody, padding: '16px' }}>
                <div style={S.statsGrid}>
                  <StatCard value={perf.emails_sent} label="Emails Sent" bg="#eff6ff" color="#1d4ed8" />
                  <StatCard
                    value={perf.emails_sent > 0 ? `${((perf.emails_clicked / perf.emails_sent) * 100).toFixed(1)}%` : '—'}
                    label="Click Rate"
                    bg="#fffbeb"
                    color="#b45309"
                  />
                </div>
              </div>
            </div>
            <div style={S.section}>
              <div style={S.sectionHead}><p style={S.sectionTitle}>Performance Rates</p></div>
              <div style={S.sectionBody}>
                <GaugeBar label="Open Rate" value={perf.open_rate || 0} color="#22c55e" />
                <GaugeBar label="Click Rate" value={perf.click_rate || 0} color="#3b82f6" />
              </div>
            </div>
          </div>
        </>
      ) : (
        <div style={{ ...S.section, marginBottom: 16 }}>
          <div style={{ ...S.sectionBody, ...S.empty }}>
            <p style={S.emptyTitle}>No performance data yet</p>
            <p style={S.emptySub}>Metrics will appear after the campaign is sent.</p>
          </div>
        </div>
      )}

      {/* AI Learning Insights */}
      {insights && (
        <div style={{ ...S.section, marginBottom: 16 }}>
          <div style={S.sectionHead}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <p style={S.sectionTitle}>AI Learning Loop Insights</p>
              <span style={{
                ...S.engagementBadge,
                background: insights.engagement_level === 'high' ? '#dcfce7' : '#ffedd5',
                color: insights.engagement_level === 'high' ? '#166534' : '#c2410c',
              }}>
                {insights.engagement_level === 'high' ? 'High Engagement' : 'Low Engagement'}
              </span>
            </div>
          </div>
          <div style={S.sectionBody}>
            <p style={S.thresholdNote}>{insights.open_rate_vs_threshold}</p>
            <div style={S.insightGrid}>
              <InsightCard title="Tone Recommendation" value={insights.tone_recommendation} />
              <InsightCard title="Persona Recommendation" value={insights.persona_recommendation} />
              <InsightCard title="CTA Assessment" value={insights.click_through_assessment} />
            </div>
          </div>
        </div>
      )}

      {/* Optimization Loop Panel */}
      {campaign.status === 'sent' && (
        <>
          <div style={S.optPanel}>
            <div style={S.optLeft}>
              <p style={S.optTitle}>Autonomous Optimization Loop</p>
              <p style={S.optSub}>
                Agents analyse performance, generate an improved variant, auto-approve and send it via CampaignX API.
              </p>
              <div style={S.optApproverRow}>
                <input
                  style={S.optApproverInput}
                  placeholder="Approver name"
                  value={optApprover}
                  onChange={e => setOptApprover(e.target.value)}
                />
              </div>
            </div>
            <button onClick={handleOptimize} disabled={optimizing} style={optimizing ? S.btnOptDisabled : S.btnOpt}>
              {optimizing ? 'Optimizing...' : 'Run Optimization Loop'}
            </button>
          </div>

          {optError && <div style={S.alertRed}>{optError}</div>}

          {optResult && (
            <div style={S.optResult}>
              <div style={S.optResultHead}>
                <p style={S.optResultTitle}>Optimization Complete — New Campaign #{optResult.new_campaign_id}</p>
                <button style={S.optNavBtn} onClick={() => navigate(`/campaign/${optResult.new_campaign_id}/analytics`)}>
                  View new campaign
                </button>
              </div>
              <div style={S.optResultBody}>
                <div style={S.optResultGrid}>
                  <InfoCell label="New Subject" value={optResult.email_content?.subject_line} />
                  <InfoCell label="New Tone" value={optResult.strategy?.tone} />
                  <InfoCell label="Recipients" value={`${optResult.segmentation?.selected_user_count} customers`} />
                  <InfoCell label="Status" value={optResult.status} />
                </div>
                <p style={{ ...S.fieldLabel, marginBottom: 6 }}>Optimization Reasoning</p>
                <div style={S.optReasonBox}>{optResult.optimization_reasoning}</div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Campaign Summary */}
      <div style={S.section}>
        <div style={S.sectionHead}><p style={S.sectionTitle}>Campaign Summary</p></div>
        <div style={S.sectionBody}>
          <div style={S.summaryGrid}>
            <InfoCell label="Goal" value={campaign.strategy_json?.campaign_goal} />
            <InfoCell label="Tone" value={campaign.strategy_json?.tone} />
            <InfoCell label="Subject Line" value={campaign.email_json?.subject_line} />
            <InfoCell label="CTA Text" value={campaign.email_json?.cta_text} />
          </div>
          {campaign.approved_by && (
            <div style={S.approvalNote}>
              Approved by <strong style={{ color: '#374151' }}>{campaign.approved_by}</strong>
              {campaign.approval_timestamp &&
                ` on ${new Date(campaign.approval_timestamp).toLocaleString('en-IN')}`}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
