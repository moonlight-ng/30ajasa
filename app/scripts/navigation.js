function initNavigation() {
    const currentPath = window.location.pathname;
    let currentPage = 'home';
    if (currentPath.includes('/building/')) currentPage = 'building';
    else if (currentPath.includes('/contact/')) currentPage = 'contact';

    const archiveBase = currentPath.startsWith('/archive/v1') ? '/archive/v1/' : '/';

    function setHrefsAndActive(link) {
        const page = link.getAttribute('data-page');
        const href = page === 'home' ? archiveBase : `${archiveBase}${page}/`;
        link.setAttribute('href', href);
        if (page === currentPage) link.classList.add('nav-active');
    }

    // All [data-page] links (desktop peripheral + mobile overlay)
    document.querySelectorAll('[data-page]').forEach(setHrefsAndActive);

    // Mobile only: (Menu) toggle overlay
    const menuBtn = document.getElementById('nav-mobile-btn');
    const overlay = document.getElementById('nav-mobile-overlay');
    if (menuBtn && overlay) {
        function openMenu() {
            overlay.classList.add('nav-open');
            overlay.setAttribute('aria-hidden', 'false');
            menuBtn.setAttribute('aria-expanded', 'true');
            menuBtn.setAttribute('aria-label', 'Close menu');
            document.body.classList.add('nav-body-open');
            const firstLink = overlay.querySelector('.nav-link');
            if (firstLink) firstLink.focus();
        }

        function closeMenu() {
            overlay.classList.remove('nav-open');
            overlay.setAttribute('aria-hidden', 'true');
            menuBtn.setAttribute('aria-expanded', 'false');
            menuBtn.setAttribute('aria-label', 'Open menu');
            document.body.classList.remove('nav-body-open');
            menuBtn.focus();
        }

        menuBtn.addEventListener('click', function () {
            overlay.classList.contains('nav-open') ? closeMenu() : openMenu();
        });

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeMenu();
        });

        overlay.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', closeMenu);
        });
    }

    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        const openOverlay = document.querySelector('.nav-overlay.nav-open');
        if (!openOverlay) return;
        openOverlay.classList.remove('nav-open');
        openOverlay.setAttribute('aria-hidden', 'true');
        const btn = document.getElementById('nav-mobile-btn');
        if (btn) {
            btn.setAttribute('aria-expanded', 'false');
            btn.setAttribute('aria-label', 'Open menu');
            btn.focus();
        }
        document.body.classList.remove('nav-body-open');
    });
}

document.addEventListener('DOMContentLoaded', initNavigation);
window.initNavigation = initNavigation;
