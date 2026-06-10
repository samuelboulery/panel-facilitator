// Architecture : app unique Vite servant les 4 surfaces (EP, IR, admin, audience)
// via des routes lazy-loadées — voir PLAN.md §2 (décision D11).
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
