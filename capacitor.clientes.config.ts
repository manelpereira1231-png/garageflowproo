import type { CapacitorConfig } from '@capacitor/cli';

// App dedicada aos clientes finais: abre apenas o ecrã de associação e o portal existente.
// Gerar: copiar este ficheiro para capacitor.config.ts apenas numa cópia de build (ver docs/android-clientes.md).
const config: CapacitorConfig = {
  appId: 'pt.garageflow.clientes',
  appName: 'GarageFlow Clientes',
  webDir: 'dist',
  // Pasta nativa própria: não colide com a app das oficinas (android/).
  android: { path: 'android-clientes' },
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
