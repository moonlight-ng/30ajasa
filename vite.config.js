import { resolve } from 'path'
import { randomUUID } from 'node:crypto'
import { defineConfig, loadEnv } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import {
    getWorkshop,
    SESSION_CAPACITY,
    SESSION_DATES,
    SESSION_PERIODS,
    WORKSHOPS,
} from './server/config.js'
import { requirePaystackProduct } from './server/paystack.js'

const PAYSTACK_ENV_KEYS = [
    'PAYSTACK_PUBLIC_KEY',
    'PAYSTACK_PRODUCT_ID',
    'PAYSTACK_PRODUCT_CODE',
    'PAYSTACK_PRODUCT_PAGE_SLUG',
    'PAYSTACK_VARIANT_OPTION_ID',
    'PAYSTACK_VARIANT_VALUE_CERAMICS_ID',
    'PAYSTACK_PRODUCT_VARIANT_CERAMICS_ID',
    'PAYSTACK_VARIANT_CERAMICS_AMOUNT',
    'PAYSTACK_VARIANT_VALUE_3D_PRINTING_ID',
    'PAYSTACK_PRODUCT_VARIANT_3D_PRINTING_ID',
    'PAYSTACK_VARIANT_3D_PRINTING_AMOUNT',
    'PAYSTACK_VARIANT_VALUE_MAKING_ID',
    'PAYSTACK_PRODUCT_VARIANT_MAKING_ID',
    'PAYSTACK_VARIANT_MAKING_AMOUNT',
]

const bookingApiPlugin = (paystackEnv) => {
    const publicKey = paystackEnv.PAYSTACK_PUBLIC_KEY
    const bookings = []
    const payments = []

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
                    const sessions = SESSION_DATES.flatMap((date) => (
                        SESSION_PERIODS.map((period) => {
                            const reserved = bookings
                                .filter((booking) => (
                                    booking.date === date
                                    && booking.period === period
                                    && ['reserved', 'paid'].includes(booking.status)
                                ))
                                .reduce((total, booking) => total + booking.quantity, 0)
                            return {
                                date,
                                period,
                                capacity: SESSION_CAPACITY,
                                reserved,
                                remaining: Math.max(0, SESSION_CAPACITY - reserved),
                            }
                        })
                    ))
                    let workshops
                    try {
                        workshops = Object.entries(WORKSHOPS).map(([slug, workshop]) => ({
                            slug,
                            name: workshop.name,
                            amount: requirePaystackProduct(paystackEnv, slug).amount,
                            currency: 'NGN',
                        }))
                    } catch (error) {
                        return sendJson(res, error.status || 503, { error: error.message })
                    }

                    return sendJson(res, 200, { sessions, workshops })
                }

                if (url.pathname === '/api/bookings' && req.method === 'POST') {
                    try {
                        const input = await readBody(req)
                        const workshop = getWorkshop(input.classSlug)
                        if (!workshop) return sendJson(res, 400, { error: 'Choose a valid class.' })
                        if (!publicKey?.startsWith('pk_test_')) {
                            return sendJson(res, 503, { error: 'Paystack Popup requires a public test key.' })
                        }

                        let paystackProduct
                        try {
                            paystackProduct = requirePaystackProduct(paystackEnv, input.classSlug)
                        } catch (error) {
                            return sendJson(res, error.status || 503, { error: error.message })
                        }

                        const quantity = Number(input.quantity || 1)
                        if (!Number.isInteger(quantity) || quantity < 1 || quantity > SESSION_CAPACITY) {
                            return sendJson(res, 400, { error: `Choose between 1 and ${SESSION_CAPACITY} places.` })
                        }

                        const reserved = bookings
                            .filter((booking) => (
                                booking.date === input.date
                                && booking.period === input.period
                                && ['reserved', 'paid'].includes(booking.status)
                            ))
                            .reduce((total, booking) => total + booking.quantity, 0)

                        if (reserved + quantity > SESSION_CAPACITY) {
                            return sendJson(res, 409, { error: 'That session has just filled up. Please choose another.' })
                        }

                        const bookingId = randomUUID()
                        const reference = `local-${Date.now().toString(36)}-${bookingId.replaceAll('-', '').slice(0, 8)}`
                        bookings.push({ ...input, quantity, id: bookingId, status: 'reserved' })
                        payments.push({
                            reference,
                            bookingId,
                            amount: paystackProduct.amount * quantity,
                            currency: 'NGN',
                            environment: 'test',
                            productId: paystackProduct.id,
                            productCode: paystackProduct.code,
                            productVariantId: paystackProduct.productVariantId,
                            variantOptionId: paystackProduct.variantOptionId,
                            variantValueId: paystackProduct.variantValueId,
                            status: 'pending',
                            createdAt: new Date().toISOString(),
                        })
                        return sendJson(res, 201, {
                            bookingId,
                            reference,
                            checkout: {
                                publicKey,
                                email: input.email.toLowerCase(),
                                amount: paystackProduct.amount * quantity,
                                currency: 'NGN',
                                reference,
                                metadata: {
                                    booking_id: bookingId,
                                    product_slug: input.classSlug,
                                    product_id: paystackProduct.id,
                                    product_code: paystackProduct.code,
                                    product_page_slug: paystackProduct.pageSlug,
                                    product_variant_id: paystackProduct.productVariantId,
                                    variant_option_id: paystackProduct.variantOptionId,
                                    variant_value_id: paystackProduct.variantValueId,
                                    session_date: input.date,
                                    session_period: input.period,
                                    quantity,
                                },
                            },
                        })
                    } catch (error) {
                        return sendJson(res, 400, { error: 'The booking details could not be read.' })
                    }
                }

                if (url.pathname === '/api/bookings/cancel' && req.method === 'POST') {
                    try {
                        const input = await readBody(req)
                        const booking = bookings.find((candidate) => candidate.id === input.bookingId)
                        const payment = payments.find((candidate) => (
                            candidate.bookingId === input.bookingId
                            && candidate.reference === input.reference
                        ))

                        if (!booking || !payment) {
                            return sendJson(res, 404, { error: 'We could not find that reservation.' })
                        }
                        if (booking.status === 'cancelled') {
                            return sendJson(res, 200, { cancelled: true, alreadyCancelled: true })
                        }
                        if (booking.status === 'paid' || payment.status === 'success') {
                            return sendJson(res, 409, { error: 'That booking has already been paid.' })
                        }
                        if (booking.status !== 'reserved' || payment.status !== 'pending') {
                            return sendJson(res, 409, { error: 'That reservation can no longer be cancelled.' })
                        }

                        booking.status = 'cancelled'
                        payment.status = 'failed'
                        payment.providerStatus = 'customer_cancelled_popup'
                        return sendJson(res, 200, { cancelled: true, alreadyCancelled: false })
                    } catch (error) {
                        return sendJson(res, 400, { error: 'The cancellation details could not be read.' })
                    }
                }

                if (url.pathname === '/api/payments/acknowledge' && req.method === 'POST') {
                    const input = await readBody(req)
                    const payment = payments.find((candidate) => candidate.reference === input.reference)
                    const popupReference = input.transaction?.reference || input.transaction?.trxref
                    if (!payment || popupReference !== payment.reference || input.transaction?.status !== 'success') {
                        return sendJson(res, 400, { error: 'The Paystack Popup result is incomplete.' })
                    }

                    payment.status = 'unverified'
                    payment.paidAt = payment.paidAt || new Date().toISOString()
                    payment.providerTransactionId = input.transaction.transaction || input.transaction.trans || null
                    return sendJson(res, 200, { status: payment.status, reference: payment.reference })
                }

                if (url.pathname === '/api/payments/status' && req.method === 'GET') {
                    const reference = url.searchParams.get('reference')
                    const payment = payments.find((candidate) => candidate.reference === reference)
                    const booking = bookings.find((candidate) => candidate.id === payment?.bookingId)
                    if (!payment || !booking) {
                        return sendJson(res, 404, { error: 'We could not find that payment.' })
                    }

                    return sendJson(res, 200, {
                        ...payment,
                        email: booking.email.toLowerCase(),
                        customerName: booking.name,
                        workshop: getWorkshop(booking.classSlug).name,
                        classSlug: booking.classSlug,
                        sessionDate: booking.date,
                        sessionPeriod: booking.period,
                        quantity: booking.quantity,
                    })
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
                } else if (req.url.startsWith('/film-club')) {
                    req.url = req.url.replace('/film-club', '/pages/film-club')
                } else if (req.url.startsWith('/payment-complete')) {
                    req.url = req.url.replace('/payment-complete', '/pages/payment-complete')
                }
                next()
            })
        }
    }
}

export default defineConfig(({ mode }) => {
    const localEnv = loadEnv(mode, __dirname, '')
    const paystackEnv = Object.fromEntries(
        PAYSTACK_ENV_KEYS.map((key) => [key, process.env[key] || localEnv[key]])
    )

    return {
        plugins: [
            bookingApiPlugin(paystackEnv),
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
                    filmClub: resolve(__dirname, 'pages/film-club/index.html'),
                    makerspace: resolve(__dirname, 'pages/makerspace/index.html'),
                    paymentComplete: resolve(__dirname, 'pages/payment-complete/index.html'),
                    archiveV1: resolve(__dirname, 'archive/v1/index.html'),
                    archiveV1Building: resolve(__dirname, 'archive/v1/building/index.html'),
                    archiveV1Contact: resolve(__dirname, 'archive/v1/contact/index.html'),
                    archiveV1FilmClub: resolve(__dirname, 'archive/v1/film-club/index.html'),
                    archiveV1Makerspace: resolve(__dirname, 'archive/v1/makerspace/index.html'),
                },
            },
        },
    }
})
