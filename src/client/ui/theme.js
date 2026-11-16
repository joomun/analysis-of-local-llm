// Theme handling
import { fmt } from '../utils/formatting.js';

let iconMoon = null;
let iconSun  = null;
const themeLabel = document.getElementById('themeLabel');

export function setIconElements(toggleEl) {
    if (!toggleEl) return;
    iconMoon = toggleEl.querySelector('.icon-moon');
    iconSun  = toggleEl.querySelector('.icon-sun');
}

export function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const isDark = theme !== 'light';
    if (iconMoon) iconMoon.style.display = isDark ? '' : 'none';
    if (iconSun)  iconSun.style.display  = isDark ? 'none' : '';
    if (themeLabel) themeLabel.textContent = isDark ? 'Light' : 'Dark';
}

export function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('dashboard-theme', next); } catch (e) {}
    applyTheme(next);
}
