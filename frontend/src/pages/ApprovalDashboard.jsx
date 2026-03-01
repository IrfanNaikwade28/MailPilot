import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getCampaign, approveCampaign, editCampaign } from '../api/client'
import StatusBadge from '../components/StatusBadge'

const S = {
  page: { maxWidth: 1000, margin: '0 auto', padding: '32px 24px' },
  breadcrumb: { fontSize: 13, color: '#6b7280', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 },
  breadBtn: { background: 'none', border: 'none', padding: 0, color: '#6b7280', fontSize: 13, cursor: 'pointer' },
  titleRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 },
  title: { fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 },
  objective: { fontSize: 14, color: '#6b7280', marginTop: 6, maxWidth: 560 },
  layout: { display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 },
  card: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 },
  cardHead: { padding: '14px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 },
  cardBody: { padding: '20px' },
  editBtn: { background: 'none', border: '1px solid #d1d5db', borderRadius: 5, padding: '5px 12px', fontSize: 12, color: '#374151', cursor: 'pointer' },
  subjectLabel: { fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 },
  subjectText: { fontSize: 17, fontWeight: 700, color: '#111827', marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid #f3f4f6' },
  bodyText: { fontSize: 14, color: '#374151', lineHeight: 1.8, whiteSpace: 'pre-wrap' },
  ctaBtn: { display: 'inline-block', background: '#1d4ed8', color: '#fff', padding: '9px 20px', borderRadius: 6, fontSize: 14, fontWeight: 600, marginTop: 16, border: 'none', cursor: 'default' },
  disclaimer: { fontSize: 12, color: '#9ca3af', lineHeight: 1.6, marginTop: 20, paddingTop: 14, borderTop: '1px solid #f3f4f6' },
  metaRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 14 },
  metaBox: { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '10px 12px', textAlign: 'center' },
  metaLabel: { fontSize: 11, color: '#9ca3af', marginBottom: 3 },
  metaValue: { fontSize: 14, fontWeight: 600, color: '#111827' },
  editLabel: { display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 5 },
  editInput: { width: '100%', border: '1px solid #d1d5db', borderRadius: 5, padding: '8px 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 10 },
  editTextarea: { width: '100%', border: '1px solid #d1d5db', borderRadius: 5, padding: '8px 10px', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: 10 },
  editActions: { display: 'flex', gap: 8, marginTop: 6 },
  saveBtn: { background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 5, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  cancelBtn: { background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 5, padding: '8px 14px', fontSize: 13, cursor: 'pointer' },
  approvePanel: { display: 'flex', flexDirection: 'column', gap: 12 },
  approveCard: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '18px' },
  approveTitle: { fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 14 },
  inputLabel: { display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 5 },
  input: { width: '100%', border: '1px solid #d1d5db', borderRadius: 5, padding: '9px 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 14 },
  approveBtn: { width: '100%', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 8 },
  rejectToggle: { width: '100%', background: '#fff', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 6, padding: '9px 0', fontSize: 14, fontWeight: 500, cursor: 'pointer' },
  rejectTextarea: { width: '100%', border: '1px solid #fca5a5', borderRadius: 5, padding: '8px 10px', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: 8 },
  rejectBtn: { width: '100%', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  linksCard: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '14px 16px' },
  linkBtn: { display: 'block', background: 'none', border: 'none', padding: '5px 0', fontSize: 13, color: '#1d4ed8', cursor: 'pointer', textAlign: 'left' },
  alert: (color) => ({ background: color === 'green' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${color === 'green' ? '#bbf7d0' : '#fecaca'}`, borderRadius: 6, padding: '10px 14px', fontSize: 13, color: color === 'green' ? '#166534' : '#b91c1c', marginBottom: 16 }),
  statusBox: { textAlign: 'center', padding: '16px 0' },
  sendTimeNote: { fontSize: 11, color: '#9ca3af', marginTop: -10, marginBottom: 12, lineHeight: 1.5 },
}

/** Convert a datetime-local string to InXiteOut format: "DD:MM:YY HH:MM:SS" IST */
function toSendTimeFormat(localDatetimeStr) {
  if (!localDatetimeStr) return null
  const d = new Date(localDatetimeStr)
  if (isNaN(d.getTime())) return null
  // Adjust to IST (UTC+5:30)
  const ist = new Date(d.getTime() + (5 * 60 + 30) * 60 * 1000 - d.getTimezoneOffset() * 60 * 1000)
  const pad = (n) => String(n).padStart(2, '0')
  const dd = pad(ist.getDate())
  const mm = pad(ist.getMonth() + 1)
  const yy = String(ist.getFullYear()).slice(-2)
  const hh = pad(ist.getHours())
  const min = pad(ist.getMinutes())
  const ss = pad(ist.getSeconds())
  return `${dd}:${mm}:${yy} ${hh}:${min}:${ss}`
}

/** Return the minimum datetime-local value = 5 minutes from now */
function minSendTime() {
  const d = new Date(Date.now() + 5 * 60 * 1000)
  return d.toISOString().slice(0, 16)
}

export default function ApprovalDashboard() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [campaign, setCampaign] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState({})
  const [approverName, setApproverName] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [sendDatetime, setSendDatetime] = useState('')

  useEffect(() => {
    getCampaign(id)
      .then((res) => {
        setCampaign(res.data)
        const e = res.data.email_json || {}
        setEditData({ subject_line: e.subject_line || '', email_body: e.email_body || '', cta_text: e.cta_text || '', disclaimer: e.disclaimer || '' })
        // Default send time = 10 minutes from now
        const d = new Date(Date.now() + 10 * 60 * 1000)
        setSendDatetime(d.toISOString().slice(0, 16))
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleSaveEdit = async () => {
    setActionLoading(true)
    try {
      const res = await editCampaign(id, editData)
      setCampaign(res.data)
      setEditing(false)
      setSuccess('Email content updated.')
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!approverName.trim()) { setError('Enter your name before approving.'); return }
    setActionLoading(true); setError(null)
    const send_time = toSendTimeFormat(sendDatetime)
    try {
      const res = await approveCampaign(id, { approved_by: approverName, action: 'approve', send_time })
      setCampaign(res.data)
      setSuccess(`Campaign approved. Scheduled for ${send_time || 'auto'}. Go to Analytics to send it.`)
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!approverName.trim()) { setError('Enter your name.'); return }
    if (!rejectionReason.trim()) { setError('Provide a rejection reason.'); return }
    setActionLoading(true); setError(null)
    try {
      const res = await approveCampaign(id, { approved_by: approverName, action: 'reject', rejection_reason: rejectionReason })
      setCampaign(res.data)
      setSuccess('Campaign rejected.')
      setShowRejectForm(false)
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '80px 0', color: '#9ca3af' }}>Loading...</div>
  if (!campaign) return null

  const email = editing ? editData : (campaign.email_json || {})
  const strategy = campaign.strategy_json || {}
  const seg = campaign.segmentation_json || {}
  const compliance = campaign.compliance_json || {}

  return (
    <div style={S.page}>
      <div style={S.breadcrumb}>
        <button style={S.breadBtn} onClick={() => navigate('/')}>Campaigns</button>
        <span>/</span>
        <button style={S.breadBtn} onClick={() => navigate(`/campaign/${id}/preview`)}>Campaign #{id}</button>
        <span>/</span>
        <span>Approval</span>
      </div>

      <div style={S.titleRow}>
        <div>
          <h1 style={S.title}>Review &amp; Approve</h1>
          <p style={S.objective}>{campaign.objective}</p>
        </div>
        <StatusBadge status={campaign.status} />
      </div>

      {success && <div style={S.alert('green')}>{success}</div>}
      {error && <div style={S.alert('red')}>{error}</div>}

      <div style={S.layout}>
        {/* Left: Email */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={S.card}>
            <div style={S.cardHead}>
              <p style={S.cardTitle}>Email Content</p>
              {campaign.status === 'draft' && !editing && (
                <button style={S.editBtn} onClick={() => setEditing(true)}>Edit</button>
              )}
            </div>
            <div style={S.cardBody}>
              {editing ? (
                <div>
                  <label style={S.editLabel}>Subject Line</label>
                  <input style={S.editInput} value={editData.subject_line} onChange={e => setEditData({ ...editData, subject_line: e.target.value })} />
                  <label style={S.editLabel}>CTA Text</label>
                  <input style={S.editInput} value={editData.cta_text} onChange={e => setEditData({ ...editData, cta_text: e.target.value })} />
                  <label style={S.editLabel}>Email Body</label>
                  <textarea style={S.editTextarea} rows={8} value={editData.email_body} onChange={e => setEditData({ ...editData, email_body: e.target.value })} />
                  <label style={S.editLabel}>Disclaimer</label>
                  <textarea style={S.editTextarea} rows={3} value={editData.disclaimer} onChange={e => setEditData({ ...editData, disclaimer: e.target.value })} />
                  <div style={S.editActions}>
                    <button style={S.saveBtn} onClick={handleSaveEdit} disabled={actionLoading}>
                      {actionLoading ? 'Saving...' : 'Save'}
                    </button>
                    <button style={S.cancelBtn} onClick={() => setEditing(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  <p style={S.subjectLabel}>Subject</p>
                  <p style={S.subjectText}>{email.subject_line}</p>
                  <p style={S.bodyText}>{email.email_body}</p>
                  <button style={S.ctaBtn}>{email.cta_text}</button>
                  <p style={S.disclaimer}>{email.disclaimer}</p>
                </div>
              )}
            </div>
          </div>

          {/* Summary row */}
          <div style={S.metaRow}>
            <div style={S.metaBox}>
              <p style={S.metaLabel}>Tone</p>
              <p style={{ ...S.metaValue, textTransform: 'capitalize' }}>{strategy.tone || '—'}</p>
            </div>
            <div style={S.metaBox}>
              <p style={S.metaLabel}>Recipients</p>
              <p style={S.metaValue}>{seg.selected_user_count ?? '—'} users</p>
            </div>
            <div style={S.metaBox}>
              <p style={S.metaLabel}>Compliance</p>
              <p style={{ ...S.metaValue, color: compliance.is_compliant ? '#166534' : '#dc2626' }}>
                {compliance.is_compliant ? 'Passed' : 'Failed'}
              </p>
            </div>
          </div>
        </div>

        {/* Right: Approval panel */}
        <div style={S.approvePanel}>
          {campaign.status === 'draft' ? (
            <div style={S.approveCard}>
              <p style={S.approveTitle}>Approval Action</p>
              <label style={S.inputLabel}>Your name</label>
              <input
                style={S.input}
                placeholder="e.g. Priya Sharma"
                value={approverName}
                onChange={e => setApproverName(e.target.value)}
              />
              <label style={S.inputLabel}>Send time (IST)</label>
              <input
                type="datetime-local"
                style={S.input}
                value={sendDatetime}
                min={minSendTime()}
                onChange={e => setSendDatetime(e.target.value)}
              />
              <p style={S.sendTimeNote}>Must be a future time. Campaign will be dispatched via CampaignX API at this time.</p>
              <button style={S.approveBtn} onClick={handleApprove} disabled={actionLoading}>
                {actionLoading ? 'Processing...' : 'Approve Campaign'}
              </button>
              {!showRejectForm ? (
                <button style={S.rejectToggle} onClick={() => setShowRejectForm(true)}>Reject</button>
              ) : (
                <div>
                  <textarea
                    style={S.rejectTextarea}
                    rows={3}
                    placeholder="Reason for rejection..."
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)}
                  />
                  <button style={S.rejectBtn} onClick={handleReject} disabled={actionLoading}>
                    {actionLoading ? 'Rejecting...' : 'Confirm Reject'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ ...S.approveCard, ...S.statusBox }}>
              <StatusBadge status={campaign.status} />
              {campaign.approved_by && (
                <p style={{ fontSize: 13, color: '#6b7280', marginTop: 8 }}>By: <strong>{campaign.approved_by}</strong></p>
              )}
              {campaign.send_time && (
                <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Scheduled: {campaign.send_time} IST</p>
              )}
              {campaign.rejection_reason && (
                <p style={{ fontSize: 13, color: '#dc2626', marginTop: 6 }}>{campaign.rejection_reason}</p>
              )}
            </div>
          )}

          <div style={S.linksCard}>
            <button style={S.linkBtn} onClick={() => navigate(`/campaign/${id}/preview`)}>View strategy &amp; segmentation</button>
            <button style={S.linkBtn} onClick={() => navigate(`/campaign/${id}/email`)}>View email preview</button>
            {(campaign.status === 'approved' || campaign.status === 'sent') && (
              <button style={S.linkBtn} onClick={() => navigate(`/campaign/${id}/analytics`)}>View analytics</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
