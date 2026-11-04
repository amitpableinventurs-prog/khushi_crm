import React, { useEffect, useRef, useState } from 'react'

// Chart tokens: dark chart surface + one validated accent (dataviz reference palette, dark mode)
const C = {
  surface: '#1a1a19',
  accent: '#3987e5',
  accentHover: '#6da7ec',
  grid: '#2c2c2a',
  baseline: '#383835',
  muted: '#898781',
}

function useWidth() {
  const ref = useRef(null)
  const [ width, setWidth ] = useState(0)

  useEffect(() => {
    if (!ref.current) return
    const observer = new ResizeObserver(([ entry ]) => setWidth(entry.contentRect.width))
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return [ ref, width ]
}

// Clean axis ticks: 0 .. niceMax in 4 steps of 1/2/2.5/5 × 10^n
function niceTicks(max) {
  if (max <= 0) return [ 0, 1 ]
  const rough = max / 4
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)))
  const step = [ 1, 2, 2.5, 5, 10 ].map(m => m * magnitude).find(s => s >= rough)
  const ticks = []
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v)
  if (ticks[ ticks.length - 1 ] < max) ticks.push(ticks[ ticks.length - 1 ] + step)
  return ticks
}

const compact = (v) => v >= 10000 ? `${Math.round(v / 1000)}K` : v.toLocaleString('en-IN')

// Column with 4px rounded top, square at the baseline
function columnPath(x, y, w, h) {
  if (h <= 0) return ''
  const r = Math.min(4, h, w / 2)
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`
}

/**
 * Single-series column chart. `data`: [{ key, label, value }]
 * The title/subtitle outside the chart names the series, so no legend.
 */
export function ColumnChart({ data, formatValue = String, height = 220, ariaLabel }) {
  const [ ref, width ] = useWidth()
  const [ active, setActive ] = useState(null)

  const pad = { top: 12, right: 8, bottom: 28, left: 44 }
  const innerW = Math.max(0, width - pad.left - pad.right)
  const innerH = height - pad.top - pad.bottom
  const ticks = niceTicks(Math.max(...data.map(d => d.value), 0))
  const yMax = ticks[ ticks.length - 1 ]
  const band = data.length ? innerW / data.length : 0
  const barW = Math.max(2, Math.min(24, band * 0.6))
  const labelEvery = Math.max(1, Math.ceil(44 / Math.max(band, 1)))
  const y = (v) => pad.top + innerH - (v / yMax) * innerH

  const activeItem = active !== null ? data[ active ] : null

  return (
    <div ref={ref} className='relative w-full' style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role='img' aria-label={ariaLabel} className='block'>
          {ticks.map(t => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? C.baseline : C.grid} strokeWidth='1' />
              <text x={pad.left - 8} y={y(t)} dy='0.32em' textAnchor='end' fontSize='11' fill={C.muted} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {compact(t)}
              </text>
            </g>
          ))}

          {data.map((d, i) => {
            const x = pad.left + band * i
            const h = (d.value / yMax) * innerH
            return (
              <g key={d.key}>
                <path d={columnPath(x + (band - barW) / 2, pad.top + innerH - h, barW, h)} fill={active === i ? C.accentHover : C.accent} />
                {i % labelEvery === 0 && (
                  <text x={x + band / 2} y={height - 8} textAnchor='middle' fontSize='11' fill={C.muted}>{d.label}</text>
                )}
                {/* hit target: the whole band, not just the painted bar */}
                <rect
                  x={x} y={pad.top} width={band} height={innerH}
                  fill='transparent'
                  tabIndex={0}
                  aria-label={`${d.label}: ${formatValue(d.value)}`}
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  style={{ outline: 'none' }}
                />
              </g>
            )
          })}
        </svg>
      )}

      {activeItem && (
        <div
          className='pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-white/10 bg-[#0d0d0d] px-2.5 py-1.5 text-xs shadow-xl whitespace-nowrap'
          style={{
            left: Math.min(Math.max(pad.left + band * active + band / 2, 60), width - 60),
            top: Math.max(y(activeItem.value) - 6, 40),
          }}
        >
          <p className='font-semibold text-[#f0efec]'>{formatValue(activeItem.value)}</p>
          <p className='text-[#c3c2b7]'>{activeItem.label}</p>
        </div>
      )}
    </div>
  )
}

/** Horizontal bars with the value at each tip. `data`: [{ key, label, value, hint }] */
export function BarList({ data, formatValue = String }) {
  const max = Math.max(...data.map(d => d.value), 0) || 1

  return (
    <ul className='space-y-3'>
      {data.map(d => (
        <li key={d.key} className='grid grid-cols-[88px_1fr] items-center gap-3 text-sm'>
          <div className='min-w-0'>
            <p className='text-[#c3c2b7] truncate'>{d.label}</p>
            {d.hint && <p className='text-xs text-[#898781] truncate'>{d.hint}</p>}
          </div>
          <div className='flex items-center gap-2 min-w-0' title={`${d.label}: ${formatValue(d.value)}${d.hint ? ` · ${d.hint}` : ''}`}>
            <div
              className='h-4 shrink-0'
              style={{ width: `${Math.max((d.value / max) * 70, d.value > 0 ? 1 : 0)}%`, background: C.accent, borderRadius: '0 4px 4px 0' }}
            />
            <span className='text-[#f0efec] font-medium whitespace-nowrap'>{formatValue(d.value)}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}

// Chart with a "Table" toggle so every value is reachable without hovering
export function ChartTableToggle({ chart, columns, rows }) {
  const [ showTable, setShowTable ] = useState(false)

  return (
    <div>
      <div className='flex justify-end -mt-2 mb-2'>
        <button
          type='button'
          onClick={() => setShowTable(v => !v)}
          className='text-xs text-[#c3c2b7] hover:text-white inline-flex items-center gap-1'
        >
          <i className={showTable ? 'ri-bar-chart-2-line' : 'ri-table-line'}></i>
          {showTable ? 'Show chart' : 'Show table'}
        </button>
      </div>
      {showTable ? (
        <div className='max-h-[220px] overflow-y-auto'>
          <table className='w-full text-sm'>
            <thead className='text-xs text-[#898781] text-left'>
              <tr>{columns.map(c => <th key={c} className='py-1.5 font-medium'>{c}</th>)}</tr>
            </thead>
            <tbody className='text-[#f0efec]' style={{ fontVariantNumeric: 'tabular-nums' }}>
              {rows.map(r => (
                <tr key={r[ 0 ]} className='border-t border-white/5'>
                  {r.map((cell, i) => <td key={i} className='py-1.5'>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : chart}
    </div>
  )
}
