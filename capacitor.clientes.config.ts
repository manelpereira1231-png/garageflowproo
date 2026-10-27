import type { CapacitorConfig } from '@capacitor/cli';

// App dedicada aos clientes finais: abre apenas o ecrã de associação e o portal existente.
// Usar com: CAPACITOR_CONFIG=capacitor.clientes.config.ts (ver README de distribuição).
const config: CapacitorConfig = {
  appId: 'pt.garageflow.clientes',
  appName: 'GarageFlow Clientes',
  webDir: 'dist',
  server: {
    url: 'https://garageflow.pt/app-clientes',
    allowNavigation: ['garageflow.pt', 'www.garageflow.pt'],
  },
  plugins: {
    SplashScreen: { launchShowDuration: 1000, backgroundColor: '#0F172A', showSpinner: false },
    StatusBar: { style: 'DARK', backgroundColor: '#0F172A' },
  },
};

export default config;
