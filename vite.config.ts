// Architecture : app unique Vite servant les 4 surfaces (EP, IR, admin, audience)
// via des routes lazy-loadées — voir PLAN.md §2 (décision D11).
// PWA : installable et restreinte à la régie via `scope: /control` (restriction
// soft — naviguer hors scope rouvre le navigateur normal).
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto', // registration injectée → pas de modif de main.tsx
      includeAssets: ['apple-touch-icon.png'],
      scope: '/control',
      manifest: {
        name: 'Régie — Tables Rondes Design',
        short_name: 'Régie',
        description: "Régie de l'écran projeté pour tables rondes design",
        lang: 'fr',
        start_url: '/control',
        scope: '/control',
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Le fallback SPA du SW ne s'applique qu'à la régie : les 3 autres
        // surfaces ne sont pas servies depuis l'app installée.
        navigateFallbackDenylist: [/^\/screen/, /^\/q/, /^\/admin/],
      },
    }),
  ],
})
