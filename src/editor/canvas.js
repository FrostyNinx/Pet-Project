// Interactive Pixel Canvas Controller

export class PixelCanvasController {
  constructor({
    mainCanvas,
    gridCanvas,
    selectionCanvas,
    prevOnionCanvas,
    nextOnionCanvas,
    remoteCursorCanvas,
    petModel,
    toolManager,
    onionSkinEngine,
    onStrokeDrawn,
    onCursorMove
  }) {
    this.mainCanvas = mainCanvas;
    this.gridCanvas = gridCanvas;
    this.selectionCanvas = selectionCanvas;
    this.prevOnionCanvas = prevOnionCanvas;
    this.nextOnionCanvas = nextOnionCanvas;
    this.remoteCursorCanvas = remoteCursorCanvas;

    this.mainCtx = mainCanvas.getContext('2d');
    this.gridCtx = gridCanvas.getContext('2d');
    this.selectionCtx = selectionCanvas ? selectionCanvas.getContext('2d') : null;
    this.prevOnionCtx = prevOnionCanvas.getContext('2d');
    this.nextOnionCtx = nextOnionCanvas.getContext('2d');
    this.cursorCtx = remoteCursorCanvas.getContext('2d');

    this.petModel = petModel;
    this.toolManager = toolManager;
    this.onionSkinEngine = onionSkinEngine;
    this.onStrokeDrawn = onStrokeDrawn || (() => {});
    this.onCursorMove = onCursorMove || (() => {});

    this.currentClip = 'idle';
    this.currentFrameIndex = 0;
    this.showGrid = true;
    this.gridOnTop = localStorage.getItem('coop_pet_grid_ontop') === 'true';
    if (this.gridCanvas) {
      this.gridCanvas.style.zIndex = this.gridOnTop ? '4' : '2.5';
    }
    this.isTransparentLayer = false;
    this.isDrawing = false;
    this.lastDrawnCoord = null;
    this.currentStrokeBatch = [];

    // Interactive Selection & Transformation System
    this.selection = null;
    this.isSelecting = false;
    this.isDraggingSelection = false;
    this.selectionBox = null;
    this.selectionDragStart = null;
    this.selectionStartCoord = null;
    this.selectionClipboard = null;
    this.dashOffset = 0;
    this.antsTimer = null;

    // Drawing History Stack (Undo / Redo)
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 40;

    this.displayWidth = mainCanvas.width;
    this.displayHeight = mainCanvas.height;

    this.initEvents();
    this.render();
  }

  get size() {
    return this.petModel.size;
  }

  get pixelSize() {
    return this.displayWidth / this.size;
  }

  toggleTransparentLayer(enabled = null) {
    if (enabled !== null) {
      this.isTransparentLayer = !!enabled;
    } else {
      this.isTransparentLayer = !this.isTransparentLayer;
    }
    this.mainCanvas.style.opacity = this.isTransparentLayer ? '0.45' : '1';
    return this.isTransparentLayer;
  }

  setGridOnTop(onTop) {
    this.gridOnTop = !!onTop;
    try { localStorage.setItem('coop_pet_grid_ontop', this.gridOnTop); } catch (_) {}
    if (this.gridCanvas) {
      this.gridCanvas.style.zIndex = this.gridOnTop ? '4' : '2.5';
    }
    this.renderGrid();
    return this.gridOnTop;
  }

  setClipAndFrame(clipName, frameIndex) {
    this.currentClip = clipName;
    const clip = this.petModel.getClip(clipName);
    this.currentFrameIndex = Math.max(0, Math.min(frameIndex, clip.length - 1));
    this.clearRemoteCursor();
    this.render();
    if (this.selection) {
      if (!this.selection.isFloating) {
        if (this.selection.sourceClip !== this.currentClip || this.selection.sourceFrame !== this.currentFrameIndex) {
          this.selection.isFloating = true;
        }
      }
      this.renderSelection();
    }
  }

  render() {
    this.renderMain();
    this.renderOnionSkin();
    this.renderGrid();
    this.renderSelection();
  }

  renderMain() {
    const frame = this.petModel.getFrame(this.currentClip, this.currentFrameIndex);
    this.mainCtx.clearRect(0, 0, this.displayWidth, this.displayHeight);
    if (!frame) return;

    const pSize = this.pixelSize;
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const color = frame[y * this.size + x];
        if (color) {
          this.mainCtx.fillStyle = color;
          this.mainCtx.fillRect(x * pSize, y * pSize, pSize, pSize);
        }
      }
    }
  }

  renderOnionSkin() {
    const clip = this.petModel.getClip(this.currentClip);
    const prevFrame = this.currentFrameIndex > 0 ? clip[this.currentFrameIndex - 1] : null;
    const nextFrame = this.currentFrameIndex < clip.length - 1 ? clip[this.currentFrameIndex + 1] : null;

    this.onionSkinEngine.renderOnionSkins(
      this.prevOnionCtx,
      this.nextOnionCtx,
      prevFrame,
      nextFrame,
      this.displayWidth,
      this.displayHeight
    );
  }

  renderGrid() {
    this.gridCtx.clearRect(0, 0, this.displayWidth, this.displayHeight);
    if (!this.showGrid) return;

    const pSize = this.pixelSize;
    this.gridCtx.strokeStyle = this.gridOnTop ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.08)';
    this.gridCtx.lineWidth = 1;

    for (let i = 0; i <= this.size; i++) {
      const pos = Math.floor(i * pSize) + 0.5;
      // Vertical
      this.gridCtx.beginPath();
      this.gridCtx.moveTo(pos, 0);
      this.gridCtx.lineTo(pos, this.displayHeight);
      this.gridCtx.stroke();
      // Horizontal
      this.gridCtx.beginPath();
      this.gridCtx.moveTo(0, pos);
      this.gridCtx.lineTo(this.displayWidth, pos);
      this.gridCtx.stroke();
    }
  }

  getGridCoords(e) {
    const rect = this.mainCanvas.getBoundingClientRect();
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;

    if (clientX === undefined || clientY === undefined) return null;

    const scaleX = this.displayWidth / rect.width;
    const scaleY = this.displayHeight / rect.height;

    const canvasX = (clientX - rect.left) * scaleX;
    const canvasY = (clientY - rect.top) * scaleY;

    const gx = Math.floor(canvasX / this.pixelSize);
    const gy = Math.floor(canvasY / this.pixelSize);

    if (gx < 0 || gx >= this.size || gy < 0 || gy >= this.size) return null;
    return { x: gx, y: gy };
  }

  initEvents() {
    const handleStart = (e) => {
      e.preventDefault();
      const coords = this.getGridCoords(e);
      if (!coords) return;

      if (this.toolManager.currentTool === 'select') {
        this.handleSelectionStart(coords);
        return;
      }

      // If user had an active selection and switched tools or drew, commit it
      if (this.selection) {
        this.commitSelection();
      }

      if (this.toolManager.currentTool !== 'eyedropper') {
        this.saveHistoryState();
      }

      this.isDrawing = true;
      this.currentStrokeBatch = [];
      this.applyTool(coords.x, coords.y);
    };

    const handleMove = (e) => {
      const coords = this.getGridCoords(e);
      if (!coords) return;

      // Broadcast cursor hover position for live partner presence (with clip and frameIndex)
      this.onCursorMove(coords.x, coords.y, this.toolManager.currentTool, this.currentClip, this.currentFrameIndex);

      if (this.toolManager.currentTool === 'select') {
        this.handleSelectionMove(coords);
        return;
      }

      if (this.isDrawing) {
        if (!this.lastDrawnCoord || this.lastDrawnCoord.x !== coords.x || this.lastDrawnCoord.y !== coords.y) {
          this.applyTool(coords.x, coords.y);
        }
      }
    };

    const handleEnd = () => {
      if (this.toolManager.currentTool === 'select') {
        this.handleSelectionEnd();
        return;
      }

      if (this.isDrawing) {
        this.isDrawing = false;
        this.lastDrawnCoord = null;
        if (this.currentStrokeBatch.length > 0) {
          this.onStrokeDrawn({
            clip: this.currentClip,
            frameIndex: this.currentFrameIndex,
            pixels: this.currentStrokeBatch
          });
          this.currentStrokeBatch = [];
        }
      }
    };

    this.mainCanvas.addEventListener('mousedown', handleStart);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);

    // Mouse leave: clear remote cursor broadcast
    this.mainCanvas.addEventListener('mouseleave', () => {
      this.onCursorMove(null, null, null, this.currentClip, this.currentFrameIndex);
    });

    // Touch events for tablet / touchscreens
    this.mainCanvas.addEventListener('touchstart', handleStart, { passive: false });
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
  }

  isCoordInsideSelection(x, y) {
    if (!this.selection) return false;
    return (
      x >= this.selection.x &&
      x < this.selection.x + this.selection.w &&
      y >= this.selection.y &&
      y < this.selection.y + this.selection.h
    );
  }

  handleSelectionStart(coords) {
    // 1. If clicking inside existing selection, start dragging it
    if (this.selection && this.isCoordInsideSelection(coords.x, coords.y)) {
      this.isDraggingSelection = true;
      this.selectionDragStart = {
        mouseX: coords.x,
        mouseY: coords.y,
        origSelX: this.selection.x,
        origSelY: this.selection.y
      };
      if (!this.selection.isFloating) {
        this.liftSelectionPixels();
      }
      return;
    }

    // 2. If clicking outside existing selection, commit it in place
    if (this.selection) {
      this.commitSelection();
    }

    // 3. Start defining a new selection box
    this.isSelecting = true;
    this.selectionStartCoord = { x: coords.x, y: coords.y };
    this.selectionBox = { x: coords.x, y: coords.y, w: 1, h: 1 };
    this.renderSelection();
  }

  handleSelectionMove(coords) {
    if (this.isDraggingSelection && this.selection && this.selectionDragStart) {
      const dx = coords.x - this.selectionDragStart.mouseX;
      const dy = coords.y - this.selectionDragStart.mouseY;
      this.selection.x = this.selectionDragStart.origSelX + dx;
      this.selection.y = this.selectionDragStart.origSelY + dy;
      this.renderSelection();
      return;
    }

    if (this.isSelecting && this.selectionStartCoord) {
      const minX = Math.min(this.selectionStartCoord.x, coords.x);
      const maxX = Math.max(this.selectionStartCoord.x, coords.x);
      const minY = Math.min(this.selectionStartCoord.y, coords.y);
      const maxY = Math.max(this.selectionStartCoord.y, coords.y);
      this.selectionBox = {
        x: minX,
        y: minY,
        w: maxX - minX + 1,
        h: maxY - minY + 1
      };
      this.renderSelection();
    }
  }

  handleSelectionEnd() {
    if (this.isDraggingSelection) {
      this.isDraggingSelection = false;
      this.selectionDragStart = null;
      this.renderSelection();
      this.updateSelectionUI();
      return;
    }

    if (this.isSelecting) {
      this.isSelecting = false;
      if (this.selectionBox && this.selectionBox.w > 0 && this.selectionBox.h > 0) {
        this.createSelection(this.selectionBox.x, this.selectionBox.y, this.selectionBox.w, this.selectionBox.h);
      }
      this.selectionBox = null;
    }
  }

  createSelection(x, y, w, h) {
    const frame = this.petModel.getFrame(this.currentClip, this.currentFrameIndex);
    if (!frame) return;

    const pixels = [];
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        if (px >= 0 && px < this.size && py >= 0 && py < this.size) {
          pixels.push(frame[py * this.size + px]);
        } else {
          pixels.push(null);
        }
      }
    }

    this.selection = {
      x,
      y,
      w,
      h,
      pixels,
      isFloating: false,
      sourceClip: this.currentClip,
      sourceFrame: this.currentFrameIndex
    };

    this.startMarchingAnts();
    this.renderSelection();
    this.updateSelectionUI();
  }

  liftSelectionPixels() {
    if (!this.selection || this.selection.isFloating) return;

    if (this.selection.sourceClip === this.currentClip && this.selection.sourceFrame === this.currentFrameIndex) {
      this.saveHistoryState();
      const frame = this.petModel.getFrame(this.currentClip, this.currentFrameIndex);
      if (frame) {
        const { x, y, w, h } = this.selection;
        for (let py = y; py < y + h; py++) {
          for (let px = x; px < x + w; px++) {
            if (px >= 0 && px < this.size && py >= 0 && py < this.size) {
              frame[py * this.size + px] = null;
            }
          }
        }
        this.renderMain();
        this.petModel.saveToStorage();
      }
    }
    this.selection.isFloating = true;
    this.renderSelection();
  }

  commitSelection() {
    if (!this.selection) return;

    if (this.selection.isFloating && this.selection.pixels) {
      this.saveHistoryState();
      const frame = this.petModel.getFrame(this.currentClip, this.currentFrameIndex);
      if (frame) {
        const { x, y, w, h, pixels } = this.selection;
        const modified = [];
        for (let row = 0; row < h; row++) {
          for (let col = 0; col < w; col++) {
            const color = pixels[row * w + col];
            const targetX = x + col;
            const targetY = y + row;
            if (color !== null && targetX >= 0 && targetX < this.size && targetY >= 0 && targetY < this.size) {
              frame[targetY * this.size + targetX] = color;
              modified.push({ x: targetX, y: targetY, color });
            }
          }
        }
        this.renderMain();
        this.petModel.saveToStorage();
        if (modified.length > 0) {
          this.onStrokeDrawn({
            clip: this.currentClip,
            frameIndex: this.currentFrameIndex,
            pixels: modified
          });
        }
      }
    }

    this.selection = null;
    this.selectionBox = null;
    this.stopMarchingAnts();
    this.clearSelectionOverlay();
    this.updateSelectionUI();
  }

  deleteSelection() {
    if (!this.selection) return;
    if (!this.selection.isFloating) {
      this.liftSelectionPixels();
    }
    this.selection = null;
    this.selectionBox = null;
    this.stopMarchingAnts();
    this.clearSelectionOverlay();
    this.updateSelectionUI();
  }

  copySelection() {
    if (!this.selection) return;
    this.selectionClipboard = {
      w: this.selection.w,
      h: this.selection.h,
      pixels: [...this.selection.pixels]
    };
  }

  pasteSelection() {
    if (!this.selectionClipboard) return;
    this.commitSelection();
    const { w, h, pixels } = this.selectionClipboard;
    const centerX = Math.floor((this.size - w) / 2);
    const centerY = Math.floor((this.size - h) / 2);

    this.selection = {
      x: centerX,
      y: centerY,
      w,
      h,
      pixels: [...pixels],
      isFloating: true,
      sourceClip: this.currentClip,
      sourceFrame: this.currentFrameIndex
    };

    this.startMarchingAnts();
    this.renderSelection();
    this.updateSelectionUI();
  }

  flipSelectionH() {
    if (!this.selection) return;
    this.liftSelectionPixels();
    const { w, h, pixels } = this.selection;
    const newPixels = new Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        newPixels[y * w + (w - 1 - x)] = pixels[y * w + x];
      }
    }
    this.selection.pixels = newPixels;
    this.renderSelection();
  }

  flipSelectionV() {
    if (!this.selection) return;
    this.liftSelectionPixels();
    const { w, h, pixels } = this.selection;
    const newPixels = new Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        newPixels[(h - 1 - y) * w + x] = pixels[y * w + x];
      }
    }
    this.selection.pixels = newPixels;
    this.renderSelection();
  }

  rotateSelection90CW() {
    if (!this.selection) return;
    this.liftSelectionPixels();
    const { w, h, pixels } = this.selection;
    const newW = h;
    const newH = w;
    const newPixels = new Array(newW * newH);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const newX = h - 1 - y;
        const newY = x;
        newPixels[newY * newW + newX] = pixels[y * w + x];
      }
    }
    this.selection.w = newW;
    this.selection.h = newH;
    this.selection.pixels = newPixels;
    this.renderSelection();
  }

  rotateSelection90CCW() {
    if (!this.selection) return;
    this.liftSelectionPixels();
    const { w, h, pixels } = this.selection;
    const newW = h;
    const newH = w;
    const newPixels = new Array(newW * newH);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const newX = y;
        const newY = w - 1 - x;
        newPixels[newY * newW + newX] = pixels[y * w + x];
      }
    }
    this.selection.w = newW;
    this.selection.h = newH;
    this.selection.pixels = newPixels;
    this.renderSelection();
  }

  flipHorizontal() {
    if (this.selection) {
      this.flipSelectionH();
    } else {
      this.saveHistoryState();
      this.petModel.flipFrameH(this.currentClip, this.currentFrameIndex);
      this.render();
      this.syncFullFrameStrokes();
    }
  }

  flipVertical() {
    if (this.selection) {
      this.flipSelectionV();
    } else {
      this.saveHistoryState();
      this.petModel.flipFrameV(this.currentClip, this.currentFrameIndex);
      this.render();
      this.syncFullFrameStrokes();
    }
  }

  rotate90CW() {
    if (this.selection) {
      this.rotateSelection90CW();
    } else {
      this.saveHistoryState();
      this.petModel.rotateFrame90CW(this.currentClip, this.currentFrameIndex);
      this.render();
      this.syncFullFrameStrokes();
    }
  }

  rotate90CCW() {
    if (this.selection) {
      this.rotateSelection90CCW();
    } else {
      this.saveHistoryState();
      this.petModel.rotateFrame90CCW(this.currentClip, this.currentFrameIndex);
      this.render();
      this.syncFullFrameStrokes();
    }
  }

  syncFullFrameStrokes() {
    const frame = this.petModel.getFrame(this.currentClip, this.currentFrameIndex);
    if (!frame) return;
    this.onStrokeDrawn({
      clip: this.currentClip,
      frameIndex: this.currentFrameIndex,
      pixels: frame.map((color, idx) => ({
        x: idx % this.size,
        y: Math.floor(idx / this.size),
        color
      }))
    });
  }

  startMarchingAnts() {
    this.stopMarchingAnts();
    this.antsTimer = setInterval(() => {
      this.dashOffset = (this.dashOffset + 1) % 10;
      this.renderSelection();
    }, 80);
  }

  stopMarchingAnts() {
    if (this.antsTimer) {
      clearInterval(this.antsTimer);
      this.antsTimer = null;
    }
  }

  clearSelectionOverlay() {
    if (this.selectionCtx) {
      this.selectionCtx.clearRect(0, 0, this.displayWidth, this.displayHeight);
    }
  }

  updateSelectionUI() {
    const toolbar = document.getElementById('selectionToolbar');
    if (toolbar) {
      toolbar.classList.toggle('hidden', !this.selection);
    }
  }

  renderSelection() {
    if (!this.selectionCtx) return;
    this.selectionCtx.clearRect(0, 0, this.displayWidth, this.displayHeight);

    const pSize = this.pixelSize;

    // 1. If actively dragging out a selection box
    if (this.isSelecting && this.selectionBox) {
      const { x, y, w, h } = this.selectionBox;
      const px = x * pSize;
      const py = y * pSize;
      const pw = w * pSize;
      const ph = h * pSize;

      this.selectionCtx.fillStyle = 'rgba(138, 173, 244, 0.2)';
      this.selectionCtx.fillRect(px, py, pw, ph);

      this.selectionCtx.strokeStyle = '#8aadf4';
      this.selectionCtx.lineWidth = 1.5;
      this.selectionCtx.setLineDash([4, 4]);
      this.selectionCtx.lineDashOffset = this.dashOffset;
      this.selectionCtx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
      return;
    }

    // 2. Active selection
    if (this.selection) {
      const { x, y, w, h, pixels, isFloating } = this.selection;
      const px = x * pSize;
      const py = y * pSize;
      const pw = w * pSize;
      const ph = h * pSize;

      // Draw floating pixels if lifted
      if (isFloating && pixels) {
        for (let row = 0; row < h; row++) {
          for (let col = 0; col < w; col++) {
            const color = pixels[row * w + col];
            if (color) {
              this.selectionCtx.fillStyle = color;
              this.selectionCtx.fillRect((x + col) * pSize, (y + row) * pSize, pSize, pSize);
            }
          }
        }
      }

      // Marching ants dashed border & tint
      this.selectionCtx.fillStyle = 'rgba(138, 173, 244, 0.12)';
      this.selectionCtx.fillRect(px, py, pw, ph);

      this.selectionCtx.strokeStyle = '#f5bde6';
      this.selectionCtx.lineWidth = 2;
      this.selectionCtx.setLineDash([5, 5]);
      this.selectionCtx.lineDashOffset = this.dashOffset;
      this.selectionCtx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);

      // Corner handles
      this.selectionCtx.setLineDash([]);
      this.selectionCtx.fillStyle = '#ffffff';
      const d = 4;
      this.selectionCtx.fillRect(px - d / 2, py - d / 2, d, d);
      this.selectionCtx.fillRect(px + pw - d / 2, py - d / 2, d, d);
      this.selectionCtx.fillRect(px - d / 2, py + ph - d / 2, d, d);
      this.selectionCtx.fillRect(px + pw - d / 2, py + ph - d / 2, d, d);
    }
  }

  applyTool(x, y) {
    const tool = this.toolManager.currentTool;
    const frame = this.petModel.getFrame(this.currentClip, this.currentFrameIndex);
    if (!frame) return;

    this.lastDrawnCoord = { x, y };

    if (tool === 'eyedropper') {
      const sampled = frame[y * this.size + x];
      if (sampled) {
        this.toolManager.setColor(sampled);
        document.dispatchEvent(new CustomEvent('color-picked', { detail: sampled }));
      }
      return;
    }

    if (tool === 'bucket') {
      const fillColor = this.toolManager.currentColor;
      const modified = this.toolManager.floodFill(frame, x, y, fillColor, this.size);
      if (modified.length > 0) {
        this.renderMain();
        this.petModel.saveToStorage();
        this.onStrokeDrawn({
          clip: this.currentClip,
          frameIndex: this.currentFrameIndex,
          pixels: modified
        });
      }
      return;
    }

    const drawColor = tool === 'eraser' ? null : this.toolManager.currentColor;
    const pixelsToDraw = [{ x, y, color: drawColor }];

    // Symmetry mode: also draw horizontally mirrored pixel
    if (this.toolManager.symmetry) {
      const symX = this.size - 1 - x;
      if (symX !== x) {
        pixelsToDraw.push({ x: symX, y, color: drawColor });
      }
    }

    for (const p of pixelsToDraw) {
      frame[p.y * this.size + p.x] = p.color;
      this.currentStrokeBatch.push(p);
    }

    this.renderMain();
    this.petModel.saveToStorage();
  }

  /**
   * Apply incoming remote drawing strokes from partner via P2P
   */
  applyRemoteStroke({ clip, frameIndex, pixels }) {
    const targetFrame = this.petModel.getFrame(clip, frameIndex);
    if (!targetFrame) return;

    for (const p of pixels) {
      targetFrame[p.y * this.size + p.x] = p.color;
    }

    // If currently viewing this clip and frame, re-render immediately
    if (this.currentClip === clip && this.currentFrameIndex === frameIndex) {
      this.renderMain();
    }
  }

  /**
   * Render partner's remote hover cursor and pen indicator
   */
  renderRemoteCursor(x, y, tool, partnerName = 'Partner') {
    this.cursorCtx.clearRect(0, 0, this.displayWidth, this.displayHeight);
    if (x === null || y === null) return;

    const pSize = this.pixelSize;
    const px = x * pSize;
    const py = y * pSize;

    // Highlight pixel target
    this.cursorCtx.strokeStyle = '#f5a97f';
    this.cursorCtx.lineWidth = 2;
    this.cursorCtx.strokeRect(px, py, pSize, pSize);

    // Cute name tag above pixel
    this.cursorCtx.fillStyle = '#f5a97f';
    this.cursorCtx.font = '10px sans-serif';
    this.cursorCtx.fillText(`✎ ${partnerName}`, px + pSize + 4, py + 12);
  }

  clearRemoteCursor() {
    this.cursorCtx.clearRect(0, 0, this.displayWidth, this.displayHeight);
  }

  /**
   * Save a snapshot of the current active frame to the undo history stack
   */
  saveHistoryState() {
    const frame = this.petModel.getFrame(this.currentClip, this.currentFrameIndex);
    if (!frame) return;

    this.undoStack.push({
      clip: this.currentClip,
      frameIndex: this.currentFrameIndex,
      data: [...frame]
    });

    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    // New action invalidates redo stack
    this.redoStack = [];
  }

  /**
   * Undo last drawing action
   */
  undo() {
    if (this.undoStack.length === 0) return false;
    const currentFrame = this.petModel.getFrame(this.currentClip, this.currentFrameIndex);
    if (!currentFrame) return false;

    const prevState = this.undoStack.pop();

    // Push current frame snapshot to redo stack
    this.redoStack.push({
      clip: this.currentClip,
      frameIndex: this.currentFrameIndex,
      data: [...currentFrame]
    });
    if (this.redoStack.length > this.maxHistory) {
      this.redoStack.shift();
    }

    const targetFrame = this.petModel.getFrame(prevState.clip, prevState.frameIndex);
    if (targetFrame) {
      for (let i = 0; i < prevState.data.length; i++) {
        targetFrame[i] = prevState.data[i];
      }
      this.petModel.saveToStorage();

      if (this.currentClip !== prevState.clip || this.currentFrameIndex !== prevState.frameIndex) {
        this.setClipAndFrame(prevState.clip, prevState.frameIndex);
      } else {
        this.render();
      }

      this.onStrokeDrawn({
        clip: prevState.clip,
        frameIndex: prevState.frameIndex,
        pixels: targetFrame.map((color, idx) => ({
          x: idx % this.size,
          y: Math.floor(idx / this.size),
          color
        }))
      });
      return true;
    }
    return false;
  }

  /**
   * Redo reverted drawing action
   */
  redo() {
    if (this.redoStack.length === 0) return false;
    const currentFrame = this.petModel.getFrame(this.currentClip, this.currentFrameIndex);
    if (!currentFrame) return false;

    const nextState = this.redoStack.pop();

    this.undoStack.push({
      clip: this.currentClip,
      frameIndex: this.currentFrameIndex,
      data: [...currentFrame]
    });
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }

    const targetFrame = this.petModel.getFrame(nextState.clip, nextState.frameIndex);
    if (targetFrame) {
      for (let i = 0; i < nextState.data.length; i++) {
        targetFrame[i] = nextState.data[i];
      }
      this.petModel.saveToStorage();

      if (this.currentClip !== nextState.clip || this.currentFrameIndex !== nextState.frameIndex) {
        this.setClipAndFrame(nextState.clip, nextState.frameIndex);
      } else {
        this.render();
      }

      this.onStrokeDrawn({
        clip: nextState.clip,
        frameIndex: nextState.frameIndex,
        pixels: targetFrame.map((color, idx) => ({
          x: idx % this.size,
          y: Math.floor(idx / this.size),
          color
        }))
      });
      return true;
    }
    return false;
  }

  /**
   * Clear current frame with undo history support
   */
  clearCurrentFrame() {
    const frame = this.petModel.getFrame(this.currentClip, this.currentFrameIndex);
    if (!frame) return;

    this.saveHistoryState();
    frame.fill(null);
    this.petModel.saveToStorage();
    this.renderMain();

    this.onStrokeDrawn({
      clip: this.currentClip,
      frameIndex: this.currentFrameIndex,
      pixels: frame.map((_, i) => ({
        x: i % this.size,
        y: Math.floor(i / this.size),
        color: null
      }))
    });
  }
}
