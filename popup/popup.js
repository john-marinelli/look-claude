const prefixEl = document.getElementById('prefix');
const snipBtn = document.getElementById('snip');
const statusEl = document.getElementById('status');

(async () => {
  const { prefix = '' } = await browser.storage.local.get('prefix');
  prefixEl.value = prefix;
})();

prefixEl.addEventListener('input', () => {
  browser.storage.local.set({ prefix: prefixEl.value });
});

snipBtn.addEventListener('click', async () => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  if (/^(about:|chrome:|moz-extension:|resource:|view-source:)/.test(tab.url || '')) {
    statusEl.textContent = 'Cannot snip on internal pages. Switch to a regular tab.';
    return;
  }

  await browser.storage.local.set({ prefix: prefixEl.value });

  try {
    await browser.tabs.sendMessage(tab.id, { type: 'START_SNIP' });
    window.close();
  } catch (e) {
    console.error('[look-claude] start-snip failed', e);
    statusEl.textContent =
      'Failed to start snip: ' + (e?.message || e)
      + ' — Try reloading the page so the content script attaches, '
      + 'and confirm that "Access your data for all websites" is enabled in about:addons.';
  }
});
