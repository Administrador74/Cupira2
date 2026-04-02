import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.foxblack.app',
  appName: 'FOXBLACK',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
