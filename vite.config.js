import { resolve } from 'path'
import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

const rewritePlugin = () => {
    return {
        name: 'rewrite-middleware',
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                if (req.url.startsWith('/makerspace')) {
                    req.url = req.url.replace('/makerspace', '/pages/makerspace')
                } else if (req.url.startsWith('/building')) {
                    req.url = req.url.replace('/building', '/pages/building')
                } else if (req.url.startsWith('/contact')) {
                    req.url = req.url.replace('/contact', '/pages/contact')
                }
                next()
            })
        }
    }
}

export default defineConfig({
    plugins: [
        rewritePlugin(),
        viteStaticCopy({
            targets: [
                { src: 'app/scripts/*', dest: 'app/scripts' },
                { src: 'app/components/*', dest: 'app/components' },
                { src: 'app/data/*', dest: 'app/data' },
            ],
        }),
    ],
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                notFound: resolve(__dirname, '404.html'),
                building: resolve(__dirname, 'pages/building/index.html'),
                contact: resolve(__dirname, 'pages/contact/index.html'),
                makerspace: resolve(__dirname, 'pages/makerspace/index.html'),
            },
        },
    },
})
