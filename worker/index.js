const SESSION_DATES = [
    '2026-09-01',
    '2026-09-03',
    '2026-09-08',
    '2026-09-10',
    '2026-09-15',
    '2026-09-17',
    '2026-09-22',
    '2026-09-24',
    '2026-09-29',
];

const SESSION_PERIODS = ['morning', 'evening'];
const CLASS_SLUGS = [
    'introduction-to-clay',
    'introduction-to-3d-printing',
    'introduction-to-making',
];
const SESSION_CAPACITY = 3;
const PAYMENT_URL = 'https://paystack.com/buy/introduction-to-making';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
    },
});

async function ensureDatabase(db) {
    await db.batch([
        db.prepare(`
            CREATE TABLE IF NOT EXISTS bookings (
                id TEXT PRIMARY KEY,
                class_slug TEXT NOT NULL,
                session_date TEXT NOT NULL,
                session_period TEXT NOT NULL CHECK (session_period IN ('morning', 'evening')),
                customer_name TEXT NOT NULL,
                customer_email TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'paid', 'cancelled')),
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        `),
        db.prepare(`
            CREATE INDEX IF NOT EXISTS idx_bookings_session_status
            ON bookings (session_date, session_period, status)
        `),
    ]);
}

async function getAvailability(db) {
    await ensureDatabase(db);

    const query = await db.prepare(`
        SELECT session_date, session_period, COUNT(*) AS reserved
        FROM bookings
        WHERE status IN ('reserved', 'paid')
        GROUP BY session_date, session_period
    `).all();

    const reservedBySession = new Map(
        (query.results || []).map((row) => [
            `${row.session_date}:${row.session_period}`,
            Number(row.reserved),
        ])
    );

    const sessions = SESSION_DATES.flatMap((date) => (
        SESSION_PERIODS.map((period) => {
            const reserved = reservedBySession.get(`${date}:${period}`) || 0;
            return {
                date,
                period,
                capacity: SESSION_CAPACITY,
                reserved,
                remaining: Math.max(0, SESSION_CAPACITY - reserved),
            };
        })
    ));

    return json({ sessions });
}

function validateBooking(input) {
    const classSlug = String(input.classSlug || '');
    const date = String(input.date || '');
    const period = String(input.period || '');
    const name = String(input.name || '').trim();
    const email = String(input.email || '').trim().toLowerCase();

    if (!CLASS_SLUGS.includes(classSlug)) return { error: 'Choose a valid class.' };
    if (!SESSION_DATES.includes(date)) return { error: 'Choose a valid session date.' };
    if (!SESSION_PERIODS.includes(period)) return { error: 'Choose Morning or Evening.' };
    if (name.length < 2 || name.length > 100) return { error: 'Enter your name.' };
    if (email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { error: 'Enter a valid email address.' };
    }

    return { classSlug, date, period, name, email };
}

async function createBooking(request, db) {
    await ensureDatabase(db);

    let input;
    try {
        input = await request.json();
    } catch {
        return json({ error: 'Send the booking details as JSON.' }, 400);
    }

    const booking = validateBooking(input);
    if (booking.error) return json({ error: booking.error }, 400);

    const id = crypto.randomUUID();
    const result = await db.prepare(`
        INSERT INTO bookings (
            id,
            class_slug,
            session_date,
            session_period,
            customer_name,
            customer_email,
            status
        )
        SELECT ?, ?, ?, ?, ?, ?, 'reserved'
        WHERE (
            SELECT COUNT(*)
            FROM bookings
            WHERE session_date = ?
              AND session_period = ?
              AND status IN ('reserved', 'paid')
        ) < ?
    `).bind(
        id,
        booking.classSlug,
        booking.date,
        booking.period,
        booking.name,
        booking.email,
        booking.date,
        booking.period,
        SESSION_CAPACITY,
    ).run();

    if (!result.meta || result.meta.changes !== 1) {
        return json({ error: 'That session has just filled up. Please choose another.' }, 409);
    }

    return json({
        bookingId: id,
        paymentUrl: PAYMENT_URL,
    }, 201);
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname === '/api/availability' && request.method === 'GET') {
            if (!env.DB) return json({ error: 'Booking storage is unavailable.' }, 503);
            return getAvailability(env.DB);
        }

        if (url.pathname === '/api/bookings' && request.method === 'POST') {
            if (!env.DB) return json({ error: 'Booking storage is unavailable.' }, 503);
            return createBooking(request, env.DB);
        }

        const response = await env.ASSETS.fetch(request);

        if (response.status !== 404 || request.method !== 'GET') {
            return response;
        }

        if (!url.pathname.endsWith('/')) {
            url.pathname += '/';
        }

        url.pathname += 'index.html';
        return env.ASSETS.fetch(new Request(url, request));
    },
};
