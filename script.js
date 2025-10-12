// Basic site interactivity
(() => {
  const root = document.documentElement;

  // Theme initialization
  const themeToggle = document.getElementById('themeToggle');
  const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches ?? false;
  const savedTheme = localStorage.getItem('theme');
  const isLight = savedTheme ? savedTheme === 'light' : prefersLight;
  if (isLight) root.classList.add('light');

  // Set initial icon
  const icon = themeToggle.querySelector('i');
  if (icon) {
    icon.setAttribute('data-lucide', isLight ? 'moon' : 'sun');
  }
  lucide.createIcons();

  // Toggle theme
  let animating = false;

  themeToggle?.addEventListener('click', () => {
    if (animating) return; // ignore clicks while animating
    animating = true;

    const nowLight = document.documentElement.classList.toggle('light');
    localStorage.setItem('theme', nowLight ? 'light' : 'dark');
    themeToggle.setAttribute('aria-pressed', String(nowLight));

    const oldSvg = themeToggle.querySelector('svg');
    if (!oldSvg) {
      animating = false;
      return;
    }

    oldSvg.style.opacity = 0;
    oldSvg.style.transform = 'rotate(90deg) scale(0.8)';

    setTimeout(() => {
      oldSvg.remove();

      const newIcon = document.createElement('i');
      newIcon.setAttribute('data-lucide', nowLight ? 'moon' : 'sun');
      themeToggle.appendChild(newIcon);
      lucide.createIcons();

      const newSvg = themeToggle.querySelector('svg');
      if (!newSvg) {
        animating = false;
        return;
      }

      newSvg.style.opacity = 0;
      newSvg.style.transform = 'rotate(-90deg) scale(0.8)';

      requestAnimationFrame(() => {
        newSvg.style.opacity = 1;
        newSvg.style.transform = 'rotate(0deg) scale(1)';
      });

      // Animation done after 300ms
      setTimeout(() => {
        animating = false;
      }, 300);

    }, 300);
  });

  // Counter button
  const countSpan = document.getElementById('count');
  const incrementBtn = document.getElementById('increment');
  let count = 0;
  incrementBtn?.addEventListener('click', () => {
    count += 1;
    if (countSpan) countSpan.textContent = String(count);
  });

  // Simple form handling
  const form = document.getElementById('nameForm');
  const input = document.getElementById('nameInput');
  const greeting = document.getElementById('greeting');

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = (input && 'value' in input) ? String(input.value).trim() : '';
    if (!name) {
      if (greeting) greeting.textContent = 'Please enter a name.';
      return;
    }
    if (greeting) greeting.textContent = `Hello, ${name}!`;
  });

  // Footer year
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();


