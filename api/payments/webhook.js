import { createHmac, timingSafeEqual } from 'node:crypto';

import { AppError } from '../../server/errors.js';
import { handleError, readRawBody, requireMethod, sendJson } from '../../server/http.js';
import { confirmTransaction } from '../../server/payments.js';

export const config = {
    api: {
        bodyParser: false,
    },
};

function validSignature(rawBody, receivedSignature, secretKey) {
    const expected = createHmac('sha512', secretKey).update(rawBody).digest('hex');
    const received = String(receivedSignature || '');
    if (expected.length !== received.length) return false;
    return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

export default async function handler(request, response) {
    try {
        requireMethod(request, 'POST');
        const secretKey = String(process.env.PAYSTACK_SECRET_KEY || '').trim();
        if (!secretKey) throw new AppError('Paystack webhook verification is not configured.', 503, 'configuration_error');

        const rawBody = await readRawBody(request);
        if (!validSignature(rawBody, request.headers['x-paystack-signature'], secretKey)) {
            throw new AppError('Invalid Paystack signature.', 401, 'invalid_signature');
        }

        let event;
        try {
            event = JSON.parse(rawBody.toString('utf8'));
        } catch {
            throw new AppError('Invalid webhook payload.', 400, 'invalid_json');
        }

        if (event.event === 'charge.success') {
            await confirmTransaction(event.data);
        }

        sendJson(response, 200, { received: true });
    } catch (error) {
        handleError(response, error);
    }
}
