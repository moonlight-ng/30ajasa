import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const workshops = [
    ['Introduction to Ceramics', 'introduction-to-clay', 'PAYSTACK_VARIANT_CERAMICS_AMOUNT'],
    ['Introduction to 3D Printing', 'introduction-to-3d-printing', 'PAYSTACK_VARIANT_3D_PRINTING_AMOUNT'],
    ['Introduction to Making bundle', 'introduction-to-making', 'PAYSTACK_VARIANT_MAKING_AMOUNT'],
];

function formatAmount(amount) {
    return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        maximumFractionDigits: 0,
    }).format(amount / 100);
}

function printPrices(source, amounts) {
    console.log(`Paystack prices (${source})`);
    for (const [name, slug] of workshops) {
        const amount = Number(amounts.get(slug));
        if (!Number.isSafeInteger(amount) || amount < 1) {
            throw new Error(`Missing or invalid amount for ${name}.`);
        }
        console.log(`- ${name}: ${formatAmount(amount)} (${amount} kobo)`);
    }
}

async function readLocalPrices() {
    const dotenv = await readFile(resolve(process.cwd(), '.env'), 'utf8');
    const variables = new Map();

    for (const line of dotenv.split(/\r?\n/)) {
        const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (match) variables.set(match[1], match[2].trim().replace(/^['"]|['"]$/g, ''));
    }

    return new Map(workshops.map(([, slug, key]) => [slug, variables.get(key)]));
}

async function readLivePrices() {
    const response = await fetch('https://makerspace.16by16.co/api/availability');
    if (!response.ok) throw new Error(`Live availability returned HTTP ${response.status}.`);
    const result = await response.json();
    return new Map((result.workshops || []).map((workshop) => [workshop.slug, workshop.amount]));
}

const live = process.argv.includes('--live');
const amounts = live ? await readLivePrices() : await readLocalPrices();
printPrices(live ? 'production' : '.env', amounts);
