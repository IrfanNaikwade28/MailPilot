import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getCampaign } from '../api/client'
import StatusBadge from '../components/StatusBadge'

const S = {
  page: { maxWidth: 860, margin: '0 auto', padding: '32px 24px' },
  breadcrumb: { fontSize: 13, color: '#6b7280', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 },
  breadBtn: { background: 'none', border: 'none', padding: 0, color: '#6b7280', fontSize: 13, cursor: 'pointer' },
  header: { marginBottom: 28 },
  titleRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  title: { fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 },
  objective: { fontSize: 14, color: '#6b7280', marginTop: 6, lineHeight: 1.6 },
  actions: { display: 'flex', gap: 8, flexShrink: 0, marginTop: 4 },
  btnPrimary: { background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 14, fontWeight: 600 },
  btnSecondary: { background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 14px', fontSize: 14, fontWeight: 500 },
  btnGreen: { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 14, fontWeight: 600 },
  section: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 16 },
  sectionHead: { padding: '14px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 },
  sectionTag: { fontSize: 12, padding: '2px 10px', borderRadius: 20, fontWeight: 600 },
  sectionBody: { padding: '18px 20px' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px' },
  field: { marginBottom: 0 },
  fieldLabel: { fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 },
  fieldValue: { fontSize: 14, color: '#111827', lineHeight: 1.5 },
  reasoningBox: { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '10px 14px', marginTop: 14 },
  reasoningLabel: { fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 },
  reasoningText: { fontSize: 13, color: '#374151', lineHeight: 1.6 },
  countBig: { fontSize: 32, fontWeight: 700, color: '#1d4ed8', lineHeight: 1 },
  countLabel: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  compliantYes: { background: '#dcfce7', color: '#166534', fontSize: 12, padding: '3px 12px', borderRadius: 20, fontWeight: 600, display: 'inline-block' },
  compliantNo: { background: '#fee2e2', color: '#991b1b', fontSize: 12, padding: '3px 12px', borderRadius: 20, fontWeight: 600, display: 'inline-block' },
  issueList: { margin: '10px 0 0', paddingLeft: 18 },
  issueItem: { fontSize: 13, color: '#b91c1c', marginBottom: 4 },
  navRow: { display: 'flex', gap: 8, marginTop: 4 },
}

export default function CampaignPreview() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [campaign, setCampaign] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getCampaign(id)
      .then((res) => setCampaign(res.data))
      .catch((err) => setError(err.response?.data?.detail || err.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div style={{ textAlign: 'center', padding: '80px 0', color: '#9ca3af' }}>Loading...</div>
  if (error) return <div style={{ textAlign: 'center', padding: '80px 0', color: '#ef4444' }}>{error}</div>
  if (!campaign) return null

  const strategy = campaign.strategy_json || {}
  const email = campaign.email_json || {}
  const seg = campaign.segmentation_json || {}
  const compliance = campaign.compliance_json || {}

  return (
    <div style={S.page}>
      <div style={S.breadcrumb}>
        <button style={S.breadBtn} onClick={() => navigate('/')}>Campaigns</button>
        <span>/</span>
        <span>Campaign #{id}</span>
      </div>

      <div style={S.header}>
        <div style={S.titleRow}>
          <div>
            <h1 style={S.title}>Campaign #{id}</h1>
            <p style={S.objective}>{campaign.objective}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
            <StatusBadge status={campaign.status} />
            <div style={S.actions}>
              {campaign.status === 'draft' && (
                <button style={S.btnPrimary} onClick={() => navigate(`/campaign/${id}/approve`)}>
                  Review & Approve
                </button>
              )}
              {campaign.status === 'approved' && (
                <button style={S.btnGreen} onClick={() => navigate(`/campaign/${id}/analytics`)}>
                  View Analytics
                </button>
              )}
              {campaign.status === 'sent' && (
                <button style={S.btnSecondary} onClick={() => navigate(`/campaign/${id}/analytics`)}>
                  View Analytics
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Strategy */}
      <div style={S.section}>
        <div style={S.sectionHead}>
          <p style={S.sectionTitle}>Strategy Agent</p>
          <span style={{ ...S.sectionTag, background: '#dcfce7', color: '#166534' }}>Done</span>
        </div>
        <div style={S.sectionBody}>
          <div style={S.grid2}>
            <Field label="Campaign Goal" value={strategy.campaign_goal} />
            <Field label="Tone" value={strategy.tone} />
            <Field label="Target Persona" value={strategy.target_persona} />
            <Field label="CTA Strategy" value={strategy.cta_strategy} />
          </div>
          {strategy.reasoning && (
            <div style={S.reasoningBox}>
              <p style={S.reasoningLabel}>Reasoning</p>
              <p style={S.reasoningText}>{strategy.reasoning}</p>
            </div>
          )}
        </div>
      </div>

      {/* Segmentation */}
      <div style={S.section}>
        <div style={S.sectionHead}>
          <p style={S.sectionTitle}>Segmentation Agent</p>
          <span style={{ ...S.sectionTag, background: '#dcfce7', color: '#166534' }}>Done</span>
        </div>
        <div style={S.sectionBody}>
          <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
            <div>
              <p style={S.countBig}>{seg.selected_user_count ?? '—'}</p>
              <p style={S.countLabel}>Users selected</p>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="Filters Applied" value={seg.filters_applied} />
            </div>
          </div>
          {seg.reasoning && (
            <div style={{ ...S.reasoningBox, marginTop: 14 }}>
              <p style={S.reasoningLabel}>Reasoning</p>
              <p style={S.reasoningText}>{seg.reasoning}</p>
            </div>
          )}
        </div>
      </div>

      {/* Compliance */}
      <div style={S.section}>
        <div style={S.sectionHead}>
          <p style={S.sectionTitle}>Compliance Agent</p>
          <span style={{
            ...S.sectionTag,
            background: compliance.is_compliant ? '#dcfce7' : '#fee2e2',
            color: compliance.is_compliant ? '#166534' : '#991b1b',
          }}>
            {compliance.is_compliant ? 'Passed' : 'Failed'}
          </span>
        </div>
        <div style={S.sectionBody}>
          <span style={compliance.is_compliant ? S.compliantYes : S.compliantNo}>
            {compliance.is_compliant ? 'Compliant — meets RBI/SEBI/IRDAI guidelines' : 'Non-Compliant'}
          </span>
          {compliance.issues_found?.length > 0 && (
            <ul style={S.issueList}>
              {compliance.issues_found.map((issue, i) => (
                <li key={i} style={S.issueItem}>{issue}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Bottom nav */}
      <div style={S.navRow}>
        <button style={S.btnSecondary} onClick={() => navigate(`/campaign/${id}/email`)}>
          View Email Content
        </button>
        {campaign.status === 'draft' && (
          <button style={S.btnPrimary} onClick={() => navigate(`/campaign/${id}/approve`)}>
            Go to Approval
          </button>
        )}
      </div>
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 14, color: '#111827', lineHeight: 1.5, margin: 0 }}>{value || '—'}</p>
    </div>
  )
}
