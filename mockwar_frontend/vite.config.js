import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', // Vercel के लिए इसे '/' रखना बेस्ट है
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1000, // फालतू की वॉर्निंग्स बंद करने के लिए
  }
})