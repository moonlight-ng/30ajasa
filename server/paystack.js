import { AppError } from './errors.js';
import { MAKERSPACE_SUBACCOUNT_CODE, PAYMENT_CALLBACK_URL } from './config.js';

export class PaystackConfigurationError extends AppError {
    constructor(message, status = 503) {
        super(message, status, 'paystack_configuration_error');
        this.name = 'PaystackConfigurationError';
    }
}

function requireText(env, key) {
    const value = String(env?.[key] || '').trim();
    if (!value) throw new PaystackConfigurationError(`Paystack configuration is missing ${key}.`);
    return value;
}

function keyEnvironment(key, prefix) {
    if (key.startsWith(`${prefix}_test_`)) return 'test';
    if (key.startsWith(`${prefix}_live_`)) return 'live';
    return null;
}

export function requirePaystackKeys(env) {
    const secretKey = requireText(env, 'PAYSTACK_SECRET_KEY');
    const secretEnvironment = keyEnvironment(secretKey, 'sk');

    if (!secretEnvironment) {
        throw new PaystackConfigurationError('Paystack must use a valid test or live secret key.');
    }

    return Object.freeze({ secretKey, environment: secretEnvironment });
}

export async function initializePaystackTransaction(transaction, env = process.env, request = fetch) {
    const { secretKey, environment } = requirePaystackKeys(env);
    const callbackUrl = String(env.PAYSTACK_CALLBACK_URL || PAYMENT_CALLBACK_URL).trim();
    const body = {
        email: transaction.email,
        amount: String(transaction.amount),
        currency: transaction.currency,
        reference: transaction.reference,
        callback_url: callbackUrl,
        subaccount: MAKERSPACE_SUBACCOUNT_CODE,
        metadata: JSON.stringify(transaction.metadata || {}),
    };

    const response = await request('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.status || !result?.data?.access_code || !result?.data?.authorization_url) {
        throw new AppError(
            result?.message || 'Paystack could not start this payment.',
            502,
            'initialization_unavailable',
        );
    }
    if (result.data.reference !== transaction.reference) {
        throw new AppError('Paystack returned an unexpected payment reference.', 502, 'initialization_mismatch');
    }

    return Object.freeze({
        accessCode: result.data.access_code,
        authorizationUrl: result.data.authorization_url,
        reference: result.data.reference,
        environment,
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
    const transactionSubaccount = String(
        transaction?.subaccount?.subaccount_code
        || transaction?.subaccount?.subaccountCode
        || transaction?.subaccount
        || '',
    ).trim();
    return (
        transaction?.status === 'success'
        && transaction?.reference === payment.reference
        && Number(transaction?.amount) === Number(payment.amount)
        && String(transaction?.currency || '').toUpperCase() === String(payment.currency || '').toUpperCase()
        && transactionEmail === String(payment.customer_email || '').trim().toLowerCase()
        && (!payment.subaccount_code || transactionSubaccount === payment.subaccount_code)
    );
}
