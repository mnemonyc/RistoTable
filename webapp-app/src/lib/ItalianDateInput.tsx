import {
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  formatDateInputIT,
  formatDateOnlyIT,
  parseDateIT,
} from './dateUtils'

type ItalianDateInputProps = {
  value: string
  onChange: (value: string) => void
  style?: import('react').CSSProperties
}

export default function ItalianDateInput({
  value,
  onChange,
  style,
}: ItalianDateInputProps) {
  const [draft, setDraft] =
    useState(
      value
        ? formatDateOnlyIT(value)
        : ''
    )

  const calendarInputRef =
    useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft(
      value
        ? formatDateOnlyIT(value)
        : ''
    )
  }, [value])

  function handleChange(
    nextValue: string
  ) {
    const formatted =
      formatDateInputIT(
        nextValue
      )

    setDraft(formatted)

    const parsed =
      parseDateIT(formatted)

    if (parsed) {
      onChange(parsed)
    }
  }

  function handleCalendarChange(
    nextValue: string
  ) {
    if (!nextValue) {
      return
    }

    setDraft(
      formatDateOnlyIT(nextValue)
    )
    onChange(nextValue)
  }

  function openCalendar() {
    const input =
      calendarInputRef.current

    if (!input) {
      return
    }

    if (
      typeof input.showPicker ===
      'function'
    ) {
      input.showPicker()
      return
    }

    input.focus()
    input.click()
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
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
        onChange={e =>
          handleChange(
            e.target.value
          )
        }
        style={{
          flex: 1,
          minWidth: 0,
          padding: 8,
          ...style,
        }}
      />

      <button
        type="button"
        onClick={openCalendar}
        title="Scegli la data dal calendario"
        aria-label="Scegli la data dal calendario"
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

      <input
        ref={calendarInputRef}
        type="date"
        value={value || ''}
        onChange={e =>
          handleCalendarChange(
            e.target.value
          )
        }
        tabIndex={-1}
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}
