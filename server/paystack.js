import { AppError } from './errors.js';

export class PaystackConfigurationError extends AppError {
    constructor(message, status = 503) {
        super(message, status, 'paystack_configuration_error');
        this.name = 'PaystackConfigurationError';
    }
}

const PRODUCT_VARIANT_KEYS = Object.freeze({
    'introduction-to-clay': Object.freeze({
        valueId: 'PAYSTACK_VARIANT_VALUE_CERAMICS_ID',
        productVariantId: 'PAYSTACK_PRODUCT_VARIANT_CERAMICS_ID',
        amount: 'PAYSTACK_VARIANT_CERAMICS_AMOUNT',
    }),
    'introduction-to-3d-printing': Object.freeze({
        valueId: 'PAYSTACK_VARIANT_VALUE_3D_PRINTING_ID',
        productVariantId: 'PAYSTACK_PRODUCT_VARIANT_3D_PRINTING_ID',
        amount: 'PAYSTACK_VARIANT_3D_PRINTING_AMOUNT',
    }),
    'introduction-to-making': Object.freeze({
        valueId: 'PAYSTACK_VARIANT_VALUE_MAKING_ID',
        productVariantId: 'PAYSTACK_PRODUCT_VARIANT_MAKING_ID',
        amount: 'PAYSTACK_VARIANT_MAKING_AMOUNT',
    }),
});

function requireText(env, key) {
    const value = String(env?.[key] || '').trim();
    if (!value) throw new PaystackConfigurationError(`Paystack configuration is missing ${key}.`);
    return value;
}

function requirePositiveInteger(env, key) {
    const value = Number(requireText(env, key));
    if (!Number.isSafeInteger(value) || value < 1) {
        throw new PaystackConfigurationError(`Paystack configuration has an invalid ${key}.`);
    }
    return value;
}

function keyEnvironment(key, prefix) {
    if (key.startsWith(`${prefix}_test_`)) return 'test';
    if (key.startsWith(`${prefix}_live_`)) return 'live';
    return null;
}

export function requireTestPublicKey(publicKey) {
    if (!publicKey) throw new PaystackConfigurationError('Paystack Popup has not been configured yet.');
    if (!String(publicKey).startsWith('pk_test_')) {
        throw new PaystackConfigurationError('This checkout is currently limited to Paystack test mode.');
    }
    return String(publicKey);
}

export function requirePaystackKeys(env) {
    const publicKey = requireText(env, 'PAYSTACK_PUBLIC_KEY');
    const secretKey = requireText(env, 'PAYSTACK_SECRET_KEY');
    const publicEnvironment = keyEnvironment(publicKey, 'pk');
    const secretEnvironment = keyEnvironment(secretKey, 'sk');

    if (!publicEnvironment || publicEnvironment !== secretEnvironment) {
        throw new PaystackConfigurationError('Paystack public and secret keys must belong to the same test or live environment.');
    }

    return Object.freeze({ publicKey, secretKey, environment: publicEnvironment });
}

export function requirePaystackProduct(env, classSlug) {
    const variantKeys = PRODUCT_VARIANT_KEYS[classSlug];
    if (!variantKeys) {
        throw new PaystackConfigurationError('Paystack does not have a variant mapping for this workshop.', 400);
    }

    return Object.freeze({
        id: requirePositiveInteger(env, 'PAYSTACK_PRODUCT_ID'),
        code: requireText(env, 'PAYSTACK_PRODUCT_CODE'),
        pageSlug: requireText(env, 'PAYSTACK_PRODUCT_PAGE_SLUG'),
        variantOptionId: requirePositiveInteger(env, 'PAYSTACK_VARIANT_OPTION_ID'),
        variantValueId: requirePositiveInteger(env, variantKeys.valueId),
        productVariantId: requirePositiveInteger(env, variantKeys.productVariantId),
        amount: requirePositiveInteger(env, variantKeys.amount),
    });
}

export async function verifyPaystackTransaction(reference, env) {
    const { secretKey } = requirePaystackKeys(env);
    const response = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
        {
            headers: {
                Authorization: `Bearer ${secretKey}`,
                Accept: 'application/json',
            },
        },
    );

    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.status || !result?.data) {
        throw new AppError('Paystack could not verify this payment yet.', 502, 'verification_unavailable');
    }

    return result.data;
}

export function transactionMatchesPayment(transaction, payment) {
    const transactionEmail = String(transaction?.customer?.email || '').trim().toLowerCase();
    return (
        transaction?.status === 'success'
        && transaction?.reference === payment.reference
        && Number(transaction?.amount) === Number(payment.amount)
        && String(transaction?.currency || '').toUpperCase() === String(payment.currency || '').toUpperCase()
        && transactionEmail === String(payment.customer_email || '').trim().toLowerCase()
    );
}
