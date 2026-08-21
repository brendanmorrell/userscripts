// ==UserScript==
// @name         Hide GitHub Copilot Comments
// @namespace    https://github.com/brendanmorrell/userscripts
// @version      2.0.1
// @description  Hides GitHub Copilot bot review comments on PRs. Purple button (bottom-right) to toggle.
// @author       brendanmorrell
// @match        https://github.com/*/*/pull/*
// @icon         data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><circle cx='32' cy='32' r='32' fill='%237c3aed'/><line x1='18' y1='18' x2='46' y2='46' stroke='white' stroke-width='6' stroke-linecap='round'/><line x1='46' y1='18' x2='18' y2='46' stroke='white' stroke-width='6' stroke-linecap='round'/></svg>
// @grant        GM_setValue
// @grant        GM_getValue
// @updateURL    https://raw.githubusercontent.com/brendanmorrell/userscripts/main/hide-copilot-comments.user.js
// @downloadURL  https://raw.githubusercontent.com/brendanmorrell/userscripts/main/hide-copilot-comments.user.js
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_KEY = 'copilot_comments_hidden';
  let hidden = GM_getValue(STORAGE_KEY, true);

  // CSS :has() approach — no DOM manipulation of comments, no observer loop possible.
  // The browser applies/removes these rules instantly as content loads dynamically.
  const styleEl = document.createElement('style');
  styleEl.id = 'copilot-hider-style';

  const HIDE_CSS = `
    .TimelineItem:has(a[data-hovercard-type="copilot"]),
    .js-timeline-item:has(a[data-hovercard-type="copilot"]),
    .js-comment-container:has(a[data-hovercard-type="copilot"]),
    .js-resolvable-timeline-thread-container:has(a[data-hovercard-type="copilot"]),
    .pull-request-review-thread:has(a[data-hovercard-type="copilot"]) {
      display: none !important;
    }
  `;

  function applyState() {
    styleEl.textContent = hidden ? HIDE_CSS : '';
    updateButton();
  }

  // --- Toggle button ---
  let btn = null;

  const ICON_HIDE = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  const ICON_SHOW = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

  function updateButton() {
    if (!btn) return;
    if (hidden) {
      btn.style.background = '#7c3aed';
      btn.title = 'Copilot comments hidden — click to show';
      btn.innerHTML = ICON_HIDE;
    } else {
      btn.style.background = '#16a34a';
      btn.title = 'Copilot comments visible — click to hide';
      btn.innerHTML = ICON_SHOW;
    }
  }

  function createButton() {
    if (document.getElementById('copilot-toggle-btn')) return;
    btn = document.createElement('button');
    btn.id = 'copilot-toggle-btn';
    Object.assign(btn.style, {
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: '9999',
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      border: 'none',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
      transition: 'background 0.15s, transform 0.1s',
    });
    btn.addEventListener('click', () => {
      hidden = !hidden;
      GM_setValue(STORAGE_KEY, hidden);
      applyState();
    });
    btn.addEventListener('mouseenter', () => { btn.style.transform = 'scale(1.1)'; });
    btn.addEventListener('mouseleave', () => { btn.style.transform = 'scale(1)'; });
    document.body.appendChild(btn);
    updateButton();
  }

  function init() {
    (document.head || document.documentElement).appendChild(styleEl);
    applyState();
    if (document.body) {
      createButton();
    } else {
      document.addEventListener('DOMContentLoaded', createButton);
    }
  }

  init();
})();
