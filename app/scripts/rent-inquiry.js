(function () {
    const form = document.getElementById('rental-form');
    if (!form) return;

    const dateInput = form.elements.date;
    const fromInput = form.elements.from;
    const toInput = form.elements.to;
    const status = document.getElementById('rental-status');

    const today = new Date();
    const localToday = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, '0'),
        String(today.getDate()).padStart(2, '0'),
    ].join('-');
    dateInput.min = localToday;

    function minutesFromTime(value) {
        const [hours, minutes] = value.split(':').map(Number);
        return (hours * 60) + minutes;
    }

    function durationInMinutes() {
        if (!fromInput.value || !toInput.value) return 0;
        return minutesFromTime(toInput.value) - minutesFromTime(fromInput.value);
    }

    function validateDuration() {
        const duration = durationInMinutes();
        const message = duration <= 0 && fromInput.value && toInput.value
            ? 'The end time must be later than the start time.'
            : duration > 0 && duration !== 240
                ? 'Please choose a four-hour rental period.'
                : '';

        toInput.setCustomValidity(message);
        if (message && status) status.textContent = message;
        return !message;
    }

    fromInput.addEventListener('change', validateDuration);
    toInput.addEventListener('change', validateDuration);

    form.addEventListener('submit', function (event) {
        event.preventDefault();

        if (!validateDuration() || !form.reportValidity()) return;

        const data = new FormData(form);
        const name = String(data.get('name')).trim();
        const date = new Date(`${data.get('date')}T12:00:00`).toLocaleDateString('en-NG', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
        const duration = durationInMinutes();
        const durationLabel = duration % 60 === 0
            ? `${duration / 60} ${duration === 60 ? 'hour' : 'hours'}`
            : `${Math.floor(duration / 60)}h ${duration % 60}m`;
        const recipient = form.dataset.recipient;
        const subject = `Space rental request — ${date}`;
        const body = [
            'Hello Makerspace,',
            '',
            'I would like to rent the space.',
            '',
            `Name: ${name}`,
            `Email: ${String(data.get('email')).trim()}`,
            `Date: ${date}`,
            `From: ${data.get('from')}`,
            `To: ${data.get('to')}`,
            `Duration: ${durationLabel}`,
            'Rate: ₦100,000',
            '',
            'Planned use:',
            String(data.get('use')).trim(),
            '',
            'Thank you,',
            name,
        ].join('\n');

        if (status) status.textContent = 'Opening your email app…';
        window.location.href = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });
})();
