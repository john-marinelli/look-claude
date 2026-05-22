async function cropDataURL(dataUrl, region) {
  const blob = await (await fetch(dataUrl)).blob();
  const bmp = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(region.width, region.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(
    bmp,
    region.x, region.y, region.width, region.height,
    0, 0, region.width, region.height
  );
  return await canvas.convertToBlob({ type: 'image/png' });
}

async function blobToDataURL(blob) {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return 'data:image/png;base64,' + btoa(bin);
}

async function captureRegion(region, windowId) {
  const screenshotDataUrl = await browser.tabs.captureVisibleTab(windowId, {
    format: 'png'
  });
  const croppedBlob = await cropDataURL(screenshotDataUrl, region);
  return await blobToDataURL(croppedBlob);
}

async function sendToClaude(imageDataUrl, prefix) {
  await browser.storage.local.set({
    pendingClaudeImage: imageDataUrl,
    pendingClaudePrefix: prefix || '',
    pendingClaudeAt: Date.now(),
  });
  const claudeTabs = await browser.tabs.query({ url: 'https://claude.ai/*' });
  if (claudeTabs.length > 0) {
    await browser.tabs.update(claudeTabs[0].id, { active: true, url: 'https://claude.ai/new' });
    await browser.windows.update(claudeTabs[0].windowId, { focused: true });
  } else {
    await browser.tabs.create({ url: 'https://claude.ai/new' });
  }
}

browser.runtime.onMessage.addListener(async (msg, sender) => {
  if (msg?.type === 'CAPTURE_REGION') {
    try {
      const windowId = sender.tab?.windowId;
      const imageDataUrl = await captureRegion(msg.region, windowId);
      const { prefix = '' } = await browser.storage.local.get('prefix');
      await sendToClaude(imageDataUrl, prefix);
      return { ok: true };
    } catch (e) {
      console.error('[look-claude] capture failed', e);
      return { ok: false, error: String(e?.message || e) };
    }
  }
  if (msg?.type === 'CLAUDE_INJECT_READY') {
    const {
      pendingClaudeImage,
      pendingClaudePrefix,
      pendingClaudeAt,
    } = await browser.storage.local.get([
      'pendingClaudeImage', 'pendingClaudePrefix', 'pendingClaudeAt'
    ]);
    if (pendingClaudeImage && Date.now() - (pendingClaudeAt || 0) < 60_000) {
      await browser.storage.local.remove([
        'pendingClaudeImage', 'pendingClaudePrefix', 'pendingClaudeAt'
      ]);
      return { image: pendingClaudeImage, prefix: pendingClaudePrefix || '' };
    }
    return { image: null };
  }
});
