(() => {
    const header = document.querySelector('.making-header');
    const toggle = header?.querySelector('.making-menu-toggle');
    const menu = header?.querySelector('.making-mobile-menu');
    if (!header || !toggle || !menu) return;
    header.classList.add('has-making-menu');

    const label = toggle.querySelector('[data-making-menu-label]');
    const menuLinks = Array.from(menu.querySelectorAll('a'));

    function focusableElements() {
        return [toggle, ...menuLinks].filter((element) => !element.hasAttribute('disabled'));
    }

    function setOpen(open, restoreFocus = false) {
        header.classList.toggle('is-menu-open', open);
        document.body.classList.toggle('making-menu-open', open);
        toggle.setAttribute('aria-expanded', String(open));
        menu.setAttribute('aria-hidden', String(!open));
        if (label) label.textContent = open ? 'Close' : 'Menu';

        if (open) {
            window.setTimeout(() => menuLinks[0]?.focus(), 180);
        } else if (restoreFocus) {
            toggle.focus();
        }
    }

    toggle.addEventListener('click', () => {
        setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    menuLinks.forEach((link) => {
        link.addEventListener('click', () => setOpen(false, true));
    });

    menu.addEventListener('click', (event) => {
        if (event.target === menu) setOpen(false, true);
    });

    document.addEventListener('keydown', (event) => {
        if (toggle.getAttribute('aria-expanded') !== 'true') return;

        if (event.key === 'Escape') {
            event.preventDefault();
            setOpen(false, true);
            return;
        }

        if (event.key !== 'Tab') return;
        const elements = focusableElements();
        const first = elements[0];
        const last = elements[elements.length - 1];

        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });

    const desktopQuery = window.matchMedia('(min-width: 769px)');
    const closeOnDesktop = (event) => {
        if (event.matches) setOpen(false);
    };
    desktopQuery.addEventListener?.('change', closeOnDesktop);
})();
