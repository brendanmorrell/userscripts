// ==UserScript==
// @name         Hide GitHub Copilot Comments
// @namespace    https://github.com/brendanmorrell/userscripts
// @version      1.1.0
// @description  Hides GitHub Copilot bot review comments on PRs. Purple button (bottom-right) to toggle.
// @author       brendanmorrell
// @match        https://github.com/*/*/pull/*
// @icon         data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><circle cx='32' cy='32' r='32' fill='%237c3aed'/><line x1='18' y1='18' x2='46' y2='46' stroke='white' stroke-width='6' stroke-linecap='round'/><line x1='46' y1='18' x2='18' y2='46' stroke='white' stroke-width='6' stroke-linecap='round'/></svg>
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_KEY = 'copilot_comments_hidden';
  let hidden = GM_getValue(STORAGE_KEY, true);

  // Find the outermost timeline container that owns a given author link
  function findContainer(authorLink) {
    let node = authorLink.parentElement;
    let candidate = null;
    while (node && node !== document.body) {
      if (node.matches(
        '.js-timeline-item, .TimelineItem, ' +
        '.js-comment-container, ' +
        '.js-resolvable-timeline-thread-container, ' +
        '.pull-request-review-thread'
      )) {
        candidate = node;
        // .js-timeline-item / .TimelineItem are the outermost we want
        if (node.matches('.js-timeline-item, .TimelineItem')) break;
      }
      node = node.parentElement;
    }
    return candidate;
  }

  function getCopilotContainers() {
    const containers = new Set();
    // Cast a wide net: user, bot, or app hrefs containing "copilot"
    const sel = [
      'a.author',
      'a[data-hovercard-type="user"]',
      'a[data-hovercard-type="bot"]',
      'a[href*="/copilot"]',
      'a[href*="/apps/copilot"]',
    ].join(', ');
    document.querySelectorAll(sel).forEach(a => {
      if (!/copilot/i.test(a.href) && !/copilot/i.test(a.textContent.trim())) return;
      const c = findContainer(a);
      if (c) containers.add(c);
    });
    return [...containers];
  }

  function applyState() {
    getCopilotContainers().forEach(el => {
      el.style.display = hidden ? 'none' : '';
    });
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

  // Re-apply on dynamic content (GitHub loads PR timeline lazily)
  let timer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(applyState, 150);
  });

  function init() {
    if (!document.body) { setTimeout(init, 50); return; }
    createButton();
    applyState();
    observer.observe(document.body, { childList: true, subtree: true });
  }

  init();
})();
