(() => {
    const form = document.getElementById('booking-form');
    if (!form) return;

    const status = document.getElementById('booking-status');
    const submitButton = form.querySelector('button[type="submit"]');
    const dateInputs = Array.from(form.querySelectorAll('input[name="date"]'));
    const periodInputs = Array.from(form.querySelectorAll('input[name="period"]'));
    const availability = new Map();

    const sessionKey = (date, period) => `${date}:${period}`;

    function setStatus(message) {
        if (status) status.textContent = message;
    }

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
    }

    async function loadAvailability() {
        try {
            const response = await fetch('/api/availability', {
                headers: { Accept: 'application/json' }
            });

            if (!response.ok) throw new Error('Availability could not be loaded');

            const data = await response.json();
            availability.clear();
            (data.sessions || []).forEach((session) => {
                availability.set(sessionKey(session.date, session.period), session);
            });
            updatePeriodChoices();
        } catch (error) {
            setStatus('Availability will be confirmed when you reserve.');
            updatePeriodChoices();
        }
    }

    dateInputs.forEach((input) => {
        input.addEventListener('change', updatePeriodChoices);
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (!form.reportValidity()) return;

        const payload = {
            classSlug: form.elements.class.value,
            date: form.elements.date.value,
            period: form.elements.period.value,
            name: form.elements.name.value.trim(),
            email: form.elements.email.value.trim()
        };

        submitButton.disabled = true;
        setStatus('Reserving your place…');

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

            setStatus('Your place is reserved. Taking you to payment…');
            window.location.assign(data.paymentUrl || form.dataset.paymentUrl);
        } catch (error) {
            setStatus(error.message || 'We could not reserve that place. Please try again.');
            submitButton.disabled = false;
        }
    });

    loadAvailability();
})();
