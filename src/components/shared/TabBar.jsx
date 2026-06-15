const ACTIVE = '#b898f0'
const INACTIVE = 'rgba(245,240,232,0.38)'
const SZ = 24

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

function SettingsIcon({ active }) {
  return (
    <svg width={SZ} height={SZ} viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE : INACTIVE} strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

const TABS = [
  { id: 'home', label: 'Home', Icon: HomeIcon },
  { id: 'movements', label: 'Moves', Icon: MovementsIcon },
  { id: 'calc', label: 'Calc', Icon: CalcIcon },
]

export default function TabBar({ activeTab, onTabChange }) {
  return (
    <nav
      style={{
        backgroundColor: 'rgba(26,26,24,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '0.5px solid rgba(255,255,255,0.12)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        display: 'flex',
        alignItems: 'flex-start',
        flexShrink: 0,
      }}
    >
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
              paddingTop: 7,
              paddingBottom: 5,
              gap: 2,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              WebkitAppearance: 'none',
            }}
          >
            <Icon active={active} />
            <span
              style={{
                fontSize: 10,
                fontWeight: active ? 600 : 400,
                color: active ? ACTIVE : INACTIVE,
                letterSpacing: 0.1,
                fontFamily: 'inherit',
              }}
            >
              {label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
