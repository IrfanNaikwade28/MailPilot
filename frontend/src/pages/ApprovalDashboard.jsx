import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getCampaign, approveCampaign, editCampaign } from '../api/client'
import StatusBadge from '../components/StatusBadge'

export default function ApprovalDashboard() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [campaign, setCampaign] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Edit mode
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState({})

  // Approval form
  const [approverName, setApproverName] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)

  useEffect(() => {
    getCampaign(id)
      .then((res) => {
        setCampaign(res.data)
        const e = res.data.email_json || {}
        setEditData({
          subject_line: e.subject_line || '',
          email_body: e.email_body || '',
          cta_text: e.cta_text || '',
          disclaimer: e.disclaimer || '',
        })
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleSaveEdit = async () => {
    setActionLoading(true)
    try {
      const res = await editCampaign(id, editData)
      setCampaign(res.data)
      setEditing(false)
      setSuccess('Email content updated successfully.')
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!approverName.trim()) { setError('Please enter your name before approving.'); return }
    setActionLoading(true)
    setError(null)
    try {
      const res = await approveCampaign(id, { approved_by: approverName, action: 'approve' })
      setCampaign(res.data)
      setSuccess('Campaign approved! You can now send the campaign.')
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!approverName.trim()) { setError('Please enter your name.'); return }
    if (!rejectionReason.trim()) { setError('Please provide a rejection reason.'); return }
    setActionLoading(true)
    setError(null)
    try {
      const res = await approveCampaign(id, {
        approved_by: approverName,
        action: 'reject',
        rejection_reason: rejectionReason,
      })
      setCampaign(res.data)
      setSuccess('Campaign rejected.')
      setShowRejectForm(false)
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) return <Spinner />
  if (!campaign) return null

  const email = editing ? editData : (campaign.email_json || {})
  const strategy = campaign.strategy_json || {}
  const seg = campaign.segmentation_json || {}
  const compliance = campaign.compliance_json || {}

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-blue-600 text-sm font-medium mb-1">
        <button onClick={() => navigate('/')} className="hover:underline">Dashboard</button>
        <span>/</span>
        <button onClick={() => navigate(`/campaign/${id}/preview`)} className="hover:underline">Campaign #{id}</button>
        <span>/</span>
        <span>Approval</span>
      </div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Human-in-the-Loop Approval</h1>
          <p className="text-gray-500 text-sm mt-1 max-w-xl">{campaign.objective}</p>
        </div>
        <StatusBadge status={campaign.status} />
      </div>

      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl p-4">
          {success}
        </div>
      )}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Email Preview / Edit */}
        <div className="lg:col-span-2 space-y-4">
          {/* Email Card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                ✍️ Email Content
              </h2>
              {campaign.status === 'draft' && !editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="text-xs border border-gray-300 hover:border-blue-400 text-gray-600 hover:text-blue-700 px-3 py-1.5 rounded-lg transition"
                >
                  Edit Content
                </button>
              )}
            </div>

            {editing ? (
              <div className="space-y-3">
                <EditField label="Subject Line" value={editData.subject_line} onChange={(v) => setEditData({ ...editData, subject_line: v })} />
                <EditField label="CTA Text" value={editData.cta_text} onChange={(v) => setEditData({ ...editData, cta_text: v })} />
                <EditField label="Email Body" value={editData.email_body} onChange={(v) => setEditData({ ...editData, email_body: v })} multiline rows={8} />
                <EditField label="Disclaimer" value={editData.disclaimer} onChange={(v) => setEditData({ ...editData, disclaimer: v })} multiline rows={3} />
                <div className="flex gap-2 pt-2">
                  <button onClick={handleSaveEdit} disabled={actionLoading} className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-60">
                    {actionLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button onClick={() => setEditing(false)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Subject</p>
                <p className="font-bold text-gray-900 text-base mb-4">{email.subject_line}</p>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{email.email_body}</p>
                <div className="mt-5">
                  <button className="bg-blue-700 text-white text-sm font-semibold px-6 py-2.5 rounded-lg shadow pointer-events-none">
                    {email.cta_text}
                  </button>
                </div>
                <p className="mt-5 text-xs text-gray-400 border-t border-gray-100 pt-4">{email.disclaimer}</p>
              </div>
            )}
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <SummaryCard icon="🎯" label="Tone" value={strategy.tone} />
            <SummaryCard icon="👥" label="Recipients" value={`${seg.selected_user_count ?? '—'} users`} />
            <SummaryCard icon="🛡️" label="Compliance" value={compliance.is_compliant ? 'Passed' : 'Failed'} color={compliance.is_compliant ? 'text-green-600' : 'text-red-600'} />
          </div>
        </div>

        {/* Right: Approval Panel */}
        <div className="space-y-4">
          {campaign.status === 'draft' ? (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <h2 className="font-semibold text-gray-800 mb-4">Approval Action</h2>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Your Name / ID</label>
              <input
                type="text"
                placeholder="e.g. Priya Sharma"
                value={approverName}
                onChange={(e) => setApproverName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none mb-4"
              />

              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="w-full bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-3 rounded-xl transition mb-3 disabled:opacity-60"
              >
                {actionLoading ? 'Processing...' : 'Approve Campaign'}
              </button>

              {!showRejectForm ? (
                <button
                  onClick={() => setShowRejectForm(true)}
                  className="w-full border border-red-300 text-red-600 hover:bg-red-50 text-sm font-medium py-2.5 rounded-xl transition"
                >
                  Reject Campaign
                </button>
              ) : (
                <div>
                  <textarea
                    rows={3}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Reason for rejection..."
                    className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-300 outline-none mb-2 resize-none"
                  />
                  <button
                    onClick={handleReject}
                    disabled={actionLoading}
                    className="w-full bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2.5 rounded-xl transition disabled:opacity-60"
                  >
                    {actionLoading ? 'Rejecting...' : 'Confirm Reject'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 text-center">
              <p className="text-4xl mb-2">
                {campaign.status === 'approved' ? '✅' : campaign.status === 'sent' ? '📧' : '❌'}
              </p>
              <StatusBadge status={campaign.status} />
              {campaign.approved_by && (
                <p className="text-xs text-gray-500 mt-2">
                  By: <strong>{campaign.approved_by}</strong>
                </p>
              )}
              {campaign.rejection_reason && (
                <p className="text-xs text-red-500 mt-1">{campaign.rejection_reason}</p>
              )}
            </div>
          )}

          {/* Quick Links */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-2">
            <button onClick={() => navigate(`/campaign/${id}/preview`)} className="w-full text-left text-xs text-blue-600 hover:underline">
              View Full Strategy Preview →
            </button>
            <button onClick={() => navigate(`/campaign/${id}/email`)} className="w-full text-left text-xs text-blue-600 hover:underline">
              View Email Preview →
            </button>
            {(campaign.status === 'approved' || campaign.status === 'sent') && (
              <button onClick={() => navigate(`/campaign/${id}/analytics`)} className="w-full text-left text-xs text-blue-600 hover:underline">
                View Analytics →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function EditField({ label, value, onChange, multiline, rows }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
      {multiline ? (
        <textarea
          rows={rows || 4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none resize-none"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
        />
      )}
    </div>
  )
}

function SummaryCard({ icon, label, value, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
      <p className="text-xl">{icon}</p>
      <p className="text-xs text-gray-400 mt-1">{label}</p>
      <p className={`text-sm font-bold mt-0.5 ${color || 'text-gray-800'} capitalize`}>{value}</p>
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-32">
      <svg className="animate-spin w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
      </svg>
    </div>
  )
}
