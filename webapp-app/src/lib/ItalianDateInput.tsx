import {
  useEffect,
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

  return (
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
        padding: 8,
        ...style,
      }}
    />
  )
}