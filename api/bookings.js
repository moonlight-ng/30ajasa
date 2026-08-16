import { createBooking } from '../server/bookings.js';
import { handleError, readJson, requireMethod, sendJson } from '../server/http.js';

export default async function handler(request, response) {
    try {
        requireMethod(request, 'POST');
        const booking = await createBooking(await readJson(request));
        sendJson(response, 201, booking);
    } catch (error) {
        handleError(response, error);
    }
}
