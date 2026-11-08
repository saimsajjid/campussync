import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3050,
    host: true,
    proxy: {
      '/sync': 'http://150.136.103.208',
      '/auth': 'http://150.136.103.208',
      '/conflicts': 'http://150.136.103.208',
      '/students': 'http://150.136.103.208',
      '/admin': 'http://150.136.103.208',
      '/demo': 'http://150.136.103.208',
      '/events': 'http://150.136.103.208',
      '/health': 'http://150.136.103.208',
    },
  },
});
