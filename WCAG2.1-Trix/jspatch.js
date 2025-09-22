<script>
/* Trix A11Y Patch v3 (WCAG 2.1 AA)
   - Hit area fix (pseudo-elements can't steal clicks)
   - Roving tabindex (Tab enters/leaves, Arrows move, Home/End jump)
   - Robust keyboard activation (synth pointer+mouse+click)
   - aria-pressed/aria-disabled sync; toolbar/dialog/editor semantics
*/
(function trixA11yV3(){
  if (window.__trixA11yV3Applied) return;
  window.__trixA11yV3Applied = true;

  // ---------- Inject CSS ----------
  const STYLE_ID = 'trix-a11y-v3-styles';
  if (!document.getElementById(STYLE_ID)) {
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      /* Make the actual <button> the hit target */
      trix-toolbar .trix-button {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2.25rem;
        height: 2.25rem;
        padding: 0;
        cursor: pointer;
        -webkit-user-select: none;
        user-select: none;
      }
      /* Prevent pseudo/overlays from stealing clicks */
      trix-toolbar .trix-button::before,
      trix-toolbar .trix-button-group::before,
      trix-toolbar .trix-button-group::after { pointer-events: none; }
      trix-toolbar .trix-button,
      trix-toolbar .trix-button * { pointer-events: auto; }

      /* Visible focus (2.4.7) */
      trix-toolbar .trix-button:focus,
      trix-toolbar .trix-button--dialog:focus,
      trix-editor:focus {
        outline: 2px solid #005fcc;
        outline-offset: 2px;
      }

      /* Visually hidden utility for polite status */
      .visually-hidden-trix-a11y {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        padding: 0 !important;
        margin: -1px !important;
        overflow: hidden !important;
        clip: rect(0 0 0 0) !important;
        white-space: nowrap !important;
        border: 0 !important;
      }
    `;
    document.head.appendChild(s);
  }

  // ---------- Utilities ----------
  function synthActivate(el){
    // Dispatch the full sequence some toolbars expect
    const bubbles = {bubbles:true, cancelable:true, composed:true};
    const r = el.getBoundingClientRect();
    const clientX = Math.max(0, r.left + r.width/2);
    const clientY = Math.max(0, r.top + r.height/2);

    el.dispatchEvent(new PointerEvent('pointerdown', {pointerId:1, pointerType:'mouse', clientX, clientY, ...bubbles}));
    el.dispatchEvent(new MouseEvent('mousedown', {clientX, clientY, ...bubbles}));
    el.dispatchEvent(new PointerEvent('pointerup',   {pointerId:1, pointerType:'mouse', clientX, clientY, ...bubbles}));
    el.dispatchEvent(new MouseEvent('mouseup', {clientX, clientY, ...bubbles}));
    el.dispatchEvent(new MouseEvent('click',   {clientX, clientY, ...bubbles}));
  }

  function isDisabled(btn){
    return btn.hasAttribute('disabled') || btn.getAttribute('aria-disabled') === 'true';
  }

  function getButtons(toolbar){
    return Array.from(toolbar.querySelectorAll('.trix-button, .trix-button--dialog, input.trix-button'));
  }

  function firstEnabledIndex(buttons){
    return buttons.findIndex(b => !isDisabled(b));
  }
  function lastEnabledIndex(buttons){
    for (let i=buttons.length-1;i>=0;i--) if (!isDisabled(buttons[i])) return i;
    return -1;
  }
  function nextEnabled(buttons, start, dir){
    let i = start;
    for (let n=0;n<buttons.length;n++){
      i = (i + dir + buttons.length) % buttons.length;
      if (!isDisabled(buttons[i])) return i;
    }
    return start;
  }

  // ---------- Toolbar Enhancement ----------
  function enableRovingTabindex(toolbar){
    const buttons = getButtons(toolbar);
    if (!buttons.length) return;

    // Make only the first enabled button tabbable
    buttons.forEach(b => b.tabIndex = -1);
    const firstIdx = Math.max(0, firstEnabledIndex(buttons));
    if (firstIdx >= 0) buttons[firstIdx].tabIndex = 0;

    // Keep roving model stable if DOM changes (buttons enable/disable)
    const refresh = () => {
      const bs = getButtons(toolbar);
      // If currently focused button is in set, keep it tabbable; else set first enabled
      const active = document.activeElement;
      bs.forEach(b => b.tabIndex = -1);
      let idx = bs.indexOf(active);
      if (idx === -1) idx = firstEnabledIndex(bs);
      if (idx >= 0) bs[idx].tabIndex = 0;
    };

    const rovingKeydown = (e) => {
      const bs = getButtons(toolbar);
      if (!bs.length) return;
      const current = bs.indexOf(document.activeElement);
      if (current === -1) return;

      let targetIndex = null;
      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          targetIndex = nextEnabled(bs, current, +1);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          targetIndex = nextEnabled(bs, current, -1);
          break;
        case 'Home':
          e.preventDefault();
          targetIndex = firstEnabledIndex(bs);
          break;
        case 'End':
          e.preventDefault();
          targetIndex = lastEnabledIndex(bs);
          break;
      }
      if (targetIndex !== null && targetIndex >= 0) {
        bs.forEach(b => b.tabIndex = -1);
        bs[targetIndex].tabIndex = 0;
        bs[targetIndex].focus();
      }
    };

    toolbar.addEventListener('keydown', rovingKeydown);
    new MutationObserver(refresh).observe(toolbar, {subtree:true, childList:true, attributes:true, attributeFilter:['disabled','class']});
  }

  function enhanceToolbar(toolbar){
    if (!toolbar || toolbar.__trixA11yDone) return;
    toolbar.__trixA11yDone = true;

    toolbar.setAttribute('role','toolbar');
    if (!toolbar.hasAttribute('aria-label')) {
      toolbar.setAttribute('aria-label','Rich text formatting');
    }

    const buttons = getButtons(toolbar);

    // Ensure buttons are focusable and keyboard-activatable
    buttons.forEach(btn => {
      btn.setAttribute('role','button');

      // Sync disabled → aria-disabled
      const syncDisabled = () => {
        if (btn.hasAttribute('disabled')) btn.setAttribute('aria-disabled','true');
        else btn.removeAttribute('aria-disabled');
      };
      syncDisabled();
      new MutationObserver(syncDisabled).observe(btn, {attributes:true, attributeFilter:['disabled']});

      // aria-pressed for toggles
      const setPressedFor = () => {
        if (btn.hasAttribute('data-trix-attribute')) {
          btn.setAttribute('aria-pressed', btn.classList.contains('trix-active') ? 'true' : 'false');
        }
      };
      setPressedFor();
      new MutationObserver((muts) => {
        muts.forEach(m => { if (m.attributeName === 'class') setPressedFor(); });
      }).observe(btn, {attributes:true, attributeFilter:['class']});

      // Robust keyboard activation (Enter on keydown; Space on keyup)
      btn.addEventListener('keydown', e => {
        if (isDisabled(btn)) return;
        if (e.key === 'Enter') {
          e.preventDefault(); e.stopPropagation();
          synthActivate(btn);
        } else if (e.key === ' ') {
          e.preventDefault(); e.stopPropagation(); // prevent scroll
        }
      });
      btn.addEventListener('keyup', e => {
        if (isDisabled(btn)) return;
        if (e.key === ' ') {
          e.preventDefault(); e.stopPropagation();
          synthActivate(btn);
        }
      });
    });

    // Link dialog semantics (if present)
    const linkDialog = toolbar.querySelector('[data-trix-dialog="href"]');
    if (linkDialog) {
      linkDialog.setAttribute('role','dialog');
      linkDialog.setAttribute('aria-modal','true');
      const urlInput = linkDialog.querySelector('input.trix-input--dialog');
      if (urlInput) {
        if (!urlInput.id) urlInput.id = 'trix-url-' + Math.random().toString(36).slice(2);
        linkDialog.setAttribute('aria-labelledby', urlInput.id);
      }
    }

    // Roving tabindex last (after individual wiring)
    enableRovingTabindex(toolbar);
  }

  // ---------- Editor Enhancement ----------
  function enhanceEditor(editor){
    if (!editor || editor.__trixA11yDone) return;
    editor.__trixA11yDone = true;

    // Ensure textbox semantics
    editor.setAttribute('role','textbox'); // Trix usually sets this
    editor.setAttribute('aria-multiline','true');

    // Prefer aria-labelledby (use nearby H1 if present), else aria-label
    if (!editor.hasAttribute('aria-labelledby') && !editor.hasAttribute('aria-label')) {
      const heading = document.querySelector('h1, h2, [data-editor-label]');
      if (heading) {
        if (!heading.id) heading.id = 'trix-editor-label-' + Math.random().toString(36).slice(2);
        editor.setAttribute('aria-labelledby', heading.id);
      } else {
        editor.setAttribute('aria-label','Rich text editor');
      }
    }

    // Live region for subtle announcements
    let status = document.getElementById('trix-a11y-status');
    if (!status) {
      status = document.createElement('div');
      status.id = 'trix-a11y-status';
      status.className = 'visually-hidden-trix-a11y';
      status.setAttribute('role','status');
      status.setAttribute('aria-live','polite');
      document.body.appendChild(status);
    }
    const announce = (msg) => { status.textContent = msg; };
    editor.addEventListener('trix-undo', () => announce('Undo'));
    editor.addEventListener('trix-redo', () => announce('Redo'));
    // Uncomment if you want content-change announcements:
    // editor.addEventListener('trix-change', () => announce('Content updated'));

    // Enhance referenced toolbar
    const toolbarId = editor.getAttribute('toolbar');
    if (toolbarId) {
      const tb = document.getElementById(toolbarId);
      if (tb) enhanceToolbar(tb);
    }
  }

  // ---------- Apply to existing + future instances ----------
  document.querySelectorAll('trix-toolbar').forEach(enhanceToolbar);
  document.querySelectorAll('trix-editor').forEach(enhanceEditor);

  const rootObserver = new MutationObserver((muts) => {
    muts.forEach(m => {
      m.addedNodes && m.addedNodes.forEach(node => {
        if (!(node instanceof HTMLElement)) return;
        if (node.matches?.('trix-toolbar')) enhanceToolbar(node);
        if (node.matches?.('trix-editor')) enhanceEditor(node);
        node.querySelectorAll?.('trix-toolbar').forEach(enhanceToolbar);
        node.querySelectorAll?.('trix-editor').forEach(enhanceEditor);
      });
    });
  });
  rootObserver.observe(document.documentElement, { childList:true, subtree:true });
})();
</script>
