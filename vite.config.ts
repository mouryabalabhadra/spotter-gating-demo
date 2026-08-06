import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [react()],
    build: {
        // Served by the Worker's ASSETS binding — see wrangler.jsonc.
        outDir: 'dist',
        sourcemap: true,
    },
    server: {
        port: 5173,
        // `npm run dev` runs Vite alone, so proxy the API to a `wrangler dev`
        // on 8787. Use `npm run preview` to exercise the real Worker instead.
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:8787',
                changeOrigin: true,
            },
        },
    },
});
