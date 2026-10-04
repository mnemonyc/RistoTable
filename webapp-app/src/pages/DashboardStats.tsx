import {
  useEffect,
  useState,
} from 'react'

import { supabase } from '../lib/supabase'

const RESTAURANT_ID =
  '0153d55d-1f5c-42c9-8da2-4eab40533c4e'

type Props = {
  selectedDate: string
}

type ReservationItem = {
  id: string
  table_id: string | null
  reservation_date: string
  reservation_time: string
  guests: number
  status: string
}

type ReservationTableLink = {
  reservation_id: string
  table_id: string
}

const RESERVATION_DURATION_MINUTES = 90

function shiftDate(
  dateString: string,
  days: number
): string {
  const [
    year,
    month,
    day,
  ] = dateString
    .split('-')
    .map(Number)

  const dateValue =
    new Date(
      year,
      month - 1,
      day + days
    )

  const y =
    dateValue.getFullYear()

  const m =
    String(
      dateValue.getMonth() + 1
    ).padStart(2, '0')

  const d =
    String(
      dateValue.getDate()
    ).padStart(2, '0')

  return `${y}-${m}-${d}`
}

function parseLocalDateTime(
  date: string,
  time: string
): Date {
  return new Date(
    `${date}T${time.slice(
      0,
      5
    )}:00`
  )
}

function addMinutes(
  date: Date,
  minutes: number
): Date {
  return new Date(
    date.getTime() +
      minutes *
        60 *
        1000
  )
}

function intervalsOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date
): boolean {
  return (
    startA < endB &&
    endA > startB
  )
}

export default function DashboardStats({
  selectedDate,
}: Props) {
  const [
    reservations,
    setReservations,
  ] = useState(0)

  const [
    guests,
    setGuests,
  ] = useState(0)

  const [
    occupiedTables,
    setOccupiedTables,
  ] = useState(0)

  const [
    freeTables,
    setFreeTables,
  ] = useState(0)

  const [
    loading,
    setLoading,
  ] = useState(false)

  useEffect(() => {
    loadStats()
  }, [selectedDate])

  async function loadStats() {
    if (!selectedDate) {
      setReservations(0)
      setGuests(0)
      setOccupiedTables(0)
      setFreeTables(0)
      return
    }

    setLoading(true)

    /*
     * ========================================================
     * PRENOTAZIONI DEL RISTORANTE
     * ========================================================
     *
     * Carichiamo anche il giorno precedente e successivo,
     * perché una prenotazione di 90 minuti può attraversare
     * la mezzanotte.
     */

    const previousDate =
      shiftDate(
        selectedDate,
        -1
      )

    const nextDate =
      shiftDate(
        selectedDate,
        1
      )

    const {
      data: reservationsData,
      error:
        reservationsError,
    } = await supabase
      .from('reservations')
      .select(
        `
        id,
        table_id,
        reservation_date,
        reservation_time,
        guests,
        status
        `
      )
      .eq(
        'restaurant_id',
        RESTAURANT_ID
      )
      .gte(
        'reservation_date',
        previousDate
      )
      .lte(
        'reservation_date',
        nextDate
      )
      .neq(
        'status',
        'cancelled'
      )

    if (
      reservationsError
    ) {
      console.error(
        'DASHBOARD STATS RESERVATIONS ERROR:',
        reservationsError
      )

      setReservations(0)
      setGuests(0)
      setOccupiedTables(0)
      setFreeTables(0)
      setLoading(false)

      return
    }

    const loadedReservations =
      (reservationsData ||
        []) as ReservationItem[]

    /*
     * ========================================================
     * PRENOTAZIONI DELLA DATA SELEZIONATA
     * ========================================================
     *
     * Il numero delle prenotazioni e dei coperti mostrato
     * nella Dashboard riguarda esclusivamente la data scelta.
     */

    const selectedDateReservations =
      loadedReservations.filter(
        reservation =>
          reservation.reservation_date ===
          selectedDate
      )

    const reservationsCount =
      selectedDateReservations.length

    const guestsCount =
      selectedDateReservations.reduce(
        (
          sum,
          reservation
        ) =>
          sum +
          (
            Number(
              reservation.guests
            ) || 0
          ),
        0
      )

    /*
     * ========================================================
     * TAVOLI UTILIZZATI
     * ========================================================
     */

    const reservationIds =
      loadedReservations.map(
        reservation =>
          reservation.id
      )

    let links:
      ReservationTableLink[] =
      []

    if (
      reservationIds.length >
      0
    ) {
      const {
        data: linksData,
        error: linksError,
      } = await supabase
        .from(
          'reservation_tables'
        )
        .select(
          'reservation_id, table_id'
        )
        .in(
          'reservation_id',
          reservationIds
        )

      if (linksError) {
        console.error(
          'DASHBOARD STATS LINKS ERROR:',
          linksError
        )
      } else {
        links =
          linksData || []
      }
    }

    /*
     * ========================================================
     * TAVOLI TOTALI
     * ========================================================
     *
     * Solo tavoli attivi collegati alle sale del ristorante.
     */

    const {
      data: tablesData,
      error: tablesError,
    } = await supabase
      .from(
        'dining_tables'
      )
      .select(
        'id, room_id, active'
      )
      .eq(
        'active',
        true
      )

    if (tablesError) {
      console.error(
        'DASHBOARD STATS TABLES ERROR:',
        tablesError
      )

      setReservations(
        reservationsCount
      )

      setGuests(
        guestsCount
      )

      setOccupiedTables(0)

      setFreeTables(0)

      setLoading(false)

      return
    }

    const activeTables =
      tablesData || []

    /*
     * ========================================================
     * SALE DEL RISTORANTE
     * ========================================================
     *
     * Recuperiamo gli ID delle sale appartenenti
     * al ristorante.
     */

    const {
      data: roomsData,
      error: roomsError,
    } = await supabase
      .from('rooms')
      .select('id')
      .eq(
        'restaurant_id',
        RESTAURANT_ID
      )

    if (roomsError) {
      console.error(
        'DASHBOARD STATS ROOMS ERROR:',
        roomsError
      )

      setReservations(
        reservationsCount
      )

      setGuests(
        guestsCount
      )

      setOccupiedTables(0)

      setFreeTables(0)

      setLoading(false)

      return
    }

    const roomIds = new Set(
      (roomsData || []).map(
        room =>
          room.id
      )
    )

    const restaurantTables =
      activeTables.filter(
        table =>
          roomIds.has(
            table.room_id
          )
      )

    const totalTables =
      restaurantTables.length

    /*
     * ========================================================
     * OCCUPAZIONE REALE
     * ========================================================
     *
     * Consideriamo occupato un tavolo se una prenotazione
     * esistente si sovrappone alla giornata selezionata.
     *
     * La durata è di 90 minuti.
     */

    const occupiedTableIds =
      new Set<string>()

    /*
     * Intervallo di riferimento:
     *
     * tutta la giornata selezionata.
     *
     * In questo modo una prenotazione iniziata il giorno
     * precedente alle 23:30, per esempio, continua a risultare
     * collegata alla giornata successiva fino alle 01:00.
     */

    const dayStart =
      parseLocalDateTime(
        selectedDate,
        '00:00'
      )

    const dayEnd =
      parseLocalDateTime(
        nextDate,
        '00:00'
      )

    for (
      const reservation of
        loadedReservations
    ) {
      const reservationStart =
        parseLocalDateTime(
          reservation.reservation_date,
          reservation.reservation_time
        )

      const reservationEnd =
        addMinutes(
          reservationStart,
          RESERVATION_DURATION_MINUTES
        )

      if (
        !intervalsOverlap(
          dayStart,
          dayEnd,
          reservationStart,
          reservationEnd
        )
      ) {
        continue
      }

      /*
       * Vecchio campo table_id.
       */

      if (
        reservation.table_id
      ) {
        occupiedTableIds.add(
          reservation.table_id
        )
      }

      /*
       * Tabella reservation_tables.
       */

      links
        .filter(
          link =>
            link.reservation_id ===
            reservation.id
        )
        .forEach(
          link => {
            occupiedTableIds.add(
              link.table_id
            )
          }
        )
    }

    /*
     * Consideriamo solo tavoli realmente appartenenti
     * alle sale del ristorante.
     */

    const restaurantTableIds =
      new Set(
        restaurantTables.map(
          table =>
            table.id
        )
      )

    const validOccupiedTableIds =
      Array.from(
        occupiedTableIds
      ).filter(
        tableId =>
          restaurantTableIds.has(
            tableId
          )
      )

    const occupied =
      validOccupiedTableIds.length

    const free =
      Math.max(
        0,
        totalTables -
          occupied
      )

    /*
     * ========================================================
     * AGGIORNAMENTO DASHBOARD
     * ========================================================
     */

    setReservations(
      reservationsCount
    )

    setGuests(
      guestsCount
    )

    setOccupiedTables(
      occupied
    )

    setFreeTables(
      free
    )

    setLoading(false)
  }

  return (
    <div
      style={{
        display:
          'flex',
        gap: 20,
        marginBottom: 20,
        flexWrap:
          'wrap',
      }}
    >
      <div>
        📋 Prenotazioni:
        <b>
          {' '}
          {loading
            ? '...'
            : reservations}
        </b>
      </div>

      <div>
        👥 Coperti:
        <b>
          {' '}
          {loading
            ? '...'
            : guests}
        </b>
      </div>

      <div>
        🔴 Occupati:
        <b>
          {' '}
          {loading
            ? '...'
            : occupiedTables}
        </b>
      </div>

      <div>
        🟢 Liberi:
        <b>
          {' '}
          {loading
            ? '...'
            : freeTables}
        </b>
      </div>
    </div>
  )
}