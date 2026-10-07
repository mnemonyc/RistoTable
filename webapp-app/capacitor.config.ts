import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.ristotable.app',
  appName: 'Prenotazioni da Bacco',
  webDir: 'dist',

  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      launchShowDuration: 2500,
      launchFadeOutDuration: 250,
      showSpinner: false,
      backgroundColor: '#1f7a3a',
    },
  },
}

export default config