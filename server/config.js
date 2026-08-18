export const WORKSHOPS = Object.freeze({
    'introduction-to-clay': Object.freeze({
        name: 'Intro to Ceramics',
    }),
    'introduction-to-3d-printing': Object.freeze({
        name: 'Intro to 3D Printing',
    }),
    'introduction-to-making': Object.freeze({
        name: 'Intro to Concrete',
    }),
});

export const SESSIONS = Object.freeze([
    Object.freeze({ date: '2026-09-03', period: 'evening' }),
    Object.freeze({ date: '2026-09-05', period: 'morning' }),
    Object.freeze({ date: '2026-09-10', period: 'evening' }),
    Object.freeze({ date: '2026-09-12', period: 'morning' }),
    Object.freeze({ date: '2026-09-17', period: 'evening' }),
    Object.freeze({ date: '2026-09-19', period: 'morning' }),
    Object.freeze({ date: '2026-09-24', period: 'evening' }),
    Object.freeze({ date: '2026-09-26', period: 'morning' }),
]);

export const SESSION_DATES = Object.freeze(SESSIONS.map(({ date }) => date));
export const SESSION_PERIODS = Object.freeze(['morning', 'evening']);
export const SESSION_CAPACITY = 3;
export const PAYMENT_CURRENCY = 'NGN';

export function getWorkshop(classSlug) {
    return WORKSHOPS[classSlug] || null;
}
