import { resolve } from 'path'
import { randomUUID } from 'node:crypto'
import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

const bookingDates = [
    '2026-09-01', '2026-09-03', '2026-09-08', '2026-09-10', '2026-09-15',
    '2026-09-17', '2026-09-22', '2026-09-24', '2026-09-29',
]
const bookingPeriods = ['morning', 'evening']

const bookingApiPlugin = () => {
    const bookings = []

    const sendJson = (res, status, body) => {
        res.statusCode = status
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        res.end(JSON.stringify(body))
    }

    const readBody = (req) => new Promise((resolve, reject) => {
        let body = ''
        req.on('data', (chunk) => { body += chunk })
        req.on('end', () => {
            try {
                resolve(JSON.parse(body || '{}'))
            } catch (error) {
                reject(error)
            }
        })
        req.on('error', reject)
    })

    return {
        name: 'booking-api',
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                const url = new URL(req.url, 'http://localhost')

                if (url.pathname === '/api/availability' && req.method === 'GET') {
                    const sessions = bookingDates.flatMap((date) => (
                        bookingPeriods.map((period) => {
                            const reserved = bookings.filter((booking) => (
                                booking.date === date && booking.period === period
                            )).length
                            return { date, period, capacity: 3, reserved, remaining: Math.max(0, 3 - reserved) }
                        })
                    ))
                    return sendJson(res, 200, { sessions })
                }

                if (url.pathname === '/api/bookings' && req.method === 'POST') {
                    try {
                        const input = await readBody(req)
                        const reserved = bookings.filter((booking) => (
                            booking.date === input.date && booking.period === input.period
                        )).length

                        if (reserved >= 3) {
                            return sendJson(res, 409, { error: 'That session has just filled up. Please choose another.' })
                        }

                        const bookingId = randomUUID()
                        bookings.push({ ...input, id: bookingId })
                        return sendJson(res, 201, {
                            bookingId,
                            paymentUrl: 'https://paystack.com/buy/introduction-to-making',
                        })
                    } catch (error) {
                        return sendJson(res, 400, { error: 'The booking details could not be read.' })
                    }
                }

                next()
            })
        },
    }
}

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
                } else if (req.url.startsWith('/rent')) {
                    req.url = req.url.replace('/rent', '/pages/rent')
                } else if (req.url.startsWith('/film-club')) {
                    req.url = req.url.replace('/film-club', '/pages/film-club')
                }
                next()
            })
        }
    }
}

export default defineConfig({
    plugins: [
        bookingApiPlugin(),
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
                rent: resolve(__dirname, 'pages/rent/index.html'),
                filmClub: resolve(__dirname, 'pages/film-club/index.html'),
                makerspace: resolve(__dirname, 'pages/makerspace/index.html'),
                archiveV1: resolve(__dirname, 'archive/v1/index.html'),
                archiveV1Building: resolve(__dirname, 'archive/v1/building/index.html'),
                archiveV1Contact: resolve(__dirname, 'archive/v1/contact/index.html'),
                archiveV1FilmClub: resolve(__dirname, 'archive/v1/film-club/index.html'),
                archiveV1Makerspace: resolve(__dirname, 'archive/v1/makerspace/index.html'),
            },
        },
    },
})
