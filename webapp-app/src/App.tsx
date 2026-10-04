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

  return authenticated ? (
    <Dashboard />
  ) : (
    <Login />
  )
}

export default App