// Theme management script
function setTheme(theme) {
  const html = document.documentElement;
  html.classList.remove('light', 'dark');
  html.classList.add(theme);
  localStorage.setItem('theme', theme);
}

function getTheme() {
  const storedTheme = localStorage.getItem('theme');
  if (storedTheme) {
    return storedTheme;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Initialize theme
document.addEventListener('DOMContentLoaded', () => {
  const theme = getTheme();
  setTheme(theme);

  // Handle theme toggle button clicks
  const themeToggleButtons = document.querySelectorAll('[data-theme-toggle]');
  themeToggleButtons.forEach(button => {
    button.addEventListener('click', () => {
      const currentTheme = getTheme();
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      setTheme(newTheme);
      
      // Update button icons
      const sunIcon = button.querySelector('[data-theme-icon="sun"]');
      const moonIcon = button.querySelector('[data-theme-icon="moon"]');
      if (sunIcon && moonIcon) {
        if (newTheme === 'dark') {
          sunIcon.classList.add('hidden');
          moonIcon.classList.remove('hidden');
        } else {
          sunIcon.classList.remove('hidden');
          moonIcon.classList.add('hidden');
        }
      }
    });
  });
}); 