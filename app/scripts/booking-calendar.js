(() => {
    const form = document.getElementById('booking-form');
    if (!form) return;

    const status = document.getElementById('booking-status');
    const submitButton = form.querySelector('button[type="submit"]');
    const periodInputs = Array.from(form.querySelectorAll('input[name="period"]'));
    const steps = Array.from(form.querySelectorAll('fieldset'));
    const submitRow = form.querySelector('.booking-submit-row');
    const quantityOutput = document.getElementById('booking-quantity');
    const totalOutput = document.getElementById('booking-total');
    const stepButtons = Array.from(form.querySelectorAll('[data-quantity-step]'));
    const availability = new Map();

    const review = document.getElementById('booking-review');
    const reviewKicker = document.getElementById('booking-review-kicker');
    const reviewTitle = document.getElementById('booking-review-title');
    const reviewIntro = document.getElementById('booking-review-intro');
    const reviewCountdown = document.getElementById('booking-review-countdown');
    const reviewNotice = document.getElementById('booking-review-notice');
    const reviewCancelButton = document.getElementById('booking-review-cancel');
    const reviewPayButton = document.getElementById('booking-review-pay');
    const searchParams = new URLSearchParams(window.location.search);
    const previewFlowEnabled = searchParams.get('booking-flow') === 'preview';
    const requestedPreviewHoldSeconds = Number(searchParams.get('hold-seconds'));

    const DEFAULT_CAPACITY = 3;
    const HOLD_DURATION_MS = 10 * 60 * 1000;
    const previewHoldDurationMs = (
        previewFlowEnabled
        && Number.isInteger(requestedPreviewHoldSeconds)
        && requestedPreviewHoldSeconds >= 1
        && requestedPreviewHoldSeconds <= 600
    ) ? requestedPreviewHoldSeconds * 1000 : HOLD_DURATION_MS;
    const SURFACE_TRANSITION_MS = 210;
    const FALLBACK_PRICES = Object.freeze({
        'introduction-to-clay': 30000,
        'introduction-to-3d-printing': 30000,
        'introduction-to-making': 30000
    });
    const WORKSHOP_NAMES = Object.freeze({
        'introduction-to-clay': 'Intro to Ceramics',
        'introduction-to-3d-printing': 'Intro to 3D Printing',
        'introduction-to-making': 'Intro to Concrete'
    });
    const SESSION_TIMES = Object.freeze({
        morning: '10am – 1pm',
        evening: '4 – 7pm'
    });

    let quantity = 1;
    let activeReservation = null;
    let countdownInterval = null;
    let holdEndsAt = 0;
    let reviewState = 'idle';
    let paymentPreview = null;

    const sessionKey = (date, period) => `${date}:${period}`;
    const formatNaira = (amount) => `₦${amount.toLocaleString('en-NG')}`;

    function selectedPrice() {
        const selected = form.querySelector('input[name="class"]:checked');
        if (!selected) return 0;
        return Number(selected.dataset.price) || FALLBACK_PRICES[selected.value] || 0;
    }

    function placesAvailable() {
        const date = form.elements.date.value;
        const period = form.elements.period.value;
        if (!date || !period) return DEFAULT_CAPACITY;

        const session = availability.get(sessionKey(date, period));
        return session ? Math.max(1, session.remaining) : DEFAULT_CAPACITY;
    }

    function updateOrder() {
        const maximum = placesAvailable();
        quantity = Math.min(Math.max(1, quantity), maximum);

        if (quantityOutput) quantityOutput.textContent = String(quantity);
        if (totalOutput) totalOutput.textContent = formatNaira(selectedPrice() * quantity);

        stepButtons.forEach((button) => {
            const step = Number(button.dataset.quantityStep);
            button.disabled = step < 0 ? quantity <= 1 : quantity >= maximum;
        });
    }

    function setStatus(message) {
        if (status) status.textContent = message;
    }

    function formatSessionDate(value) {
        const date = new Date(`${value}T12:00:00Z`);
        return new Intl.DateTimeFormat('en-NG', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC'
        }).format(date);
    }

    function formatCountdown(milliseconds) {
        const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    function setReviewValue(name, value, detail = '') {
        const output = review?.querySelector(`[data-review-value="${name}"]`);
        if (!output) return;

        output.textContent = value;
        if (detail) {
            const small = document.createElement('small');
            small.textContent = detail;
            output.append(small);
        }
    }

    function createPaymentPreview() {
        const element = document.createElement('div');
        element.className = 'booking-payment-preview';
        element.hidden = true;
        element.innerHTML = `
            <section class="booking-payment-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="booking-payment-preview-title">
                <header class="booking-payment-preview-header">
                    <strong>Makerspace × Paystack</strong>
                    <button type="button" class="booking-payment-preview-close">Close</button>
                </header>
                <div class="booking-payment-preview-copy">
                    <p class="making-label">Payment handoff</p>
                    <h2 id="booking-payment-preview-title" tabindex="-1">Pay securely.</h2>
                    <p>This is where the secure Paystack popup will open. Closing payment releases the reservation immediately.</p>
                </div>
                <dl class="booking-payment-preview-meta">
                    <div>
                        <dt>Total</dt>
                        <dd data-payment-preview-value="total"></dd>
                    </div>
                    <div>
                        <dt>Email</dt>
                        <dd data-payment-preview-value="email"></dd>
                    </div>
                    <div>
                        <dt>Hold</dt>
                        <dd data-payment-preview-value="remaining"></dd>
                    </div>
                </dl>
                <button type="button" class="booking-payment-preview-return">Cancel payment</button>
            </section>
        `;

        const closeButtons = element.querySelectorAll(
            '.booking-payment-preview-close, .booking-payment-preview-return'
        );
        closeButtons.forEach((button) => button.addEventListener('click', cancelPaymentPreview));
        element.addEventListener('click', (event) => {
            if (event.target === element) cancelPaymentPreview();
        });
        document.body.append(element);
        return element;
    }

    function paymentPreviewValue(name) {
        return paymentPreview?.querySelector(`[data-payment-preview-value="${name}"]`);
    }

    function closePaymentPreview(restoreFocus = true) {
        if (!paymentPreview || paymentPreview.hidden) return;
        paymentPreview.hidden = true;
        document.body.classList.remove('booking-payment-preview-open');
        if (restoreFocus && reviewState === 'held') reviewPayButton?.focus();
    }

    function cancelPaymentPreview() {
        if (!paymentPreview || paymentPreview.hidden || reviewState !== 'held') return;
        closePaymentPreview(false);
        cancelPreviewReservation();
    }

    function openPaymentPreview() {
        if (!paymentPreview || !activeReservation || reviewState !== 'held') return;

        reviewPayButton.disabled = true;
        reviewPayButton.textContent = 'Opening secure payment…';

        window.setTimeout(() => {
            const total = paymentPreviewValue('total');
            const email = paymentPreviewValue('email');
            if (total) total.textContent = formatNaira(activeReservation.total);
            if (email) email.textContent = activeReservation.payload.email;

            paymentPreview.hidden = false;
            document.body.classList.add('booking-payment-preview-open');
            paymentPreview.querySelector('#booking-payment-preview-title')?.focus();

            reviewPayButton.disabled = false;
            reviewPayButton.textContent = `Pay ${formatNaira(activeReservation.total)}`;
            updateCountdown();
        }, 360);
    }

    function transitionSurface(from, to, focusTarget) {
        if (!from || !to) return Promise.resolve();

        from.classList.remove('is-surface-entering');
        from.classList.add('is-surface-leaving');

        return new Promise((resolve) => {
            window.setTimeout(() => {
                from.hidden = true;
                from.classList.remove('is-surface-leaving');
                to.hidden = false;
                to.classList.remove('is-surface-leaving');
                void to.offsetWidth;
                to.classList.add('is-surface-entering');
                to.scrollIntoView({ behavior: 'smooth', block: 'start' });

                window.setTimeout(() => {
                    to.classList.remove('is-surface-entering');
                    focusTarget?.focus({ preventScroll: true });
                    resolve();
                }, 430);
            }, SURFACE_TRANSITION_MS);
        });
    }

    function updateCountdown() {
        if (reviewState !== 'held') return;

        const remaining = holdEndsAt - Date.now();
        const display = formatCountdown(remaining);
        if (reviewCountdown) reviewCountdown.textContent = display;

        const paymentRemaining = paymentPreviewValue('remaining');
        if (paymentRemaining) paymentRemaining.textContent = `${display} remaining`;

        review?.classList.toggle('is-urgent', remaining <= 60 * 1000);
        if (remaining <= 0) expirePreviewReservation();
    }

    function startCountdown() {
        window.clearInterval(countdownInterval);
        holdEndsAt = Date.now() + previewHoldDurationMs;
        updateCountdown();
        countdownInterval = window.setInterval(updateCountdown, 1000);
    }

    function renderReview(payload) {
        const total = selectedPrice() * quantity;
        activeReservation = { payload, total };

        setReviewValue('workshop', WORKSHOP_NAMES[payload.classSlug] || payload.classSlug);
        setReviewValue('date', formatSessionDate(payload.date));
        setReviewValue(
            'time',
            payload.period === 'morning' ? 'Morning' : 'Evening',
            SESSION_TIMES[payload.period]
        );
        setReviewValue('quantity', quantity === 1 ? '1 place' : `${quantity} places`);
        setReviewValue('customer', payload.name, payload.email);
        setReviewValue('total', formatNaira(total));

        reviewKicker.textContent = 'Reservation held';
        reviewTitle.textContent = 'Review booking';
        reviewIntro.textContent = 'Your places are set aside. Complete payment before the timer reaches zero.';
        reviewNotice.textContent = 'Cancelling releases your places immediately. Payment is handled securely by Paystack.';
        reviewCancelButton.hidden = false;
        reviewCancelButton.disabled = false;
        reviewCancelButton.textContent = 'Cancel reservation';
        reviewPayButton.disabled = false;
        reviewPayButton.textContent = `Pay ${formatNaira(total)}`;
        review.classList.remove('is-expired', 'is-urgent');
    }

    function showPreviewReservation(payload) {
        renderReview(payload);
        reviewState = 'held';
        startCountdown();
        submitButton.disabled = false;
        transitionSurface(form, review, reviewTitle);
    }

    function returnToBookingForm(message) {
        window.clearInterval(countdownInterval);
        countdownInterval = null;
        closePaymentPreview(false);
        reviewState = 'idle';
        activeReservation = null;
        transitionSurface(review, form, form.querySelector('input[name="class"]:checked'))
            .then(() => setStatus(message));
    }

    function cancelPreviewReservation() {
        if (reviewState !== 'held') return;
        reviewCancelButton.disabled = true;
        reviewCancelButton.textContent = 'Releasing…';
        reviewPayButton.disabled = true;

        window.setTimeout(() => {
            returnToBookingForm('Reservation cancelled. Your places are available again.');
        }, 320);
    }

    function expirePreviewReservation() {
        if (reviewState !== 'held') return;

        reviewState = 'expired';
        window.clearInterval(countdownInterval);
        countdownInterval = null;
        closePaymentPreview(false);
        review?.classList.remove('is-urgent');
        review?.classList.add('is-expired');

        if (reviewCountdown) reviewCountdown.textContent = '00:00';
        reviewKicker.textContent = 'Hold ended';
        reviewTitle.textContent = 'Reservation expired';
        reviewIntro.textContent = 'The 10-minute payment window is over, so these places are available to book again.';
        reviewNotice.textContent = 'Nothing was charged. Choose a session again to start a new reservation.';
        reviewCancelButton.hidden = true;
        reviewPayButton.disabled = false;
        reviewPayButton.textContent = 'Choose another session';
        reviewTitle.focus({ preventScroll: true });
    }

    async function acknowledgePopupPayment(reference, transaction) {
        const response = await fetch('/api/payments/acknowledge', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            body: JSON.stringify({ reference, transaction })
        });
        const payment = await response.json();

        if (!response.ok) {
            throw new Error(payment.error || 'The payment could not be verified yet.');
        }

        return payment;
    }

    async function cancelReservedBooking(booking) {
        const response = await fetch('/api/bookings/cancel', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            body: JSON.stringify({
                bookingId: booking.bookingId,
                reference: booking.reference
            })
        });
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'The reservation could not be released.');
        }

        return result;
    }

    async function releaseReservedBooking(booking, reason) {
        setStatus(`${reason} Releasing your reservation…`);

        try {
            await cancelReservedBooking(booking);
            await loadAvailability();
            setStatus(`${reason} Your reservation has been released.`);
        } catch (error) {
            setStatus(
                `${reason} We could not release the reservation automatically. `
                + 'It will be released when the hold expires.'
            );
        } finally {
            submitButton.disabled = false;
        }
    }

    function openPaystackPopup(booking) {
        const checkout = booking.checkout;
        if (!checkout?.publicKey || !checkout.reference) {
            throw new Error('The Paystack Popup details are missing. Please try again.');
        }
        if (typeof window.PaystackPop !== 'function') {
            throw new Error('Paystack Popup did not load. Check your connection and try again.');
        }

        const popup = new window.PaystackPop();
        let paymentFinished = false;
        const releaseOnce = (reason) => {
            if (paymentFinished) return;
            paymentFinished = true;
            void releaseReservedBooking(booking, reason);
        };

        popup.newTransaction({
            key: checkout.publicKey,
            email: checkout.email,
            amount: checkout.amount,
            currency: checkout.currency,
            reference: checkout.reference,
            metadata: checkout.metadata,
            onSuccess: async (transaction) => {
                if (paymentFinished) return;
                paymentFinished = true;
                setStatus('Payment received. Verifying it with Paystack…');

                try {
                    await acknowledgePopupPayment(booking.reference, transaction);
                    window.location.assign(
                        `/payment-complete/?reference=${encodeURIComponent(booking.reference)}`
                    );
                } catch (error) {
                    setStatus(error.message || 'The payment succeeded but could not be verified yet.');
                    submitButton.disabled = false;
                }
            },
            onCancel: () => {
                releaseOnce('Payment cancelled.');
            },
            onError: (error) => {
                releaseOnce(error?.message || 'Payment could not start.');
            }
        });
    }

    function isStepAnswered(step) {
        const groups = new Set(
            Array.from(step.querySelectorAll('input[type="radio"]')).map((input) => input.name)
        );

        return Array.from(groups).every((name) => form.querySelector(`input[name="${name}"]:checked`));
    }

    function setStepHidden(step, hidden) {
        if (step.hidden === hidden) return;

        step.hidden = hidden;

        if (!hidden) {
            step.classList.remove('is-revealed');
            void step.offsetWidth;
            step.classList.add('is-revealed');
        }
    }

    function updateSteps() {
        let reveal = true;

        steps.forEach((step) => {
            setStepHidden(step, !reveal);
            if (reveal) reveal = isStepAnswered(step);
        });

        if (submitRow) setStepHidden(submitRow, !reveal);

        updateOrder();
    }

    stepButtons.forEach((button) => {
        button.addEventListener('click', () => {
            quantity += Number(button.dataset.quantityStep);
            updateOrder();
        });
    });

    function updatePeriodChoices() {
        const selectedDate = form.elements.date.value;

        periodInputs.forEach((input) => {
            const detail = form.querySelector(`[data-remaining-for="${input.value}"]`);

            if (!selectedDate) {
                input.disabled = false;
                if (detail) detail.textContent = 'Select a date';
                return;
            }

            const session = availability.get(sessionKey(selectedDate, input.value));
            const remaining = session ? session.remaining : 3;
            input.disabled = remaining < 1;

            if (input.disabled && input.checked) {
                input.checked = false;
            }

            if (detail) {
                detail.textContent = remaining === 1 ? '1 place left' : `${remaining} places left`;
            }
        });

        updateSteps();
    }

    function applyWorkshopCatalog(workshops = []) {
        workshops.forEach((workshop) => {
            const input = form.querySelector(`input[name="class"][value="${workshop.slug}"]`);
            const amount = Number(workshop.amount);
            if (!input || !Number.isSafeInteger(amount) || amount < 1) return;

            const nairaAmount = amount / 100;
            input.dataset.price = String(nairaAmount);

            const priceLabel = input.closest('label')?.querySelector('small');
            if (priceLabel) priceLabel.textContent = formatNaira(nairaAmount);
        });
    }

    async function loadAvailability() {
        try {
            const response = await fetch('/api/availability', {
                headers: { Accept: 'application/json' }
            });

            if (!response.ok) throw new Error('Availability could not be loaded');

            const data = await response.json();
            availability.clear();
            applyWorkshopCatalog(data.workshops);
            (data.sessions || []).forEach((session) => {
                availability.set(sessionKey(session.date, session.period), session);
            });
            updatePeriodChoices();
        } catch (error) {
            setStatus(
                previewFlowEnabled
                    ? ''
                    : 'Availability will be confirmed when you reserve.'
            );
            updatePeriodChoices();
        }
    }

    form.addEventListener('change', (event) => {
        if (event.target.name === 'date') {
            updatePeriodChoices();
            return;
        }

        updateSteps();
    });

    form.querySelectorAll('input[name="class"]').forEach((input) => {
        input.addEventListener('click', () => {
            if (input.dataset.wasChecked === 'true') {
                input.checked = false;
                delete input.dataset.wasChecked;
                updateSteps();
                return;
            }

            input.dataset.wasChecked = 'true';
            form.querySelectorAll('input[name="class"]').forEach((other) => {
                if (other !== input) delete other.dataset.wasChecked;
            });
        });
    });

    reviewCancelButton?.addEventListener('click', cancelPreviewReservation);
    reviewPayButton?.addEventListener('click', () => {
        if (reviewState === 'expired') {
            returnToBookingForm('That hold expired. Choose a session to reserve again.');
            loadAvailability();
            return;
        }

        openPaymentPreview();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && paymentPreview && !paymentPreview.hidden) {
            cancelPaymentPreview();
        }
    });

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) updateCountdown();
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (!form.reportValidity()) return;

        const payload = {
            classSlug: form.elements.class.value,
            date: form.elements.date.value,
            period: form.elements.period.value,
            quantity,
            name: form.elements.name.value.trim(),
            email: form.elements.email.value.trim()
        };

        submitButton.disabled = true;
        setStatus('Reserving your place…');

        if (previewFlowEnabled && review) {
            window.setTimeout(() => showPreviewReservation(payload), 520);
            return;
        }

        let createdBooking = null;

        try {
            const response = await fetch('/api/bookings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 409) await loadAvailability();
                throw new Error(data.error || 'We could not reserve that place.');
            }

            createdBooking = data;
            setStatus('Your place is reserved. Opening Paystack Popup…');
            openPaystackPopup(data);
        } catch (error) {
            if (createdBooking) {
                await releaseReservedBooking(
                    createdBooking,
                    error.message || 'Payment could not start.'
                );
            } else {
                setStatus(error.message || 'We could not reserve that place. Please try again.');
                submitButton.disabled = false;
            }
        }
    });

    if (previewFlowEnabled && review) {
        submitButton.textContent = 'Reserve';
        setStatus('');
        paymentPreview = createPaymentPreview();
        window.bookingFlowPreview = Object.freeze({
            expire: expirePreviewReservation,
            cancel: cancelPreviewReservation,
            closePayment: cancelPaymentPreview,
            getRemaining: () => Math.max(0, holdEndsAt - Date.now())
        });
    }

    updateSteps();
    loadAvailability();
})();
