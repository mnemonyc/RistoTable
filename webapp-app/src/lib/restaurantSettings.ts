import { supabase } from './supabase'

export const RESTAURANT_ID =
  '0153d55d-1f5c-42c9-8da2-4eab40533c4e'

export type RestaurantSettings = {
  firstShiftStart: string
  firstShiftEnd: string
  secondShiftStart: string
  secondShiftEnd: string
  reservationDurationMinutes: number
  timeIntervalMinutes: number
}

export const DEFAULT_RESTAURANT_SETTINGS: RestaurantSettings = {
  firstShiftStart: '19:30',
  firstShiftEnd: '22:00',
  secondShiftStart: '22:00',
  secondShiftEnd: '24:00',
  reservationDurationMinutes: 90,
  timeIntervalMinutes: 15,
}

function normalizeTime(value: string): string {
  return value.slice(0, 5)
}

function timeToMinutes(value: string): number {
  const normalized = normalizeTime(value)
  const [hour, minute] = normalized
    .split(':')
    .map(Number)

  return hour * 60 + minute
}

function minutesToTime(totalMinutes: number): string {
  const normalized =
    ((totalMinutes % 1440) + 1440) % 1440

  const hour = Math.floor(normalized / 60)
  const minute = normalized % 60

  return (
    String(hour).padStart(2, '0') +
    ':' +
    String(minute).padStart(2, '0')
  )
}

export function generateTimeOptions(
  start: string,
  end: string,
  intervalMinutes = 15
): string[] {
  const startMinutes = timeToMinutes(start)
  const rawEndMinutes = timeToMinutes(end)
  const endMinutes =
    rawEndMinutes === 0 &&
    normalizeTime(end) === '00:00'
      ? 1440
      : rawEndMinutes

  const safeInterval =
    Number.isFinite(intervalMinutes) &&
    intervalMinutes > 0
      ? intervalMinutes
      : 15

  const result: string[] = []

  for (
    let minutes = startMinutes;
    minutes < endMinutes;
    minutes += safeInterval
  ) {
    result.push(minutesToTime(minutes))
  }

  return result
}

export function getShiftForTime(
  time: string,
  settings: RestaurantSettings
): '1' | '2' {
  return (
    timeToMinutes(time) <
    timeToMinutes(settings.secondShiftStart)
      ? '1'
      : '2'
  )
}

export async function loadRestaurantSettings(): Promise<RestaurantSettings> {
  const { data, error } = await supabase
    .from('restaurant_settings')
    .select(
      'first_shift_start, first_shift_end, second_shift_start, second_shift_end, reservation_duration_minutes, time_interval_minutes'
    )
    .eq('restaurant_id', RESTAURANT_ID)
    .maybeSingle()

  if (error || !data) {
    if (error) {
      console.warn(
        'Impostazioni orari non disponibili, uso i valori predefiniti.',
        error
      )
    }

    return DEFAULT_RESTAURANT_SETTINGS
  }

  return {
    firstShiftStart:
      normalizeTime(data.first_shift_start),
    firstShiftEnd:
      normalizeTime(data.first_shift_end),
    secondShiftStart:
      normalizeTime(data.second_shift_start),
    secondShiftEnd:
      normalizeTime(data.second_shift_end),
    reservationDurationMinutes:
      Number(
        data.reservation_duration_minutes
      ) ||
      DEFAULT_RESTAURANT_SETTINGS.reservationDurationMinutes,
    timeIntervalMinutes:
      Number(
        data.time_interval_minutes
      ) ||
      DEFAULT_RESTAURANT_SETTINGS.timeIntervalMinutes,
  }
}
