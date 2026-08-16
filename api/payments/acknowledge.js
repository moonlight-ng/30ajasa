import { handleError, readJson, requireMethod, sendJson } from '../../server/http.js';
import { acknowledgePopupPayment } from '../../server/payments.js';

export default async function handler(request, response) {
    try {
        requireMethod(request, 'POST');
        sendJson(response, 200, await acknowledgePopupPayment(await readJson(request)));
    } catch (error) {
        handleError(response, error);
    }
}
