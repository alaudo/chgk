// imageViewer.js - lightweight image popup viewer with zoom + ESC close

(function () {
  const MAX_ZOOM = 6;
  const MIN_ZOOM = 1;

  let overlayEl = null;
  let imgEl = null;
  let titleEl = null;
  let zoomEl = null;

  let isOpen = false;
  let zoom = 1;
  let tx = 0;
  let ty = 0;

  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartTx = 0;
  let dragStartTy = 0;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function applyTransform() {
    if (!imgEl) return;
    imgEl.style.transform = `translate(${tx}px, ${ty}px) scale(${zoom})`;
    if (zoomEl) zoomEl.textContent = `${Math.round(zoom * 100)}%`;
    imgEl.classList.toggle('image-viewer--can-pan', zoom > 1);
  }

  function resetView() {
    zoom = 1;
    tx = 0;
    ty = 0;
    applyTransform();
  }

  function setZoom(nextZoom, anchorX, anchorY) {
    const prevZoom = zoom;
    zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);

    if (!imgEl || !overlayEl) {
      applyTransform();
      return;
    }

    // Keep the point under the cursor relatively stable while zooming.
    if (typeof anchorX === 'number' && typeof anchorY === 'number') {
      const rect = imgEl.getBoundingClientRect();
      const imgCx = rect.left + rect.width / 2;
      const imgCy = rect.top + rect.height / 2;

      const dx = anchorX - imgCx;
      const dy = anchorY - imgCy;

      const scaleRatio = zoom / prevZoom;
      tx -= dx * (scaleRatio - 1);
      ty -= dy * (scaleRatio - 1);
    }

    applyTransform();
  }

  function closeViewer() {
    if (!overlayEl) return;
    overlayEl.style.display = 'none';
    overlayEl.setAttribute('aria-hidden', 'true');
    isOpen = false;
    isDragging = false;

    // Restore body scroll.
    document.body.classList.remove('image-viewer-open');
  }

  function openViewer(src, title) {
    ensureElements();

    if (!imgEl || !overlayEl) return;

    imgEl.src = src;
    imgEl.alt = title || 'Скриншот';

    if (titleEl) titleEl.textContent = title || '';

    resetView();

    overlayEl.style.display = 'flex';
    overlayEl.setAttribute('aria-hidden', 'false');
    isOpen = true;

    document.body.classList.add('image-viewer-open');

    // Focus close button for keyboard users.
    const closeBtn = overlayEl.querySelector('[data-image-viewer-close]');
    closeBtn?.focus();
  }

  function ensureElements() {
    if (overlayEl) return;

    overlayEl = document.createElement('div');
    overlayEl.className = 'image-viewer-overlay';
    overlayEl.id = 'imageViewerOverlay';
    overlayEl.style.display = 'none';
    overlayEl.setAttribute('aria-hidden', 'true');
    overlayEl.setAttribute('role', 'dialog');
    overlayEl.setAttribute('aria-modal', 'true');

    overlayEl.innerHTML = `
      <div class="image-viewer-backdrop" data-image-viewer-backdrop></div>
      <div class="image-viewer-dialog" role="document">
        <div class="image-viewer-toolbar">
          <div class="image-viewer-title" id="imageViewerTitle"></div>
          <div class="image-viewer-actions">
            <button type="button" class="btn btn-secondary btn-small" data-image-viewer-zoom-out title="Уменьшить">−</button>
            <span class="image-viewer-zoom" id="imageViewerZoom">100%</span>
            <button type="button" class="btn btn-secondary btn-small" data-image-viewer-zoom-in title="Увеличить">+</button>
            <button type="button" class="btn btn-secondary btn-small" data-image-viewer-reset title="Сбросить">↺</button>
            <button type="button" class="btn btn-danger btn-small" data-image-viewer-close title="Закрыть">×</button>
          </div>
        </div>
        <div class="image-viewer-stage" data-image-viewer-stage>
          <img class="image-viewer-image" id="imageViewerImage" src="" alt="">
        </div>
        <div class="image-viewer-hint">Колёсико мыши — зум, Esc — закрыть, перетаскивание — панорамирование при увеличении</div>
      </div>
    `;

    document.body.appendChild(overlayEl);

    imgEl = overlayEl.querySelector('#imageViewerImage');
    titleEl = overlayEl.querySelector('#imageViewerTitle');
    zoomEl = overlayEl.querySelector('#imageViewerZoom');

    // Backdrop click closes.
    overlayEl.querySelector('[data-image-viewer-backdrop]')?.addEventListener('click', closeViewer);

    // Close button.
    overlayEl.querySelector('[data-image-viewer-close]')?.addEventListener('click', closeViewer);

    // Zoom controls.
    overlayEl.querySelector('[data-image-viewer-zoom-in]')?.addEventListener('click', () => setZoom(zoom * 1.2));
    overlayEl.querySelector('[data-image-viewer-zoom-out]')?.addEventListener('click', () => setZoom(zoom / 1.2));
    overlayEl.querySelector('[data-image-viewer-reset]')?.addEventListener('click', resetView);

    // Wheel zoom.
    overlayEl.querySelector('[data-image-viewer-stage]')?.addEventListener(
      'wheel',
      (e) => {
        if (!isOpen) return;
        e.preventDefault();
        const delta = e.deltaY;
        const factor = delta > 0 ? 1 / 1.1 : 1.1;
        setZoom(zoom * factor, e.clientX, e.clientY);
      },
      { passive: false }
    );

    // Drag to pan.
    imgEl?.addEventListener('mousedown', (e) => {
      if (!isOpen) return;
      if (zoom <= 1) return;
      e.preventDefault();
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragStartTx = tx;
      dragStartTy = ty;
    });

    window.addEventListener('mousemove', (e) => {
      if (!isOpen) return;
      if (!isDragging) return;
      tx = dragStartTx + (e.clientX - dragStartX);
      ty = dragStartTy + (e.clientY - dragStartY);
      applyTransform();
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
    });

    // Keyboard.
    window.addEventListener('keydown', (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        closeViewer();
      }
      if (e.key === '+' || (e.key === '=' && (e.ctrlKey || e.metaKey))) {
        // allow ctrl+= on some keyboards
        // (only if viewer open)
      }
    });
  }

  function handleTriggerClick(triggerEl, e) {
    const src = triggerEl.getAttribute('data-viewer-src');
    if (!src) return;

    e.preventDefault();
    e.stopPropagation();

    const img = triggerEl.querySelector('img');
    const title = img?.alt || triggerEl.getAttribute('aria-label') || '';
    openViewer(src, title);
  }

  // Global click delegation.
  document.addEventListener(
    'click',
    (e) => {
      const el = e.target?.closest?.('[data-viewer-src]');
      if (!el) return;
      handleTriggerClick(el, e);
    },
    true
  );
})();
