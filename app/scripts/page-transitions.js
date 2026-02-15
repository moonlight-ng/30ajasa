/**
 * Page fade in on load, fade out before same-site navigation.
 */
(function () {
    const DURATION_MS = 250;

    function isInternalLink(link) {
        const href = link.getAttribute("href");
        if (!href || href === "#" || link.target === "_blank") return false;
        try {
            return new URL(link.href).origin === window.location.origin;
        } catch {
            return true;
        }
    }

    function initFadeIn() {
        requestAnimationFrame(function () {
            document.body.classList.add("page-ready");
        });
    }

    function initFadeOut() {
        document.querySelectorAll("a[href]").forEach(function (link) {
            link.addEventListener("click", function (e) {
                if (!isInternalLink(link)) return;
                e.preventDefault();
                document.body.classList.remove("page-ready");
                document.body.classList.add("page-transition-out");
                setTimeout(function () {
                    window.location.href = link.href;
                }, DURATION_MS);
            });
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
            initFadeIn();
            initFadeOut();
        });
    } else {
        initFadeIn();
        initFadeOut();
    }
})();
