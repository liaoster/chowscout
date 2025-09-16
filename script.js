// Basic site interactivity
(() => {
  const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  const root = document.documentElement;

  // Theme initialization
  const savedTheme = localStorage.getItem('theme');
  const isLight = savedTheme ? savedTheme === 'light' : prefersLight;
  if (isLight) root.classList.add('light');

  // Toggle theme
  const themeToggle = document.getElementById('themeToggle');
  themeToggle?.addEventListener('click', () => {
    const nowLight = root.classList.toggle('light');
    localStorage.setItem('theme', nowLight ? 'light' : 'dark');
    themeToggle.setAttribute('aria-pressed', String(nowLight));
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


