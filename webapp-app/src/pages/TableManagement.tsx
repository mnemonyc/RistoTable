import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import { supabase } from '../lib/supabase'

const RESTAURANT_ID =
  '0153d55d-1f5c-42c9-8da2-4eab40533c4e'

type TableItem = {
  id: string
  room_id: string
  table_name: string
  seats: number
}

type RoomItem = {
  id: string
  room_name: string
  created_at: string
}

type Props = {
  onBack: () => void
}

export default function TableManagement({
  onBack,
}: Props) {
  const [rooms, setRooms] =
    useState<RoomItem[]>([])

  const [tables, setTables] =
    useState<TableItem[]>([])

  const [message, setMessage] =
    useState('')

  const [loading, setLoading] =
    useState(true)

  const [saving, setSaving] =
    useState(false)

  /*
   * ========================================================
   * CARICAMENTO
   * ========================================================
   */

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setMessage('')

    /*
     * --------------------------------------------------------
     * SALE
     * --------------------------------------------------------
     */

    const {
      data: roomData,
      error: roomError,
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

    if (roomError) {
      setMessage(
        `Errore caricamento sale: ${roomError.message}`
      )

      setLoading(false)

      return
    }

    /*
     * --------------------------------------------------------
     * TAVOLI
     * --------------------------------------------------------
     */

    const {
      data: tableData,
      error: tableError,
    } = await supabase
      .from('dining_tables')
      .select(
        `
        id,
        room_id,
        table_name,
        seats
        `
      )
      .eq(
        'active',
        true
      )

    if (tableError) {
      setMessage(
        `Errore caricamento tavoli: ${tableError.message}`
      )

      setLoading(false)

      return
    }

    /*
     * Ordine naturale:
     *
     * T1
     * T2
     * T3
     * ...
     * T10
     * T11
     *
     * invece di:
     *
     * T1
     * T10
     * T11
     * T2
     */

    const sortedTables =
      [...(tableData || [])].sort(
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

    /*
     * --------------------------------------------------------
     * SALE REALMENTE UTILIZZABILI
     * --------------------------------------------------------
     *
     * Mostriamo soltanto le sale che:
     *
     * 1. appartengono al ristorante
     * 2. hanno almeno un tavolo attivo
     *
     * In questo modo una eventuale sala
     * senza tavoli non viene mostrata.
     */

    const activeTableRoomIds =
      new Set(
        sortedTables.map(
          table =>
            table.room_id
        )
      )

    const filteredRooms =
      (roomData || []).filter(
        room =>
          activeTableRoomIds.has(
            room.id
          )
      )

    /*
     * Ordine delle sale basato su
     * created_at, come definito
     * nella struttura del database.
     */

    filteredRooms.sort(
      (a, b) =>
        new Date(
          a.created_at
        ).getTime() -
        new Date(
          b.created_at
        ).getTime()
    )

    console.log(
      'TABLE MANAGEMENT ROOMS',
      filteredRooms
    )

    console.log(
      'TABLE MANAGEMENT TABLES',
      sortedTables
    )

    setRooms(
      filteredRooms
    )

    setTables(
      sortedTables
    )

    setLoading(false)
  }

  /*
   * ========================================================
   * MODIFICA COPERTI
   * ========================================================
   */

  function updateSeats(
    id: string,
    seats: number
  ) {
    const value =
      Math.max(
        1,
        Number.isFinite(
          seats
        )
          ? Math.floor(seats)
          : 1
      )

    setTables(
      previous =>
        previous.map(
          table =>
            table.id ===
            id
              ? {
                  ...table,
                  seats:
                    value,
                }
              : table
        )
    )
  }

  /*
   * ========================================================
   * SALVATAGGIO
   * ========================================================
   */

  async function saveAll() {
    setSaving(true)

    setMessage(
      'Salvataggio in corso...'
    )

    for (
      const table of tables
    ) {
      const {
        error,
      } = await supabase
        .from(
          'dining_tables'
        )
        .update({
          seats:
            table.seats,
        })
        .eq(
          'id',
          table.id
        )

      if (error) {
        setMessage(
          `Errore nel salvataggio di ${table.table_name}: ${error.message}`
        )

        setSaving(false)

        return
      }
    }

    setMessage(
      '✅ Configurazione salvata'
    )

    setSaving(false)
  }

  /*
   * ========================================================
   * RIEPILOGO SALE
   * ========================================================
   */

  const roomSummary =
    useMemo(() => {
      return rooms.map(
        room => {
          const roomTables =
            tables.filter(
              table =>
                table.room_id ===
                room.id
            )

          return {
            id: room.id,
            room_name:
              room.room_name,
            tableCount:
              roomTables.length,
            seats:
              roomTables.reduce(
                (
                  total,
                  table
                ) =>
                  total +
                  table.seats,
                0
              ),
          }
        }
      )
    }, [
      rooms,
      tables,
    ])

  /*
   * ========================================================
   * TOTALI
   * ========================================================
   */

  const totalSeats =
    tables.reduce(
      (
        total,
        table
      ) =>
        total +
        table.seats,
      0
    )

  /*
   * ========================================================
   * CARICAMENTO
   * ========================================================
   */

  if (loading) {
    return (
      <div
        style={{
          padding: 20,
        }}
      >
        <button
          onClick={
            onBack
          }
        >
          ← Torna alla Dashboard
        </button>

        <h2>
          Gestione Tavoli
        </h2>

        <p>
          Caricamento...
        </p>
      </div>
    )
  }

  /*
   * ========================================================
   * PAGINA
   * ========================================================
   */

  return (
    <div
      style={{
        padding: 20,
        maxWidth: 900,
        margin: '0 auto',
      }}
    >
      <button
        onClick={
          onBack
        }
        style={{
          padding:
            '8px 14px',
          marginBottom: 20,
        }}
      >
        ← Torna alla Dashboard
      </button>

      <h2>
        ⚙️ Gestione Tavoli
      </h2>

      <p>
        Modifica il numero massimo
        di coperti per ogni tavolo.
      </p>

      {/* ================================================== */}
      {/* RIEPILOGO GENERALE */}
      {/* ================================================== */}

      <div
        style={{
          display:
            'flex',
          gap: 15,
          flexWrap:
            'wrap',
          marginTop: 20,
          marginBottom: 30,
        }}
      >
        <div
          style={{
            border:
              '1px solid #ccc',
            borderRadius: 8,
            padding: 15,
            minWidth: 160,
          }}
        >
          <strong>
            🍽️ Tavoli
          </strong>

          <div
            style={{
              fontSize: 24,
              marginTop: 5,
            }}
          >
            {
              tables.length
            }
          </div>
        </div>

        <div
          style={{
            border:
              '1px solid #ccc',
            borderRadius: 8,
            padding: 15,
            minWidth: 160,
          }}
        >
          <strong>
            👥 Coperti
          </strong>

          <div
            style={{
              fontSize: 24,
              marginTop: 5,
            }}
          >
            {
              totalSeats
            }
          </div>
        </div>
      </div>

      {/* ================================================== */}
      {/* SALE */}
      {/* ================================================== */}

      <h3>
        Sale
      </h3>

      {roomSummary.length ===
      0 ? (
        <p>
          Nessuna sala disponibile.
        </p>
      ) : (
        <div
          style={{
            display:
              'flex',
            gap: 15,
            flexWrap:
              'wrap',
            marginBottom: 30,
          }}
        >
          {roomSummary.map(
            room => (
              <div
                key={
                  room.id
                }
                style={{
                  border:
                    '1px solid #ccc',
                  borderRadius: 8,
                  padding: 15,
                  minWidth: 220,
                }}
              >
                <strong>
                  {
                    room.room_name
                  }
                </strong>

                <div
                  style={{
                    marginTop: 8,
                  }}
                >
                  Tavoli:{' '}
                  <strong>
                    {
                      room.tableCount
                    }
                  </strong>
                </div>

                <div>
                  Coperti:{' '}
                  <strong>
                    {
                      room.seats
                    }
                  </strong>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* ================================================== */}
      {/* TAVOLI PER SALA */}
      {/* ================================================== */}

      {rooms.map(
        room => {
          const roomTables =
            tables.filter(
              table =>
                table.room_id ===
                room.id
            )

          /*
           * Una sala viene mostrata
           * soltanto se possiede tavoli attivi.
           */

          if (
            roomTables.length ===
            0
          ) {
            return null
          }

          return (
            <div
              key={
                room.id
              }
              style={{
                marginBottom: 35,
              }}
            >
              <h3>
                {
                  room.room_name
                }
              </h3>

              {roomTables.map(
                table => (
                  <div
                    key={
                      table.id
                    }
                    style={{
                      display:
                        'flex',
                      alignItems:
                        'center',
                      gap: 15,
                      marginBottom:
                        12,
                      padding: 10,
                      border:
                        '1px solid #ddd',
                      borderRadius: 6,
                      maxWidth: 500,
                    }}
                  >
                    <strong
                      style={{
                        width: 60,
                      }}
                    >
                      {
                        table.table_name
                      }
                    </strong>

                    <input
                      type="number"
                      min="1"
                      value={
                        table.seats
                      }
                      onChange={e =>
                        updateSeats(
                          table.id,
                          Number(
                            e
                              .target
                              .value
                          )
                        )
                      }
                      style={{
                        width: 80,
                        padding: 6,
                      }}
                    />

                    <span>
                      posti
                    </span>
                  </div>
                )
              )}
            </div>
          )
        }
      )}

      {/* ================================================== */}
      {/* SALVATAGGIO */}
      {/* ================================================== */}

      <button
        onClick={
          saveAll
        }
        disabled={
          saving
        }
        style={{
          marginTop: 10,
          padding:
            '10px 20px',
        }}
      >
        {saving
          ? '💾 Salvataggio...'
          : '💾 Salva configurazione'}
      </button>

      {/* ================================================== */}
      {/* MESSAGGIO */}
      {/* ================================================== */}

      {message && (
        <p
          style={{
            marginTop: 15,
            fontWeight:
              'bold',
          }}
        >
          {
            message
          }
        </p>
      )}
    </div>
  )
}