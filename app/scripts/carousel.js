(() => {
    const carousel = document.querySelector('.making-carousel');
    if (!carousel) return;

    const track = carousel.querySelector('.making-carousel-track');
    const buttons = Array.from(carousel.querySelectorAll('[data-carousel-scroll]'));
    if (!track || !buttons.length) return;

    function stepDistance() {
        const item = track.querySelector('li');
        if (!item) return track.clientWidth;

        const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
        return item.getBoundingClientRect().width + gap;
    }

    function updateButtons() {
        const maxScroll = track.scrollWidth - track.clientWidth;

        buttons.forEach((button) => {
            const direction = Number(button.dataset.carouselScroll);
            button.disabled = direction < 0
                ? track.scrollLeft <= 1
                : track.scrollLeft >= maxScroll - 1;
        });
    }

    buttons.forEach((button) => {
        button.addEventListener('click', () => {
            const direction = Number(button.dataset.carouselScroll);
            track.scrollBy({ left: direction * stepDistance(), behavior: 'smooth' });
        });
    });

    track.addEventListener('scroll', updateButtons, { passive: true });
    window.addEventListener('resize', updateButtons);
    updateButtons();
})();
