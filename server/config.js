export const WORKSHOP = Object.freeze({
    slug: 'introduction-to-3d-printing',
    name: 'Intro to 3D Printing',
    description: 'A practical introduction to digital fabrication, from preparing a model to printing a finished object.',
});

const EVENT_AMOUNT = 3_000_000;

export const EVENTS = Object.freeze([
    Object.freeze({ slug: 'intro-to-3d-printing-2026-09-03', date: '2026-09-03', period: 'evening', capacity: 1, amount: EVENT_AMOUNT }),
    Object.freeze({ slug: 'intro-to-3d-printing-2026-09-05', date: '2026-09-05', period: 'morning', capacity: 1, amount: EVENT_AMOUNT }),
    Object.freeze({ slug: 'intro-to-3d-printing-2026-09-10', date: '2026-09-10', period: 'evening', capacity: 1, amount: EVENT_AMOUNT }),
    Object.freeze({ slug: 'intro-to-3d-printing-2026-09-12', date: '2026-09-12', period: 'morning', capacity: 1, amount: EVENT_AMOUNT }),
    Object.freeze({ slug: 'intro-to-3d-printing-2026-09-17', date: '2026-09-17', period: 'evening', capacity: 1, amount: EVENT_AMOUNT }),
    Object.freeze({ slug: 'intro-to-3d-printing-2026-09-19', date: '2026-09-19', period: 'morning', capacity: 1, amount: EVENT_AMOUNT }),
    Object.freeze({ slug: 'intro-to-3d-printing-2026-09-24', date: '2026-09-24', period: 'evening', capacity: 1, amount: EVENT_AMOUNT }),
    Object.freeze({ slug: 'intro-to-3d-printing-2026-09-26', date: '2026-09-26', period: 'morning', capacity: 1, amount: EVENT_AMOUNT }),
]);

export const SESSION_CAPACITY = 1;
export const PAYMENT_CURRENCY = 'NGN';
export const MAKERSPACE_SUBACCOUNT_CODE = 'ACCT_x95j3w6lcfe44s4';
export const PAYMENT_CALLBACK_URL = 'https://makerspace.16by16.co/payment-complete/';

export function getEvent(eventSlug) {
    return EVENTS.find((event) => event.slug === eventSlug) || null;
}

export function getWorkshop(classSlug) {
    return classSlug === WORKSHOP.slug ? WORKSHOP : null;
}
