import { useState } from 'react'
import NewReservation from './NewReservation'
import { supabase } from '../lib/supabase'
import ReservationsList from './ReservationsList'
import TableMap from './TableMap'
import DashboardStats from './DashboardStats'
import TableManagement from './TableManagement'
import ItalianDateInput from '../lib/ItalianDateInput'
import { formatDateIT } from '../lib/dateUtils'

const RESTAURANT_ID =
  '0153d55d-1f5c-42c9-8da2-4eab40533c4e'

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

async function logout(): Promise<void> {
  await supabase.auth.signOut()
  window.location.reload()
}

export type ReservationSelection = {
  date: string
  time: string
  guests: number
  tableIds: string[]
}

type PrintableReservation = {
  id: string
  reservation_time: string
  guests: number
  notes: string | null
  status: string
  customer?: {
    full_name: string
    phone: string | null
  }
  tables: {
    table_name: string
  }[]
}

type PrintableRoom = {
  id: string
  room_name: string
}

type PrintableTable = {
  id: string
  room_id: string
  table_name: string
  seats: number
  pos_x: number
  pos_y: number
}

function normalizeTime(
  value: string
): string {
  return value.slice(0, 5)
}

function getStatusLabel(
  status: string
): string {
  switch (status) {
    case 'confirmed':
      return 'Confermata'

    case 'cancelled':
      return 'Cancellata'

    case 'pending':
      return 'In attesa'

    case 'completed':
      return 'Completata'

    case 'booked':
      return 'Prenotata'

    default:
      return status
  }
}

function getSortedTableNames(
  reservation: PrintableReservation
): string[] {
  return reservation.tables
    .map(table => table.table_name)
    .sort((a, b) =>
      a.localeCompare(
        b,
        'it',
        {
          numeric: true,
          sensitivity: 'base',
        }
      )
    )
}

function sortPrintableReservations(
  reservations: PrintableReservation[]
): PrintableReservation[] {
  return [...reservations].sort(
    (a, b) => {
      const aTables =
        getSortedTableNames(a)

      const bTables =
        getSortedTableNames(b)

      const aTableKey =
        aTables.join(' + ')

      const bTableKey =
        bTables.join(' + ')

      const aHasTable =
        aTableKey.length > 0

      const bHasTable =
        bTableKey.length > 0

      if (
        aHasTable !==
        bHasTable
      ) {
        return aHasTable
          ? -1
          : 1
      }

      const tableComparison =
        aTableKey.localeCompare(
          bTableKey,
          'it',
          {
            numeric: true,
            sensitivity: 'base',
          }
        )

      if (
        tableComparison !== 0
      ) {
        return tableComparison
      }

      return normalizeTime(
        a.reservation_time
      ).localeCompare(
        normalizeTime(
          b.reservation_time
        )
      )
    }
  )
}

function escapeHtml(
  value: string
): string {
  return value
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&#039;'
    )
}

async function printDailyReservations(
  selectedDate: string
): Promise<void> {
  const printWindow =
    window.open(
      '',
      '_blank',
      'width=1100,height=800'
    )

  if (!printWindow) {
    window.alert(
      'Impossibile aprire la finestra di stampa. Controlla che i popup non siano bloccati.'
    )
    return
  }

  printWindow.document.write(
    `<!doctype html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>Prenotazioni - ${escapeHtml(formatDateIT(selectedDate))}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: #111827;
      background: #ffffff;
      font-size: 11px;
    }

    h1 {
      margin: 0 0 4px;
      font-size: 21px;
    }

    h2 {
      margin: 0 0 16px;
      font-size: 15px;
      font-weight: normal;
      color: #374151;
    }

    .summary {
      display: flex;
      gap: 24px;
      margin-bottom: 14px;
      padding-bottom: 10px;
      border-bottom: 2px solid #111827;
    }

    .summary strong {
      font-size: 13px;
    }

    .map-section {
      margin-top: 20px;
      page-break-inside: avoid;
    }

    .map-title {
      margin: 0 0 8px;
      font-size: 15px;
      color: #111827;
    }

    .map-legend {
      display: flex;
      gap: 14px;
      flex-wrap: wrap;
      margin-bottom: 8px;
      font-size: 9px;
      font-weight: bold;
    }

    .legend-item {
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }

    .legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 3px;
      display: inline-block;
      border: 1px solid #374151;
    }

    .map {
      position: relative;
      width: 100%;
      aspect-ratio: 920 / 600;
      border: 1px solid #6b7280;
      border-radius: 8px;
      overflow: hidden;
      background: #f8fafc;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }

    .map-table {
      position: absolute;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 11.304%;
      height: 12.333%;
      border-radius: 5px;
      border: 1.5px solid;
      font-weight: bold;
      color: #ffffff;
      text-align: center;
      line-height: 1.05;
      text-shadow: 0 1px 2px rgba(0,0,0,0.65);
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }

    .map-table .name {
      font-size: 10px;
    }

    .map-table .seats {
      font-size: 7px;
      margin-top: 2px;
    }

    .map-table .status {
      font-size: 6px;
      margin-top: 2px;
      text-transform: uppercase;
    }

    .map-table.occupied {
      background: #dc2626;
      border-color: #991b1b;
    }

    .map-table.free {
      background: #16a34a;
      border-color: #166534;
    }

    .map-table.grouped {
      box-shadow: 0 0 0 2px #f59e0b inset;
    }

    .map-note {
      margin-top: 7px;
      color: #4b5563;
      font-size: 8px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th {
      padding: 7px 6px;
      text-align: left;
      background: #e5e7eb;
      border: 1px solid #9ca3af;
      font-size: 10px;
      text-transform: uppercase;
    }

    td {
      padding: 7px 6px;
      border: 1px solid #d1d5db;
      vertical-align: top;
    }

    tr {
      page-break-inside: avoid;
    }

    .time {
      font-weight: bold;
      font-size: 13px;
      white-space: nowrap;
    }

    .table-name {
      font-weight: bold;
      font-size: 13px;
      color: #111827;
    }

    .customer {
      font-weight: bold;
    }

    .phone {
      color: #4b5563;
      margin-top: 2px;
    }

    .cancelled {
      color: #b91c1c;
      font-weight: bold;
    }

    .notes {
      color: #4b5563;
    }

    .empty {
      padding: 20px;
      text-align: center;
      border: 1px solid #d1d5db;
    }

    .footer {
      margin-top: 14px;
      color: #6b7280;
      font-size: 9px;
      text-align: right;
    }

    @media print {
      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <h1>BACCO IL TEMPIO DEL PANZEROTTO</h1>
  <h2>Prenotazioni del ${escapeHtml(formatDateIT(selectedDate))}</h2>
  <div id="print-content">
    <div class="empty">Caricamento prenotazioni...</div>
  </div>
</body>
</html>`
  )

  printWindow.document.close()

  try {
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

    if (reservationsError) {
      throw reservationsError
    }

    const reservations =
      reservationsData || []

    const customerIds = [
      ...new Set(
        reservations.map(
          reservation =>
            reservation.customer_id
        )
      ),
    ]

    const reservationIds =
      reservations.map(
        reservation =>
          reservation.id
      )

    const [
      customersResult,
      linksResult,
    ] = await Promise.all([
      customerIds.length > 0
        ? supabase
            .from('customers')
            .select(
              'id, full_name, phone'
            )
            .in(
              'id',
              customerIds
            )
        : Promise.resolve({
            data: [],
            error: null,
          }),

      reservationIds.length > 0
        ? supabase
            .from('reservation_tables')
            .select(
              'reservation_id, table_id'
            )
            .in(
              'reservation_id',
              reservationIds
            )
        : Promise.resolve({
            data: [],
            error: null,
          }),
    ])

    if (customersResult.error) {
      throw customersResult.error
    }

    if (linksResult.error) {
      throw linksResult.error
    }

    const links =
      linksResult.data || []

    const tableIds = [
      ...new Set(
        [
          ...reservations.map(
            reservation =>
              reservation.table_id
          ),
          ...links.map(
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

    const tablesResult =
      tableIds.length > 0
        ? await supabase
            .from('dining_tables')
            .select(
              'id, table_name'
            )
            .in(
              'id',
              tableIds
            )
        : {
            data: [],
            error: null,
          }

    if (tablesResult.error) {
      throw tablesResult.error
    }

    const customersMap =
      new Map(
        (
          customersResult.data ||
          []
        ).map(
          customer => [
            customer.id,
            customer,
          ]
        )
      )

    const tablesMap =
      new Map(
        (
          tablesResult.data ||
          []
        ).map(
          table => [
            table.id,
            table,
          ]
        )
      )

    const completeReservations =
      reservations.map(
        reservation => {
          const linkedTableIds =
            links
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

          return {
            ...reservation,
            customer:
              customersMap.get(
                reservation.customer_id
              ),
            tables:
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
                  ): table is {
                    id: string
                    table_name: string
                  } =>
                    Boolean(table)
                ),
          }
        }
      )

    const sortedReservations =
      sortPrintableReservations(
        completeReservations as PrintableReservation[]
      )

    const totalGuests =
      sortedReservations.reduce(
        (sum, reservation) =>
          sum +
          reservation.guests,
        0
      )

    const [
      roomsForPrintResult,
      tablesForPrintResult,
    ] = await Promise.all([
      supabase
        .from('rooms')
        .select(
          'id, room_name'
        )
        .eq(
          'restaurant_id',
          RESTAURANT_ID
        )
        .order('created_at'),

      supabase
        .from('dining_tables')
        .select(
          'id, room_id, table_name, seats, pos_x, pos_y'
        )
        .eq(
          'active',
          true
        ),
    ])

    if (roomsForPrintResult.error) {
      throw roomsForPrintResult.error
    }

    if (tablesForPrintResult.error) {
      throw tablesForPrintResult.error
    }

    const printableRooms =
      (roomsForPrintResult.data ||
        []) as PrintableRoom[]

    const printableTables =
      (tablesForPrintResult.data ||
        []) as PrintableTable[]

    const occupiedTableIds =
      new Set<string>()

    sortedReservations.forEach(
      reservation => {
        reservation.tables.forEach(
          table => {
            const matchingTable =
              printableTables.find(
                item =>
                  item.table_name ===
                  table.table_name
              )

            if (matchingTable) {
              occupiedTableIds.add(
                matchingTable.id
              )
            }
          }
        )
      }
    )

    links.forEach(link => {
      if (
        reservations.some(
          reservation =>
            reservation.id ===
            link.reservation_id
        )
      ) {
        occupiedTableIds.add(
          link.table_id
        )
      }
    })

    const tableReservationCount =
      new Map<string, number>()

    links.forEach(link => {
      tableReservationCount.set(
        link.table_id,
        (tableReservationCount.get(
          link.table_id
        ) || 0) + 1
      )
    })

    reservations.forEach(
      reservation => {
        if (
          reservation.table_id
        ) {
          tableReservationCount.set(
            reservation.table_id,
            (tableReservationCount.get(
              reservation.table_id
            ) || 0) + 1
          )
        }
      }
    )

    const mapsHtml =
      printableRooms
        .map(room => {
          const roomTables =
            printableTables
              .filter(
                table =>
                  table.room_id ===
                  room.id
              )
              .sort((a, b) =>
                a.table_name.localeCompare(
                  b.table_name,
                  'it',
                  {
                    numeric: true,
                    sensitivity: 'base',
                  }
                )
              )

          const tablesHtml =
            roomTables
              .map(table => {
                const occupied =
                  occupiedTableIds.has(
                    table.id
                  )

                const grouped =
                  (tableReservationCount.get(
                    table.id
                  ) || 0) > 0 &&
                  sortedReservations.some(
                    (reservation: PrintableReservation) =>
                      reservation.tables.length >
                        1 &&
                      reservation.tables.some(
                        (item: { table_name: string }) =>
                          item.table_name ===
                          table.table_name
                      )
                  )

                const left =
                  Math.max(
                    0,
                    Math.min(
                      100,
                      (table.pos_x /
                        920) *
                        100
                    )
                  )

                const top =
                  Math.max(
                    0,
                    Math.min(
                      100,
                      (table.pos_y /
                        600) *
                        100
                    )
                  )

                return `
                  <div
                    class="map-table ${occupied ? 'occupied' : 'free'}${grouped ? ' grouped' : ''}"
                    style="left:${left}%;top:${top}%;"
                    title="${escapeHtml(table.table_name)}"
                  >
                    <div class="name">${escapeHtml(table.table_name)}</div>
                    <div class="seats">${table.seats} coperti</div>
                    <div class="status">${occupied ? 'Occupato' : 'Libero'}</div>
                  </div>
                `
              })
              .join('')

          return `
            <section class="map-section">
              <h3 class="map-title">Mappa — ${escapeHtml(room.room_name)}</h3>
              <div class="map-legend">
                <span class="legend-item">
                  <span class="legend-dot" style="background:#dc2626"></span>
                  Occupato
                </span>
                <span class="legend-item">
                  <span class="legend-dot" style="background:#16a34a"></span>
                  Libero
                </span>
                <span class="legend-item">
                  <span class="legend-dot" style="background:#f59e0b"></span>
                  Tavolata
                </span>
              </div>
              <div class="map">
                ${tablesHtml}
              </div>
              <div class="map-note">
                Stato dei tavoli sulla giornata del ${escapeHtml(formatDateIT(selectedDate))}.
                I tavoli con una o più prenotazioni sono evidenziati in rosso.
              </div>
            </section>
          `
        })
        .join('')

    const rows =
      sortedReservations
        .map(
          reservation => {
            const tableNames =
              getSortedTableNames(
                reservation
              )

            const tableDisplay =
              tableNames.length > 0
                ? tableNames
                    .map(
                      table =>
                        escapeHtml(
                          table
                        )
                    )
                    .join(
                      ' + '
                    )
                : '—'

            const customerName =
              escapeHtml(
                reservation
                  .customer
                  ?.full_name ||
                  'Cliente non trovato'
              )

            const phone =
              reservation
                .customer
                ?.phone
                ? escapeHtml(
                    reservation
                      .customer
                      .phone
                  )
                : '—'

            const notes =
              reservation.notes
                ? escapeHtml(
                    reservation.notes
                  )
                : '—'

            const status =
              getStatusLabel(
                reservation.status
              )

            const statusClass =
              reservation.status ===
              'cancelled'
                ? ' class="cancelled"'
                : ''

            return `
              <tr>
                <td class="time">${escapeHtml(normalizeTime(reservation.reservation_time))}</td>
                <td class="table-name">${tableDisplay}</td>
                <td>
                  <div class="customer">${customerName}</div>
                  <div class="phone">${phone}</div>
                </td>
                <td>${reservation.guests}</td>
                <td${statusClass}>${escapeHtml(status)}</td>
                <td class="notes">${notes}</td>
              </tr>
            `
          }
        )
        .join('')

    const content =
      sortedReservations.length > 0
        ? `
          <div class="summary">
            <div><strong>${sortedReservations.length}</strong> prenotazioni</div>
            <div><strong>${totalGuests}</strong> coperti</div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Ora</th>
                <th>Tavolo</th>
                <th>Cliente / Telefono</th>
                <th>Coperti</th>
                <th>Stato</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>

          ${mapsHtml}

          <div class="footer">
            Stampato da Prenotazioni da Bacco
          </div>
        `
        : `
          <div class="empty">
            Nessuna prenotazione per questa giornata.
          </div>
        `

    const contentElement =
      printWindow.document.getElementById(
        'print-content'
      )

    if (contentElement) {
      contentElement.innerHTML =
        content
    }

    printWindow.focus()

    window.setTimeout(
      () => {
        printWindow.print()
      },
      150
    )
  } catch (printError) {
    console.error(
      'ERRORE STAMPA PRENOTAZIONI:',
      printError
    )

    const contentElement =
      printWindow.document.getElementById(
        'print-content'
      )

    if (contentElement) {
      contentElement.innerHTML = `
        <div class="empty">
          Errore durante il caricamento delle prenotazioni.
        </div>
      `
    }
  }
}

export default function Dashboard() {
  const [selectedDate, setSelectedDate] =
    useState(getLocalDate())

  const [showTables, setShowTables] =
    useState(false)

  const [showNew, setShowNew] =
    useState(false)

  const [
    reservationSelection,
    setReservationSelection,
  ] =
    useState<ReservationSelection | null>(
      null
    )

  function openNewReservation(
    selection?: ReservationSelection
  ) {
    if (selection) {
      setReservationSelection(
        selection
      )

      setSelectedDate(
        selection.date
      )
    } else {
      setReservationSelection(
        null
      )
    }

    setShowNew(true)
  }

  function closeNewReservation() {
    setShowNew(false)
    setReservationSelection(
      null
    )
  }

  if (showNew) {
    return (
      <NewReservation
        initialSelection={
          reservationSelection ?? undefined
        }
        defaultDate={
          selectedDate
        }
        onBack={
          closeNewReservation
        }
      />
    )
  }

  if (showTables) {
    return (
      <TableManagement
        onBack={() =>
          setShowTables(false)
        }
      />
    )
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>
        BACCO IL TEMPIO DEL PANZEROTTO
      </h1>

      <h2>
        Dashboard
      </h2>

      <div
        style={{
          marginBottom: 20,
        }}
      >
        <label>
          📅 Data:
        </label>

        <ItalianDateInput
          value={selectedDate}
          onChange={setSelectedDate}
          style={{
            marginLeft: 10,
            padding: 6,
            width: 110,
          }}
        />
      </div>

      <DashboardStats
        selectedDate={
          selectedDate
        }
      />

      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          marginTop: 20,
        }}
      >
        <button
          onClick={() =>
            setShowTables(true)
          }
        >
          ⚙️ Tavoli
        </button>

        <button
          onClick={() =>
            openNewReservation()
          }
        >
          ➕ Nuova Prenotazione
        </button>

        <button
          onClick={() =>
            void printDailyReservations(
              selectedDate
            )
          }
        >
          🖨️ Stampa prenotazioni
        </button>

        <button
          onClick={logout}
        >
          🚪 Logout
        </button>
      </div>

      <br />

      <ReservationsList
        selectedDate={
          selectedDate
        }
      />

      <br />

      <hr />

      <TableMap
        selectedDate={
          selectedDate
        }
        onReserveSelected={
          openNewReservation
        }
      />
    </div>
  )
}
