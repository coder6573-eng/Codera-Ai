import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'ai.codera.app',
  appName: 'Codera AI',
  webDir: 'dist',
  plugins: { CapacitorHttp: { enabled: true } }
};
export default config;
