import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                notFound: resolve(__dirname, '404.html'),
                building: resolve(__dirname, 'building/index.html'),
                filmClub: resolve(__dirname, 'film-club/index.html'),
                makerspace: resolve(__dirname, 'makerspace/index.html'),
            },
        },
    },
})
