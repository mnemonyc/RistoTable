import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const RESTAURANT_ID =
  '0153d55d-1f5c-42c9-8da2-4eab40533c4e'

const RESERVATION_DURATION_MINUTES = 90

type Reservation = {
  id: string
  customer_id: string
  table_id: string | null
  reservation_date: string
  reservation_time: string
  guests: number
  notes: string | null
  status: string
}

type Customer = {
  id: string
  full_name: string
  phone: string | null
  email?: string | null
  notes?: string | null
  vip?: boolean
}

type DiningTable = {
  id: string
  room_id: string
  table_name: string
  seats: number
  active: boolean
}

type Room = {
  id: string
  room_name: string
  created_at: string
}

type ReservationTableLink = {
  reservation_id: string
  table_id: string
}

type ReservationComplete =
  Reservation & {
    customer?: Customer
    tables?: DiningTable[]
  }

type AuditRecord = {
  id: number
  reservation_id: string
  action: string
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  actor: string | null
  created_at: string | null
}

type Props = {
  selectedDate: string
}

function parseLocalDateTime(
  date: string,
  time: string
): Date {
  return new Date(
    `${date}T${time.slice(0, 5)}:00`
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

function formatDateForDatabase(
  value: Date
): string {
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

  return {
    from:
      formatDateForDatabase(
        previous
      ),
    to:
      formatDateForDatabase(
        next
      ),
  }
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

function generateTimes(
  startHour: number,
  endHour: number
): string[] {
  const result: string[] = []

  for (
    let hour = startHour;
    hour <= endHour;
    hour++
  ) {
    for (
      let minute = 0;
      minute < 60;
      minute += 15
    ) {
      if (
        hour === endHour &&
        minute > 45
      ) {
        continue
      }

      result.push(
        `${String(hour).padStart(
          2,
          '0'
        )}:${String(minute).padStart(
          2,
          '0'
        )}`
      )
    }
  }

  return result
}

/*
 * ========================================================
 * AUDIT
 * ========================================================
 */

function getAuditActionLabel(
  action: string
): string {
  switch (action) {
    case 'created':
      return 'Prenotazione creata'

    case 'updated':
      return 'Prenotazione modificata'

    case 'table_added':
      return 'Tavolo aggiunto'

    case 'table_removed':
      return 'Tavolo rimosso'

    case 'deleted':
      return 'Prenotazione cancellata'

    default:
      return action
  }
}

function getAuditActionIcon(
  action: string
): string {
  switch (action) {
    case 'created':
      return '🟢'

    case 'updated':
      return '🔵'

    case 'table_added':
      return '🪑'

    case 'table_removed':
      return '🪑'

    case 'deleted':
      return '🔴'

    default:
      return '📌'
  }
}

function getAuditActionColor(
  action: string
): string {
  switch (action) {
    case 'created':
      return '#4ade80'

    case 'updated':
      return '#60a5fa'

    case 'table_added':
      return '#fbbf24'

    case 'table_removed':
      return '#fb923c'

    case 'deleted':
      return '#f87171'

    default:
      return '#cbd5e1'
  }
}

function formatAuditDate(
  value: string | null
): string {
  if (!value) {
    return '-'
  }

  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value
  }

  return date.toLocaleString(
    'it-IT',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }
  )
}

function getAuditValue(
  data:
    | Record<string, unknown>
    | null,
  key: string
): string | null {
  if (!data) {
    return null
  }

  const value =
    data[key]

  if (
    value === undefined ||
    value === null
  ) {
    return null
  }

  return String(value)
}

function renderAuditChanges(
  audit: AuditRecord
) {
  if (
    audit.action !==
    'updated'
  ) {
    return null
  }

  const oldDate =
    getAuditValue(
      audit.old_data,
      'reservation_date'
    )

  const newDate =
    getAuditValue(
      audit.new_data,
      'reservation_date'
    )

  const oldTime =
    getAuditValue(
      audit.old_data,
      'reservation_time'
    )

  const newTime =
    getAuditValue(
      audit.new_data,
      'reservation_time'
    )

  const oldGuests =
    getAuditValue(
      audit.old_data,
      'guests'
    )

  const newGuests =
    getAuditValue(
      audit.new_data,
      'guests'
    )

  const oldStatus =
    getAuditValue(
      audit.old_data,
      'status'
    )

  const newStatus =
    getAuditValue(
      audit.new_data,
      'status'
    )

  const oldCustomer =
    getAuditValue(
      audit.old_data,
      'customer_id'
    )

  const newCustomer =
    getAuditValue(
      audit.new_data,
      'customer_id'
    )

  const oldTable =
    getAuditValue(
      audit.old_data,
      'table_id'
    )

  const newTable =
    getAuditValue(
      audit.new_data,
      'table_id'
    )

  const changes: string[] = []

  if (
    oldDate !== newDate &&
    oldDate &&
    newDate
  ) {
    changes.push(
      `Data: ${oldDate} → ${newDate}`
    )
  }

  if (
    oldTime !== newTime &&
    oldTime &&
    newTime
  ) {
    changes.push(
      `Ora: ${normalizeTime(oldTime)} → ${normalizeTime(newTime)}`
    )
  }

  if (
    oldGuests !== newGuests &&
    oldGuests &&
    newGuests
  ) {
    changes.push(
      `Coperti: ${oldGuests} → ${newGuests}`
    )
  }

  if (
    oldStatus !== newStatus &&
    oldStatus &&
    newStatus
  ) {
    changes.push(
      `Stato: ${oldStatus} → ${newStatus}`
    )
  }

  if (
    oldCustomer !== newCustomer
  ) {
    changes.push(
      'Cliente modificato'
    )
  }

  if (
    oldTable !== newTable
  ) {
    changes.push(
      'Tavolo principale modificato'
    )
  }

  if (
    changes.length === 0
  ) {
    return (
      <div
        style={{
          marginTop: 8,
          color: '#94a3b8',
          fontSize: 13,
        }}
      >
        Modifica registrata nei dati
        della prenotazione.
      </div>
    )
  }

  return (
    <div
      style={{
        marginTop: 10,
        padding: 10,
        borderRadius: 7,
        background: '#0f172a',
        border:
          '1px solid #334155',
      }}
    >
      {changes.map(
        change => (
          <div
            key={change}
            style={{
              color: '#cbd5e1',
              marginBottom: 4,
            }}
          >
            • {change}
          </div>
        )
      )}
    </div>
  )
}

/*
 * ========================================================
 * COMPONENTE
 * ========================================================
 */

export default function ReservationsList({
  selectedDate,
}: Props) {
  const [
    reservations,
    setReservations,
  ] = useState<
    ReservationComplete[]
  >([])

  const [rooms, setRooms] =
    useState<Room[]>([])

  const [tables, setTables] =
    useState<DiningTable[]>([])

  const [customers, setCustomers] =
    useState<Customer[]>([])

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  const [
    editingReservation,
    setEditingReservation,
  ] =
    useState<ReservationComplete | null>(
      null
    )

  const [
    savingEdit,
    setSavingEdit,
  ] = useState(false)

  const [
    editDate,
    setEditDate,
  ] = useState('')

  const [
    editTime,
    setEditTime,
  ] = useState('20:00')

  const [
    editShift,
    setEditShift,
  ] = useState<'1' | '2'>('1')

  const [
    editGuests,
    setEditGuests,
  ] = useState(2)

  const [
    editRoomId,
    setEditRoomId,
  ] = useState('')

  const [
    editTableIds,
    setEditTableIds,
  ] = useState<string[]>([])

  const [
    editCustomerName,
    setEditCustomerName,
  ] = useState('')

  const [
    editCustomerPhone,
    setEditCustomerPhone,
  ] = useState('')

  const [
    editCustomerEmail,
    setEditCustomerEmail,
  ] = useState('')

  const [
    editNotes,
    setEditNotes,
  ] = useState('')

  const [
    editCustomerVip,
    setEditCustomerVip,
  ] = useState(false)

  const [
    editError,
    setEditError,
  ] = useState('')

  const [
    editMessage,
    setEditMessage,
  ] = useState('')

  /*
   * ========================================================
   * DISPONIBILITÀ TAVOLI IN MODIFICA
   * ========================================================
   */

  const [
    editOccupiedTableIds,
    setEditOccupiedTableIds,
  ] = useState<Set<string>>(
    new Set()
  )

  const [
    loadingEditAvailability,
    setLoadingEditAvailability,
  ] = useState(false)

  /*
   * ========================================================
   * AUDIT
   * ========================================================
   */

  const [
    auditReservationId,
    setAuditReservationId,
  ] = useState<string | null>(
    null
  )

  const [
    auditRecords,
    setAuditRecords,
  ] = useState<AuditRecord[]>([])

  const [
    auditLoading,
    setAuditLoading,
  ] = useState(false)

  const [
    auditError,
    setAuditError,
  ] = useState('')

  const shift1Times = useMemo(
    () => generateTimes(20, 21),
    []
  )

  const shift2Times = useMemo(
    () => generateTimes(22, 23),
    []
  )

  const editAvailableTimes =
    editShift === '1'
      ? shift1Times
      : shift2Times

  /*
   * ========================================================
   * CARICAMENTO
   * ========================================================
   */

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    if (!selectedDate) {
      setReservations([])
      setLoading(false)
      return
    }

    loadReservations()
  }, [selectedDate])

  /*
   * Quando cambiano data/orario/sala
   * durante la modifica, ricalcoliamo
   * immediatamente i tavoli occupati.
   */

  useEffect(() => {
    if (
      !editingReservation ||
      !editDate ||
      !editTime ||
      !editRoomId
    ) {
      setEditOccupiedTableIds(
        new Set()
      )
      return
    }

    loadEditAvailability()
  }, [
    editingReservation,
    editDate,
    editTime,
    editRoomId,
  ])

  async function loadInitialData() {
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
          'id, room_id, table_name, seats, active'
        )
        .eq(
          'active',
          true
        ),

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
      console.error(
        'ERRORE SALE:',
        roomsResult.error
      )
    }

    if (tablesResult.error) {
      console.error(
        'ERRORE TAVOLI:',
        tablesResult.error
      )
    }

    if (customersResult.error) {
      console.error(
        'ERRORE CLIENTI:',
        customersResult.error
      )
    }

    const loadedRooms =
      roomsResult.data || []

    const loadedTables =
      sortTables(
        tablesResult.data || []
      )

    /*
     * Mostriamo solamente le sale
     * che hanno almeno un tavolo attivo.
     * In questo modo eventuali vecchie
     * sale vuote non compaiono.
     */

    const activeRoomIds =
      new Set(
        loadedTables.map(
          table =>
            table.room_id
        )
      )

    const visibleRooms =
      loadedRooms.filter(
        room =>
          activeRoomIds.has(
            room.id
          )
      )

    setRooms(
      visibleRooms
    )

    setTables(
      loadedTables
    )

    setCustomers(
      customersResult.data || []
    )
  }

  async function loadReservations() {
    if (!selectedDate) {
      return
    }

    setLoading(true)
    setError('')

    const {
      data: reservationsData,
      error: reservationsError,
    } = await supabase
      .from('reservations')
      .select(
        `
        id,
        customer_id,
        table_id,
        reservation_date,
        reservation_time,
        guests,
        notes,
        status
        `
      )
      .eq(
        'restaurant_id',
        RESTAURANT_ID
      )
      .eq(
        'reservation_date',
        selectedDate
      )
      .order(
        'reservation_time'
      )

    if (reservationsError) {
      console.error(
        'ERRORE PRENOTAZIONI:',
        reservationsError
      )

      setReservations([])

      setError(
        `Errore caricamento prenotazioni: ${reservationsError.message}`
      )

      setLoading(false)

      return
    }

    if (
      !reservationsData ||
      reservationsData.length === 0
    ) {
      setReservations([])
      setLoading(false)
      return
    }

    const customerIds = [
      ...new Set(
        reservationsData.map(
          reservation =>
            reservation.customer_id
        )
      ),
    ]

    const {
      data: customersData,
      error: customersError,
    } = await supabase
      .from('customers')
      .select(
        'id, full_name, phone, email, notes, vip'
      )
      .in(
        'id',
        customerIds
      )

    if (customersError) {
      console.error(
        'ERRORE CLIENTI:',
        customersError
      )
    }

    const reservationIds =
      reservationsData.map(
        reservation =>
          reservation.id
      )

    const {
      data: linksData,
      error: linksError,
    } = await supabase
      .from('reservation_tables')
      .select(
        'reservation_id, table_id'
      )
      .in(
        'reservation_id',
        reservationIds
      )

    if (linksError) {
      console.error(
        'ERRORE RESERVATION_TABLES:',
        linksError
      )
    }

    const reservationTableLinks =
      linksData || []

    const tableIds = [
      ...new Set(
        [
          ...reservationsData.map(
            reservation =>
              reservation.table_id
          ),
          ...reservationTableLinks.map(
            link =>
              link.table_id
          ),
        ].filter(
          (
            tableId
          ): tableId is string =>
            Boolean(tableId)
        )
      ),
    ]

    let tablesData:
      DiningTable[] = []

    if (
      tableIds.length > 0
    ) {
      const {
        data,
        error: tablesError,
      } = await supabase
        .from('dining_tables')
        .select(
          'id, room_id, table_name, seats, active'
        )
        .in(
          'id',
          tableIds
        )

      if (tablesError) {
        console.error(
          'ERRORE TAVOLI:',
          tablesError
        )
      }

      tablesData =
        data || []
    }

    const customersMap =
      new Map(
        (
          customersData || []
        ).map(
          customer => [
            customer.id,
            customer,
          ]
        )
      )

    const tablesMap =
      new Map(
        tablesData.map(
          table => [
            table.id,
            table,
          ]
        )
      )

    const completeReservations =
      reservationsData.map(
        reservation => {
          const linkedTableIds =
            reservationTableLinks
              .filter(
                link =>
                  link.reservation_id ===
                  reservation.id
              )
              .map(
                link =>
                  link.table_id
              )

          const allTableIds = [
            ...linkedTableIds,
          ]

          if (
            reservation.table_id &&
            !allTableIds.includes(
              reservation.table_id
            )
          ) {
            allTableIds.push(
              reservation.table_id
            )
          }

          const reservationTables =
            allTableIds
              .map(
                tableId =>
                  tablesMap.get(
                    tableId
                  )
              )
              .filter(
                (
                  table
                ): table is DiningTable =>
                  Boolean(table)
              )

          return {
            ...reservation,

            customer:
              customersMap.get(
                reservation.customer_id
              ),

            tables:
              reservationTables,
          }
        }
      )

    setReservations(
      completeReservations
    )

    setLoading(false)
  }

  /*
   * ========================================================
   * DISPONIBILITÀ TAVOLI IN MODIFICA
   * ========================================================
   */

  async function loadEditAvailability() {
    if (
      !editingReservation ||
      !editDate ||
      !editTime ||
      !editRoomId
    ) {
      return
    }

    setLoadingEditAvailability(
      true
    )

    try {
      const conflicting =
        await getConflictingTableIds(
          editingReservation.id,
          editDate,
          editTime
        )

      setEditOccupiedTableIds(
        conflicting
      )

      /*
       * Se uno dei tavoli precedentemente
       * selezionati è diventato occupato,
       * lo togliamo dalla selezione.
       *
       * In questo modo non è possibile
       * salvare accidentalmente una
       * tavolata su un tavolo occupato.
       */

      setEditTableIds(
        previous =>
          previous.filter(
            id =>
              !conflicting.has(id)
          )
      )
    } catch (availabilityError) {
      console.error(
        'ERRORE DISPONIBILITÀ MODIFICA:',
        availabilityError
      )

      setEditOccupiedTableIds(
        new Set()
      )
    } finally {
      setLoadingEditAvailability(
        false
      )
    }
  }

  /*
   * ========================================================
   * STORICO
   * ========================================================
   */

  async function loadAudit(
    reservationId: string
  ) {
    if (
      auditReservationId ===
      reservationId
    ) {
      setAuditReservationId(null)
      setAuditRecords([])
      setAuditError('')
      return
    }

    setAuditReservationId(
      reservationId
    )

    setAuditRecords([])
    setAuditError('')
    setAuditLoading(true)

    const {
      data,
      error,
    } = await supabase
      .from('reservation_history')
      .select(
        `
        id,
        reservation_id,
        action,
        old_data,
        new_data,
        actor,
        created_at
        `
      )
      .eq(
        'reservation_id',
        reservationId
      )
      .order(
        'created_at',
        {
          ascending: false,
        }
      )

    if (error) {
      console.error(
        'ERRORE STORICO PRENOTAZIONE:',
        error
      )

      setAuditError(
        `Errore caricamento storico: ${error.message}`
      )

      setAuditLoading(false)

      return
    }

    setAuditRecords(
      (data || []) as AuditRecord[]
    )

    setAuditLoading(false)
  }

  function closeAudit() {
    setAuditReservationId(null)
    setAuditRecords([])
    setAuditError('')
  }

  /*
   * ========================================================
   * MODIFICA PRENOTAZIONE
   * ========================================================
   */

  function openEdit(
    reservation: ReservationComplete
  ) {
    const firstTable =
      reservation.tables?.[0]

    const roomId =
      firstTable?.room_id ||
      ''

    const time =
      normalizeTime(
        reservation.reservation_time
      )

    setEditingReservation(
      reservation
    )

    setEditDate(
      reservation.reservation_date
    )

    setEditTime(time)

    setEditShift(
      time >= '22:00'
        ? '2'
        : '1'
    )

    setEditGuests(
      reservation.guests
    )

    setEditRoomId(
      roomId
    )

    setEditTableIds(
      reservation.tables?.map(
        table => table.id
      ) || []
    )

    setEditCustomerName(
      reservation.customer
        ?.full_name || ''
    )

    setEditCustomerPhone(
      reservation.customer
        ?.phone || ''
    )

    setEditCustomerEmail(
      reservation.customer
        ?.email || ''
    )

    setEditNotes(
      reservation.notes ||
        reservation.customer
          ?.notes ||
        ''
    )

    setEditCustomerVip(
      Boolean(
        reservation.customer?.vip
      )
    )

    setEditOccupiedTableIds(
      new Set()
    )

    setEditError('')
    setEditMessage('')

    closeAudit()

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  function closeEdit() {
    if (savingEdit) {
      return
    }

    setEditingReservation(null)
    setEditError('')
    setEditMessage('')
    setEditOccupiedTableIds(
      new Set()
    )
  }

  const editVisibleTables =
    useMemo(() => {
      if (!editRoomId) {
        return []
      }

      return sortTables(
        tables.filter(
          table =>
            table.room_id ===
            editRoomId
        )
      )
    }, [
      tables,
      editRoomId,
    ])

  function toggleEditTable(
    tableId: string
  ) {
    if (
      editOccupiedTableIds.has(
        tableId
      )
    ) {
      return
    }

    setEditTableIds(
      previous => {
        if (
          previous.includes(
            tableId
          )
        ) {
          return previous.filter(
            id =>
              id !== tableId
          )
        }

        return [
          ...previous,
          tableId,
        ]
      }
    )
  }

  function handleEditRoomChange(
    roomId: string
  ) {
    setEditRoomId(roomId)
    setEditTableIds([])
    setEditOccupiedTableIds(
      new Set()
    )
  }

  function handleEditShiftChange(
    value: '1' | '2'
  ) {
    setEditShift(value)

    const firstTime =
      value === '1'
        ? shift1Times[0]
        : shift2Times[0]

    setEditTime(firstTime)
  }

  function getEditSelectedTables(): DiningTable[] {
    return tables.filter(
      table =>
        editTableIds.includes(
          table.id
        )
    )
  }

  function getEditSelectedCapacity(): number {
    return getEditSelectedTables().reduce(
      (
        total,
        table
      ) =>
        total + table.seats,
      0
    )
  }

  /*
   * ========================================================
   * CONTROLLO CONFLITTI
   * ========================================================
   */

  async function getConflictingTableIds(
    reservationId: string,
    date: string,
    time: string
  ): Promise<Set<string>> {
    const range =
      getReservationDateRange(
        date
      )

    const {
      data: reservationData,
      error: reservationError,
    } = await supabase
      .from('reservations')
      .select(
        `
        id,
        reservation_date,
        reservation_time,
        table_id,
        status
        `
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
      .neq(
        'id',
        reservationId
      )

    if (reservationError) {
      throw new Error(
        `Errore controllo disponibilità: ${reservationError.message}`
      )
    }

    const loadedReservations =
      reservationData || []

    const reservationIds =
      loadedReservations.map(
        reservation =>
          reservation.id
      )

    let links:
      ReservationTableLink[] =
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
          `Errore controllo tavoli: ${linkError.message}`
        )
      }

      links =
        linkData || []
    }

    const requestedStart =
      parseLocalDateTime(
        date,
        time
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
        loadedReservations
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

      links
        .filter(
          link =>
            link.reservation_id ===
            reservation.id
        )
        .forEach(
          link =>
            conflicting.add(
              link.table_id
            )
        )

      if (
        reservation.table_id
      ) {
        conflicting.add(
          reservation.table_id
        )
      }
    }

    return conflicting
  }

  /*
   * ========================================================
   * CLIENTE
   * ========================================================
   */

  async function findOrCreateCustomer(): Promise<Customer> {
    const name =
      editCustomerName.trim()

    const phone =
      editCustomerPhone.trim()

    const email =
      editCustomerEmail.trim()

    const notes =
      editNotes.trim()

    if (!name) {
      throw new Error(
        'Inserisci il nome del cliente.'
      )
    }

    let existingCustomer:
      Customer | null =
      null

    if (phone) {
      existingCustomer =
        customers.find(
          customer =>
            (
              customer.phone ||
              ''
            ).trim() ===
            phone
        ) || null
    }

    if (existingCustomer) {
      const {
        data,
        error,
      } = await supabase
        .from('customers')
        .update({
          full_name:
            name,
          phone:
            phone || null,
          email:
            email || null,
          notes:
            notes || null,
          vip:
            editCustomerVip,
        })
        .eq(
          'id',
          existingCustomer.id
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

      return data
    }

    const {
      data,
      error,
    } = await supabase
      .from('customers')
      .insert({
        restaurant_id:
          RESTAURANT_ID,
        full_name:
          name,
        phone:
          phone || null,
        email:
          email || null,
        notes:
          notes || null,
        vip:
          editCustomerVip,
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

    return data
  }

  /*
   * ========================================================
   * SALVATAGGIO MODIFICA
   * ========================================================
   */

  async function saveEdit() {
    if (
      !editingReservation
    ) {
      return
    }

    setSavingEdit(true)
    setEditError('')
    setEditMessage('')

    try {
      if (!editDate) {
        throw new Error(
          'Inserisci la data della prenotazione.'
        )
      }

      if (!editTime) {
        throw new Error(
          'Inserisci l’orario della prenotazione.'
        )
      }

      if (
        editGuests < 1
      ) {
        throw new Error(
          'Il numero di coperti deve essere almeno 1.'
        )
      }

      if (
        editTableIds.length ===
        0
      ) {
        throw new Error(
          'Seleziona almeno un tavolo.'
        )
      }

      /*
       * Secondo controllo definitivo
       * direttamente prima del salvataggio.
       */

      const conflicting =
        await getConflictingTableIds(
          editingReservation.id,
          editDate,
          editTime
        )

      const conflicts =
        editTableIds.filter(
          id =>
            conflicting.has(id)
        )

      if (
        conflicts.length > 0
      ) {
        const names =
          tables
            .filter(
              table =>
                conflicts.includes(
                  table.id
                )
            )
            .map(
              table =>
                table.table_name
            )

        throw new Error(
          `I seguenti tavoli risultano occupati nel nuovo orario: ${names.join(
            ', '
          )}.`
        )
      }

      const selectedTables =
        getEditSelectedTables()

      const selectedCapacity =
        selectedTables.reduce(
          (
            total,
            table
          ) =>
            total +
            table.seats,
          0
        )

      if (
        selectedCapacity <
        editGuests
      ) {
        throw new Error(
          `I tavoli selezionati hanno ${selectedCapacity} coperti disponibili, ma la prenotazione richiede ${editGuests} coperti.`
        )
      }

      const roomIds =
        Array.from(
          new Set(
            selectedTables.map(
              table =>
                table.room_id
            )
          )
        )

      if (
        roomIds.length !==
        1
      ) {
        throw new Error(
          'I tavoli di una stessa prenotazione devono appartenere alla stessa sala.'
        )
      }

      if (
        roomIds[0] !==
        editRoomId
      ) {
        throw new Error(
          'I tavoli selezionati non appartengono alla sala scelta.'
        )
      }

      const customer =
        await findOrCreateCustomer()

      const primaryTableId =
        editTableIds[0]

      const {
        error:
          reservationUpdateError,
      } = await supabase
        .from('reservations')
        .update({
          customer_id:
            customer.id,
          table_id:
            primaryTableId,
          reservation_date:
            editDate,
          reservation_time:
            editTime,
          guests:
            editGuests,
          notes:
            editNotes.trim() ||
            null,
        })
        .eq(
          'id',
          editingReservation.id
        )

      if (
        reservationUpdateError
      ) {
        throw new Error(
          `Errore modifica prenotazione: ${reservationUpdateError.message}`
        )
      }

      const {
        error:
          deleteLinksError,
      } = await supabase
        .from('reservation_tables')
        .delete()
        .eq(
          'reservation_id',
          editingReservation.id
        )

      if (
        deleteLinksError
      ) {
        throw new Error(
          `Errore aggiornamento tavoli: ${deleteLinksError.message}`
        )
      }

      const newLinks =
        editTableIds.map(
          tableId => ({
            reservation_id:
              editingReservation.id,
            table_id:
              tableId,
          })
        )

      const {
        error:
          insertLinksError,
      } = await supabase
        .from('reservation_tables')
        .insert(
          newLinks
        )

      if (
        insertLinksError
      ) {
        throw new Error(
          `Errore assegnazione nuovi tavoli: ${insertLinksError.message}`
        )
      }

      setEditMessage(
        '✅ Prenotazione modificata correttamente.'
      )

      await loadReservations()

      setCustomers(
        previous => {
          const exists =
            previous.some(
              item =>
                item.id ===
                customer.id
            )

          if (!exists) {
            return [
              ...previous,
              customer,
            ]
          }

          return previous.map(
            item =>
              item.id ===
              customer.id
                ? customer
                : item
          )
        }
      )

      setEditingReservation(
        null
      )

      closeAudit()
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : 'Errore sconosciuto durante la modifica.'

      setEditError(message)
    } finally {
      setSavingEdit(false)
    }
  }

  const selectedCapacity =
    getEditSelectedCapacity()

  return (
    <div
      style={{
        color: '#f1f5f9',
        width: '100%',
      }}
    >
      <div
        style={{
          background:
            '#111827',
          border:
            '1px solid #374151',
          borderRadius: 12,
          padding: '14px 18px',
          marginBottom: 18,
        }}
      >
        <h2
          style={{
            margin: 0,
            color: '#f8fafc',
            fontSize: 20,
          }}
        >
          📋 Prenotazioni del{' '}
          {selectedDate}
        </h2>
      </div>

      {error && (
        <div
          style={{
            marginBottom: 15,
            padding: 14,
            borderRadius: 8,
            background:
              '#450a0a',
            border:
              '1px solid #ef4444',
            color:
              '#fecaca',
            fontWeight:
              'bold',
          }}
        >
          ❌ {error}
        </div>
      )}

      {editingReservation && (
        <section
          style={{
            border:
              '1px solid #3b82f6',
            borderRadius: 12,
            padding: 20,
            marginBottom: 25,
            background:
              '#111827',
            boxShadow:
              '0 8px 30px rgba(0,0,0,0.35)',
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
            <h2
              style={{
                marginTop: 0,
                marginBottom: 0,
                color: '#f8fafc',
              }}
            >
              ✏️ Modifica prenotazione
            </h2>

            <button
              type="button"
              onClick={
                closeEdit
              }
              disabled={
                savingEdit
              }
              style={{
                background:
                  '#374151',
                color:
                  '#f9fafb',
                border:
                  '1px solid #6b7280',
                borderRadius: 6,
                padding:
                  '7px 12px',
                cursor:
                  'pointer',
              }}
            >
              ✕ Chiudi
            </button>
          </div>

          <div
            style={{
              padding: 12,
              marginTop: 15,
              marginBottom: 18,
              borderRadius: 8,
              background:
                '#172554',
              border:
                '1px solid #2563eb',
              color:
                '#dbeafe',
            }}
          >
            Stai modificando la
            prenotazione di{' '}
            <strong>
              {
                editingReservation
                  .customer
                  ?.full_name
              }
            </strong>
            .
          </div>

          <h3
            style={{
              color: '#93c5fd',
            }}
          >
            📅 Data e orario
          </h3>

          <div
            style={{
              display: 'flex',
              gap: 15,
              flexWrap:
                'wrap',
              alignItems:
                'flex-end',
            }}
          >
            <div>
              <label>Data</label>
              <br />

              <input
                type="date"
                value={
                  editDate
                }
                onChange={e =>
                  setEditDate(
                    e.target.value
                  )
                }
                style={{
                  ...inputStyle,
                  width: 145,
                }}
              />
            </div>

            <div>
              <label>Turno</label>
              <br />

              <select
                value={
                  editShift
                }
                onChange={e =>
                  handleEditShiftChange(
                    e.target
                      .value as
                      | '1'
                      | '2'
                  )
                }
                style={
                  selectStyle
                }
              >
                <option value="1">
                  Turno 1 — 20:00 / 22:00
                </option>

                <option value="2">
                  Turno 2 — 22:00 / 24:00
                </option>
              </select>
            </div>

            <div>
              <label>Orario</label>
              <br />

              <select
                value={
                  editTime
                }
                onChange={e =>
                  setEditTime(
                    e.target
                      .value
                  )
                }
                style={
                  selectStyle
                }
              >
                {editAvailableTimes.map(
                  time => (
                    <option
                      key={
                        time
                      }
                      value={
                        time
                      }
                    >
                      {time}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label>Coperti</label>
              <br />

              <input
                type="number"
                min="1"
                value={
                  editGuests
                }
                onChange={e =>
                  setEditGuests(
                    Math.max(
                      1,
                      Number(
                        e.target
                          .value
                      ) || 1
                    )
                  )
                }
                style={{
                  ...inputStyle,
                  width: 80,
                }}
              />
            </div>
          </div>

          <p
            style={{
              color: '#94a3b8',
            }}
          >
            ⏱️ Durata prenotazione:{' '}
            <strong
              style={{
                color: '#e2e8f0',
              }}
            >
              1 ora e 30 minuti
            </strong>
          </p>

          <hr
            style={{
              border:
                'none',
              borderTop:
                '1px solid #374151',
              margin:
                '20px 0',
            }}
          />

          <h3
            style={{
              color: '#c4b5fd',
            }}
          >
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
            <DarkInput
              label="Nome *"
              value={
                editCustomerName
              }
              onChange={
                setEditCustomerName
              }
            />

            <DarkInput
              label="Telefono"
              value={
                editCustomerPhone
              }
              onChange={
                setEditCustomerPhone
              }
            />

            <DarkInput
              label="Email"
              type="email"
              value={
                editCustomerEmail
              }
              onChange={
                setEditCustomerEmail
              }
            />
          </div>

          <div
            style={{
              marginTop: 12,
            }}
          >
            <label>Note</label>
            <br />

            <textarea
              value={
                editNotes
              }
              onChange={e =>
                setEditNotes(
                  e.target.value
                )
              }
              rows={3}
              style={{
                ...inputStyle,
                width:
                  '100%',
                resize:
                  'vertical',
                boxSizing:
                  'border-box',
              }}
            />
          </div>

          <div
            style={{
              marginTop: 12,
            }}
          >
            <label
              style={{
                cursor:
                  'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={
                  editCustomerVip
                }
                onChange={e =>
                  setEditCustomerVip(
                    e.target
                      .checked
                  )
                }
              />{' '}
              ⭐ Cliente VIP
            </label>
          </div>

          <hr
            style={{
              border:
                'none',
              borderTop:
                '1px solid #374151',
              margin:
                '20px 0',
            }}
          />

          <h3
            style={{
              color: '#fbbf24',
            }}
          >
            🏠 Sala
          </h3>

          <select
            value={
              editRoomId
            }
            onChange={e =>
              handleEditRoomChange(
                e.target.value
              )
            }
            style={{
              ...selectStyle,
              minWidth: 250,
            }}
          >
            {rooms.map(
              room => (
                <option
                  key={
                    room.id
                  }
                  value={
                    room.id
                  }
                >
                  {
                    room.room_name
                  }
                </option>
              )
            )}
          </select>

          <h3
            style={{
              marginTop: 25,
              color: '#fb923c',
            }}
          >
            🪑 Tavoli
          </h3>

          <div
            style={{
              padding: 10,
              marginBottom: 12,
              borderRadius: 8,
              background:
                '#1f2937',
              border:
                '1px solid #374151',
              color:
                '#cbd5e1',
              fontSize: 13,
            }}
          >
            Seleziona uno o più tavoli.
            <br />

            <span
              style={{
                color:
                  '#60a5fa',
              }}
            >
              🔵 Selezionato
            </span>

            {' · '}

            <span
              style={{
                color:
                  '#4ade80',
              }}
            >
              🟢 Disponibile
            </span>

            {' · '}

            <span
              style={{
                color:
                  '#f87171',
              }}
            >
              🔴 Occupato
            </span>

            {loadingEditAvailability && (
              <div
                style={{
                  marginTop: 8,
                  color:
                    '#fbbf24',
                }}
              >
                ⏳ Controllo
                disponibilità...
              </div>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fill, minmax(115px, 1fr))',
              gap: 10,
            }}
          >
            {editVisibleTables.map(
              table => {
                const selected =
                  editTableIds.includes(
                    table.id
                  )

                const occupied =
                  editOccupiedTableIds.has(
                    table.id
                  )

                return (
                  <button
                    key={
                      table.id
                    }
                    type="button"
                    disabled={
                      occupied
                    }
                    onClick={() =>
                      toggleEditTable(
                        table.id
                      )
                    }
                    style={{
                      minHeight:
                        95,
                      padding:
                        '10px 6px',
                      border:
                        selected
                          ? '2px solid #3b82f6'
                          : occupied
                            ? '2px solid #ef4444'
                            : '1px solid #4b5563',
                      borderRadius:
                        9,
                      background:
                        selected
                          ? '#172554'
                          : occupied
                            ? '#450a0a'
                            : '#1f2937',
                      color:
                        '#f8fafc',
                      cursor:
                        occupied
                          ? 'not-allowed'
                          : 'pointer',
                      opacity:
                        occupied
                          ? 0.72
                          : 1,
                      boxShadow:
                        selected
                          ? '0 0 0 1px rgba(59,130,246,0.25)'
                          : 'none',
                    }}
                  >
                    <strong
                      style={{
                        display:
                          'block',
                        fontSize:
                          17,
                      }}
                    >
                      {
                        table.table_name
                      }
                    </strong>

                    <span
                      style={{
                        display:
                          'block',
                        marginTop:
                          4,
                        color:
                          '#cbd5e1',
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
                        display:
                          'block',
                        marginTop:
                          6,
                        fontSize:
                          10,
                        fontWeight:
                          'bold',
                        color:
                          selected
                            ? '#60a5fa'
                            : occupied
                              ? '#f87171'
                              : '#4ade80',
                      }}
                    >
                      {selected
                        ? '🔵 SELEZIONATO'
                        : occupied
                          ? '🔴 OCCUPATO'
                          : '🟢 DISPONIBILE'}
                    </span>
                  </button>
                )
              }
            )}
          </div>

          <div
            style={{
              marginTop: 15,
              padding: 15,
              border:
                '1px solid #374151',
              borderRadius: 9,
              background:
                '#0f172a',
            }}
          >
            <strong
              style={{
                color:
                  '#f8fafc',
              }}
            >
              Selezione
            </strong>

            <div
              style={{
                marginTop: 8,
                color:
                  '#cbd5e1',
              }}
            >
              Tavoli:{' '}
              <strong
                style={{
                  color:
                    '#f8fafc',
                }}
              >
                {getEditSelectedTables()
                  .map(
                    table =>
                      table.table_name
                  )
                  .join(
                    ' + '
                  ) ||
                  'nessuno'}
              </strong>
            </div>

            <div
              style={{
                marginTop: 4,
                color:
                  '#cbd5e1',
              }}
            >
              Capacità totale:{' '}
              <strong
                style={{
                  color:
                    '#4ade80',
                }}
              >
                {
                  selectedCapacity
                }
              </strong>{' '}
              coperti
            </div>

            <div
              style={{
                marginTop: 4,
                color:
                  '#cbd5e1',
              }}
            >
              Prenotazione:{' '}
              <strong
                style={{
                  color:
                    '#f8fafc',
                }}
              >
                {editGuests}
              </strong>{' '}
              coperti
            </div>

            {selectedCapacity <
              editGuests && (
              <div
                style={{
                  marginTop: 10,
                  padding: 8,
                  borderRadius: 6,
                  background:
                    '#451a03',
                  color:
                    '#fdba74',
                  fontWeight:
                    'bold',
                }}
              >
                ⚠️ Capacità
                insufficiente
              </div>
            )}

            {selectedCapacity >=
              editGuests &&
              editTableIds.length >
                0 && (
                <div
                  style={{
                    marginTop: 10,
                    padding: 8,
                    borderRadius: 6,
                    background:
                      '#052e16',
                    color:
                      '#86efac',
                    fontWeight:
                      'bold',
                  }}
                >
                  ✅ Capacità
                  sufficiente
                </div>
              )}
          </div>

          {editError && (
            <div
              style={{
                marginTop: 15,
                padding: 12,
                borderRadius: 7,
                background:
                  '#450a0a',
                border:
                  '1px solid #ef4444',
                color:
                  '#fecaca',
                fontWeight:
                  'bold',
              }}
            >
              ❌ {editError}
            </div>
          )}

          {editMessage && (
            <div
              style={{
                marginTop: 15,
                padding: 12,
                borderRadius: 7,
                background:
                  '#052e16',
                border:
                  '1px solid #22c55e',
                color:
                  '#bbf7d0',
                fontWeight:
                  'bold',
              }}
            >
              {editMessage}
            </div>
          )}

          <div
            style={{
              marginTop: 20,
              display: 'flex',
              gap: 10,
              flexWrap:
                'wrap',
            }}
          >
            <button
              type="button"
              onClick={
                saveEdit
              }
              disabled={
                savingEdit ||
                loadingEditAvailability ||
                !editCustomerName.trim() ||
                editTableIds.length ===
                  0 ||
                selectedCapacity <
                  editGuests
              }
              style={{
                padding:
                  '12px 22px',
                fontSize: 15,
                fontWeight:
                  'bold',
                border:
                  '1px solid #2563eb',
                borderRadius: 7,
                background:
                  '#2563eb',
                color:
                  '#ffffff',
                cursor:
                  'pointer',
                opacity:
                  savingEdit ||
                  loadingEditAvailability
                    ? 0.65
                    : 1,
              }}
            >
              {savingEdit
                ? '💾 Salvataggio...'
                : '💾 Salva modifiche'}
            </button>

            <button
              type="button"
              onClick={
                closeEdit
              }
              disabled={
                savingEdit
              }
              style={{
                padding:
                  '12px 20px',
                border:
                  '1px solid #4b5563',
                borderRadius: 7,
                background:
                  '#374151',
                color:
                  '#ffffff',
                cursor:
                  'pointer',
              }}
            >
              Annulla
            </button>
          </div>
        </section>
      )}

      {loading ? (
        <div
          style={{
            padding: 25,
            textAlign:
              'center',
            color:
              '#94a3b8',
          }}
        >
          ⏳ Caricamento
          prenotazioni...
        </div>
      ) : reservations.length ===
        0 ? (
        <div
          style={{
            padding: 25,
            borderRadius: 10,
            background:
              '#111827',
            border:
              '1px solid #374151',
            color:
              '#94a3b8',
            textAlign:
              'center',
          }}
        >
          Nessuna prenotazione
          per questa giornata.
        </div>
      ) : (
        <div
          style={{
            overflowX:
              'auto',
            borderRadius: 10,
            border:
              '1px solid #374151',
            background:
              '#111827',
          }}
        >
          <table
            style={{
              borderCollapse:
                'collapse',
              width: '100%',
              minWidth:
                1000,
              color:
                '#e5e7eb',
            }}
          >
            <thead>
              <tr
                style={{
                  background:
                    '#1f2937',
                }}
              >
                {[
                  'Data',
                  'Ora',
                  'Nome e cognome',
                  'Telefono',
                  'Tavolo',
                  'Coperti',
                  'Note',
                  'Stato',
                  'Azioni',
                ].map(
                  title => (
                    <th
                      key={
                        title
                      }
                      style={{
                        padding:
                          10,
                        borderBottom:
                          '1px solid #4b5563',
                        color:
                          '#93c5fd',
                        textAlign:
                          'left',
                        whiteSpace:
                          'nowrap',
                      }}
                    >
                      {title}
                    </th>
                  )
                )}
              </tr>
            </thead>

            <tbody>
              {reservations.map(
                reservation => (
                  <>
                    <tr
                      key={
                        reservation.id
                      }
                      style={{
                        background:
                          '#111827',
                      }}
                    >
                      <td
                        style={
                          cellStyle
                        }
                      >
                        {
                          reservation.reservation_date
                        }
                      </td>

                      <td
                        style={{
                          ...cellStyle,
                          fontWeight:
                            'bold',
                          color:
                            '#fbbf24',
                        }}
                      >
                        {
                          reservation.reservation_time
                        }
                      </td>

                      <td
                        style={{
                          ...cellStyle,
                          fontWeight:
                            'bold',
                          color:
                            '#f8fafc',
                        }}
                      >
                        {reservation
                          .customer
                          ?.full_name ||
                          'Cliente non trovato'}
                      </td>

                      <td
                        style={
                          cellStyle
                        }
                      >
                        {reservation
                          .customer
                          ?.phone ||
                          '-'}
                      </td>

                      <td
                        style={{
                          ...cellStyle,
                          color:
                            '#60a5fa',
                        }}
                      >
                        {reservation.tables &&
                        reservation.tables
                          .length >
                          0 ? (
                          <strong>
                            {reservation.tables
                              .map(
                                table =>
                                  table.table_name
                              )
                              .join(
                                ' + '
                              )}
                          </strong>
                        ) : (
                          'Tavolo non trovato'
                        )}
                      </td>

                      <td
                        style={{
                          ...cellStyle,
                          fontWeight:
                            'bold',
                        }}
                      >
                        {
                          reservation.guests
                        }
                      </td>

                      <td
                        style={{
                          ...cellStyle,
                          color:
                            '#cbd5e1',
                          maxWidth:
                            220,
                        }}
                      >
                        {reservation
                          .notes ||
                          '-'}
                      </td>

                      <td
                        style={
                          cellStyle
                        }
                      >
                        <span
                          style={{
                            display:
                              'inline-block',
                            padding:
                              '4px 8px',
                            borderRadius:
                              5,
                            background:
                              reservation.status ===
                              'cancelled'
                                ? '#450a0a'
                                : '#052e16',
                            color:
                              reservation.status ===
                              'cancelled'
                                ? '#fca5a5'
                                : '#86efac',
                            fontSize:
                              12,
                            fontWeight:
                              'bold',
                          }}
                        >
                          {
                            reservation.status
                          }
                        </span>
                      </td>

                      <td
                        style={
                          cellStyle
                        }
                      >
                        <div
                          style={{
                            display:
                              'flex',
                            gap: 7,
                            flexWrap:
                              'wrap',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              openEdit(
                                reservation
                              )
                            }
                            style={{
                              padding:
                                '7px 11px',
                              border:
                                '1px solid #3b82f6',
                              borderRadius:
                                6,
                              background:
                                '#172554',
                              color:
                                '#93c5fd',
                              cursor:
                                'pointer',
                              whiteSpace:
                                'nowrap',
                            }}
                          >
                            ✏️ Modifica
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              loadAudit(
                                reservation.id
                              )
                            }
                            style={{
                              padding:
                                '7px 11px',
                              border:
                                auditReservationId ===
                                reservation.id
                                  ? '1px solid #60a5fa'
                                  : '1px solid #6b7280',
                              borderRadius:
                                6,
                              background:
                                auditReservationId ===
                                reservation.id
                                  ? '#1e3a8a'
                                  : '#374151',
                              color:
                                '#ffffff',
                              cursor:
                                'pointer',
                              whiteSpace:
                                'nowrap',
                            }}
                          >
                            🔎 Storico
                          </button>
                        </div>
                      </td>
                    </tr>

                    {auditReservationId ===
                      reservation.id && (
                      <tr
                        key={`${reservation.id}-audit`}
                        style={{
                          background:
                            '#0f172a',
                        }}
                      >
                        <td
                          colSpan={
                            9
                          }
                          style={{
                            padding:
                              0,
                            borderBottom:
                              '1px solid #374151',
                          }}
                        >
                          <div
                            style={{
                              padding:
                                18,
                              borderTop:
                                '1px solid #1e3a5f',
                            }}
                          >
                            <div
                              style={{
                                display:
                                  'flex',
                                justifyContent:
                                  'space-between',
                                alignItems:
                                  'center',
                                gap: 10,
                                flexWrap:
                                  'wrap',
                                marginBottom:
                                  15,
                              }}
                            >
                              <div>
                                <h3
                                  style={{
                                    margin:
                                      0,
                                    color:
                                      '#f8fafc',
                                  }}
                                >
                                  🔎 Storico prenotazione
                                </h3>

                                <div
                                  style={{
                                    marginTop:
                                      5,
                                    color:
                                      '#94a3b8',
                                    fontSize:
                                      13,
                                  }}
                                >
                                  {reservation
                                    .customer
                                    ?.full_name ||
                                    'Cliente non trovato'}{' '}
                                  ·{' '}
                                  {reservation.reservation_date}{' '}
                                  ·{' '}
                                  {normalizeTime(
                                    reservation.reservation_time
                                  )}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={
                                  closeAudit
                                }
                                style={{
                                  padding:
                                    '6px 11px',
                                  border:
                                    '1px solid #4b5563',
                                  borderRadius:
                                    6,
                                  background:
                                    '#1f2937',
                                  color:
                                    '#e5e7eb',
                                  cursor:
                                    'pointer',
                                }}
                              >
                                ✕ Chiudi storico
                              </button>
                            </div>

                            {auditLoading ? (
                              <div
                                style={{
                                  padding:
                                    20,
                                  textAlign:
                                    'center',
                                  color:
                                    '#94a3b8',
                                }}
                              >
                                ⏳ Caricamento
                                storico...
                              </div>
                            ) : auditError ? (
                              <div
                                style={{
                                  padding:
                                    12,
                                  borderRadius:
                                    7,
                                  background:
                                    '#450a0a',
                                  border:
                                    '1px solid #ef4444',
                                  color:
                                    '#fecaca',
                                  fontWeight:
                                    'bold',
                                }}
                              >
                                ❌{' '}
                                {
                                  auditError
                                }
                              </div>
                            ) : auditRecords.length ===
                              0 ? (
                              <div
                                style={{
                                  padding:
                                    15,
                                  borderRadius:
                                    8,
                                  background:
                                    '#1f2937',
                                  border:
                                    '1px solid #374151',
                                  color:
                                    '#94a3b8',
                                }}
                              >
                                Nessun evento
                                presente nello
                                storico di questa
                                prenotazione.
                              </div>
                            ) : (
                              <div
                                style={{
                                  display:
                                    'flex',
                                  flexDirection:
                                    'column',
                                  gap: 10,
                                }}
                              >
                                {auditRecords.map(
                                  audit => {
                                    const actionColor =
                                      getAuditActionColor(
                                        audit.action
                                      )

                                    const addedTableId =
                                      getAuditValue(
                                        audit.new_data,
                                        'table_id'
                                      )

                                    const removedTableId =
                                      getAuditValue(
                                        audit.old_data,
                                        'table_id'
                                      )

                                    const addedTable =
                                      tables.find(
                                        table =>
                                          table.id ===
                                          addedTableId
                                      )

                                    const removedTable =
                                      tables.find(
                                        table =>
                                          table.id ===
                                          removedTableId
                                      )

                                    return (
                                      <div
                                        key={
                                          audit.id
                                        }
                                        style={{
                                          padding:
                                            14,
                                          borderRadius:
                                            9,
                                          background:
                                            '#111827',
                                          border:
                                            `1px solid ${actionColor}`,
                                        }}
                                      >
                                        <div
                                          style={{
                                            display:
                                              'flex',
                                            alignItems:
                                              'center',
                                            justifyContent:
                                              'space-between',
                                            gap: 12,
                                            flexWrap:
                                              'wrap',
                                          }}
                                        >
                                          <div
                                            style={{
                                              display:
                                                'flex',
                                              alignItems:
                                                'center',
                                              gap: 8,
                                            }}
                                          >
                                            <span
                                              style={{
                                                fontSize:
                                                  18,
                                              }}
                                            >
                                              {getAuditActionIcon(
                                                audit.action
                                              )}
                                            </span>

                                            <strong
                                              style={{
                                                color:
                                                  actionColor,
                                              }}
                                            >
                                              {getAuditActionLabel(
                                                audit.action
                                              )}
                                            </strong>
                                          </div>

                                          <span
                                            style={{
                                              color:
                                                '#94a3b8',
                                              fontSize:
                                                12,
                                            }}
                                          >
                                            {formatAuditDate(
                                              audit.created_at
                                            )}
                                          </span>
                                        </div>

                                        <div
                                          style={{
                                            marginTop:
                                              9,
                                            color:
                                              '#cbd5e1',
                                            fontSize:
                                              13,
                                          }}
                                        >
                                          Operatore:{' '}
                                          <strong
                                            style={{
                                              color:
                                                '#e2e8f0',
                                              fontFamily:
                                                'monospace',
                                              fontSize:
                                                12,
                                            }}
                                          >
                                            {audit.actor ||
                                              'system'}
                                          </strong>
                                        </div>

                                        {audit.action ===
                                          'table_added' &&
                                          audit.new_data && (
                                            <div
                                              style={{
                                                marginTop:
                                                  8,
                                                color:
                                                  '#cbd5e1',
                                              }}
                                            >
                                              Tavolo aggiunto:{' '}
                                              <strong
                                                style={{
                                                  color:
                                                    '#fbbf24',
                                                }}
                                              >
                                                {addedTable
                                                  ?.table_name ||
                                                  'Tavolo non disponibile'}
                                              </strong>

                                              {addedTable && (
                                                <span
                                                  style={{
                                                    color:
                                                      '#64748b',
                                                    marginLeft:
                                                      8,
                                                  }}
                                                >
                                                  (
                                                  {
                                                    addedTable.seats
                                                  }{' '}
                                                  posti)
                                                </span>
                                              )}
                                            </div>
                                          )}

                                        {audit.action ===
                                          'table_removed' &&
                                          audit.old_data && (
                                            <div
                                              style={{
                                                marginTop:
                                                  8,
                                                color:
                                                  '#cbd5e1',
                                              }}
                                            >
                                              Tavolo rimosso:{' '}
                                              <strong
                                                style={{
                                                  color:
                                                    '#fb923c',
                                                }}
                                              >
                                                {removedTable
                                                  ?.table_name ||
                                                  'Tavolo non disponibile'}
                                              </strong>

                                              {removedTable && (
                                                <span
                                                  style={{
                                                    color:
                                                      '#64748b',
                                                    marginLeft:
                                                      8,
                                                  }}
                                                >
                                                  (
                                                  {
                                                    removedTable.seats
                                                  }{' '}
                                                  posti)
                                                </span>
                                              )}
                                            </div>
                                          )}

                                        {renderAuditChanges(
                                          audit
                                        )}
                                      </div>
                                    )
                                  }
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/*
 * ========================================================
 * STILI
 * ========================================================
 */

const inputStyle: React.CSSProperties = {
  padding: 8,
  background: '#1f2937',
  color: '#f8fafc',
  border: '1px solid #4b5563',
  borderRadius: 6,
  outline: 'none',
}

const selectStyle: React.CSSProperties = {
  padding: 8,
  background: '#1f2937',
  color: '#f8fafc',
  border: '1px solid #4b5563',
  borderRadius: 6,
}

const cellStyle: React.CSSProperties = {
  padding: 9,
  borderBottom: '1px solid #374151',
  verticalAlign: 'middle',
}

type DarkInputProps = {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}

function DarkInput({
  label,
  value,
  onChange,
  type = 'text',
}: DarkInputProps) {
  return (
    <div>
      <label>
        {label}
      </label>

      <br />

      <input
        type={type}
        value={value}
        onChange={e =>
          onChange(
            e.target.value
          )
        }
        style={{
          ...inputStyle,
          width: '100%',
          boxSizing:
            'border-box',
        }}
      />
    </div>
  )
}