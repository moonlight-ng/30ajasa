import { AppError } from './errors.js';

export function sendJson(response, status, body) {
    response.statusCode = status;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.end(JSON.stringify(body));
}

export async function readJson(request) {
    if (request.body && typeof request.body === 'object' && !Buffer.isBuffer(request.body)) {
        return request.body;
    }

    const raw = await readRawBody(request);
    try {
        return JSON.parse(raw.toString('utf8') || '{}');
    } catch {
        throw new AppError('Send the request body as JSON.', 400, 'invalid_json');
    }
}

export async function readRawBody(request) {
    if (Buffer.isBuffer(request.body)) return request.body;
    if (typeof request.body === 'string') return Buffer.from(request.body);

    const chunks = [];
    for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

export function queryValue(request, key) {
    const value = request.query?.[key];
    if (Array.isArray(value)) return value[0];
    if (value !== undefined) return value;
    return new URL(request.url, 'http://localhost').searchParams.get(key);
}

export function requireMethod(request, allowed) {
    if (request.method !== allowed) {
        throw new AppError('Method not allowed.', 405, 'method_not_allowed');
    }
}

export function handleError(response, error) {
    const status = Number(error?.status) || 500;
    const message = error instanceof AppError
        ? error.message
        : 'Something went wrong. Please try again.';
    sendJson(response, status, { error: message, code: error?.code || 'request_failed' });
}
