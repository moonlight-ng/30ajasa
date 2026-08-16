import { getAvailability } from '../server/bookings.js';
import { handleError, requireMethod, sendJson } from '../server/http.js';

export default async function handler(request, response) {
    try {
        requireMethod(request, 'GET');
        sendJson(response, 200, await getAvailability());
    } catch (error) {
        handleError(response, error);
    }
}
