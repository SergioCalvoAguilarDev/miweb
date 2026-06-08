/* ─── SALUDO DINAMICO ──────────────────────────────── */
(function dynamicGreeting() {
  const el = document.getElementById('greetingText');
  if (!el) return;
  const h = new Date().getHours();
  let msg = 'Hola, soy';
  if (h >= 6  && h < 14) msg = 'Buenos dias';
  if (h >= 14 && h < 21) msg = 'Buenas tardes';
  if (h >= 21 || h < 6)  msg = 'Buenas noches';
  el.textContent = msg;
})();

/* ─── CONTADORES ANIMADOS ─────────────────────────── */
(function animateCounters() {
  const numbers = document.querySelectorAll('.stat-value');
  const suffix = { '5': '+', '40': '+', '100': '%' };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseInt(el.dataset.target, 10);
      const suf = suffix[String(target)] || '';
      let current = 0;
      const step = 1400 / target;

      const timer = setInterval(() => {
        current++;
        el.textContent = current + suf;
        if (current >= target) {
          el.textContent = target + suf;
          clearInterval(timer);
        }
      }, step);

      observer.unobserve(el);
    });
  }, { threshold: 0.5 });

  numbers.forEach(n => observer.observe(n));
})();

/* ─── TOAST ───────────────────────────────────────── */
let toastTimer = null;
function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

/* ─── ACCIONES ────────────────────────────────────── */
function handlePortfolio() {
  showToast('Portfolio en desarrollo');
}
function handleContact() {
  showToast('sergio.calvo@email.com');
}

/* ─── CURSOR GLOW ─────────────────────────────────── */
(function cursorGlow() {
  const glow = document.createElement('div');
  glow.style.cssText = `
    position: fixed;
    width: 300px; height: 300px;
    border-radius: 50%;
    pointer-events: none;
    background: radial-gradient(circle, rgba(0,112,209,0.05) 0%, transparent 70%);
    transform: translate(-50%, -50%);
    z-index: 3;
    transition: opacity 0.4s;
    opacity: 0;
  `;
  document.body.appendChild(glow);

  document.addEventListener('mousemove', (e) => {
    glow.style.left = e.clientX + 'px';
    glow.style.top  = e.clientY + 'px';
    glow.style.opacity = '1';
  });
  document.addEventListener('mouseleave', () => {
    glow.style.opacity = '0';
  });
})();
