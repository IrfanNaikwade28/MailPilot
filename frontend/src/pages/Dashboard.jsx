import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listCampaigns } from '../api/client'
import StatusBadge from '../components/StatusBadge'

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    listCampaigns()
      .then((res) => setCampaigns(res.data))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Campaign Dashboard</h1>
          <p className="text-gray-500 mt-1">Manage and monitor your BFSI email marketing campaigns.</p>
        </div>
        <button
          onClick={() => navigate('/create')}
          className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition"
        >
          + New Campaign
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total', value: campaigns.length, color: 'text-gray-700' },
          { label: 'Draft', value: campaigns.filter(c => c.status === 'draft').length, color: 'text-yellow-600' },
          { label: 'Approved', value: campaigns.filter(c => c.status === 'approved').length, color: 'text-green-600' },
          { label: 'Sent', value: campaigns.filter(c => c.status === 'sent').length, color: 'text-blue-600' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
            <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-400 font-medium mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Campaigns List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <svg className="animate-spin w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-16 text-center">
          <p className="text-5xl mb-4">📧</p>
          <p className="text-lg font-semibold text-gray-600">No campaigns yet</p>
          <p className="text-gray-400 text-sm mt-1 mb-6">Create your first BFSI email campaign using the AI pipeline.</p>
          <button
            onClick={() => navigate('/create')}
            className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition"
          >
            Create Campaign
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center justify-between hover:border-blue-300 hover:shadow-md transition cursor-pointer"
              onClick={() => navigate(`/campaign/${c.id}/preview`)}
            >
              <div className="flex-1 min-w-0 mr-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gray-400 font-mono">#{c.id}</span>
                  <StatusBadge status={c.status} />
                </div>
                <p className="text-sm font-semibold text-gray-800 truncate">{c.objective}</p>
                {c.email_json?.subject_line && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    Subject: {c.email_json.subject_line}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <p className="text-xs text-gray-400">
                  {c.created_at ? new Date(c.created_at).toLocaleDateString('en-IN') : ''}
                </p>
                <div className="flex gap-1">
                  <ActionBtn
                    label="Preview"
                    onClick={(e) => { e.stopPropagation(); navigate(`/campaign/${c.id}/preview`) }}
                  />
                  {c.status === 'draft' && (
                    <ActionBtn
                      label="Approve"
                      primary
                      onClick={(e) => { e.stopPropagation(); navigate(`/campaign/${c.id}/approve`) }}
                    />
                  )}
                  {(c.status === 'approved' || c.status === 'sent') && (
                    <ActionBtn
                      label="Analytics"
                      onClick={(e) => { e.stopPropagation(); navigate(`/campaign/${c.id}/analytics`) }}
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ActionBtn({ label, onClick, primary }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs font-medium px-3 py-1.5 rounded-lg transition ${
        primary
          ? 'bg-blue-700 hover:bg-blue-800 text-white'
          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
      }`}
    >
      {label}
    </button>
  )
}
