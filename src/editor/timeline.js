// Pixel Pet Studio Frame Timeline & Playback Controller

export class TimelineController {
  constructor({
    container,
    petModel,
    onFrameSelect,
    onFrameAdd,
    onFrameDuplicate,
    onFrameDelete,
    onFrameReorder,
    onFpsChange
  }) {
    this.container = container;
    this.petModel = petModel;
    this.onFrameSelect = onFrameSelect || (() => {});
    this.onFrameAdd = onFrameAdd || (() => {});
    this.onFrameDuplicate = onFrameDuplicate || (() => {});
    this.onFrameDelete = onFrameDelete || (() => {});
    this.onFrameReorder = onFrameReorder || (() => {});
    this.onFpsChange = onFpsChange || (() => {});

    this.currentClip = 'idle';
    this.currentFrameIndex = 0;
    this.isPlaying = false;
    this.playbackInterval = null;
    this.draggedFrameIndex = null;

    this.render();
  }

  setClip(clipName) {
    this.currentClip = clipName;
    this.currentFrameIndex = 0;
    this.render();
    this.onFrameSelect(this.currentClip, this.currentFrameIndex);
  }

  setFrameIndex(index) {
    const clip = this.petModel.getClip(this.currentClip);
    this.currentFrameIndex = Math.max(0, Math.min(index, clip.length - 1));
    this.highlightActiveCard();
  }

  render() {
    this.container.innerHTML = '';
    const clip = this.petModel.getClip(this.currentClip);

    clip.forEach((frameData, idx) => {
      const card = document.createElement('div');
      card.className = `frame-card ${idx === this.currentFrameIndex ? 'active' : ''}`;
      card.dataset.index = idx;
      card.draggable = true;
      card.setAttribute('title', `Frame ${idx + 1} (Drag to reorder)`);

      // Miniature canvas thumbnail
      const canvas = document.createElement('canvas');
      canvas.className = 'frame-thumb';
      canvas.width = this.petModel.size;
      canvas.height = this.petModel.size;
      this.drawThumb(canvas, frameData);

      const numLabel = document.createElement('span');
      numLabel.className = 'frame-number';
      numLabel.textContent = `${idx + 1}`;

      card.appendChild(canvas);
      card.appendChild(numLabel);

      // Click to select
      card.addEventListener('click', () => {
        this.currentFrameIndex = idx;
        this.highlightActiveCard();
        this.onFrameSelect(this.currentClip, idx);
      });

      // Drag and Drop frame reordering
      card.addEventListener('dragstart', (e) => {
        this.draggedFrameIndex = idx;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(idx));
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        this.container.querySelectorAll('.frame-card').forEach(c => {
          c.classList.remove('drag-over');
        });
        this.draggedFrameIndex = null;
      });

      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (this.draggedFrameIndex !== null && this.draggedFrameIndex !== idx) {
          card.classList.add('drag-over');
        }
      });

      card.addEventListener('dragleave', () => {
        card.classList.remove('drag-over');
      });

      card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('drag-over');
        const fromIndex = this.draggedFrameIndex !== null ? this.draggedFrameIndex : parseInt(e.dataTransfer.getData('text/plain'), 10);
        const toIndex = idx;

        if (!isNaN(fromIndex) && fromIndex !== toIndex) {
          this.petModel.reorderFrame(this.currentClip, fromIndex, toIndex);
          this.currentFrameIndex = toIndex;
          this.render();
          this.onFrameSelect(this.currentClip, toIndex);
          this.onFrameReorder(this.currentClip, fromIndex, toIndex);
        }
      });

      this.container.appendChild(card);
    });

    // Add new frame button at end of strip
    const addBtn = document.createElement('div');
    addBtn.className = 'add-frame-btn';
    addBtn.innerHTML = `<span>+</span><span style="font-size:9px">New</span>`;
    addBtn.title = 'Add new blank frame';
    addBtn.addEventListener('click', () => {
      const newIndex = this.petModel.addFrame(this.currentClip);
      this.currentFrameIndex = newIndex;
      this.render();
      this.onFrameAdd(this.currentClip, newIndex);
      this.onFrameSelect(this.currentClip, newIndex);
    });
    this.container.appendChild(addBtn);
  }

  drawThumb(canvas, frameData) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const size = this.petModel.size;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const color = frameData[y * size + x];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }

  updateCurrentThumb() {
    const card = this.container.children[this.currentFrameIndex];
    if (card) {
      const canvas = card.querySelector('canvas');
      const frameData = this.petModel.getFrame(this.currentClip, this.currentFrameIndex);
      if (canvas && frameData) {
        this.drawThumb(canvas, frameData);
      }
    }
  }

  highlightActiveCard() {
    const cards = this.container.querySelectorAll('.frame-card');
    cards.forEach((c, idx) => {
      if (idx === this.currentFrameIndex) {
        c.classList.add('active');
        c.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      } else {
        c.classList.remove('active');
      }
    });
  }

  duplicateCurrent() {
    const newIdx = this.petModel.duplicateFrame(this.currentClip, this.currentFrameIndex);
    this.currentFrameIndex = newIdx;
    this.render();
    this.onFrameDuplicate(this.currentClip, this.currentFrameIndex);
    this.onFrameSelect(this.currentClip, this.currentFrameIndex);
  }

  deleteCurrent() {
    const clip = this.petModel.getClip(this.currentClip);
    if (clip.length <= 1) {
      alert('An animation clip must have at least one frame!');
      return;
    }
    const nextIdx = this.petModel.deleteFrame(this.currentClip, this.currentFrameIndex);
    this.currentFrameIndex = nextIdx;
    this.render();
    this.onFrameDelete(this.currentClip, this.currentFrameIndex);
    this.onFrameSelect(this.currentClip, this.currentFrameIndex);
  }
}
