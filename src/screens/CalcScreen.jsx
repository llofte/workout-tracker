import { useState } from 'react'

const ff = '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'

const BARBELLS = [
  { label: '10 kg', weight: 22.05 },
  { label: '15 kg', weight: 33.07 },
  { label: '20 kg', weight: 44.09 },
]

const PLATES = [45, 35, 25, 15, 10, 5, 2.5, 1.75]

const PLATE_STYLE = {
  45:  { bg: 'rgba(210,60,45,0.22)',   border: 'rgba(210,60,45,0.5)',   text: '#e07060' },
  35:  { bg: 'rgba(195,150,30,0.22)',  border: 'rgba(195,150,30,0.5)',  text: '#d4aa30' },
  25:  { bg: 'rgba(45,155,70,0.22)',   border: 'rgba(45,155,70,0.5)',   text: '#50c070' },
  15:  { bg: 'rgba(50,110,200,0.22)',  border: 'rgba(50,110,200,0.5)',  text: '#6090d8' },
  10:  { bg: 'rgba(245,240,232,0.1)',  border: 'rgba(245,240,232,0.22)', text: 'rgba(245,240,232,0.65)' },
  5:   { bg: 'rgba(245,240,232,0.07)', border: 'rgba(245,240,232,0.16)', text: 'rgba(245,240,232,0.5)' },
  2.5:  { bg: 'rgba(245,240,232,0.05)', border: 'rgba(245,240,232,0.12)', text: 'rgba(245,240,232,0.4)' },
  1.75: { bg: 'rgba(245,240,232,0.03)', border: 'rgba(245,240,232,0.09)', text: 'rgba(245,240,232,0.32)' },
}

function fmtLbs(v) {
  return Math.round(v).toString()
}

function calcPlatesForTarget(targetWeight, barbellWeight) {
  const perSide = (targetWeight - barbellWeight) / 2
  if (perSide < 0) return { plates: [], total: barbellWeight }
  const result = []
  let left = Math.round(perSide * 10) / 10
  for (const plate of PLATES) {
    while (Math.round(left * 10) / 10 >= plate) {
      result.push(plate)
      left = Math.round((left - plate) * 10) / 10
    }
  }
  const total = barbellWeight + result.reduce((s, p) => s + p * 2, 0)
  return { plates: result, total }
}

function PlateChip({ weight, onPress, removable }) {
  const c = PLATE_STYLE[weight]
  return (
    <button onClick={onPress} style={{
      backgroundColor: c.bg,
      border: `1px solid ${c.border}`,
      color: c.text,
      borderRadius: 10,
      padding: removable ? '7px 12px' : '13px 16px',
      fontSize: removable ? 14 : 17,
      fontWeight: 700,
      cursor: 'pointer',
      fontFamily: ff,
      minWidth: removable ? 0 : 56,
      position: 'relative',
    }}>
      {weight}
      {removable && (
        <span style={{ marginLeft: 6, opacity: 0.5, fontSize: 12 }}>×</span>
      )}
    </button>
  )
}

const sectionLabel = {
  color: 'rgba(245,240,232,0.35)', fontSize: 11, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 10px', fontFamily: ff,
}

export default function CalcScreen() {
  const [mode, setMode] = useState('build')
  const [barbellWeight, setBarbellWeight] = useState(45)
  const [loadedPlates, setLoadedPlates] = useState([])
  const [targetInput, setTargetInput] = useState('')

  const buildTotal = barbellWeight + loadedPlates.reduce((s, p) => s + p * 2, 0)

  function changBarbell(w) {
    setBarbellWeight(w)
    setLoadedPlates([])
    setTargetInput('')
  }

  function addPlate(p) { setLoadedPlates(prev => [...prev, p]) }
  function removePlate(i) { setLoadedPlates(prev => prev.filter((_, idx) => idx !== i)) }
  function clear() { setLoadedPlates([]) }

  const targetNum = parseFloat(targetInput)
  const targetValid = !isNaN(targetNum) && targetNum > barbellWeight
  const targetResult = targetValid ? calcPlatesForTarget(targetNum, barbellWeight) : null
  const targetIsExact = targetResult && targetResult.total === targetNum

  return (
    <div style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)', paddingBottom: 60 }}>
      <div style={{ padding: '20px 20px 16px' }}>
        <h1 style={{ color: '#f5f0e8', fontSize: 34, fontWeight: 700, letterSpacing: -0.5, margin: 0, fontFamily: ff }}>
          Calculator
        </h1>
      </div>

      {/* Barbell selector */}
      <div style={{ padding: '0 20px 14px', display: 'flex', gap: 8 }}>
        {BARBELLS.map(b => (
          <button key={b.weight} onClick={() => changBarbell(b.weight)} style={{
            flex: 1, padding: '10px 0', borderRadius: 10, cursor: 'pointer', fontFamily: ff,
            border: `1px solid ${barbellWeight === b.weight ? 'rgba(245,240,232,0.35)' : 'rgba(245,240,232,0.1)'}`,
            backgroundColor: barbellWeight === b.weight ? 'rgba(245,240,232,0.08)' : 'transparent',
            color: barbellWeight === b.weight ? '#f5f0e8' : 'rgba(245,240,232,0.38)',
            fontSize: 14, fontWeight: barbellWeight === b.weight ? 600 : 400,
          }}>
            {b.label}
          </button>
        ))}
      </div>

      {/* Mode toggle */}
      <div style={{ padding: '0 20px 20px' }}>
        <div style={{ display: 'flex', backgroundColor: '#1c1c1e', borderRadius: 10, padding: 3 }}>
          {['build', 'target'].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: ff,
              backgroundColor: mode === m ? 'rgba(245,240,232,0.12)' : 'transparent',
              color: mode === m ? '#f5f0e8' : 'rgba(245,240,232,0.35)',
              fontSize: 14, fontWeight: mode === m ? 600 : 400,
            }}>
              {m === 'build' ? 'Build' : 'Target'}
            </button>
          ))}
        </div>
      </div>

      {/* ── BUILD MODE ── */}
      {mode === 'build' && (
        <>
          {/* Total */}
          <div style={{ textAlign: 'center', padding: '0 20px 24px' }}>
            <span style={{ color: '#f5f0e8', fontSize: 72, fontWeight: 800, letterSpacing: -3, fontFamily: ff, lineHeight: 1 }}>
              {fmtLbs(buildTotal)}
            </span>
            <span style={{ color: 'rgba(245,240,232,0.4)', fontSize: 22, fontFamily: ff, marginLeft: 6 }}>lbs</span>
          </div>

          {/* Loaded plates */}
          <div style={{ margin: '0 20px 16px', backgroundColor: '#1c1c1e', borderRadius: 14, padding: '14px 16px', minHeight: 64 }}>
            {loadedPlates.length === 0 ? (
              <p style={{ color: 'rgba(245,240,232,0.22)', fontSize: 14, margin: 0, fontFamily: ff, textAlign: 'center', paddingTop: 8 }}>
                No plates loaded
              </p>
            ) : (
              <>
                <p style={sectionLabel}>Each side</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {loadedPlates.map((p, i) => (
                    <PlateChip key={i} weight={p} onPress={() => removePlate(i)} removable />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Plate picker */}
          <div style={{ padding: '0 20px 12px' }}>
            <p style={sectionLabel}>Add plate · each side</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {PLATES.map(p => (
                <PlateChip key={p} weight={p} onPress={() => addPlate(p)} />
              ))}
            </div>
          </div>

          {loadedPlates.length > 0 && (
            <div style={{ padding: '4px 20px' }}>
              <button onClick={clear} style={{
                background: 'none', border: 'none',
                color: 'rgba(245,240,232,0.28)', fontSize: 14,
                cursor: 'pointer', fontFamily: ff, padding: '4px 0',
              }}>
                Clear
              </button>
            </div>
          )}
        </>
      )}

      {/* ── TARGET MODE ── */}
      {mode === 'target' && (
        <>
          <div style={{ margin: '0 20px 16px', backgroundColor: '#1c1c1e', borderRadius: 14, padding: '14px 16px' }}>
            <p style={sectionLabel}>Target weight</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <input
                type="number"
                inputMode="decimal"
                placeholder="135"
                value={targetInput}
                onChange={e => setTargetInput(e.target.value)}
                style={{
                  flex: 1, backgroundColor: 'transparent', border: 'none', outline: 'none',
                  color: '#f5f0e8', fontSize: 48, fontWeight: 800, fontFamily: ff,
                  letterSpacing: -1.5, padding: 0, width: '100%',
                }}
              />
              <span style={{ color: 'rgba(245,240,232,0.35)', fontSize: 20, fontFamily: ff, flexShrink: 0 }}>lbs</span>
            </div>
          </div>

          {/* Result */}
          {targetResult && (
            <div style={{ margin: '0 20px', backgroundColor: '#1c1c1e', borderRadius: 14, padding: '14px 16px' }}>
              <p style={sectionLabel}>Each side</p>
              {targetResult.plates.length === 0 ? (
                <p style={{ color: '#f5f0e8', fontSize: 16, margin: '0 0 14px', fontFamily: ff }}>
                  Just the barbell
                </p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                  {targetResult.plates.map((p, i) => (
                    <PlateChip key={i} weight={p} onPress={() => {}} />
                  ))}
                </div>
              )}
              <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.08)', paddingTop: 12, display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ color: 'rgba(245,240,232,0.4)', fontSize: 13, fontFamily: ff }}>
                  Total
                </span>
                <span style={{ color: '#f5f0e8', fontSize: 20, fontWeight: 700, fontFamily: ff, letterSpacing: -0.3 }}>
                  {fmtLbs(targetResult.total)} lbs
                </span>
                {!targetIsExact && (
                  <span style={{ color: 'rgba(245,240,232,0.3)', fontSize: 13, fontFamily: ff }}>
                    · closest to {targetNum}
                  </span>
                )}
              </div>
            </div>
          )}

          {targetInput !== '' && !isNaN(targetNum) && targetNum <= barbellWeight && (
            <div style={{ margin: '0 20px', backgroundColor: '#1c1c1e', borderRadius: 14, padding: '14px 16px' }}>
              <p style={{ color: 'rgba(245,240,232,0.4)', fontSize: 14, margin: 0, fontFamily: ff }}>
                Must be greater than the barbell ({barbellWeight} lbs).
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
