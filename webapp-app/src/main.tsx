import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SplashScreen } from '@capacitor/splash-screen'
import './index.css'
import App from './App.tsx'

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

  // Nasconde la Splash Screen nativa solo dopo
  // che l'app React è stata montata.
  try {
    await SplashScreen.hide()
  } catch {
    // Sul browser/web la Splash Screen nativa non esiste:
    // ignoriamo semplicemente l'errore.
  }
}

void startApp()