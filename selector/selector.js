(() => {
  if (window.__lookClaudeListenerInstalled) return;
  window.__lookClaudeListenerInstalled = true;

  let overlay, rect, hint;
  let startX = 0, startY = 0, dragging = false, active = false;

  function startSnip() {
    if (active) return;
    active = true;

    overlay = document.createElement('div');
    overlay.id = 'look-claude-overlay';
    rect = document.createElement('div');
    rect.id = 'look-claude-rect';
    rect.style.display = 'none';
    hint = document.createElement('div');
    hint.id = 'look-claude-hint';
    hint.textContent = 'Drag to select a region — Esc to cancel';

    document.documentElement.appendChild(overlay);
    document.documentElement.appendChild(rect);
    document.documentElement.appendChild(hint);

    document.addEventListener('keydown', onKey, true);
    overlay.addEventListener('mousedown', onDown);
    overlay.addEventListener('mousemove', onMove);
    overlay.addEventListener('mouseup', onUp);
  }

  function cleanup() {
    if (!active) return;
    overlay?.remove();
    rect?.remove();
    hint?.remove();
    overlay = rect = hint = null;
    document.removeEventListener('keydown', onKey, true);
    dragging = false;
    active = false;
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      cleanup();
    }
  }

  function onDown(e) {
    if (e.button !== 0) return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    rect.style.left = startX + 'px';
    rect.style.top = startY + 'px';
    rect.style.width = '0px';
    rect.style.height = '0px';
    rect.style.display = 'block';
  }

  function onMove(e) {
    if (!dragging) return;
    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);
    rect.style.left = x + 'px';
    rect.style.top = y + 'px';
    rect.style.width = w + 'px';
    rect.style.height = h + 'px';
  }

  async function onUp(e) {
    if (!dragging) return;
    dragging = false;
    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);

    if (w < 5 || h < 5) {
      cleanup();
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const region = {
      x: Math.round(x * dpr),
      y: Math.round(y * dpr),
      width: Math.round(w * dpr),
      height: Math.round(h * dpr)
    };

    hint.textContent = 'Capturing…';
    overlay.style.background = 'transparent';
    rect.style.display = 'none';

    try {
      await browser.runtime.sendMessage({ type: 'CAPTURE_REGION', region });
    } catch (err) {
      hint.textContent = 'Error: ' + (err?.message || err);
      setTimeout(cleanup, 2500);
      return;
    }
    cleanup();
  }

  browser.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'START_SNIP') {
      startSnip();
      return Promise.resolve({ ok: true });
    }
  });
})();
