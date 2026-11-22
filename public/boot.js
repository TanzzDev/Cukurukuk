// Terapkan tema SEBELUM render pertama (mencegah kilatan putih). File terpisah agar CSP tanpa inline script.
(function () {
  try {
    var t = localStorage.getItem('drowify_theme') || localStorage.getItem('nanz_theme') || 'dark';
    var d = document.documentElement;
    d.setAttribute('data-theme', t);
    d.classList.remove('dark', 'light');
    d.classList.add(t);
  } catch (e) { /* abaikan */ }
})();
