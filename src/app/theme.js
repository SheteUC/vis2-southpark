function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  window.localStorage.setItem('south-park-theme', theme);
}

function getStoredTheme() {
  return window.localStorage.getItem('south-park-theme');
}

function updateThemeIcon(button, theme) {
  button.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  button.innerHTML = theme === 'dark'
    ? `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
    `
    : `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="5"></circle>
        <path d="M12 1v2"></path>
        <path d="M12 21v2"></path>
        <path d="M4.22 4.22l1.42 1.42"></path>
        <path d="M18.36 18.36l1.42 1.42"></path>
        <path d="M1 12h2"></path>
        <path d="M21 12h2"></path>
        <path d="M4.22 19.78l1.42-1.42"></path>
        <path d="M18.36 5.64l1.42-1.42"></path>
      </svg>
    `;
}

export function initThemeToggle() {
  const button = document.querySelector('[data-theme-toggle]');
  if (!button) return;

  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialTheme = getStoredTheme() || (prefersDark ? 'dark' : 'light');
  setTheme(initialTheme);
  updateThemeIcon(button, initialTheme);

  button.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
    updateThemeIcon(button, next);
  });
}
