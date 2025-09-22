<script>
/* Trix A11Y Patch v2 (CSS + robust keyboard activation)
   - Fixes ::before hit-area
   - Tab focus + Enter/Space activation that dispatches pointer+mouse+click
*/
(function trixA11yPatchV2(){
  if (window.__trixA11yV2) return;
  window.__trixA11yV2 = true;

  // --- Inject CSS so the real <button> is the hit target ---
  const styleId = 'trix-a11y-v2-styles';
  if (!document.getElementById(styleId)) {
    const s = document.createElement('style');
    s.id = styleId;
    s.textContent = `
      trix-toolbar .trix-button {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2.25rem;
        height: 2.25rem;
        padding: 0;
        cursor: pointer;
      }
      /* Prevent pseudo/overlays from stealing clicks */
      trix-toolbar .trix-button::before,
      trix-toolbar .trix-button-group::before,
      trix-toolbar .trix-button-group::after { pointer-events: none; }
      trix-toolbar .trix-button,
      trix-toolbar .trix-button * { pointer-events: auto; }

      /* Visible focus */
      trix-toolbar .trix-button:focus,
      trix-toolbar .trix-button--dialog:focus,
      trix-editor:focus {
        outline: 2px solid #005fcc;
        outline-offset: 2px;
      }

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

  // Synthesize the full activation sequence some toolbars expect
  function synthActivate(el){
    const opts = {bubbles:true, cancelable:true, composed:true};
    const rect = el.getBoundingClientRect();
    const clientX = Math.max(0, rect.left + rect.width/2);
    const clientY = Math.max(0, rect.top + rect.height/2);

    const pointerDown = new PointerEvent('pointerdown', {pointerId:1, pointerType:'mouse', clientX, clientY, ...opts});
    el.dispatchEvent(pointerDown);

    const mouseDown = new MouseEvent('mousedown', {clientX, clientY, ...opts});
    el.dispatchEvent(mouseDown);

    const pointerUp = new PointerEvent('pointerup', {pointerId:1, pointerType:'mouse', clientX, clientY, ...opts});
    el.dispatchEvent(pointerUp);

    const mouseUp = new MouseEvent('mouseup', {clientX, clientY, ...opts});
    el.dispatchEvent(mouseUp);

    const clickEv = new MouseEvent('click', {clientX, clientY, ...opts});
    el.dispatchEvent(clickEv);
  }

  function enhanceToolbar(toolbar){
    if (!toolbar || toolbar.__a11yDone) return;
    toolbar.__a11yDone = true;

    toolbar.setAttribute('role','toolbar');
    toolbar.setAttribute('aria-label', toolbar.getAttribute('aria-label') || 'Rich text formatting');

    const buttons = toolbar.querySelectorAll('.trix-button, .trix-button--dialog, input.trix-button');

    const setPressedFor = (el) => {
      if (el.hasAttribute('data-trix-attribute')) {
        el.setAttribute('aria-pressed', el.classList.contains('trix-active') ? 'true' : 'false');
      }
    };

    buttons.forEach(btn => {
      if (btn.tabIndex < 0) btn.tabIndex = 0;
      btn.setAttribute('role','button');

      // Keep aria-disabled synced
      const syncDisabled = () => {
        if (btn.hasAttribute('disabled')) btn.setAttribute('aria-disabled','true');
        else btn.removeAttribute('aria-disabled');
      };
      syncDisabled();
      new MutationObserver(syncDisabled).observe(btn, {attributes:true, attributeFilter:['disabled']});

      // Robust keyboard activation:
      // - Enter activates on keydown (native behavior)
      // - Space prevents scroll on keydown and activates on keyup (native button pattern)
      btn.addEventListener('keydown', e => {
        if (btn.hasAttribute('disabled') || btn.getAttribute('aria-disabled') === 'true') return;
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          synthActivate(btn);
        } else if (e.key === ' ') {
          e.preventDefault(); // prevent page scroll
          e.stopPropagation();
          // wait for keyup to "click"
        }
      });
      btn.addEventListener('keyup', e => {
        if (btn.hasAttribute('disabled') || btn.getAttribute('aria-disabled') === 'true') return;
        if (e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          synthActivate(btn);
        }
      });

      setPressedFor(btn);
    });

    // Keep aria-pressed synced when Trix toggles classes
    const activeObserver = new MutationObserver((muts) => {
      muts.forEach(m => {
        if (m.type === 'attributes' && m.attributeName === 'class') {
          setPressedFor(m.target);
        }
      });
    });
    buttons.forEach(btn => activeObserver.observe(btn, {attributes:true, attributeFilter:['class']}));

    // Dialog semantics (link dialog)
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
  }

  function enhanceEditor(editor){
    if (!editor || editor.__a11yDone) return;
    editor.__a11yDone = true;

    editor.setAttribute('role','textbox');       // Trix usually sets this
    editor.setAttribute('aria-multiline','true');
    if (!editor.hasAttribute('aria-labelledby') && !editor.hasAttribute('aria-label')) {
      editor.setAttribute('aria-label','Announcement content editor');
    }

    // Live region (optional announcements)
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

    // Enhance its toolbar
    const toolbarId = editor.getAttribute('toolbar');
    if (toolbarId) {
      const tb = document.getElementById(toolbarId);
      if (tb) enhanceToolbar(tb);
    }
  }

  // Enhance existing instances
  document.querySelectorAll('trix-toolbar').forEach(enhanceToolbar);
  document.querySelectorAll('trix-editor').forEach(enhanceEditor);

  // Watch for dynamically inserted editors/toolbars
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
