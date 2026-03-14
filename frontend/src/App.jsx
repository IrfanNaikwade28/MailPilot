import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import CreateCampaign from './pages/CreateCampaign'
import CampaignPreview from './pages/CampaignPreview'
import EmailPreview from './pages/EmailPreview'
import ApprovalDashboard from './pages/ApprovalDashboard'
import Analytics from './pages/Analytics'
import Coverage from './pages/Coverage'
import Settings from './pages/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/create" element={<CreateCampaign />} />
            <Route path="/campaign/:id/preview" element={<CampaignPreview />} />
            <Route path="/campaign/:id/email" element={<EmailPreview />} />
            <Route path="/campaign/:id/approve" element={<ApprovalDashboard />} />
            <Route path="/campaign/:id/analytics" element={<Analytics />} />
            <Route path="/coverage" element={<Coverage />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
