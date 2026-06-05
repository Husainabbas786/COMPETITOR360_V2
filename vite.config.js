import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The app reads master-data.json from the project root — the single source of truth.
// Keeping it at the root (next to the .xlsx) means dropping in updated data needs no code change.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
})
