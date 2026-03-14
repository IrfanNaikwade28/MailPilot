import { useState, useEffect, useRef } from 'react'
import { getSettings, saveSettings, uploadCsv, getDatasetPreview } from '../api/client'

const S = {
  page: { maxWidth: 800, margin: '0 auto', padding: '32px 24px' },
  heading: { fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 4 },
  subtext: { fontSize: 14, color: '#6b7280', marginBottom: 28 },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    padding: 24,
    marginBottom: 20,
  },
  cardTitle: { fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 16 },
  radioRow: { display: 'flex', gap: 12, marginBottom: 20 },
  radioOption: (active) => ({
    flex: 1,
    border: `2px solid ${active ? '#1d4ed8' : '#e5e7eb'}`,
    borderRadius: 8,
    padding: '14px 18px',
    cursor: 'pointer',
    background: active ? '#eff6ff' : '#fff',
    transition: 'border-color 0.15s',
  }),
  radioLabel: (active) => ({
    fontSize: 14,
    fontWeight: 600,
    color: active ? '#1d4ed8' : '#374151',
    display: 'block',
    marginBottom: 2,
  }),
  radioDesc: { fontSize: 12, color: '#6b7280' },
  label: { fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 },
  input: {
    width: '100%',
    padding: '9px 12px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    fontSize: 14,
    color: '#111827',
    background: '#f9fafb',
    boxSizing: 'border-box',
    marginBottom: 14,
    outline: 'none',
    fontFamily: 'inherit',
  },
  saveBtnRow: { display: 'flex', justifyContent: 'flex-end', marginTop: 8 },
  btn: (variant) => ({
    padding: '9px 20px',
    borderRadius: 7,
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    background: variant === 'primary' ? '#1d4ed8' : '#f3f4f6',
    color: variant === 'primary' ? '#fff' : '#374151',
  }),
  divider: { height: 1, background: '#f3f4f6', margin: '16px 0' },
  uploadZone: (dragging) => ({
    border: `2px dashed ${dragging ? '#1d4ed8' : '#d1d5db'}`,
    borderRadius: 8,
    padding: '32px 24px',
    textAlign: 'center',
    background: dragging ? '#eff6ff' : '#fafafa',
    cursor: 'pointer',
    transition: 'all 0.15s',
  }),
  uploadText: { fontSize: 14, color: '#374151', marginBottom: 4 },
  uploadSub: { fontSize: 12, color: '#9ca3af' },
  badge: (color) => ({
    display: 'inline-block',
    padding: '2px 9px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    background: color === 'green' ? '#dcfce7' : color === 'blue' ? '#dbeafe' : '#f3f4f6',
    color: color === 'green' ? '#15803d' : color === 'blue' ? '#1d4ed8' : '#374151',
    marginLeft: 8,
  }),
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '8px 10px', background: '#f9fafb', color: '#6b7280', fontWeight: 600, borderBottom: '1px solid #e5e7eb' },
  td: { padding: '7px 10px', borderBottom: '1px solid #f3f4f6', color: '#374151', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  alert: (type) => ({
    padding: '10px 14px',
    borderRadius: 6,
    fontSize: 13,
    marginBottom: 14,
    background: type === 'success' ? '#dcfce7' : type === 'error' ? '#fee2e2' : '#dbeafe',
    color: type === 'success' ? '#15803d' : type === 'error' ? '#b91c1c' : '#1d4ed8',
    border: `1px solid ${type === 'success' ? '#bbf7d0' : type === 'error' ? '#fca5a5' : '#bfdbfe'}`,
  }),
}

export default function Settings() {
  const [dataSource, setDataSource] = useState('api')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [csvUploaded, setCsvUploaded] = useState(false)
  const [preview, setPreview] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [alert, setAlert] = useState(null) // { type, msg }
  const fileInputRef = useRef()

  useEffect(() => {
    getSettings()
      .then(r => {
        const s = r.data
        setDataSource(s.data_source || 'api')
        setApiKey(s.api_key || '')
        setBaseUrl(s.base_url || '')
        setCsvUploaded(!!s.csv_uploaded)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (csvUploaded) {
      setLoadingPreview(true)
      getDatasetPreview()
        .then(r => setPreview(r.data))
        .catch(() => setPreview(null))
        .finally(() => setLoadingPreview(false))
    }
  }, [csvUploaded])

  const handleSave = () => {
    setSaving(true)
    setAlert(null)
    saveSettings({ data_source: dataSource, api_key: apiKey, base_url: baseUrl })
      .then(() => setAlert({ type: 'success', msg: 'Settings saved.' }))
      .catch(e => setAlert({ type: 'error', msg: e?.response?.data?.detail || 'Save failed.' }))
      .finally(() => setSaving(false))
  }

  const handleFile = (file) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setAlert({ type: 'error', msg: 'Only CSV files are accepted.' })
      return
    }
    setUploading(true)
    setAlert(null)
    uploadCsv(file)
      .then(r => {
        setPreview(r.data)
        setCsvUploaded(true)
        setAlert({ type: 'success', msg: `Uploaded ${r.data.row_count} rows from "${file.name}".` })
      })
      .catch(e => setAlert({ type: 'error', msg: e?.response?.data?.detail || 'Upload failed.' }))
      .finally(() => setUploading(false))
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    handleFile(file)
  }

  return (
    <div style={S.page}>
      <div style={S.heading}>Settings</div>
      <div style={S.subtext}>Configure the data source used by the campaign pipeline.</div>

      {alert && <div style={S.alert(alert.type)}>{alert.msg}</div>}

      {/* Data Source Selection */}
      <div style={S.card}>
        <div style={S.cardTitle}>Data Source</div>
        <div style={S.radioRow}>
          <div style={S.radioOption(dataSource === 'api')} onClick={() => setDataSource('api')}>
            <span style={S.radioLabel(dataSource === 'api')}>CampaignX API</span>
            <span style={S.radioDesc}>Use the live InXiteOut CampaignX cohort (default)</span>
          </div>
          <div style={S.radioOption(dataSource === 'csv')} onClick={() => setDataSource('csv')}>
            <span style={S.radioLabel(dataSource === 'csv')}>
              CSV Dataset
              {csvUploaded && <span style={S.badge('green')}>File ready</span>}
            </span>
            <span style={S.radioDesc}>Upload your own customer CSV file</span>
          </div>
        </div>

        {/* CampaignX API Panel */}
        {dataSource === 'api' && (
          <div>
            <div style={S.divider} />
            <label style={S.label}>API Key</label>
            <input
              style={S.input}
              type="password"
              placeholder="Enter CampaignX API key"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
            />
            <label style={S.label}>Base URL</label>
            <input
              style={S.input}
              type="text"
              placeholder="e.g. https://api.inxiteout.com"
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
            />
          </div>
        )}

        {/* CSV Panel */}
        {dataSource === 'csv' && (
          <div>
            <div style={S.divider} />
            <div style={S.cardTitle}>Upload CSV Dataset</div>
            <div
              style={S.uploadZone(dragging)}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div style={S.uploadText}>
                {uploading ? 'Uploading...' : 'Drag & drop a CSV file here, or click to browse'}
              </div>
              <div style={S.uploadSub}>
                Required columns: customer_id, name, email, occupation, city, age, income
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files[0])}
              />
            </div>
          </div>
        )}

        <div style={S.saveBtnRow}>
          <button style={S.btn('primary')} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* CSV Preview */}
      {dataSource === 'csv' && csvUploaded && (
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={S.cardTitle}>
              Dataset Preview
              {preview && (
                <span style={S.badge('blue')}>{preview.row_count} rows</span>
              )}
            </div>
            {loadingPreview && <span style={{ fontSize: 12, color: '#6b7280' }}>Loading...</span>}
          </div>

          {preview && preview.first_10_rows && preview.first_10_rows.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    {preview.columns.map(col => (
                      <th key={col} style={S.th}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.first_10_rows.map((row, i) => (
                    <tr key={i}>
                      {preview.columns.map(col => (
                        <td key={col} style={S.td} title={row[col]}>
                          {row[col] ?? '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>
                Showing first {preview.first_10_rows.length} of {preview.row_count} rows
              </div>
            </div>
          ) : (
            !loadingPreview && <div style={{ fontSize: 13, color: '#9ca3af' }}>No preview available.</div>
          )}
        </div>
      )}
    </div>
  )
}
