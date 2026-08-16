import { cancelBooking } from '../../server/bookings.js';
import { handleError, readJson, requireMethod, sendJson } from '../../server/http.js';

export default async function handler(request, response) {
    try {
        requireMethod(request, 'POST');
        sendJson(response, 200, await cancelBooking(await readJson(request)));
    } catch (error) {
        handleError(response, error);
    }
}
