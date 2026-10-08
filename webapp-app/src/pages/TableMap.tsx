import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatDateIT } from '../lib/dateUtils'
import {
  DEFAULT_RESTAURANT_SETTINGS,
  generateTimeOptions,
  loadRestaurantSettings,
  type RestaurantSettings,
} from '../lib/restaurantSettings'

const RESTAURANT_ID =
  '0153d55d-1f5c-42c9-8da2-4eab40533c4e'

const RESERVATION_DURATION_MINUTES = 90

type TableItem = {
  id: string
  room_id: string
  table_name: string
  seats: number
  pos_x: number
  pos_y: number
}

type RoomItem = {
  id: string
  room_name: string
  created_at: string
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

interface TableMapProps {
  selectedDate: string
  onReserveSelected: (selection: {
    date: string
    time: string
    guests: number
    tableIds: string[]
  }) => void
}

function normalizeTime(time: string): string {
  return time.slice(0, 5)
}

function shiftDate(
  dateString: string,
  days: number
): string {
  const [year, month, day] = dateString
    .split('-')
    .map(Number)

  const dateValue = new Date(
    year,
    month - 1,
    day + days
  )

  const y = dateValue.getFullYear()

  const m = String(
    dateValue.getMonth() + 1
  ).padStart(2, '0')

  const d = String(
    dateValue.getDate()
  ).padStart(2, '0')

  return `${y}-${m}-${d}`
}

function parseLocalDateTime(
  date: string,
  time: string
): Date {
  return new Date(
    `${date}T${normalizeTime(time)}:00`
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

function sortTables(
  tables: TableItem[]
): TableItem[] {
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

export default function TableMap({
  selectedDate,
  onReserveSelected,
}: TableMapProps) {
  const [tables, setTables] =
    useState<TableItem[]>([])

  const [rooms, setRooms] =
    useState<RoomItem[]>([])

  const [roomId, setRoomId] =
    useState('')

  const [reservations, setReservations] =
    useState<ReservationItem[]>([])

  const [
    reservationTableLinks,
    setReservationTableLinks,
  ] = useState<
    ReservationTableLink[]
  >([])

  const [settings, setSettings] =
    useState<RestaurantSettings>(
      DEFAULT_RESTAURANT_SETTINGS
    )

  const [selectedTime, setSelectedTime] =
    useState(
      DEFAULT_RESTAURANT_SETTINGS.firstShiftStart
    )

  const [guests, setGuests] =
    useState(2)

  const [
    selectedTableIds,
    setSelectedTableIds,
  ] = useState<string[]>([])

  const [loading, setLoading] =
    useState(false)

  const [error, setError] =
    useState('')

  /*
   * ========================================================
   * CARICAMENTO INIZIALE
   * ========================================================
   */

  useEffect(() => {
    void loadRestaurantSettings().then(
      loadedSettings => {
        setSettings(loadedSettings)

        const firstTime =
          generateTimeOptions(
            loadedSettings.firstShiftStart,
            loadedSettings.firstShiftEnd,
            loadedSettings.timeIntervalMinutes
          )[0]

        if (firstTime) {
          setSelectedTime(firstTime)
        }
      }
    )

    loadRooms()
    loadTables()
  }, [])

  /*
   * ========================================================
   * CAMBIO DATA / ORARIO
   * ========================================================
   */

  useEffect(() => {
    loadReservations()
  }, [
    selectedDate,
    selectedTime,
  ])

  useEffect(() => {
    setSelectedTableIds([])
  }, [
    selectedDate,
    selectedTime,
    guests,
  ])

  /*
   * ========================================================
   * SALE
   * ========================================================
   */

  async function loadRooms() {
    const {
      data,
      error,
    } = await supabase
      .from('rooms')
      .select(
        'id, room_name, created_at'
      )
      .eq(
        'restaurant_id',
        RESTAURANT_ID
      )
      .order('created_at')

    console.log(
      'TABLE MAP ROOMS',
      data
    )

    console.log(
      'TABLE MAP ROOMS ERROR',
      error
    )

    if (error) {
      setError(
        `Errore caricamento sale: ${error.message}`
      )
      return
    }

    const loadedRooms =
      data || []

    setRooms(
      loadedRooms
    )

    if (
      loadedRooms.length > 0
    ) {
      setRoomId(
        current =>
          current &&
          loadedRooms.some(
            room =>
              room.id ===
              current
          )
            ? current
            : loadedRooms[0].id
      )
    } else {
      setRoomId('')
    }
  }

  /*
   * ========================================================
   * TAVOLI
   * ========================================================
   */

  async function loadTables() {
    const {
      data,
      error,
    } = await supabase
      .from('dining_tables')
      .select(
        `
        id,
        room_id,
        table_name,
        seats,
        pos_x,
        pos_y
        `
      )
      .eq(
        'active',
        true
      )

    if (error) {
      console.error(
        'TABLE MAP TABLES ERROR:',
        error
      )

      setTables([])

      setError(
        `Errore caricamento tavoli: ${error.message}`
      )

      return
    }

    const sortedTables =
      sortTables(
        data || []
      )

    console.log(
      'TABLE MAP TABLES',
      sortedTables
    )

    setTables(
      sortedTables
    )
  }

  /*
   * ========================================================
   * PRENOTAZIONI
   * ========================================================
   */

  async function loadReservations() {
    if (!selectedDate) {
      setReservations([])
      setReservationTableLinks([])
      return
    }

    setLoading(true)
    setError('')

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
      data,
      error,
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

    if (error) {
      console.error(
        'TABLE MAP RESERVATIONS ERROR:',
        error
      )

      setReservations([])
      setReservationTableLinks([])

      setError(
        `Errore caricamento prenotazioni: ${error.message}`
      )

      setLoading(false)

      return
    }

    const reservationData =
      data || []

    setReservations(
      reservationData
    )

    const reservationIds =
      reservationData.map(
        reservation =>
          reservation.id
      )

    if (
      reservationIds.length ===
      0
    ) {
      setReservationTableLinks(
        []
      )

      setLoading(false)

      return
    }

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
        'TABLE MAP RESERVATION_TABLES ERROR:',
        linksError
      )

      setReservationTableLinks(
        []
      )

      setError(
        `Errore caricamento tavoli prenotati: ${linksError.message}`
      )
    } else {
      setReservationTableLinks(
        linksData || []
      )
    }

    setLoading(false)
  }

  /*
   * ========================================================
   * TAVOLI UTILIZZATI DA UNA PRENOTAZIONE
   * ========================================================
   */

  function reservationUsesTable(
    reservation: ReservationItem,
    tableId: string
  ): boolean {
    if (
      reservation.table_id ===
      tableId
    ) {
      return true
    }

    return reservationTableLinks.some(
      link =>
        link.reservation_id ===
          reservation.id &&
        link.table_id ===
          tableId
    )
  }

  /*
   * ========================================================
   * OCCUPAZIONE TAVOLO
   * ========================================================
   */

  function isOccupied(
    tableId: string
  ): boolean {
    if (!selectedTime) {
      return reservations.some(
        reservation => {
          if (
            reservation.reservation_date !==
            selectedDate
          ) {
            return false
          }

          return reservationUsesTable(
            reservation,
            tableId
          )
        }
      )
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

    return reservations.some(
      reservation => {
        if (
          !reservationUsesTable(
            reservation,
            tableId
          )
        ) {
          return false
        }

        const existingStart =
          parseLocalDateTime(
            reservation.reservation_date,
            reservation.reservation_time
          )

        const existingEnd =
          addMinutes(
            existingStart,
            RESERVATION_DURATION_MINUTES
          )

        return intervalsOverlap(
          requestedStart,
          requestedEnd,
          existingStart,
          existingEnd
        )
      }
    )
  }

  /*
   * ========================================================
   * CAPACITÀ
   * ========================================================
   */

  function isTooSmall(
    table: TableItem
  ): boolean {
    return (
      table.seats <
      guests
    )
  }

  /*
   * ========================================================
   * STATO TAVOLO
   * ========================================================
   */

  function getTableStatus(
    table: TableItem
  ):
    | 'occupied'
    | 'too-small'
    | 'available' {
    if (
      isOccupied(
        table.id
      )
    ) {
      return 'occupied'
    }

    if (
      isTooSmall(
        table
      )
    ) {
      return 'too-small'
    }

    return 'available'
  }

  /*
   * ========================================================
   * SELEZIONE TAVOLO
   * ========================================================
   */

  function toggleTable(
    table: TableItem
  ) {
    const status =
      getTableStatus(
        table
      )

    if (
      status ===
      'occupied'
    ) {
      alert(
        `${table.table_name} è occupato nell'intervallo selezionato.`
      )

      return
    }

    const alreadySelected =
      selectedTableIds.includes(
        table.id
      )

    if (
      alreadySelected
    ) {
      setSelectedTableIds(
        current =>
          current.filter(
            id =>
              id !==
              table.id
          )
      )

      return
    }

    if (
      selectedTableIds.length >
      0
    ) {
      const firstSelected =
        tables.find(
          currentTable =>
            currentTable.id ===
            selectedTableIds[0]
        )

      if (
        firstSelected &&
        firstSelected.room_id !==
          table.room_id
      ) {
        alert(
          'Per una tavolata devi selezionare tavoli della stessa sala.'
        )

        return
      }
    }

    setSelectedTableIds(
      current => [
        ...current,
        table.id,
      ]
    )
  }

  /*
   * ========================================================
   * TAVOLI SELEZIONATI
   * ========================================================
   */

  const selectedTables =
    useMemo(
      () =>
        tables.filter(
          table =>
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
    useMemo(
      () =>
        selectedTables.reduce(
          (
            total,
            table
          ) =>
            total +
            table.seats,
          0
        ),
      [selectedTables]
    )

  const capacityIsEnough =
    selectedCapacity >=
    guests

  /*
   * ========================================================
   * PRENOTAZIONE
   * ========================================================
   */

  function prepareReservation() {
    if (
      selectedTableIds.length ===
      0
    ) {
      return
    }

    if (
      !capacityIsEnough
    ) {
      return
    }

    if (!selectedTime) {
      alert(
        'Seleziona un orario per procedere con la prenotazione.'
      )

      return
    }

    onReserveSelected({
      date: selectedDate,
      time: selectedTime,
      guests,
      tableIds:
        selectedTableIds,
    })
  }

  /*
   * ========================================================
   * ORARI
   * ========================================================
   */

  const timeOptions = [
    ...generateTimeOptions(
      settings.firstShiftStart,
      settings.firstShiftEnd,
      settings.timeIntervalMinutes
    ),
    ...generateTimeOptions(
      settings.secondShiftStart,
      settings.secondShiftEnd,
      settings.timeIntervalMinutes
    ),
  ]

  /*
   * ========================================================
   * TAVOLI VISIBILI
   * ========================================================
   */

  const visibleTables =
    useMemo(
      () =>
        sortTables(
          tables.filter(
            table =>
              table.room_id ===
              roomId
          )
        ),
      [
        tables,
        roomId,
      ]
    )

  /*
   * ========================================================
   * RENDER
   * ========================================================
   */

  return (
    <div
      style={{
        background:
          '#020617',
        color:
          '#f8fafc',
        padding: 20,
        borderRadius: 14,
        minHeight: 650,
        border:
          '1px solid #1e293b',
        boxShadow:
          '0 10px 30px rgba(0,0,0,0.35)',
      }}
    >
      <h2
        style={{
          marginTop: 0,
          marginBottom: 18,
          color:
            '#ffffff',
          fontSize: 26,
        }}
      >
        🪑 Mappa Tavoli
      </h2>

      {/* ================================================== */}
      {/* FILTRI */}
      {/* ================================================== */}

      <div
        style={{
          marginBottom: 15,
          padding: 18,
          border:
            '1px solid #334155',
          borderRadius: 12,
          background:
            '#0f172a',
          boxShadow:
            '0 4px 14px rgba(0,0,0,0.25)',
        }}
      >
        <strong
          style={{
            color:
              '#ffffff',
            fontSize: 16,
          }}
        >
          Seleziona i tavoli per
          la prenotazione
        </strong>

        <div
          style={{
            display: 'flex',
            gap: 22,
            flexWrap:
              'wrap',
            alignItems:
              'flex-end',
            marginTop: 18,
          }}
        >
          <div>
            <label
              style={{
                color:
                  '#cbd5e1',
                fontSize: 13,
                fontWeight:
                  600,
              }}
            >
              Data
            </label>

            <div
              style={{
                marginTop: 5,
                color:
                  '#ffffff',
                fontWeight:
                  'bold',
                fontSize: 16,
              }}
            >
              {formatDateIT(selectedDate)}
            </div>
          </div>

          <div>
            <label
              style={{
                color:
                  '#cbd5e1',
                fontSize: 13,
                fontWeight:
                  600,
              }}
            >
              Ora
            </label>

            <br />

            <select
              value={
                selectedTime
              }
              onChange={e =>
                setSelectedTime(
                  e.target.value
                )
              }
              style={{
                marginTop: 5,
                padding:
                  '9px 12px',
                background:
                  '#020617',
                color:
                  '#ffffff',
                border:
                  '1px solid #475569',
                borderRadius: 7,
                fontWeight:
                  600,
                outline:
                  'none',
              }}
            >
              {timeOptions.map(
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
            <label
              style={{
                color:
                  '#cbd5e1',
                fontSize: 13,
                fontWeight:
                  600,
              }}
            >
              Coperti
            </label>

            <br />

            <input
              type="number"
              min="1"
              value={guests}
              onChange={e => {
                const value =
                  Math.max(
                    1,
                    Number(
                      e.target.value
                    ) || 1
                  )

                setGuests(
                  value
                )
              }}
              style={{
                marginTop: 5,
                width: 90,
                padding:
                  '9px 10px',
                background:
                  '#020617',
                color:
                  '#ffffff',
                border:
                  '1px solid #475569',
                borderRadius: 7,
                fontWeight:
                  600,
              }}
            />
          </div>
        </div>

        <div
          style={{
            marginTop: 16,
            paddingTop: 12,
            borderTop:
              '1px solid #1e293b',
            color:
              '#cbd5e1',
          }}
        >
          ⏱️ Durata prevista:{' '}
          <strong
            style={{
              color:
                '#ffffff',
            }}
          >
            1 ora e 30 minuti
          </strong>
        </div>
      </div>

      {/* ================================================== */}
      {/* SALA */}
      {/* ================================================== */}

      <div
        style={{
          marginBottom: 15,
          padding: 16,
          background:
            '#0f172a',
          borderRadius: 12,
          border:
            '1px solid #334155',
        }}
      >
        <label
          style={{
            color:
              '#cbd5e1',
            fontSize: 13,
            fontWeight:
              600,
          }}
        >
          Sala
        </label>

        <br />

        <select
          value={roomId}
          onChange={e => {
            setRoomId(
              e.target.value
            )

            setSelectedTableIds(
              []
            )
          }}
          style={{
            marginTop: 7,
            padding:
              '9px 12px',
            minWidth: 240,
            background:
              '#020617',
            color:
              '#ffffff',
            border:
              '1px solid #475569',
            borderRadius: 7,
            fontWeight:
              600,
          }}
        >
          {rooms.map(
            room => (
              <option
                key={room.id}
                value={room.id}
              >
                {room.room_name}
              </option>
            )
          )}
        </select>
      </div>

      {/* ================================================== */}
      {/* RIEPILOGO SELEZIONE */}
      {/* ================================================== */}

      {selectedTableIds.length >
        0 && (
        <div
          style={{
            marginBottom: 15,
            padding: 18,
            border:
              capacityIsEnough
                ? '2px solid #22c55e'
                : '2px solid #f59e0b',
            borderRadius: 12,
            background:
              capacityIsEnough
                ? '#052e16'
                : '#451a03',
            boxShadow:
              '0 4px 14px rgba(0,0,0,0.25)',
          }}
        >
          <strong
            style={{
              color:
                '#ffffff',
              fontSize: 17,
            }}
          >
            Tavoli selezionati
          </strong>

          <p
            style={{
              color:
                '#e2e8f0',
              lineHeight:
                1.6,
            }}
          >
            {selectedTables
              .map(
                table =>
                  `${table.table_name} (${table.seats} posti)`
              )
              .join(
                ' + '
              )}
          </p>

          <p
            style={{
              color:
                '#e2e8f0',
            }}
          >
            Coperti richiesti:{' '}
            <strong
              style={{
                color:
                  '#ffffff',
              }}
            >
              {guests}
            </strong>
          </p>

          <p
            style={{
              color:
                '#e2e8f0',
            }}
          >
            Capacità totale:{' '}
            <strong
              style={{
                color:
                  '#ffffff',
              }}
            >
              {selectedCapacity}
            </strong>
          </p>

          {capacityIsEnough ? (
            <p
              style={{
                color:
                  '#4ade80',
                fontWeight:
                  'bold',
              }}
            >
              ✅ Capacità sufficiente
            </p>
          ) : (
            <p
              style={{
                color:
                  '#fb923c',
                fontWeight:
                  'bold',
              }}
            >
              ⚠️ Mancano{' '}
              {guests -
                selectedCapacity}{' '}
              coperti. Seleziona
              altri tavoli della
              stessa sala.
            </p>
          )}

          <button
            type="button"
            onClick={
              prepareReservation
            }
            disabled={
              !capacityIsEnough ||
              !selectedTime
            }
            style={{
              marginTop: 5,
              padding:
                '11px 20px',
              fontWeight:
                'bold',
              fontSize: 14,
              color:
                '#ffffff',
              background:
                capacityIsEnough &&
                selectedTime
                  ? '#2563eb'
                  : '#475569',
              border:
                '1px solid #60a5fa',
              borderRadius: 8,
              cursor:
                capacityIsEnough &&
                selectedTime
                  ? 'pointer'
                  : 'not-allowed',
              boxShadow:
                capacityIsEnough &&
                selectedTime
                  ? '0 4px 10px rgba(37,99,235,0.35)'
                  : 'none',
            }}
          >
            ➜ Prenota tavoli
            selezionati
          </button>
        </div>
      )}

      {/* ================================================== */}
      {/* LEGENDA */}
      {/* ================================================== */}

      <div
        style={{
          marginBottom: 15,
          padding: 14,
          display: 'flex',
          gap: 20,
          flexWrap:
            'wrap',
          background:
            '#0f172a',
          border:
            '1px solid #334155',
          borderRadius: 12,
        }}
      >
        <span
          style={{
            color:
              '#4ade80',
            fontWeight:
              'bold',
          }}
        >
          🟢 Libero
        </span>

        <span
          style={{
            color:
              '#f87171',
            fontWeight:
              'bold',
          }}
        >
          🔴 Occupato
        </span>

        <span
          style={{
            color:
              '#cbd5e1',
            fontWeight:
              'bold',
          }}
        >
          ⚪ Capienza insufficiente
        </span>

        <span
          style={{
            color:
              '#60a5fa',
            fontWeight:
              'bold',
          }}
        >
          🔵 Selezionato
        </span>
      </div>

      {loading && (
        <div
          style={{
            marginBottom: 15,
            padding: 12,
            borderRadius: 8,
            background:
              '#172033',
            color:
              '#cbd5e1',
          }}
        >
          ⏳ Caricamento
          disponibilità...
        </div>
      )}

      {error && (
        <div
          style={{
            marginBottom: 15,
            padding: 12,
            border:
              '1px solid #ef4444',
            borderRadius: 8,
            background:
              '#450a0a',
            color:
              '#fecaca',
            fontWeight:
              'bold',
          }}
        >
          ❌ {error}
        </div>
      )}

      {/* ================================================== */}
      {/* MAPPA */}
      {/* ================================================== */}

      <div
  style={{
    position: 'relative',
                   width: 920,
                  height: 600,border: '1px solid #475569',
    borderRadius: 12,
    overflow: 'hidden',
    background: '#020617',
    boxShadow:
      'inset 0 0 40px rgba(0,0,0,0.5), 0 8px 20px rgba(0,0,0,0.35)',
    boxSizing: 'border-box',
  }}
>
        {visibleTables.length ===
        0 ? (
          <div
            style={{
              padding: 30,
              color:
                '#cbd5e1',
              textAlign:
                'center',
              fontSize: 16,
            }}
          >
            Nessun tavolo presente
            in questa sala.
          </div>
        ) : (
          visibleTables.map(
            table => {
              const status =
                getTableStatus(
                  table
                )

              const selected =
                selectedTableIds.includes(
                  table.id
                )

              let backgroundColor =
                '#16a34a'

              let borderColor =
                '#86efac'

              let textColor =
                '#ffffff'

              if (
                status ===
                'occupied'
              ) {
                backgroundColor =
                  '#dc2626'

                borderColor =
                  '#fecaca'

                textColor =
                  '#ffffff'
              }

              if (
                status ===
                'too-small'
              ) {
                backgroundColor =
                  '#475569'

                borderColor =
                  '#cbd5e1'

                textColor =
                  '#ffffff'
              }

              if (
                selected
              ) {
                backgroundColor =
                  '#2563eb'

                borderColor =
                  '#bfdbfe'

                textColor =
                  '#ffffff'
              }

              return (
                <button
                  key={
                    table.id
                  }
                  type="button"
                  aria-label={`${table.table_name}, ${table.seats} posti, ${
                    status ===
                    'occupied'
                      ? 'occupato'
                      : status ===
                        'too-small'
                      ? 'capienza insufficiente'
                      : selected
                      ? 'selezionato'
                      : 'libero'
                  }`}
                  style={{
                    position:
                      'absolute',

                    left:
                      table.pos_x,

                    top:
                      table.pos_y,

                    width: 104,
                    height: 74,

                    backgroundColor,

                    color:
                      textColor,

                    border:
                      selected
                        ? '3px solid #dbeafe'
                        : `2px solid ${borderColor}`,

                    borderRadius: 10,

                    cursor:
                      status ===
                      'occupied'
                        ? 'not-allowed'
                        : 'pointer',

                    opacity:
                      status ===
                        'too-small' &&
                      !selected
                        ? 0.88
                        : 1,

                    fontWeight:
                      'bold',

                    boxShadow:
                      selected
                        ? '0 0 16px rgba(59,130,246,0.85)'
                        : '0 4px 10px rgba(0,0,0,0.45)',

                    padding: 4,

                    display:
                      'flex',

                    flexDirection:
                      'column',

                    alignItems:
                      'center',

                    justifyContent:
                      'center',

                    transition:
                      'transform 0.12s ease, box-shadow 0.12s ease',

                    textShadow:
                      '0 1px 2px rgba(0,0,0,0.9)',
                  }}
                  onClick={() =>
                    toggleTable(
                      table
                    )
                  }
                >
                  <strong
                    style={{
                      color:
                        '#ffffff',
                      fontSize:
                        16,
                      lineHeight:
                        1.1,
                      display:
                        'block',
                    }}
                  >
                    {
                      table.table_name
                    }
                  </strong>

                  <span
                    style={{
                      color:
                        '#ffffff',
                      fontSize:
                        12,
                      lineHeight:
                        1.1,
                      display:
                        'block',
                      marginTop:
                        3,
                      fontWeight:
                        700,
                    }}
                  >
                    {table.seats}{' '}
                    👤
                  </span>

                  <small
                    style={{
                      color:
                        '#ffffff',
                      fontSize:
                        10,
                      fontWeight:
                        800,
                      lineHeight:
                        1.1,
                      display:
                        'block',
                      marginTop:
                        3,
                      textTransform:
                        'uppercase',
                    }}
                  >
                    {status ===
                    'occupied'
                      ? 'Occupato'
                      : status ===
                        'too-small'
                      ? 'Insuff.'
                      : selected
                      ? 'Selezionato'
                      : 'Libero'}
                  </small>
                </button>
              )
            }
          )
        )}
      </div>

      {/* ================================================== */}
      {/* INFORMAZIONE OPERATIVA */}
      {/* ================================================== */}

      <div
        style={{
          marginTop: 14,
          padding: 12,
          borderRadius: 9,
          background:
            '#0f172a',
          border:
            '1px solid #1e293b',
          color:
            '#94a3b8',
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        💡 Una tavolata può
        comprendere più tavoli
        della stessa sala. La
        capacità viene calcolata
        sommando i posti dei tavoli
        selezionati.
      </div>
    </div>
  )
}