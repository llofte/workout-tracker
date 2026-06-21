import { isStandalone } from '../../utils/pwa'

const ACTIVE = '#0ff7c5'
const INACTIVE = 'rgba(245,240,232,0.38)'
const SZ = 22

function HomeIcon({ active }) {
  return (
    <svg width={SZ} height={SZ} viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE : INACTIVE} strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function MovementsIcon({ active }) {
  return (
    <svg width={SZ} height={SZ} viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE : INACTIVE} strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

function CalcIcon({ active }) {
  return (
    <svg width={SZ} height={SZ} viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE : INACTIVE} strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="9" width="2.5" height="6" rx="0.75" fill={active ? ACTIVE : INACTIVE} stroke="none" />
      <rect x="6" y="10.5" width="12" height="3" rx="0.75" fill={active ? ACTIVE : INACTIVE} stroke="none" />
      <rect x="19.5" y="9" width="2.5" height="6" rx="0.75" fill={active ? ACTIVE : INACTIVE} stroke="none" />
      <rect x="4.5" y="7" width="2" height="10" rx="0.75" fill={active ? ACTIVE : INACTIVE} stroke="none" />
      <rect x="17.5" y="7" width="2" height="10" rx="0.75" fill={active ? ACTIVE : INACTIVE} stroke="none" />
    </svg>
  )
}

const TABS = [
  { id: 'home', label: 'Home', Icon: HomeIcon },
  { id: 'movements', label: 'Moves', Icon: MovementsIcon },
  { id: 'calc', label: 'Calc', Icon: CalcIcon },
]

export default function TabBar({ activeTab, onTabChange, hidden }) {
  return (
    <nav style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingBottom: 'env(safe-area-inset-bottom)',
      backgroundColor: '#100b16',
      borderTop: '0.5px solid rgba(255,255,255,0.1)',
      display: 'flex',
      zIndex: 50,
      transform: hidden ? 'translateY(100%)' : 'translateY(0)',
      transition: 'transform 0.25s ease',
    }}>
      {TABS.map(({ id, label, Icon }) => {
        const active = activeTab === id
        return (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            aria-label={label}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: 8,
              paddingBottom: isStandalone ? 0 : 8,
              gap: 3,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              WebkitAppearance: 'none',
            }}
          >
            <Icon active={active} />
            <span style={{
              fontSize: 10,
              fontWeight: active ? 600 : 400,
              color: active ? ACTIVE : INACTIVE,
              letterSpacing: 0.1,
              fontFamily: 'inherit',
            }}>
              {label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
