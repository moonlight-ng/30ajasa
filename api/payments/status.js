import { handleError, queryValue, requireMethod, sendJson } from '../../server/http.js';
import { getPaymentStatus } from '../../server/payments.js';

export default async function handler(request, response) {
    try {
        requireMethod(request, 'GET');
        sendJson(response, 200, await getPaymentStatus(queryValue(request, 'reference')));
    } catch (error) {
        handleError(response, error);
    }
}
