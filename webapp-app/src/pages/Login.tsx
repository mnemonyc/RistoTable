import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  async function login() {
    setMessage('Accesso in corso...')

    const { error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      })

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('')
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>RistoTable</h1>

      <div>
        <input
          placeholder="Email"
          value={email}
          onChange={(e) =>
            setEmail(e.target.value)
          }
        />
      </div>

      <br />

      <div>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) =>
            setPassword(e.target.value)
          }
        />
      </div>

      <br />

      <button onClick={login}>
        Accedi
      </button>

      <br />
      <br />

      <div>{message}</div>
    </div>
  )
}