import { useState } from 'react'
import NewReservation from './NewReservation'
import { supabase } from '../lib/supabase'
import ReservationsList from './ReservationsList'
import TableMap from './TableMap'
import DashboardStats from './DashboardStats'
import TableManagement from './TableManagement'
import ItalianDateInput from '../lib/ItalianDateInput'
import { formatDateIT } from '../lib/dateUtils'

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