function initNavigation() {
    // Get current page from URL path
    const currentPath = window.location.pathname;
    let currentPage = 'home';

    if (currentPath.includes('/building/')) {
        currentPage = 'building';
    } else if (currentPath.includes('/film-club/')) {
        currentPage = 'film-club';
    } else if (currentPath.includes('/makerspace/')) {
        currentPage = 'makerspace';
    }

    // Set active state for current page
    const activeNavLink = document.querySelector(`[data-page="${currentPage}"]`);
    if (activeNavLink) {
        activeNavLink.classList.add('nav-active');
    }

    // Adjust paths based on current directory depth
    const navLinks = document.querySelectorAll('[data-page]');
    const depth = currentPath.split('/').length - 2; // Adjust for domain and empty segments

    navLinks.forEach(link => {
        const page = link.getAttribute('data-page');
        let href = '';

        if (depth === 0) {
            // Root level (index.html)
            if (page === 'home') {
                href = '#';
            } else {
                href = `${page}/`;
            }
        } else {
            // In subdirectory (building/, film-club/, makerspace/)
            if (page === 'home') {
                href = '../';
            } else {
                // Sibling directories
                href = `../${page}/`;
            }
        }

        link.setAttribute('href', href);
    });
}

// Auto-initialize on DOM content loaded
document.addEventListener('DOMContentLoaded', initNavigation);

// Expose function for manual initialization after component loading
window.initNavigation = initNavigation;
