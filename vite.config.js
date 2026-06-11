import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base auf Repo-Namen setzen für GitHub Pages
// Falls du das Repo anders nennst, hier anpassen
export default defineConfig({
  plugins: [react()],
  base: '/odonics_wmdashboard/',
})
