import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

function App() {
  const [authenticated, setAuthenticated] =
    useState(false)

  useEffect(() => {
    async function check() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      setAuthenticated(!!session)
    }

    check()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setAuthenticated(!!session)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return (
    <div className="app-shell">
      <div className="app-content">
        {authenticated ? <Dashboard /> : <Login />}
      </div>
      <footer className="app-copyright">
        © 2026 Francesco Colella — Prenotazioni da Bacco™ — Tutti i diritti riservati.
      </footer>
    </div>
  )
}

export default App