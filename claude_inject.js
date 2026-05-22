(async () => {
  const resp = await browser.runtime.sendMessage({ type: 'CLAUDE_INJECT_READY' });
  if (!resp?.image) return;
  const { image: dataUrl, prefix = '' } = resp;

  function dataUrlToFile(url, name) {
    const [head, b64] = url.split(',');
    const mime = /data:([^;]+)/.exec(head)?.[1] || 'image/png';
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], name, { type: mime });
  }

  async function waitFor(predicate, timeout = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const r = predicate();
      if (r) return r;
      await new Promise(r => setTimeout(r, 200));
    }
    return null;
  }

  const file = dataUrlToFile(dataUrl, `snip-${Date.now()}.png`);

  // 1) Attach image first via the page's own file input. This is the most
  // reliable path — React/ProseMirror ignore most synthetic paste/drop with files.
  const fileInput = await waitFor(() => {
    const inputs = document.querySelectorAll('input[type="file"]');
    for (const inp of inputs) {
      const accept = (inp.accept || '').toLowerCase();
      if (!accept || accept.includes('image') || accept.includes('*') || accept.includes('png')) {
        return inp;
      }
    }
    return inputs[0] || null;
  });

  let attached = false;
  if (fileInput) {
    try {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      attached = true;
    } catch (e) {
      console.warn('[look-claude] file input assignment failed', e);
    }
  }

  // 2) Now insert prefix into the composer. Just focus and insertText — don't
  // manually move the caret; that causes ProseMirror to insert a leading newline.
  const input = await waitFor(() => document.querySelector('div[contenteditable="true"]'));
  if (input && prefix) {
    input.focus();
    if (!document.execCommand('insertText', false, prefix)) {
      const dt = new DataTransfer();
      dt.setData('text/plain', prefix);
      input.dispatchEvent(new ClipboardEvent('paste', {
        clipboardData: dt, bubbles: true, cancelable: true,
      }));
    }
  }

  // 3) If file-input assignment didn't work, fall back to synthetic paste/drop
  // on the composer.
  if (!attached && input) {
    input.focus();
    const pdt = new DataTransfer();
    pdt.items.add(file);
    input.dispatchEvent(new ClipboardEvent('paste', {
      clipboardData: pdt, bubbles: true, cancelable: true,
    }));

    setTimeout(() => {
      const chip = document.querySelector(
        '[data-testid*="attachment" i], [aria-label*="attach" i] img'
      );
      if (chip) return;
      const ddt = new DataTransfer();
      ddt.items.add(file);
      const r = input.getBoundingClientRect();
      const opts = {
        bubbles: true, cancelable: true, composed: true,
        clientX: r.left + r.width / 2,
        clientY: r.top + r.height / 2,
        dataTransfer: ddt,
      };
      input.dispatchEvent(new DragEvent('dragenter', opts));
      input.dispatchEvent(new DragEvent('dragover', opts));
      input.dispatchEvent(new DragEvent('drop', opts));
    }, 400);
  }
})();
