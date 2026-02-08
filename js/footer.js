(function () {
    const placeholder = document.getElementById('footer-placeholder');
    if (!placeholder) return;
    fetch('/components/footer.html')
        .then((r) => r.text())
        .then((html) => {
            placeholder.outerHTML = html;
        })
        .catch(() => {});
})();
