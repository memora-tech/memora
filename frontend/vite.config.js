import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true, type: 'module' },
      includeAssets: ['icons/favicon.svg'],
      manifest: {
        id: '/app',
        name: 'Memora',
        short_name: 'Memora',
        description: 'Flashcards gerados por IA, repetição espaçada e comunidade de estudo.',
        lang: 'pt-BR',
        dir: 'ltr',
        start_url: '/app',
        scope: '/',
        display: 'standalone',
        background_color: '#FAFAF7',
        theme_color: '#FAFAF7',
        categories: ['education', 'productivity'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ],
        shortcuts: [
          { name: 'Começar a estudar', url: '/app?acao=comecar', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Criar deck', url: '/app/criar', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Carteira', url: '/app/carteira', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/v1\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'memora-fonts-css' }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'memora-fonts-files', expiration: { maxEntries: 24, maxAgeSeconds: 31536000 } }
          },
          {
            urlPattern: /\/v1\/(me|study\/today|decks|wallet)(\/|\?|$)/,
            handler: 'NetworkFirst',
            options: { cacheName: 'memora-api', networkTimeoutSeconds: 3, expiration: { maxEntries: 64, maxAgeSeconds: 604800 } }
          }
        ]
      }
    })
  ],
  server: {
    port: 5180,
    proxy: { '/v1': { target: 'http://localhost:3180', changeOrigin: true } }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    css: { modules: { classNameStrategy: 'non-scoped' } }
  }
})
