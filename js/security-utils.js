// SalesDesk shared output-encoding helper.
// Load before any module that renders dynamic values into HTML.
(() => {
  if (window.esc) return;
  window.esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[char]));
})();
