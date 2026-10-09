// Pet Sprite Renderer

export class PetRenderer {
  constructor(petModel) {
    this.petModel = petModel;
  }

  /**
   * Render a specific frame of a clip onto a target canvas
   * @param {HTMLCanvasElement} canvas 
   * @param {string} clipName 
   * @param {number} frameIndex 
   * @param {boolean} flipHorizontal 
   */
  renderFrame(canvas, clipName, frameIndex, flipHorizontal = false) {
    const ctx = canvas.getContext('2d');
    const size = this.petModel.size;
    const frame = this.petModel.getFrame(clipName, frameIndex);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!frame) return;

    const pixelW = canvas.width / size;
    const pixelH = canvas.height / size;

    ctx.save();
    if (flipHorizontal) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const color = frame[y * size + x];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(x * pixelW, y * pixelH, pixelW, pixelH);
        }
      }
    }

    ctx.restore();
  }
}
