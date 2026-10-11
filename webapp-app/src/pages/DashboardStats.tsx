import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const RESTAURANT_ID = '0153d55d-1f5c-42c9-8da2-4eab40533c4e'
const RESERVATION_DURATION_MINUTES = 90

type Props = { selectedDate: string }
type ReservationItem = {
  id: string
  table_id: string | null
  reservation_date: string
  reservation_time: string
  guests: number
  status: string
}
type ReservationTableLink = { reservation_id: string; table_id: string }
type DiningTable = { id: string; room_id: string; active: boolean }
type Room = { id: string; room_name: string }

function shiftDate(dateString: string, days: number): string {
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function parseLocalDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time.slice(0, 5)}:00`)
}

export default function DashboardStats({ selectedDate }: Props) {
  const [reservations, setReservations] = useState(0)
  const [guests, setGuests] = useState(0)
  const [inside, setInside] = useState({ occupied: 0, free: 0, total: 0 })
  const [outside, setOutside] = useState({ occupied: 0, free: 0, total: 0 })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    void loadStats(() => cancelled)
    return () => { cancelled = true }
  }, [selectedDate])

  async function loadStats(isCancelled: () => boolean) {
    if (!selectedDate) {
      setReservations(0)
      setGuests(0)
      setInside({ occupied: 0, free: 0, total: 0 })
      setOutside({ occupied: 0, free: 0, total: 0 })
      return
    }

    setLoading(true)
    const previousDate = shiftDate(selectedDate, -1)
    const nextDate = shiftDate(selectedDate, 1)

    const [reservationsResult, tablesResult, roomsResult] = await Promise.all([
      supabase.from('reservations')
        .select('id, table_id, reservation_date, reservation_time, guests, status')
        .eq('restaurant_id', RESTAURANT_ID)
        .gte('reservation_date', previousDate)
        .lte('reservation_date', nextDate)
        .neq('status', 'cancelled'),
      supabase.from('dining_tables')
        .select('id, room_id, active')
        .eq('active', true),
      supabase.from('rooms')
        .select('id, room_name')
        .eq('restaurant_id', RESTAURANT_ID),
    ])

    if (isCancelled()) return

    if (reservationsResult.error || tablesResult.error || roomsResult.error) {
      console.error('DASHBOARD STATS LOAD ERROR:', reservationsResult.error || tablesResult.error || roomsResult.error)
      setReservations(0)
      setGuests(0)
      setInside({ occupied: 0, free: 0, total: 0 })
      setOutside({ occupied: 0, free: 0, total: 0 })
      setLoading(false)
      return
    }

    const allReservations = (reservationsResult.data || []) as ReservationItem[]
    const selectedReservations = allReservations.filter(item => item.reservation_date === selectedDate)
    setReservations(selectedReservations.length)
    setGuests(selectedReservations.reduce((sum, item) => sum + (Number(item.guests) || 0), 0))

    const reservationIds = allReservations.map(item => item.id)
    let links: ReservationTableLink[] = []
    if (reservationIds.length) {
      const linksResult = await supabase.from('reservation_tables')
        .select('reservation_id, table_id')
        .in('reservation_id', reservationIds)
      if (isCancelled()) return
      if (linksResult.error) {
        console.error('DASHBOARD STATS LINKS ERROR:', linksResult.error)
      } else {
        links = linksResult.data || []
      }
    }

    const rooms = (roomsResult.data || []) as Room[]
    const tables = (tablesResult.data || []) as DiningTable[]
    const roomById = new Map(rooms.map(room => [room.id, room]))
    const restaurantTables = tables.filter(table => roomById.has(table.room_id))
    const insideTables = restaurantTables.filter(table => !roomById.get(table.room_id)!.room_name.toLowerCase().includes('estern'))
    const outsideTables = restaurantTables.filter(table => roomById.get(table.room_id)!.room_name.toLowerCase().includes('estern'))

    const dayStart = parseLocalDateTime(selectedDate, '00:00')
    const dayEnd = parseLocalDateTime(nextDate, '00:00')
    const occupiedIds = new Set<string>()

    for (const reservation of allReservations) {
      const start = parseLocalDateTime(reservation.reservation_date, reservation.reservation_time)
      const end = new Date(start.getTime() + RESERVATION_DURATION_MINUTES * 60_000)
      if (!(start < dayEnd && end > dayStart)) continue
      if (reservation.table_id) occupiedIds.add(reservation.table_id)
      for (const link of links) {
        if (link.reservation_id === reservation.id) occupiedIds.add(link.table_id)
      }
    }

    const countRoom = (roomTables: DiningTable[]) => {
      const ids = new Set(roomTables.map(table => table.id))
      const occupied = Array.from(occupiedIds).filter(id => ids.has(id)).length
      return { occupied, free: Math.max(0, roomTables.length - occupied), total: roomTables.length }
    }

    setInside(countRoom(insideTables))
    setOutside(countRoom(outsideTables))
    setLoading(false)
  }

  const value = (number: number) => loading ? '…' : number

  return (
    <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <div>📋 Prenotazioni: <b>{value(reservations)}</b></div>
        <div>👥 Coperti: <b>{value(guests)}</b></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
        <section style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: 12 }}>
          <strong>🏠 Interno</strong>
          <div>🔴 Occupati: <b>{value(inside.occupied)} / {value(inside.total)}</b></div>
          <div>🟢 Liberi: <b>{value(inside.free)}</b></div>
        </section>
        <section style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: 12 }}>
          <strong>☀️ Esterno</strong>
          <div>🔴 Occupati: <b>{value(outside.occupied)} / {value(outside.total)}</b></div>
          <div>🟢 Liberi: <b>{value(outside.free)}</b></div>
        </section>
      </div>
    </div>
  )
}
