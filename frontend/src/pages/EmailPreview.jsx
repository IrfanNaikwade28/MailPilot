import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getCampaign } from '../api/client'

const S = {
  page: { maxWidth: 860, margin: '0 auto', padding: '32px 24px' },
  breadcrumb: { fontSize: 13, color: '#6b7280', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 },
  breadBtn: { background: 'none', border: 'none', padding: 0, color: '#6b7280', fontSize: 13, cursor: 'pointer' },
  title: { fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 24px' },
  layout: { display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 },
  emailCard: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' },
  emailBar: { background: '#f3f4f6', borderBottom: '1px solid #e5e7eb', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 },
  dot: (color) => ({ width: 10, height: 10, borderRadius: '50%', background: color }),
  emailBarLabel: { fontSize: 12, color: '#9ca3af', marginLeft: 6 },
  emailBody: { padding: '24px 28px' },
  subjectLabel: { fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 },
  subjectText: { fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #f3f4f6' },
  bodyText: { fontSize: 14, color: '#374151', lineHeight: 1.8, whiteSpace: 'pre-wrap' },
  ctaBtn: { display: 'inline-block', background: '#1d4ed8', color: '#fff', padding: '10px 24px', borderRadius: 6, fontSize: 14, fontWeight: 600, marginTop: 20, border: 'none' },
  disclaimer: { fontSize: 12, color: '#9ca3af', lineHeight: 1.6, marginTop: 24, paddingTop: 16, borderTop: '1px solid #f3f4f6' },
  sidebar: { display: 'flex', flexDirection: 'column', gap: 12 },
  infoCard: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '16px' },
  infoTitle: { fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 },
  infoRow: { marginBottom: 12 },
  infoLabel: { fontSize: 11, color: '#9ca3af', marginBottom: 3, fontWeight: 600 },
  infoValue: { fontSize: 13, color: '#111827' },
  noteBox: { background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 14px' },
  noteText: { fontSize: 12, color: '#166534', lineHeight: 1.6 },
  proceedBtn: { background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 0', fontSize: 14, fontWeight: 600, width: '100%', cursor: 'pointer' },
}

export default function EmailPreview() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [campaign, setCampaign] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCampaign(id)
      .then((res) => setCampaign(res.data))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div style={{ textAlign: 'center', padding: '80px 0', color: '#9ca3af' }}>Loading...</div>
  if (!campaign) return null

  const email = campaign.email_json || {}
  const wordCount = (email.email_body || '').split(/\s+/).filter(Boolean).length

  return (
    <div style={S.page}>
      <div style={S.breadcrumb}>
        <button style={S.breadBtn} onClick={() => navigate('/')}>Campaigns</button>
        <span>/</span>
        <button style={S.breadBtn} onClick={() => navigate(`/campaign/${id}/preview`)}>Campaign #{id}</button>
        <span>/</span>
        <span>Email Preview</span>
      </div>

      <h1 style={S.title}>Email Preview</h1>

      <div style={S.layout}>
        {/* Email render */}
        <div style={S.emailCard}>
          <div style={S.emailBar}>
            <span style={S.dot('#f87171')} />
            <span style={S.dot('#fbbf24')} />
            <span style={S.dot('#4ade80')} />
            <span style={S.emailBarLabel}>Email Preview</span>
          </div>
          <div style={S.emailBody}>
            <p style={S.subjectLabel}>Subject</p>
            <p style={S.subjectText}>{email.subject_line || '—'}</p>
            <p style={S.bodyText}>{email.email_body || '—'}</p>
            {email.cta_text && (
              <button style={S.ctaBtn}>{email.cta_text}</button>
            )}
            {email.disclaimer && (
              <p style={S.disclaimer}>{email.disclaimer}</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div style={S.sidebar}>
          <div style={S.infoCard}>
            <p style={S.infoTitle}>Email Details</p>
            <div style={S.infoRow}>
              <p style={S.infoLabel}>Subject Line</p>
              <p style={S.infoValue}>{email.subject_line || '—'}</p>
            </div>
            <div style={S.infoRow}>
              <p style={S.infoLabel}>CTA Text</p>
              <p style={{ ...S.infoValue, color: '#1d4ed8', fontWeight: 600 }}>{email.cta_text || '—'}</p>
            </div>
            <div style={S.infoRow}>
              <p style={S.infoLabel}>Body Length</p>
              <p style={S.infoValue}>{wordCount} words</p>
            </div>
            <div style={S.infoRow}>
              <p style={S.infoLabel}>Disclaimer</p>
              <p style={S.infoValue}>{email.disclaimer ? 'Present' : 'Missing'}</p>
            </div>
          </div>

          <div style={S.noteBox}>
            <p style={S.noteText}>
              This email was generated by the Content Agent and reviewed by the Compliance Agent for BFSI regulatory adherence.
            </p>
          </div>

          <button style={S.proceedBtn} onClick={() => navigate(`/campaign/${id}/approve`)}>
            Proceed to Approval
          </button>
        </div>
      </div>
    </div>
  )
}
