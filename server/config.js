export const WORKSHOPS = Object.freeze({
    'introduction-to-clay': Object.freeze({
        name: 'Introduction to Ceramics',
    }),
    'introduction-to-3d-printing': Object.freeze({
        name: 'Introduction to 3D Printing',
    }),
    'introduction-to-making': Object.freeze({
        name: 'Introduction to Making',
    }),
});

export const SESSION_DATES = Object.freeze([
    '2026-09-01',
    '2026-09-03',
    '2026-09-08',
    '2026-09-10',
    '2026-09-15',
    '2026-09-17',
    '2026-09-22',
    '2026-09-24',
    '2026-09-29',
]);

export const SESSION_PERIODS = Object.freeze(['morning', 'evening']);
export const SESSION_CAPACITY = 3;
export const PAYMENT_CURRENCY = 'NGN';

export function getWorkshop(classSlug) {
    return WORKSHOPS[classSlug] || null;
}
