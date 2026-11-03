import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatDateIT } from '../lib/dateUtils'

const RESTAURANT_ID = '0153d55d-1f5c-42c9-8da2-4eab40533c4e'

type ClosureDay = {
  id: string
  closed_date: string
}

function addDays(date: string, amount: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const value = new Date(Date.UTC(year, month - 1, day + amount))
  return [
    value.getUTCFullYear(),
    String(value.getUTCMonth() + 1).padStart(2, '0'),
    String(value.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

export default function ClosureManagement({ onBack }: { onBack: () => void }) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [closures, setClosures] = useState<ClosureDay[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingDate, setEditingDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function loadClosures() {
    setLoading(true)
    setError('')
    const { data, error: loadError } = await supabase
      .from('business_closures')
      .select('id, closed_date')
      .eq('restaurant_id', RESTAURANT_ID)
      .order('closed_date')

    if (loadError) {
      setError(`Errore caricamento chiusure: ${loadError.message}`)
    } else {
      setClosures(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    void loadClosures()
  }, [])

  async function saveRange() {
    setMessage('')
    setError('')
    if (!startDate || !endDate) {
      setError('Seleziona la data iniziale e quella finale.')
      return
    }
    if (endDate < startDate) {
      setError('La data finale non può precedere quella iniziale.')
      return
    }

    const days: { restaurant_id: string; closed_date: string }[] = []
    for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
      days.push({ restaurant_id: RESTAURANT_ID, closed_date: date })
      if (days.length > 366) {
        setError('Puoi impostare al massimo un anno di chiusura per volta.')
        return
      }
    }

    setSaving(true)
    const { error: saveError } = await supabase
      .from('business_closures')
      .upsert(days, { onConflict: 'restaurant_id,closed_date', ignoreDuplicates: true })

    if (saveError) {
      setError(`Errore salvataggio chiusura: ${saveError.message}`)
    } else {
      setMessage(`Chiusura impostata dal ${formatDateIT(startDate)} al ${formatDateIT(endDate)}.`)
      setStartDate('')
      setEndDate('')
      await loadClosures()
    }
    setSaving(false)
  }

  async function updateDay(id: string) {
    setError('')
    setMessage('')
    if (!editingDate) {
      setError('Seleziona una data valida.')
      return
    }
    const duplicate = closures.some(item => item.id !== id && item.closed_date === editingDate)
    if (duplicate) {
      setError('Questa giornata risulta già impostata come chiusura.')
      return
    }
    setSaving(true)
    const { error: updateError } = await supabase
      .from('business_closures')
      .update({ closed_date: editingDate })
      .eq('id', id)
      .eq('restaurant_id', RESTAURANT_ID)

    if (updateError) {
      setError(`Errore modifica data: ${updateError.message}`)
    } else {
      setMessage('Giornata di chiusura aggiornata.')
      setEditingId(null)
      setEditingDate('')
      await loadClosures()
    }
    setSaving(false)
  }

  async function removeDay(id: string, date: string) {
    if (!window.confirm(`Vuoi riaprire Bacco il ${formatDateIT(date)}?`)) return
    setError('')
    setMessage('')
    const { error: deleteError } = await supabase
      .from('business_closures')
      .delete()
      .eq('id', id)
      .eq('restaurant_id', RESTAURANT_ID)

    if (deleteError) {
      setError(`Errore riapertura giornata: ${deleteError.message}`)
    } else {
      setMessage(`Il ${formatDateIT(date)} è stato riaperto.`)
      await loadClosures()
    }
  }

  return (
    <div style={{ padding: 20, maxWidth: 760, margin: '0 auto', color: '#f8fafc' }}>
      <button type="button" onClick={onBack} style={{ padding: '9px 14px', marginBottom: 18 }}>← Torna alla Dashboard</button>
      <h1>📅 Chiusure per ferie</h1>
      <p style={{ color: '#cbd5e1' }}>Seleziona il primo e l’ultimo giorno di chiusura. Tutte le date comprese saranno bloccate per le nuove prenotazioni.</p>

      <section style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, padding: 18, marginTop: 18 }}>
        <h2 style={{ marginTop: 0 }}>Imposta un periodo</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
          <label>Dal
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 6, padding: 11, borderRadius: 7 }} />
          </label>
          <label>Al
            <input type="date" min={startDate || undefined} value={endDate} onChange={e => setEndDate(e.target.value)} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 6, padding: 11, borderRadius: 7 }} />
          </label>
        </div>
        <button type="button" disabled={saving} onClick={() => void saveRange()} style={{ marginTop: 16, padding: '11px 18px', border: 0, borderRadius: 8, background: saving ? '#475569' : '#2563eb', color: 'white', fontWeight: 700 }}>
          {saving ? 'Salvataggio…' : 'Imposta chiusura'}
        </button>
      </section>

      {message && <div role="status" style={{ marginTop: 14, padding: 12, borderRadius: 8, background: '#052e16', color: '#86efac' }}>{message}</div>}
      {error && <div role="alert" style={{ marginTop: 14, padding: 12, borderRadius: 8, background: '#450a0a', color: '#fecaca' }}>{error}</div>}

      <section style={{ marginTop: 24 }}>
        <h2>Giornate già impostate</h2>
        {loading ? <p>Caricamento…</p> : closures.length === 0 ? (
          <p style={{ color: '#cbd5e1' }}>Non ci sono giornate di chiusura programmate.</p>
        ) : (
          <div style={{ display: 'grid', gap: 9 }}>
            {closures.map(day => (
              <div key={day.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 12, background: '#0f172a', border: '1px solid #334155', borderRadius: 9 }}>
                {editingId === day.id ? (
                  <>
                    <input type="date" value={editingDate} onChange={e => setEditingDate(e.target.value)} style={{ padding: 9, borderRadius: 6 }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" disabled={saving} onClick={() => void updateDay(day.id)}>Salva</button>
                      <button type="button" onClick={() => { setEditingId(null); setEditingDate('') }}>Annulla</button>
                    </div>
                  </>
                ) : (
                  <>
                    <strong>🔒 {formatDateIT(day.closed_date)}</strong>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" onClick={() => { setEditingId(day.id); setEditingDate(day.closed_date) }}>Modifica</button>
                      <button type="button" disabled={saving} onClick={() => void removeDay(day.id, day.closed_date)} style={{ background: '#991b1b', color: 'white' }}>Riapri giorno</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
