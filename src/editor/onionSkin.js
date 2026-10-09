// Pixel Animation Onion Skinning Engine

export class OnionSkinEngine {
  constructor(size = 24) {
    this.size = size;
    this.enabled = true;
    this.mode = 'tint'; // 'tint' (Retro Red/Blue) or 'natural' (semi-transparent colors)
    this.opacity = 0.45;
  }

  /**
   * Render ghost frames onto prev and next onion canvas contexts
   * @param {CanvasRenderingContext2D} prevCtx 
   * @param {CanvasRenderingContext2D} nextCtx 
   * @param {Array} prevFrameData 1D array of pixel colors
   * @param {Array} nextFrameData 1D array of pixel colors
   * @param {number} displayWidth 
   * @param {number} displayHeight 
   */
  renderOnionSkins(prevCtx, nextCtx, prevFrameData, nextFrameData, displayWidth, displayHeight) {
    // Clear both onion canvases
    prevCtx.clearRect(0, 0, displayWidth, displayHeight);
    nextCtx.clearRect(0, 0, displayWidth, displayHeight);

    if (!this.enabled) return;

    const pixelW = displayWidth / this.size;
    const pixelH = displayHeight / this.size;

    // Render Previous Frame (Flipnote Red Tint or Natural)
    if (prevFrameData) {
      prevCtx.save();
      prevCtx.globalAlpha = this.opacity;
      for (let y = 0; y < this.size; y++) {
        for (let x = 0; x < this.size; x++) {
          const color = prevFrameData[y * this.size + x];
          if (color) {
            if (this.mode === 'tint') {
              // Classic Flipnote / Animation red tint for previous frame
              prevCtx.fillStyle = '#ff4d6d';
            } else {
              prevCtx.fillStyle = color;
            }
            prevCtx.fillRect(x * pixelW, y * pixelH, pixelW, pixelH);
          }
        }
      }
      prevCtx.restore();
    }

    // Render Next Frame (Blue/Cyan Tint or Natural)
    if (nextFrameData) {
      nextCtx.save();
      nextCtx.globalAlpha = this.opacity * 0.8;
      for (let y = 0; y < this.size; y++) {
        for (let x = 0; x < this.size; x++) {
          const color = nextFrameData[y * this.size + x];
          if (color) {
            if (this.mode === 'tint') {
              // Classic Flipnote blue/cyan tint for next frame
              nextCtx.fillStyle = '#4cc9f0';
            } else {
              nextCtx.fillStyle = color;
            }
            nextCtx.fillRect(x * pixelW, y * pixelH, pixelW, pixelH);
          }
        }
      }
      nextCtx.restore();
    }
  }
}
