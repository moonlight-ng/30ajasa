/**
 * Hero slideshow: cycles images every 3s at random positions.
 * Pauses when hero is out of view (Intersection Observer).
 */
(function () {
    "use strict";

    const SLIDE_DURATION_MS = 2000;
    const IMAGE_SIZE_PCT = 40; // max width/height % so image stays in bounds
    const POSITION_MAX_PCT = 100 - IMAGE_SIZE_PCT; // e.g. 60% so left/top in [0, 60]

    // Quadrants: 0 = top-left, 1 = top-right, 2 = bottom-left, 3 = bottom-right (by half of range)
    const HALF = POSITION_MAX_PCT / 2;

    const SLIDES = [
        { src: "images/space.png" },
        { src: "images/manifesto.webp" },
        { src: "images/diy-water-filter.webp" },
        { src: "images/system.webp" },
        { src: "images/tushar-sat02.webp" },
    ];

    function randomInRange(min, max) {
        return min + Math.random() * (max - min);
    }

    function getPositionInQuadrant(quadrant) {
        var left, top;
        if (quadrant === 0) {
            left = randomInRange(0, HALF);
            top = randomInRange(0, HALF);
        } else if (quadrant === 1) {
            left = randomInRange(HALF, POSITION_MAX_PCT);
            top = randomInRange(0, HALF);
        } else if (quadrant === 2) {
            left = randomInRange(0, HALF);
            top = randomInRange(HALF, POSITION_MAX_PCT);
        } else {
            left = randomInRange(HALF, POSITION_MAX_PCT);
            top = randomInRange(HALF, POSITION_MAX_PCT);
        }
        return { left: left, top: top };
    }

    function pickOtherQuadrant(lastQuadrant) {
        var candidates = [0, 1, 2, 3].filter(function (q) { return q !== lastQuadrant; });
        return candidates[Math.floor(Math.random() * candidates.length)];
    }

    function preloadImages() {
        SLIDES.forEach(function (slide) {
            var img = new Image();
            img.src = slide.src;
        });
    }

    function setSlide(slideWrapper, imgEl, index, quadrantState) {
        var slide = SLIDES[index];
        var quadrant = pickOtherQuadrant(quadrantState.last);
        quadrantState.last = quadrant;
        var pos = getPositionInQuadrant(quadrant);
        slideWrapper.style.left = pos.left + "%";
        slideWrapper.style.top = pos.top + "%";

        imgEl.src = slide.src;
        imgEl.alt = "";
        function fadeIn() {
            imgEl.style.opacity = "0";
            requestAnimationFrame(function () {
                imgEl.style.opacity = "1";
            });
        }
        if (imgEl.complete && imgEl.naturalWidth) {
            requestAnimationFrame(fadeIn);
        } else {
            imgEl.addEventListener("load", function onLoad() {
                imgEl.removeEventListener("load", onLoad);
                requestAnimationFrame(fadeIn);
            });
        }
    }

    function initMobileStrip() {
        var strip = document.querySelector(".hero-mobile-strip");
        if (!strip || strip.children.length) return;
        SLIDES.forEach(function (slide) {
            var item = document.createElement("div");
            item.setAttribute("class", "hero-mobile-strip-item");
            var img = document.createElement("img");
            img.src = slide.src;
            img.alt = "";
            img.setAttribute("class", "hero-mobile-strip-img");
            item.appendChild(img);
            strip.appendChild(item);
        });
    }

    function init() {
        var heroSection = document.querySelector(".hero-section");
        var slideshowEl = document.querySelector(".hero-slideshow");
        if (!heroSection || !slideshowEl) return;

        initMobileStrip();

        var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduceMotion) {
            var staticSlide = SLIDES[0];
            var img = document.createElement("img");
            img.src = staticSlide.src;
            img.alt = "";
            img.setAttribute("class", "hero-slideshow-img");
            img.style.left = "30%";
            img.style.top = "30%";
            slideshowEl.appendChild(img);
            return;
        }

        preloadImages();

        var slideWrapper = document.createElement("div");
        slideWrapper.setAttribute("class", "hero-slideshow-slide");

        var imgEl = document.createElement("img");
        imgEl.setAttribute("class", "hero-slideshow-img");
        imgEl.alt = "";

        slideWrapper.appendChild(imgEl);
        slideshowEl.appendChild(slideWrapper);

        var currentIndex = 0;
        var inView = false;
        var intervalId = null;
        var quadrantState = { last: -1 }; // -1 so first slide can use any quadrant

        function goToNext() {
            if (!inView) return;
            currentIndex = (currentIndex + 1) % SLIDES.length;
            setSlide(slideWrapper, imgEl, currentIndex, quadrantState);
        }

        function startInterval() {
            if (intervalId) return;
            intervalId = setInterval(goToNext, SLIDE_DURATION_MS);
        }

        function stopInterval() {
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
        }

        var observer = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    inView = entry.isIntersecting;
                    if (inView) {
                        startInterval();
                    } else {
                        stopInterval();
                    }
                });
            },
            { threshold: 0.25 }
        );
        observer.observe(heroSection);

        document.addEventListener("click", function () {
            currentIndex = (currentIndex + 1) % SLIDES.length;
            setSlide(slideWrapper, imgEl, currentIndex, quadrantState);
            stopInterval();
            if (inView) startInterval();
        });

        // Initial slide
        setSlide(slideWrapper, imgEl, currentIndex, quadrantState);
        if (inView) startInterval();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
