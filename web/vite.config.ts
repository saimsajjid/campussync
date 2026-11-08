import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'fonts/*', 'pwa-*.png'],
      manifest: {
        name: 'CampusSync - Multi-Campus Sync Engine',
        short_name: 'CampusSync',
        description: 'Offline-First Dependable Sync Engine for Multi-Campus Records',
        theme_color: '#1E293B',
        background_color: '#F4F6FA',
        display: 'standalone',
        orientation: 'any',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [
          /^\/auth/,
          /^\/sync/,
          /^\/conflicts/,
          /^\/students/,
          /^\/admin/,
          /^\/demo/,
          /^\/events/,
          /^\/health/,
          /^\/api/,
        ],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/fonts/') || url.pathname.endsWith('.woff2'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'campussync-fonts',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/auth') ||
              url.pathname.startsWith('/sync') ||
              url.pathname.startsWith('/conflicts') ||
              url.pathname.startsWith('/students') ||
              url.pathname.startsWith('/admin') ||
              url.pathname.startsWith('/demo') ||
              url.pathname.startsWith('/events') ||
              url.pathname.startsWith('/health') ||
              url.pathname.startsWith('/api'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
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
