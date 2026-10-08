export function formatDateIT(value: string): string {
  if (!value) {
    return ''
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (!match) {
    return value
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  const date = new Date(
    Date.UTC(year, month - 1, day)
  )

  const days = [
    'dom',
    'lun',
    'mar',
    'mer',
    'gio',
    'ven',
    'sab',
  ]

  const dayName = days[date.getUTCDay()]

  return `${dayName} ${match[3]}/${match[2]}/${match[1]}`
}

export function formatDateOnlyIT(
  value: string
): string {
  if (!value) {
    return ''
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (!match) {
    return value
  }

  return `${match[3]}/${match[2]}/${match[1]}`
}

export function parseDateIT(
  value: string
): string | null {
  const match = value
    .trim()
    .match(/^(\d{2})\/(\d{2})\/(\d{4})$/)

  if (!match) {
    return null
  }

  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])

  const date = new Date(
    year,
    month - 1,
    day
  )

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }

  return `${year}-${String(month).padStart(
    2,
    '0'
  )}-${String(day).padStart(2, '0')}`
}

export function formatDateInputIT(
  value: string
): string {
  const digits = value
    .replace(/\D/g, '')
    .slice(0, 8)

  if (digits.length <= 2) {
    return digits
  }

  if (digits.length <= 4) {
    return `${digits.slice(
      0,
      2
    )}/${digits.slice(2)}`
  }

  return `${digits.slice(
    0,
    2
  )}/${digits.slice(
    2,
    4
  )}/${digits.slice(4)}`
}

export function isISODate(
  value: string
): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}