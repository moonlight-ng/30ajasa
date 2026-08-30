(() => {
    const container = document.querySelector('[data-payment-state]');
    if (!container) return;

    const kicker = document.getElementById('payment-kicker');
    const message = document.getElementById('payment-result-message');
    const receipt = document.getElementById('payment-receipt');
    const retry = document.getElementById('payment-retry');
    const returnLink = document.getElementById('payment-return');
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference') || params.get('trxref');

    const formatAmount = (amount, currency) => new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
    }).format(amount / 100);

    const formatSession = (date, period) => {
        const formattedDate = new Intl.DateTimeFormat('en-NG', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
        }).format(new Date(`${date}T12:00:00Z`));
        return `${formattedDate} · ${period[0].toUpperCase()}${period.slice(1)}`;
    };

    const setState = (state, title, detail) => {
        container.dataset.paymentState = state;
        if (kicker) kicker.textContent = title;
        message.textContent = detail;
    };

    const fillReceipt = (payment) => {
        receipt.querySelector('[data-receipt="workshop"]').textContent = payment.workshop;
        receipt.querySelector('[data-receipt="email"]').textContent = payment.email;
        receipt.querySelector('[data-receipt="session"]').textContent = formatSession(
            payment.sessionDate,
            payment.sessionPeriod,
        );
        const mode = payment.environment === 'test' ? 'Test payment' : 'Paid';
        receipt.querySelector('[data-receipt="amount"]').textContent = `${formatAmount(payment.amount, payment.currency)} · ${mode}`;
        receipt.querySelector('[data-receipt="reference"]').textContent = payment.reference;
        receipt.hidden = false;
    };

    async function verify() {
        retry.hidden = true;
        returnLink.hidden = true;
        receipt.hidden = true;

        if (!reference) {
        setState(
            'error',
            'Payment reference needed',
            'Open the link Paystack returned after checkout, or return to the events and try again.',
        );
            returnLink.hidden = false;
            return;
        }

        setState(
            'loading',
            'Checking your payment',
            'We’re securely verifying the result with Paystack.',
        );

        try {
            const response = await fetch(`/api/payments/status?reference=${encodeURIComponent(reference)}`, {
                headers: { Accept: 'application/json' },
            });
            const payment = await response.json();

            if (!response.ok) throw new Error(payment.error || 'We could not verify this payment.');

            if (payment.status === 'success') {
                fillReceipt(payment);
                setState(
                    'success',
                    'Payment complete',
                    'Please check your email for confirmation of your booking.',
                );
                return;
            }

            if (payment.status === 'unverified') {
                fillReceipt(payment);
                setState(
                    'success',
                    'Payment complete',
                    'Please check your email for confirmation of your booking.',
                );
                return;
            }

            if (payment.status === 'failed') {
                setState(
                    'error',
                    'Payment not completed',
                    'No real charge was made. Return to the events whenever you’re ready to try again.',
                );
                returnLink.hidden = false;
                return;
            }

            setState(
                'pending',
                'Payment still processing',
                'Paystack has not confirmed it yet. Wait a moment, then check again.',
            );
            retry.hidden = false;
        } catch (error) {
            setState(
                'error',
                'Could not confirm yet',
                error.message || 'Your payment record is safe. Please try the check again.',
            );
            retry.hidden = false;
        }
    }

    retry.addEventListener('click', verify);
    verify();
})();
