import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import { supabase } from '../lib/supabase'
import ItalianDateInput from '../lib/ItalianDateInput'
import { formatDateIT } from '../lib/dateUtils'
import {
  DEFAULT_RESTAURANT_SETTINGS,
  generateTimeOptions,
  getShiftForTime,
  loadRestaurantSettings,
  type RestaurantSettings,
} from '../lib/restaurantSettings'

const RESTAURANT_ID =
  '0153d55d-1f5c-42c9-8da2-4eab40533c4e'

const RESERVATION_DURATION_MINUTES = 90

type ReservationSelection = {
  date: string
  time: string
  guests: number
  tableIds: string[]
}

type NewReservationProps = {
  initialSelection?: ReservationSelection | null
  defaultDate?: string
  onBack?: () => void
}

type Room = {
  id: string
  room_name: string
  created_at: string
}

type DiningTable = {
  id: string
  room_id: string
  table_name: string
  seats: number
  pos_x: number
  pos_y: number
  active: boolean
  created_at: string
}

type Customer = {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  notes: string | null
  vip: boolean
}

type Reservation = {
  id: string
  reservation_date: string
  reservation_time: string
  guests: number
  table_id: string | null
  status: string
}

type ReservationTableLink = {
  reservation_id: string
  table_id: string
}

function getLocalDate(): string {
  const now = new Date()

  const year = now.getFullYear()

  const month = String(
    now.getMonth() + 1
  ).padStart(2, '0')

  const day = String(
    now.getDate()
  ).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function parseLocalDateTime(
  date: string,
  time: string
): Date {
  return new Date(
    `${date}T${time}:00`
  )
}

function addMinutes(
  date: Date,
  minutes: number
): Date {
  return new Date(
    date.getTime() +
      minutes * 60 * 1000
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

function normalizeTime(
  time: string
): string {
  return time.slice(0, 5)
}

function sortTables(
  tables: DiningTable[]
): DiningTable[] {
  return [...tables].sort(
    (a, b) =>
      a.table_name.localeCompare(
        b.table_name,
        'it',
        {
          numeric: true,
          sensitivity: 'base',
        }
      )
  )
}

function getReservationDateRange(
  date: string
): {
  from: string
  to: string
} {
  const current =
    new Date(`${date}T00:00:00`)

  const previous = new Date(
    current.getTime() -
      24 * 60 * 60 * 1000
  )

  const next = new Date(
    current.getTime() +
      24 * 60 * 60 * 1000
  )

  const format = (value: Date) => {
    const year =
      value.getFullYear()

    const month = String(
      value.getMonth() + 1
    ).padStart(2, '0')

    const day = String(
      value.getDate()
    ).padStart(2, '0')

    return `${year}-${month}-${day}`
  }

  return {
    from: format(previous),
    to: format(next),
  }
}

export default function NewReservation({
  initialSelection,
  defaultDate,
  onBack,
}: NewReservationProps) {
  const [rooms, setRooms] =
    useState<Room[]>([])

  const [tables, setTables] =
    useState<DiningTable[]>([])

  const [customers, setCustomers] =
    useState<Customer[]>([])

  const [reservations, setReservations] =
    useState<Reservation[]>([])

  const [
    reservationTableLinks,
    setReservationTableLinks,
  ] = useState<
    ReservationTableLink[]
  >([])

  const [selectedDate, setSelectedDate] =
    useState(
      initialSelection?.date ||
        defaultDate ||
        getLocalDate()
    )

  const [selectedTime, setSelectedTime] =
    useState(
      initialSelection?.time ||
        DEFAULT_RESTAURANT_SETTINGS.firstShiftStart
    )

  const [shift, setShift] =
    useState<'1' | '2'>(
      initialSelection?.time
        ? getShiftForTime(
            initialSelection.time,
            DEFAULT_RESTAURANT_SETTINGS
          )
        : '1'
    )

  const [guests, setGuests] =
    useState(
      initialSelection?.guests ||
        2
    )

  const [
    selectedTableIds,
    setSelectedTableIds,
  ] = useState<string[]>(
    initialSelection?.tableIds ||
      []
  )

  const [
    selectedRoomId,
    setSelectedRoomId,
  ] = useState('')

  const [
    customerName,
    setCustomerName,
  ] = useState('')

  const [
    customerPhone,
    setCustomerPhone,
  ] = useState('')

  const [
    customerEmail,
    setCustomerEmail,
  ] = useState('')

  const [
    customerNotes,
    setCustomerNotes,
  ] = useState('')

  const [customerVip, setCustomerVip] =
    useState(false)

  const [message, setMessage] =
    useState('')

  const [error, setError] =
    useState('')

  const [loading, setLoading] =
    useState(true)

  const [saving, setSaving] =
    useState(false)

  const [
    loadingAvailability,
    setLoadingAvailability,
  ] = useState(false)

  const [settings, setSettings] =
    useState<RestaurantSettings>(
      DEFAULT_RESTAURANT_SETTINGS
    )

  const shift1Times = useMemo(
    () =>
      generateTimeOptions(
        settings.firstShiftStart,
        settings.firstShiftEnd,
        settings.timeIntervalMinutes
      ),
    [settings]
  )

  const shift2Times = useMemo(
    () =>
      generateTimeOptions(
        settings.secondShiftStart,
        settings.secondShiftEnd,
        settings.timeIntervalMinutes
      ),
    [settings]
  )

  const availableTimes =
    shift === '1'
      ? shift1Times
      : shift2Times

  useEffect(() => {
    void loadRestaurantSettings().then(
      loadedSettings => {
        setSettings(loadedSettings)

        if (!initialSelection) {
          const firstTime =
            generateTimeOptions(
              loadedSettings.firstShiftStart,
              loadedSettings.firstShiftEnd,
              loadedSettings.timeIntervalMinutes
            )[0]

          if (firstTime) {
            setSelectedTime(firstTime)
            setShift('1')
          }
        }
      }
    )

    loadInitialData()
  }, [])

  useEffect(() => {
    if (
      initialSelection
    ) {
      setSelectedDate(
        initialSelection.date
      )

      setSelectedTime(
        initialSelection.time
      )

      setGuests(
        initialSelection.guests
      )

      setSelectedTableIds(
        initialSelection.tableIds
      )

      setShift(
        getShiftForTime(
          initialSelection.time,
          settings
        )
      )
    }
  }, [initialSelection])

  useEffect(() => {
    if (
      selectedDate &&
      selectedTime
    ) {
      loadAvailability()
    }
  }, [
    selectedDate,
    selectedTime,
  ])

  async function loadInitialData() {
    setLoading(true)
    setError('')

    const [
      roomsResult,
      tablesResult,
      customersResult,
    ] = await Promise.all([
      supabase
        .from('rooms')
        .select(
          'id, room_name, created_at'
        )
        .eq(
          'restaurant_id',
          RESTAURANT_ID
        )
        .order('created_at'),

      supabase
        .from('dining_tables')
        .select(
          'id, room_id, table_name, seats, pos_x, pos_y, active, created_at'
        )
        .eq('active', true),

      supabase
        .from('customers')
        .select(
          'id, full_name, phone, email, notes, vip'
        )
        .eq(
          'restaurant_id',
          RESTAURANT_ID
        )
        .order('full_name'),
    ])

    if (roomsResult.error) {
      setError(
        `Errore caricamento sale: ${roomsResult.error.message}`
      )
      setLoading(false)
      return
    }

    if (tablesResult.error) {
      setError(
        `Errore caricamento tavoli: ${tablesResult.error.message}`
      )
      setLoading(false)
      return
    }

    if (customersResult.error) {
      setError(
        `Errore caricamento clienti: ${customersResult.error.message}`
      )
      setLoading(false)
      return
    }

    const loadedTables =
      sortTables(
        tablesResult.data || []
      )

    /*
     * Mostriamo esclusivamente le sale
     * che hanno almeno un tavolo attivo.
     *
     * In questo modo una vecchia sala
     * rimasta eventualmente nel database
     * senza tavoli non viene mostrata.
     */
    const activeRoomIds =
      new Set(
        loadedTables.map(
          table => table.room_id
        )
      )

    const loadedRooms = (
      roomsResult.data || []
    ).filter(room =>
      activeRoomIds.has(room.id)
    )

    setRooms(loadedRooms)
    setTables(loadedTables)
    setCustomers(
      customersResult.data || []
    )

    if (
      loadedRooms.length > 0 &&
      !selectedRoomId
    ) {
      const initialTable =
        initialSelection?.tableIds?.[0]

      const initialTableData =
        loadedTables.find(
          table =>
            table.id ===
            initialTable
        )

      if (
        initialTableData &&
        activeRoomIds.has(
          initialTableData.room_id
        )
      ) {
        setSelectedRoomId(
          initialTableData.room_id
        )
      } else {
        setSelectedRoomId(
          loadedRooms[0].id
        )
      }
    }

    setLoading(false)
  }

  async function loadAvailability() {
    setLoadingAvailability(true)
    setError('')

    const range =
      getReservationDateRange(
        selectedDate
      )

    const {
      data: reservationData,
      error: reservationError,
    } = await supabase
      .from('reservations')
      .select(
        'id, reservation_date, reservation_time, guests, table_id, status'
      )
      .eq(
        'restaurant_id',
        RESTAURANT_ID
      )
      .gte(
        'reservation_date',
        range.from
      )
      .lte(
        'reservation_date',
        range.to
      )
      .neq(
        'status',
        'cancelled'
      )

    if (reservationError) {
      setError(
        `Errore controllo disponibilità: ${reservationError.message}`
      )
      setLoadingAvailability(false)
      return
    }

    const loadedReservations =
      reservationData || []

    let links: ReservationTableLink[] =
      []

    if (
      loadedReservations.length > 0
    ) {
      const reservationIds =
        loadedReservations.map(
          reservation =>
            reservation.id
        )

      const {
        data: linkData,
        error: linkError,
      } = await supabase
        .from('reservation_tables')
        .select(
          'reservation_id, table_id'
        )
        .in(
          'reservation_id',
          reservationIds
        )

      if (linkError) {
        setError(
          `Errore controllo tavoli prenotati: ${linkError.message}`
        )
        setLoadingAvailability(false)
        return
      }

      links = linkData || []
    }

    setReservations(
      loadedReservations
    )

    setReservationTableLinks(
      links
    )

    setLoadingAvailability(false)

    const unavailableIds =
      getUnavailableTableIds(
        loadedReservations,
        links
      )

    setSelectedTableIds(
      previous =>
        previous.filter(
          id =>
            !unavailableIds.has(id)
        )
    )
  }

  function getUnavailableTableIds(
    reservationList: Reservation[],
    links: ReservationTableLink[]
  ): Set<string> {
    const unavailable =
      new Set<string>()

    const requestedStart =
      parseLocalDateTime(
        selectedDate,
        selectedTime
      )

    const requestedEnd =
      addMinutes(
        requestedStart,
        RESERVATION_DURATION_MINUTES
      )

    for (
      const reservation of
        reservationList
    ) {
      const reservationStart =
        parseLocalDateTime(
          reservation.reservation_date,
          normalizeTime(
            reservation.reservation_time
          )
        )

      const reservationEnd =
        addMinutes(
          reservationStart,
          RESERVATION_DURATION_MINUTES
        )

      const overlaps =
        intervalsOverlap(
          requestedStart,
          requestedEnd,
          reservationStart,
          reservationEnd
        )

      if (!overlaps) {
        continue
      }

      const reservationLinks =
        links.filter(
          link =>
            link.reservation_id ===
            reservation.id
        )

      if (
        reservationLinks.length > 0
      ) {
        for (
          const link of
            reservationLinks
        ) {
          unavailable.add(
            link.table_id
          )
        }
      }

      if (reservation.table_id) {
        unavailable.add(
          reservation.table_id
        )
      }
    }

    return unavailable
  }

  const unavailableTableIds =
    useMemo(
      () =>
        getUnavailableTableIds(
          reservations,
          reservationTableLinks
        ),
      [
        reservations,
        reservationTableLinks,
        selectedDate,
        selectedTime,
      ]
    )

  const visibleTables = useMemo(() => {
    if (!selectedRoomId) {
      return []
    }

    return sortTables(
      tables.filter(
        table =>
          table.room_id ===
          selectedRoomId
      )
    )
  }, [
    tables,
    selectedRoomId,
  ])

  const selectedTables =
    useMemo(
      () =>
        tables.filter(table =>
          selectedTableIds.includes(
            table.id
          )
        ),
      [
        tables,
        selectedTableIds,
      ]
    )

  const selectedCapacity =
    selectedTables.reduce(
      (total, table) =>
        total + table.seats,
      0
    )

  const remainingGuests =
    Math.max(
      0,
      guests - selectedCapacity
    )

  function handleDateChange(
    value: string
  ) {
    setSelectedDate(value)
    setSelectedTableIds([])
  }

  function handleShiftChange(
    value: '1' | '2'
  ) {
    setShift(value)

    const firstTime =
      value === '1'
        ? shift1Times[0]
        : shift2Times[0]

    setSelectedTime(firstTime)
    setSelectedTableIds([])
  }

  function handleTimeChange(
    value: string
  ) {
    setSelectedTime(value)
    setSelectedTableIds([])
  }

  function handleGuestsChange(
    value: number
  ) {
    const safeValue =
      Math.max(
        1,
        Math.floor(value || 1)
      )

    setGuests(safeValue)
    setSelectedTableIds([])
  }

  function handleRoomChange(
    roomId: string
  ) {
    setSelectedRoomId(roomId)
    setSelectedTableIds([])
  }

  function toggleTable(
    tableId: string
  ) {
    if (
      unavailableTableIds.has(
        tableId
      )
    ) {
      return
    }

    setSelectedTableIds(
      previous => {
        if (
          previous.includes(tableId)
        ) {
          return previous.filter(
            id => id !== tableId
          )
        }

        return [
          ...previous,
          tableId,
        ]
      }
    )
  }

  function findTableCombination(
    requiredGuests: number
  ): string[] {
    const availableTables =
      visibleTables.filter(
        table =>
          !unavailableTableIds.has(
            table.id
          )
      )

    if (
      availableTables.length === 0
    ) {
      return []
    }

    const dp: Array<
      string[] | null
    > = Array(
      requiredGuests + 1
    ).fill(null)

    dp[0] = []

    for (
      const table of
        availableTables
    ) {
      for (
        let capacity =
          requiredGuests;
        capacity >= 0;
        capacity--
      ) {
        if (
          dp[capacity] === null
        ) {
          continue
        }

        const newCapacity =
          Math.min(
            requiredGuests,
            capacity +
              table.seats
          )

        if (
          dp[newCapacity] ===
          null
        ) {
          dp[newCapacity] = [
            ...(dp[capacity] || []),
            table.id,
          ]
        }
      }
    }

    return (
      dp[requiredGuests] || []
    )
  }

  function autoSelectTables() {
    const combination =
      findTableCombination(
        guests
      )

    if (
      combination.length === 0
    ) {
      setError(
        'Non ci sono tavoli liberi sufficienti per questa prenotazione.'
      )
      return
    }

    setError('')
    setSelectedTableIds(
      combination
    )
  }

  function clearSelectedTables() {
    setSelectedTableIds([])
    setError('')
  }

  function findExistingCustomer(): Customer | null {
    const normalizedPhone =
      customerPhone.trim()

    if (!normalizedPhone) {
      return null
    }

    return (
      customers.find(
        customer =>
          (customer.phone || '')
            .trim() ===
          normalizedPhone
      ) || null
    )
  }

  async function createOrUpdateCustomer(): Promise<{
    customer: Customer | null
    created: boolean
  }> {
    const name =
      customerName.trim()

    const phone =
      customerPhone.trim()

    const email =
      customerEmail.trim()

    const notes =
      customerNotes.trim()

    const existing =
      findExistingCustomer()

    if (existing) {
      const { data, error } =
        await supabase
          .from('customers')
          .update({
            full_name: name,
            email:
              email || null,
            notes:
              notes || null,
            vip: customerVip,
          })
          .eq(
            'id',
            existing.id
          )
          .select(
            'id, full_name, phone, email, notes, vip'
          )
          .single()

      if (error) {
        throw new Error(
          `Errore aggiornamento cliente: ${error.message}`
        )
      }

      return {
        customer: data,
        created: false,
      }
    }

    const { data, error } =
      await supabase
        .from('customers')
        .insert({
          restaurant_id:
            RESTAURANT_ID,
          full_name: name,
          phone:
            phone || null,
          email:
            email || null,
          notes:
            notes || null,
          vip: customerVip,
        })
        .select(
          'id, full_name, phone, email, notes, vip'
        )
        .single()

    if (error) {
      throw new Error(
        `Errore creazione cliente: ${error.message}`
      )
    }

    return {
      customer: data,
      created: true,
    }
  }

  async function finalAvailabilityCheck(): Promise<{
    available: boolean
    conflictingTableIds: string[]
  }> {
    const range =
      getReservationDateRange(
        selectedDate
      )

    const {
      data: reservationData,
      error: reservationError,
    } = await supabase
      .from('reservations')
      .select(
        'id, reservation_date, reservation_time, guests, table_id, status'
      )
      .eq(
        'restaurant_id',
        RESTAURANT_ID
      )
      .gte(
        'reservation_date',
        range.from
      )
      .lte(
        'reservation_date',
        range.to
      )
      .neq(
        'status',
        'cancelled'
      )

    if (reservationError) {
      throw new Error(
        `Errore controllo disponibilità finale: ${reservationError.message}`
      )
    }

    const currentReservations =
      reservationData || []

    const reservationIds =
      currentReservations.map(
        reservation =>
          reservation.id
      )

    let links: ReservationTableLink[] =
      []

    if (
      reservationIds.length > 0
    ) {
      const {
        data: linkData,
        error: linkError,
      } = await supabase
        .from('reservation_tables')
        .select(
          'reservation_id, table_id'
        )
        .in(
          'reservation_id',
          reservationIds
        )

      if (linkError) {
        throw new Error(
          `Errore controllo tavoli prenotati: ${linkError.message}`
        )
      }

      links = linkData || []
    }

    const requestedStart =
      parseLocalDateTime(
        selectedDate,
        selectedTime
      )

    const requestedEnd =
      addMinutes(
        requestedStart,
        RESERVATION_DURATION_MINUTES
      )

    const conflicting =
      new Set<string>()

    for (
      const reservation of
        currentReservations
    ) {
      const reservationStart =
        parseLocalDateTime(
          reservation.reservation_date,
          normalizeTime(
            reservation.reservation_time
          )
        )

      const reservationEnd =
        addMinutes(
          reservationStart,
          RESERVATION_DURATION_MINUTES
        )

      if (
        !intervalsOverlap(
          requestedStart,
          requestedEnd,
          reservationStart,
          reservationEnd
        )
      ) {
        continue
      }

      for (
        const link of links
      ) {
        if (
          link.reservation_id ===
            reservation.id &&
          selectedTableIds.includes(
            link.table_id
          )
        ) {
          conflicting.add(
            link.table_id
          )
        }
      }

      if (
        reservation.table_id &&
        selectedTableIds.includes(
          reservation.table_id
        )
      ) {
        conflicting.add(
          reservation.table_id
        )
      }
    }

    return {
      available:
        conflicting.size === 0,
      conflictingTableIds:
        Array.from(conflicting),
    }
  }

  async function saveReservation() {
    setError('')
    setMessage('')

    const name =
      customerName.trim()

    if (!name) {
      setError(
        'Inserisci il nome del cliente.'
      )
      return
    }

    if (!selectedDate) {
      setError(
        'Inserisci la data della prenotazione.'
      )
      return
    }

    if (!selectedTime) {
      setError(
        'Inserisci l’orario della prenotazione.'
      )
      return
    }

    if (guests < 1) {
      setError(
        'Il numero di coperti deve essere almeno 1.'
      )
      return
    }

    if (
      selectedTableIds.length ===
      0
    ) {
      setError(
        'Seleziona almeno un tavolo.'
      )
      return
    }

    if (
      selectedCapacity < guests
    ) {
      setError(
        `I tavoli selezionati hanno ${selectedCapacity} coperti disponibili, ma la prenotazione richiede ${guests} coperti.`
      )
      return
    }

    const selectedTableObjects =
      tables.filter(table =>
        selectedTableIds.includes(
          table.id
        )
      )

    const roomIds = Array.from(
      new Set(
        selectedTableObjects.map(
          table =>
            table.room_id
        )
      )
    )

    if (roomIds.length !== 1) {
      setError(
        'I tavoli di una stessa prenotazione devono appartenere alla stessa sala.'
      )
      return
    }

    setSaving(true)

    try {
      const availability =
        await finalAvailabilityCheck()

      if (
        !availability.available
      ) {
        const conflictingNames =
          tables
            .filter(table =>
              availability.conflictingTableIds.includes(
                table.id
              )
            )
            .map(
              table =>
                table.table_name
            )

        setError(
          `Attenzione: ${conflictingNames.join(
            ', '
          )} è stato prenotato nel frattempo. Seleziona altri tavoli.`
        )

        setSelectedTableIds(
          previous =>
            previous.filter(
              id =>
                !availability.conflictingTableIds.includes(
                  id
                )
            )
        )

        setSaving(false)
        return
      }

      const {
        customer,
        created,
      } =
        await createOrUpdateCustomer()

      if (!customer) {
        throw new Error(
          'Impossibile creare o recuperare il cliente.'
        )
      }

      const primaryTableId =
        selectedTableIds[0]

      const {
        data: reservation,
        error:
          reservationError,
      } = await supabase
        .from('reservations')
        .insert({
          restaurant_id:
            RESTAURANT_ID,
          customer_id:
            customer.id,
          table_id:
            primaryTableId,
          reservation_date:
            selectedDate,
          reservation_time:
            selectedTime,
          guests,
          notes:
            customerNotes.trim() ||
            null,
          status:
            'booked',
        })
        .select(
          'id, reservation_date, reservation_time, guests, table_id, status'
        )
        .single()

      if (reservationError) {
        if (created) {
          await supabase
            .from('customers')
            .delete()
            .eq(
              'id',
              customer.id
            )
        }

        throw new Error(
          `Errore creazione prenotazione: ${reservationError.message}`
        )
      }

      const reservationLinks =
        selectedTableIds.map(
          tableId => ({
            reservation_id:
              reservation.id,
            table_id:
              tableId,
          })
        )

      const {
        error: linksError,
      } = await supabase
        .from('reservation_tables')
        .insert(
          reservationLinks
        )

      if (linksError) {
        await supabase
          .from('reservations')
          .delete()
          .eq(
            'id',
            reservation.id
          )

        if (created) {
          await supabase
            .from('customers')
            .delete()
            .eq(
              'id',
              customer.id
            )
        }

        throw new Error(
          `Errore assegnazione tavoli: ${linksError.message}`
        )
      }

      setMessage(
        `✅ Prenotazione salvata: ${name}, ${guests} coperti, ${selectedTableIds.length} tavol${
          selectedTableIds.length === 1
            ? 'o'
            : 'i'
        }, ${formatDateIT(selectedDate)} alle ${selectedTime}.`
      )

      setSelectedTableIds([])

      await loadAvailability()

      setCustomerName('')
      setCustomerPhone('')
      setCustomerEmail('')
      setCustomerNotes('')
      setCustomerVip(false)
    } catch (saveError) {
      const errorMessage =
        saveError instanceof Error
          ? saveError.message
          : 'Errore sconosciuto durante il salvataggio.'

      setError(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  function selectCustomer(
    customer: Customer
  ) {
    setCustomerName(
      customer.full_name
    )

    setCustomerPhone(
      customer.phone || ''
    )

    setCustomerEmail(
      customer.email || ''
    )

    setCustomerNotes(
      customer.notes || ''
    )

    setCustomerVip(
      customer.vip
    )
  }

  /*
   * Dimensione del tavolo in base
   * al numero di coperti.
   */
  function getTableSize(
    seats: number
  ): {
    width: number
    height: number
  } {
    if (seats <= 2) {
      return {
        width: 82,
        height: 64,
      }
    }

    if (seats <= 4) {
      return {
        width: 92,
        height: 68,
      }
    }

    return {
      width: 104,
      height: 74,
    }
  }

  if (loading) {
    return (
      <div
        style={{
          padding: 20,
          color: '#e5e7eb',
        }}
      >
        {onBack && (
          <button
            onClick={onBack}
            style={{
              padding:
                '8px 14px',
              marginBottom: 20,
            }}
          >
            ← Indietro
          </button>
        )}

        <h2>
          Nuova Prenotazione
        </h2>

        <p>
          Caricamento...
        </p>
      </div>
    )
  }

  return (
    <div
      style={{
        padding: 20,
        maxWidth: 1150,
        margin: '0 auto',
        color: '#e5e7eb',
      }}
    >
      {onBack && (
        <button
          onClick={onBack}
          style={{
            padding:
              '8px 14px',
            marginBottom: 20,
          }}
        >
          ← Torna alla Dashboard
        </button>
      )}

      <h2>
        ➕ Nuova Prenotazione
      </h2>

      {/* DATA E ORARIO */}

      <section
        style={{
          border:
            '1px solid #4b5563',
          borderRadius: 10,
          padding: 15,
          marginTop: 20,
          background:
            '#18181b',
        }}
      >
        <h3>
          📅 Data e orario
        </h3>

        <div
          style={{
            display: 'flex',
            gap: 15,
            flexWrap: 'wrap',
            alignItems:
              'flex-end',
          }}
        >
          <div>
            <label>
              Data
            </label>

            <br />

            <ItalianDateInput
              value={selectedDate}
              onChange={handleDateChange}
            />
          </div>

          <div>
            <label>
              Turno
            </label>

            <br />

            <select
              value={shift}
              onChange={e =>
                handleShiftChange(
                  e.target.value as
                    | '1'
                    | '2'
                )
              }
              style={{
                padding: 8,
              }}
            >
              <option value="1">
                Turno 1 — {settings.firstShiftStart} / {settings.firstShiftEnd}
              </option>

              <option value="2">
                Turno 2 — {settings.secondShiftStart} / {settings.secondShiftEnd}
              </option>
            </select>
          </div>

          <div>
            <label>
              Orario
            </label>

            <br />

            <select
              value={
                selectedTime
              }
              onChange={e =>
                handleTimeChange(
                  e.target.value
                )
              }
              style={{
                padding: 8,
              }}
            >
              {availableTimes.map(
                time => (
                  <option
                    key={time}
                    value={time}
                  >
                    {time}
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label>
              Coperti
            </label>

            <br />

            <input
              type="number"
              min="1"
              value={guests}
              onChange={e =>
                handleGuestsChange(
                  Number(
                    e.target.value
                  )
                )
              }
              style={{
                width: 90,
                padding: 8,
              }}
            />
          </div>
        </div>

        <p
          style={{
            marginTop: 15,
            marginBottom: 0,
          }}
        >
          ⏱️ La prenotazione occupa
          il tavolo per{' '}
          <strong>
            1 ora e 30 minuti
          </strong>
          .
        </p>
      </section>

      {/* CLIENTE */}

      <section
        style={{
          border:
            '1px solid #4b5563',
          borderRadius: 10,
          padding: 15,
          marginTop: 20,
          background:
            '#18181b',
        }}
      >
        <h3>
          👤 Cliente
        </h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
          }}
        >
          <div>
            <label>
              Nome *
            </label>

            <br />

            <input
              type="text"
              value={
                customerName
              }
              onChange={e =>
                setCustomerName(
                  e.target.value
                )
              }
              style={{
                width: '100%',
                padding: 8,
                boxSizing:
                  'border-box',
              }}
            />
          </div>

          <div>
            <label>
              Telefono
            </label>

            <br />

            <input
              type="text"
              value={
                customerPhone
              }
              onChange={e =>
                setCustomerPhone(
                  e.target.value
                )
              }
              style={{
                width: '100%',
                padding: 8,
                boxSizing:
                  'border-box',
              }}
            />
          </div>

          <div>
            <label>
              Email
            </label>

            <br />

            <input
              type="email"
              value={
                customerEmail
              }
              onChange={e =>
                setCustomerEmail(
                  e.target.value
                )
              }
              style={{
                width: '100%',
                padding: 8,
                boxSizing:
                  'border-box',
              }}
            />
          </div>
        </div>

        <div
          style={{
            marginTop: 12,
          }}
        >
          <label>
            Note
          </label>

          <br />

          <textarea
            value={
              customerNotes
            }
            onChange={e =>
              setCustomerNotes(
                e.target.value
              )
            }
            rows={3}
            style={{
              width: '100%',
              padding: 8,
              boxSizing:
                'border-box',
            }}
          />
        </div>

        <div
          style={{
            marginTop: 10,
          }}
        >
          <label>
            <input
              type="checkbox"
              checked={
                customerVip
              }
              onChange={e =>
                setCustomerVip(
                  e.target.checked
                )
              }
            />{' '}
            ⭐ Cliente VIP
          </label>
        </div>

        {customerPhone.trim() &&
          customers.filter(
            customer =>
              (
                customer.phone ||
                ''
              ).trim() ===
              customerPhone.trim()
          ).length >
            0 && (
            <div
              style={{
                marginTop: 15,
                padding: 10,
                border:
                  '1px solid #4b5563',
                borderRadius: 6,
              }}
            >
              <strong>
                Cliente già presente
              </strong>

              {customers
                .filter(
                  customer =>
                    (
                      customer.phone ||
                      ''
                    ).trim() ===
                    customerPhone.trim()
                )
                .map(customer => (
                  <div
                    key={
                      customer.id
                    }
                    style={{
                      marginTop: 8,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        selectCustomer(
                          customer
                        )
                      }
                    >
                      Usa{' '}
                      {
                        customer.full_name
                      }
                    </button>
                  </div>
                ))}
            </div>
          )}
      </section>

      {/* SALA */}

      <section
        style={{
          border:
            '1px solid #4b5563',
          borderRadius: 10,
          padding: 15,
          marginTop: 20,
          background:
            '#18181b',
        }}
      >
        <h3>
          🏠 Sala
        </h3>

        <select
          value={
            selectedRoomId
          }
          onChange={e =>
            handleRoomChange(
              e.target.value
            )
          }
          style={{
            padding: 8,
            minWidth: 250,
          }}
        >
          {rooms.map(room => (
            <option
              key={room.id}
              value={room.id}
            >
              {room.room_name}
            </option>
          ))}
        </select>
      </section>

      {/* MAPPA TAVOLI */}

      <section
        style={{
          border:
            '1px solid #4b5563',
          borderRadius: 10,
          padding: 15,
          marginTop: 20,
          background:
            '#18181b',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent:
              'space-between',
            alignItems:
              'center',
            gap: 10,
            flexWrap:
              'wrap',
          }}
        >
          <div>
            <h3
              style={{
                margin:
                  '0 0 5px 0',
              }}
            >
              🪑 Mappa tavoli
            </h3>

            <div
              style={{
                fontSize: 13,
                color: '#9ca3af',
              }}
            >
              {rooms.find(
                room =>
                  room.id ===
                  selectedRoomId
              )?.room_name ||
                'Sala'}
              {' — '}
              {selectedTime}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap:
                'wrap',
            }}
          >
            <button
              type="button"
              onClick={
                autoSelectTables
              }
              disabled={
                loadingAvailability
              }
            >
              ✨ Selezione automatica
            </button>

            <button
              type="button"
              onClick={
                clearSelectedTables
              }
            >
              ✕ Azzera
            </button>
          </div>
        </div>

        {/* LEGENDA */}

        <div
          style={{
            display: 'flex',
            gap: 18,
            flexWrap: 'wrap',
            marginTop: 15,
            padding:
              '10px 12px',
            borderRadius: 8,
            background:
              '#27272a',
            fontSize: 13,
          }}
        >
          <span>
            <span
              style={{
                display:
                  'inline-block',
                width: 12,
                height: 12,
                borderRadius:
                  '50%',
                background:
                  '#22c55e',
                marginRight: 6,
              }}
            />
            Libero
          </span>

          <span>
            <span
              style={{
                display:
                  'inline-block',
                width: 12,
                height: 12,
                borderRadius:
                  '50%',
                background:
                  '#ef4444',
                marginRight: 6,
              }}
            />
            Occupato
          </span>

          <span>
            <span
              style={{
                display:
                  'inline-block',
                width: 12,
                height: 12,
                borderRadius:
                  '50%',
                background:
                  '#2563eb',
                marginRight: 6,
              }}
            />
            Selezionato
          </span>
        </div>

        {loadingAvailability ? (
          <div
            style={{
              marginTop: 20,
              padding: 30,
              textAlign:
                'center',
              color:
                '#9ca3af',
            }}
          >
            🔄 Controllo
            disponibilità...
          </div>
        ) : (
          <>
            {/* CONTENITORE MAPPA */}

            <div
              style={{
                marginTop: 18,
                overflowX:
                  'auto',
                overflowY:
                  'hidden',
                borderRadius: 10,
                border:
                  '1px solid #3f3f46',
                background:
                  '#09090b',
              }}
            >
              <div
                style={{
                  position:
                    'relative',
                  width: 920,
                  height: 600,
                  margin:
                    '0 auto',
                  background:
                    'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
                  backgroundSize:
                    '40px 40px',
                }}
              >
                {/* TITOLO MAPPA */}

                <div
                  style={{
                    position:
                      'absolute',
                    top: 15,
                    left: 20,
                    fontSize: 12,
                    color:
                      '#71717a',
                    fontWeight:
                      'bold',
                    textTransform:
                      'uppercase',
                    letterSpacing:
                      1,
                  }}
                >
                  {
                    rooms.find(
                      room =>
                        room.id ===
                        selectedRoomId
                    )?.room_name
                  }
                </div>

                {/* TAVOLI */}

                {visibleTables.map(
                  table => {
                    const selected =
                      selectedTableIds.includes(
                        table.id
                      )

                    const unavailable =
                      unavailableTableIds.has(
                        table.id
                      )

                    const size =
                      getTableSize(
                        table.seats
                      )

                    let background =
                      '#f8fafc'

                    let borderColor =
                      '#16a34a'

                    let textColor =
                      '#111827'

                    if (
                      unavailable
                    ) {
                      background =
                        '#7f1d1d'
                      borderColor =
                        '#ef4444'
                      textColor =
                        '#ffffff'
                    } else if (
                      selected
                    ) {
                      background =
                        '#1d4ed8'
                      borderColor =
                        '#60a5fa'
                      textColor =
                        '#ffffff'
                    }

                    return (
                      <button
                        key={
                          table.id
                        }
                        type="button"
                        disabled={
                          unavailable
                        }
                        onClick={() =>
                          toggleTable(
                            table.id
                          )
                        }
                        title={
                          unavailable
                            ? `${table.table_name} — Occupato`
                            : `${table.table_name} — ${table.seats} coperti — Libero`
                        }
                        style={{
                          position:
                            'absolute',
                          left:
                            table.pos_x,
                          top:
                            table.pos_y,
                          width:
                            size.width,
                          height:
                            size.height,
                          padding: 6,
                          boxSizing:
                            'border-box',
                          border:
                            `3px solid ${borderColor}`,
                          borderRadius:
                            10,
                          background,
                          color:
                            textColor,
                          cursor:
                            unavailable
                              ? 'not-allowed'
                              : 'pointer',
                          display:
                            'flex',
                          flexDirection:
                            'column',
                          justifyContent:
                            'center',
                          alignItems:
                            'center',
                          transition:
                            'all 0.15s ease',
                          boxShadow:
                            selected
                              ? '0 0 0 3px rgba(37,99,235,0.25)'
                              : '0 2px 8px rgba(0,0,0,0.25)',
                          opacity:
                            unavailable
                              ? 0.85
                              : 1,
                          fontFamily:
                            'inherit',
                        }}
                      >
                        <span
                          style={{
                            fontSize:
                              19,
                            fontWeight:
                              800,
                            lineHeight:
                              1.1,
                            color:
                              textColor,
                          }}
                        >
                          {
                            table.table_name
                          }
                        </span>

                        <span
                          style={{
                            fontSize:
                              12,
                            marginTop: 4,
                            color:
                              textColor,
                            opacity:
                              0.9,
                          }}
                        >
                          {table.seats}{' '}
                          {table.seats ===
                          1
                            ? 'posto'
                            : 'posti'}
                        </span>

                        <span
                          style={{
                            position:
                              'absolute',
                            right: 7,
                            top: 7,
                            width: 10,
                            height: 10,
                            borderRadius:
                              '50%',
                            background:
                              unavailable
                                ? '#ef4444'
                                : selected
                                ? '#93c5fd'
                                : '#22c55e',
                            boxShadow:
                              '0 0 4px rgba(0,0,0,0.35)',
                          }}
                        />
                      </button>
                    )
                  }
                )}

                {visibleTables.length ===
                  0 && (
                  <div
                    style={{
                      position:
                        'absolute',
                      inset: 0,
                      display:
                        'flex',
                      alignItems:
                        'center',
                      justifyContent:
                        'center',
                      color:
                        '#9ca3af',
                    }}
                  >
                    Nessun tavolo
                    disponibile
                    in questa sala.
                  </div>
                )}
              </div>
            </div>

            {/* RIEPILOGO SELEZIONE */}

            <div
              style={{
                marginTop: 18,
                padding: 15,
                border:
                  '1px solid #52525b',
                borderRadius: 10,
                background:
                  '#27272a',
              }}
            >
              <div
                style={{
                  display:
                    'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 12,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      color:
                        '#a1a1aa',
                    }}
                  >
                    TAVOLI
                  </div>

                  <strong
                    style={{
                      fontSize: 17,
                    }}
                  >
                    {selectedTables.length
                      ? selectedTables
                          .map(
                            table =>
                              table.table_name
                          )
                          .join(
                            ', '
                          )
                      : 'Nessuno'}
                  </strong>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 12,
                      color:
                        '#a1a1aa',
                    }}
                  >
                    CAPACITÀ
                  </div>

                  <strong
                    style={{
                      fontSize: 17,
                    }}
                  >
                    {
                      selectedCapacity
                    }{' '}
                    coperti
                  </strong>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 12,
                      color:
                        '#a1a1aa',
                    }}
                  >
                    PRENOTAZIONE
                  </div>

                  <strong
                    style={{
                      fontSize: 17,
                    }}
                  >
                    {guests}{' '}
                    coperti
                  </strong>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 12,
                      color:
                        '#a1a1aa',
                    }}
                  >
                    ORARIO
                  </div>

                  <strong
                    style={{
                      fontSize: 17,
                    }}
                  >
                    {
                      selectedTime
                    }
                  </strong>
                </div>
              </div>

              {remainingGuests >
                0 && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 10,
                    borderRadius: 7,
                    background:
                      '#78350f',
                    color:
                      '#fef3c7',
                    fontWeight:
                      'bold',
                  }}
                >
                  ⚠️ Mancano{' '}
                  {
                    remainingGuests
                  }{' '}
                  coperti
                </div>
              )}

              {selectedCapacity >=
                guests &&
                selectedTableIds.length >
                  0 && (
                <div
                  style={{
                    marginTop: 12,
                    color:
                      '#4ade80',
                    fontWeight:
                      'bold',
                  }}
                >
                  ✅ Capacità
                  sufficiente
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {/* MESSAGGI */}

      {error && (
        <div
          style={{
            marginTop: 20,
            padding: 12,
            borderRadius: 8,
            background:
              '#fee2e2',
            border:
              '1px solid #ef4444',
            color:
              '#991b1b',
            fontWeight:
              'bold',
          }}
        >
          ❌ {error}
        </div>
      )}

      {message && (
        <div
          style={{
            marginTop: 20,
            padding: 12,
            borderRadius: 8,
            background:
              '#dcfce7',
            border:
              '1px solid #22c55e',
            color:
              '#166534',
            fontWeight:
              'bold',
          }}
        >
          {message}
        </div>
      )}

      {/* SALVATAGGIO */}

      <div
        style={{
          marginTop: 25,
          marginBottom: 40,
          display: 'flex',
          gap: 10,
          flexWrap:
            'wrap',
        }}
      >
        <button
          type="button"
          onClick={
            saveReservation
          }
          disabled={
            saving ||
            selectedTableIds.length ===
              0 ||
            selectedCapacity <
              guests
          }
          style={{
            padding:
              '12px 24px',
            fontSize: 16,
            fontWeight:
              'bold',
          }}
        >
          {saving
            ? '💾 Salvataggio...'
            : '💾 Salva Prenotazione'}
        </button>

        {onBack && (
          <button
            type="button"
            onClick={onBack}
            disabled={saving}
            style={{
              padding:
                '12px 20px',
            }}
          >
            Annulla
          </button>
        )}
      </div>
    </div>
  )
}