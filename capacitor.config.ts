import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.1c889e563ee54eeebb22adb65e48f639',
  appName: 'Berber Randevu',
  webDir: 'dist',
  server: {
    url: 'https://1c889e56-3ee5-4eee-bb22-adb65e48f639.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#0a0a0a',
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
