import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 180000, // 3 min — LLM + API calls can be slow
})

// Campaign endpoints
export const createCampaign = (objective) =>
  api.post('/campaign/create', { objective })

export const listCampaigns = () =>
  api.get('/campaign/list')

export const listCampaignsWithStats = () =>
  api.get('/campaign/list-with-stats')

export const getCampaign = (id) =>
  api.get(`/campaign/${id}`)

export const editCampaign = (id, data) =>
  api.patch(`/campaign/${id}/edit`, data)

export const approveCampaign = (id, data) =>
  api.post(`/campaign/${id}/approve`, data)

export const sendCampaign = (id) =>
  api.post(`/campaign/${id}/send`)

export const getCampaignAnalytics = (id) =>
  api.get(`/campaign/${id}/analytics`)

export const optimizeCampaign = (id, data) =>
  api.post(`/campaign/${id}/optimize`, data)

// Admin
export const refreshCohort = () =>
  api.post('/admin/refresh-cohort')

export const listUsers = () =>
  api.get('/users')

// Coverage
export const getCoverageStats = () =>
  api.get('/coverage')

export const getUncoveredIds = () =>
  api.get('/coverage/uncovered-ids')

// Settings
export const getSettings = () =>
  api.get('/settings')

export const saveSettings = (data) =>
  api.post('/settings', data)

export const uploadCsv = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/settings/upload-csv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const getDatasetPreview = () =>
  api.get('/settings/dataset-preview')

export default api
