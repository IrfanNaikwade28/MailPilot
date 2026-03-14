import { useNavigate, useLocation } from 'react-router-dom'

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <nav style={{ background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={() => navigate('/')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, padding: 0 }}
        >
          <div style={{ width: 32, height: 32, background: '#1d4ed8', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>M</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>MailPilot</span>
          <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 400 }}>— FrostHack XPECTO 2026</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <NavLink label="Campaigns" path="/" current={location.pathname === '/'} onClick={() => navigate('/')} />
          <NavLink label="Coverage" path="/coverage" current={location.pathname === '/coverage'} onClick={() => navigate('/coverage')} />
          <NavLink label="New Campaign" path="/create" current={location.pathname === '/create'} onClick={() => navigate('/create')} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, background: '#22c55e', borderRadius: '50%', display: 'inline-block' }} />
            <span style={{ fontSize: 12, color: '#6b7280' }}>LLaMA 3.3 · Groq</span>
          </div>
          <div style={{
            background: 'linear-gradient(135deg, #1d4ed8 0%, #7c3aed 100%)',
            borderRadius: 6,
            padding: '3px 10px',
            fontSize: 12,
            fontWeight: 700,
            color: '#fff',
            letterSpacing: '0.02em',
          }}>
            EO+EC: 989
          </div>
        </div>
      </div>
    </nav>
  )
}

function NavLink({ label, path, current, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: current ? '#eff6ff' : 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '6px 12px',
        borderRadius: 6,
        fontSize: 14,
        fontWeight: current ? 600 : 400,
        color: current ? '#1d4ed8' : '#374151',
      }}
    >
      {label}
    </button>
  )
}
