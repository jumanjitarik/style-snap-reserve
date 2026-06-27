import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kuaforapp.app',
  appName: 'Kuafor App',
  webDir: 'output/public',
  server: {
    url: 'https://kuaforapp.antalyasosyal.com',
    cleartext: false
  }
};

export default config;