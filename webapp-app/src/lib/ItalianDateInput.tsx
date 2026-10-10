import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  formatDateInputIT,
  formatDateOnlyIT,
  parseDateIT,
} from './dateUtils'
import { supabase } from './supabase'

const RESTAURANT_ID =
  '0153d55d-1f5c-42c9-8da2-4eab40533c4e'

type ItalianDateInputProps = {
  value: string
  onChange: (value: string) => void
  style?: import('react').CSSProperties
}

function toLocalISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getMonthStart(dateString: string): Date {
  if (dateString) {
    const [year, month] = dateString.split('-').map(Number)
    if (year && month) {
      return new Date(year, month - 1, 1)
    }
  }

  const today = new Date()
  return new Date(today.getFullYear(), today.getMonth(), 1)
}

function shiftMonth(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

export default function ItalianDateInput({
  value,
  onChange,
  style,
}: ItalianDateInputProps) {
  const [draft, setDraft] = useState(
    value ? formatDateOnlyIT(value) : ''
  )
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(
    () => getMonthStart(value)
  )
  const [reservationDates, setReservationDates] = useState<Set<string>>(
    new Set()
  )
  const [loadingDates, setLoadingDates] = useState(false)
  const calendarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setDraft(value ? formatDateOnlyIT(value) : '')
    if (value) {
      setVisibleMonth(getMonthStart(value))
    }
  }, [value])

  useEffect(() => {
    if (!calendarOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      if (
        calendarRef.current &&
        !calendarRef.current.contains(event.target as Node)
      ) {
        setCalendarOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCalendarOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [calendarOpen])

  useEffect(() => {
    if (!calendarOpen) return

    let cancelled = false

    async function loadReservationDates() {
      setLoadingDates(true)

      const firstDay = toLocalISODate(
        new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1)
      )
      const lastDay = toLocalISODate(
        new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0)
      )

      const { data, error } = await supabase
        .from('reservations')
        .select('reservation_date')
        .eq('restaurant_id', RESTAURANT_ID)
        .gte('reservation_date', firstDay)
        .lte('reservation_date', lastDay)
        .neq('status', 'cancelled')

      if (cancelled) return

      if (error) {
        console.error('Errore caricamento date con prenotazioni:', error)
        setReservationDates(new Set())
      } else {
        setReservationDates(
          new Set(
            (data || []).map(item => item.reservation_date)
          )
        )
      }

      setLoadingDates(false)
    }

    void loadReservationDates()

    return () => {
      cancelled = true
    }
  }, [calendarOpen, visibleMonth])

  const calendarDays = useMemo(() => {
    const year = visibleMonth.getFullYear()
    const month = visibleMonth.getMonth()
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const count = Math.ceil((firstWeekday + daysInMonth) / 7) * 7

    return Array.from({ length: count }, (_, index) => {
      const dayNumber = index - firstWeekday + 1
      if (dayNumber < 1 || dayNumber > daysInMonth) return null
      return toLocalISODate(new Date(year, month, dayNumber))
    })
  }, [visibleMonth])

  function handleChange(nextValue: string) {
    const formatted = formatDateInputIT(nextValue)
    setDraft(formatted)

    const parsed = parseDateIT(formatted)
    if (parsed) {
      onChange(parsed)
      setVisibleMonth(getMonthStart(parsed))
    }
  }

  function chooseDate(nextValue: string) {
    setDraft(formatDateOnlyIT(nextValue))
    onChange(nextValue)
    setCalendarOpen(false)
  }

  const monthLabel = visibleMonth.toLocaleDateString('it-IT', {
    month: 'long',
    year: 'numeric',
  })

  const today = toLocalISODate(new Date())

  return (
    <div
      ref={calendarRef}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        width: 230,
        maxWidth: '100%',
      }}
    >
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={10}
        placeholder="GG/MM/AAAA"
        aria-label="Data in formato GG/MM/AAAA"
        value={draft}
        onChange={e => handleChange(e.target.value)}
        style={{
          flex: 1,
          minWidth: 0,
          boxSizing: 'border-box',
          padding: 8,
          ...style,
        }}
      />

      <button
        type="button"
        onClick={() => {
          setVisibleMonth(getMonthStart(value))
          setCalendarOpen(current => !current)
        }}
        title="Scegli la data dal calendario"
        aria-label="Scegli la data dal calendario"
        aria-expanded={calendarOpen}
        style={{
          flexShrink: 0,
          minWidth: 42,
          minHeight: 42,
          padding: '8px 10px',
          cursor: 'pointer',
        }}
      >
        📅
      </button>

      {calendarOpen && (
        <div
          role="dialog"
          aria-label="Calendario delle prenotazioni"
          style={{
            position: 'absolute',
            zIndex: 1000,
            top: 'calc(100% + 8px)',
            right: 0,
            width: 286,
            maxWidth: 'calc(100vw - 32px)',
            padding: 12,
            border: '1px solid #cbd5e1',
            borderRadius: 12,
            background: '#ffffff',
            color: '#0f172a',
            boxShadow: '0 12px 32px rgba(0,0,0,0.22)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginBottom: 12,
            }}
          >
            <button
              type="button"
              aria-label="Mese precedente"
              onClick={() => setVisibleMonth(month => shiftMonth(month, -1))}
              style={{ minWidth: 36, minHeight: 36, cursor: 'pointer' }}
            >
              ‹
            </button>
            <strong style={{ textTransform: 'capitalize' }}>
              {monthLabel}
            </strong>
            <button
              type="button"
              aria-label="Mese successivo"
              onClick={() => setVisibleMonth(month => shiftMonth(month, 1))}
              style={{ minWidth: 36, minHeight: 36, cursor: 'pointer' }}
            >
              ›
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
              gap: 3,
              textAlign: 'center',
            }}
          >
            {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((day, index) => (
              <div
                key={`${day}-${index}`}
                style={{
                  padding: '5px 0',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#64748b',
                }}
              >
                {day}
              </div>
            ))}

            {calendarDays.map((day, index) => {
              if (!day) {
                return <div key={`empty-${index}`} />
              }

              const dayNumber = Number(day.slice(-2))
              const isSelected = day === value
              const hasReservations = reservationDates.has(day)
              const isToday = day === today

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => chooseDate(day)}
                  aria-label={`${formatDateOnlyIT(day)}${hasReservations ? ', con prenotazioni' : ''}`}
                  aria-pressed={isSelected}
                  title={hasReservations ? 'Sono presenti prenotazioni' : undefined}
                  style={{
                    position: 'relative',
                    minWidth: 0,
                    height: 36,
                    padding: '3px 0 7px',
                    borderRadius: 9,
                    border: isToday
                      ? '1px solid #64748b'
                      : '1px solid transparent',
                    background: isSelected ? '#dbeafe' : 'transparent',
                    color: isSelected ? '#1d4ed8' : '#0f172a',
                    fontWeight: isSelected || hasReservations ? 700 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {dayNumber}
                  {hasReservations && (
                    <span
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: '#16a34a',
                        left: '50%',
                        bottom: 3,
                        transform: 'translateX(-50%)',
                      }}
                    />
                  )}
                </button>
              )
            })}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              marginTop: 12,
              paddingTop: 10,
              borderTop: '1px solid #e2e8f0',
              fontSize: 12,
              color: '#475569',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#16a34a',
                flexShrink: 0,
              }}
            />
            Giorno con prenotazioni
            {loadingDates && (
              <span style={{ marginLeft: 'auto' }}>Aggiornamento…</span>
            )}
          </div>

          <button
            type="button"
            onClick={() => chooseDate(today)}
            style={{
              width: '100%',
              marginTop: 10,
              padding: 8,
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              background: '#f8fafc',
              color: '#0f172a',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Oggi
          </button>
        </div>
      )}
    </div>
  )
}
