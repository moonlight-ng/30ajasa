(function () {
    const placeholder = document.getElementById('footer-placeholder');
    if (!placeholder) return;
    fetch('/app/components/footer.html')
        .then((r) => r.text())
        .then((html) => {
            placeholder.outerHTML = html;
        })
        .catch(() => { });
})();
