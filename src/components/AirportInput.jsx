import { useState, useRef, useEffect } from 'react'
import { filterAirports, parseIata, airportLabel, AIRPORTS } from '../lib/airports'
import { MapPin } from 'lucide-react'

/**
 * Airport autocomplete input.
 * - value: IATA code (e.g. "FRA")
 * - onChange(code): called with 3-letter IATA code
 * - placeholder: e.g. "FRA – Frankfurt"
 */
export default function AirportInput({ value, onChange, placeholder = 'Stadt oder Code', id }) {
  const [query, setQuery]       = useState(value ? airportLabel(value) : '')
  const [open, setOpen]         = useState(false)
  const [options, setOptions]   = useState([])
  const [highlighted, setHl]    = useState(0)
  const containerRef            = useRef(null)

  // Sync external value → display text
  useEffect(() => {
    if (value && !query.startsWith(value)) {
      setQuery(airportLabel(value))
    }
  }, [value])

  function handleInput(e) {
    const q = e.target.value
    setQuery(q)
    const opts = filterAirports(q)
    setOptions(opts)
    setHl(0)
    setOpen(opts.length > 0)

    // If input is empty, clear selection
    if (!q) onChange(null)
  }

  function select(opt) {
    setQuery(opt.label)
    setOpen(false)
    onChange(opt.code)
  }

  function handleKeyDown(e) {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHl(h => Math.min(h + 1, options.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHl(h => Math.max(h - 1, 0)) }
    if (e.key === 'Enter')     { e.preventDefault(); if (options[highlighted]) select(options[highlighted]) }
    if (e.key === 'Escape')    { setOpen(false) }
  }

  function handleBlur(e) {
    // Delay so click on option fires first
    setTimeout(() => {
      setOpen(false)
      // Try to resolve partial input
      const code = parseIata(query)
      if (code) {
        setQuery(airportLabel(code))
        onChange(code)
      } else if (query && !value) {
        setQuery('')
      }
    }, 150)
  }

  // Close on outside click
  useEffect(() => {
    function outside(e) { if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          id={id}
          type="text"
          value={query}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (options.length > 0) setOpen(true) }}
          onBlur={handleBlur}
          autoComplete="off"
          placeholder={placeholder}
          className="w-full border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>
      {open && options.length > 0 && (
        <ul className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden max-h-52 overflow-y-auto">
          {options.map((opt, i) => (
            <li
              key={opt.code}
              onMouseDown={() => select(opt)}
              className={`flex items-center gap-3 px-3 py-2 cursor-pointer text-sm transition-colors ${i === highlighted ? 'bg-teal-50 text-teal-700' : 'hover:bg-slate-50 text-slate-700'}`}
            >
              <span className="font-mono font-bold text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 shrink-0">{opt.code}</span>
              <span>{AIRPORTS[opt.code]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
