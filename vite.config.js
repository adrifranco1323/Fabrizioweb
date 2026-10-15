import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'offline-precache-manifest',
      generateBundle(_, bundle) {
        const assets = Object.keys(bundle).filter(file => file.startsWith('assets/'))
        this.emitFile({
          type: 'asset',
          fileName: 'precache-manifest.json',
          source: JSON.stringify(assets.map(file => `/${file}`)),
        })
      },
    },
  ],
})