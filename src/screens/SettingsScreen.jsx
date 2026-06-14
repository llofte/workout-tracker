const S = {
  root: {
    paddingTop: 'max(env(safe-area-inset-top), 16px)',
    paddingBottom: 40,
  },
  header: {
    padding: '20px 20px 20px',
  },
  title: {
    color: '#f5f0e8',
    fontSize: 34,
    fontWeight: 700,
    letterSpacing: -0.5,
    margin: 0,
    fontFamily: 'inherit',
  },
  sectionLabel: {
    padding: '4px 20px 6px',
    color: 'rgba(245,240,232,0.4)',
    fontSize: 13,
    fontWeight: 400,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontFamily: 'inherit',
  },
  group: {
    margin: '0 20px 24px',
    backgroundColor: '#1c1c1e',
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    borderBottom: '0.5px solid rgba(255,255,255,0.08)',
    cursor: 'pointer',
  },
  rowLast: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    cursor: 'pointer',
  },
  rowLabel: {
    color: '#f5f0e8',
    fontSize: 16,
    margin: 0,
    fontFamily: 'inherit',
  },
  rowValue: {
    color: 'rgba(245,240,232,0.45)',
    fontSize: 15,
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  rowDanger: {
    color: '#e74c3c',
    fontSize: 16,
    margin: 0,
    fontFamily: 'inherit',
  },
  chevron: {
    color: 'rgba(245,240,232,0.3)',
  },
}

function ChevronRight() {
  return (
    <svg style={S.chevron} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function Row({ label, value, last, danger }) {
  return (
    <div style={last ? S.rowLast : S.row}>
      <p style={danger ? S.rowDanger : S.rowLabel}>{label}</p>
      {value !== undefined && (
        <span style={S.rowValue}>
          {value}
          {!danger && <ChevronRight />}
        </span>
      )}
      {value === undefined && !danger && <ChevronRight />}
    </div>
  )
}

export default function SettingsScreen() {
  return (
    <div style={S.root}>
      <div style={S.header}>
        <h1 style={S.title}>Settings</h1>
      </div>

      <p style={S.sectionLabel}>General</p>
      <div style={S.group}>
        <Row label="Weight Unit" value="lbs" />
        <Row label="Program" value="BB WOD" last />
      </div>

      <p style={S.sectionLabel}>Movements</p>
      <div style={S.group}>
        <Row label="Edit PR Baselines" />
        <Row label="Movement Aliases" last />
      </div>

      <p style={S.sectionLabel}>Data</p>
      <div style={S.group}>
        <Row label="Export Data (JSON)" />
        <Row label="Clear All Data" danger last />
      </div>
    </div>
  )
}
