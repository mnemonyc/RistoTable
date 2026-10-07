import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SplashScreen } from '@capacitor/splash-screen'
import './index.css'
import App from './App.tsx'

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds)
  })
}

async function startApp() {
  const rootElement = document.getElementById('root')

  if (!rootElement) {
    throw new Error('Elemento root non trovato')
  }

  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )

  try {
    /*
     * Lasciamo alla UI React il tempo di essere realmente visibile.
     * In questo modo evitiamo il flash grigio tra Splash e Login.
     */
    await wait(1200)
    await SplashScreen.hide()
  } catch {
    /*
     * Nel browser/web la Splash nativa non esiste.
     * L'eventuale errore viene ignorato.
     */
  }
}

void startApp()