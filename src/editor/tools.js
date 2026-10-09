// Pixel Art Tools & Curated Color Palettes

export const PALETTES = {
  advanced: [
    // Row 1: Monochrome & Slate
    '#181926', '#363a4f', '#6e738d', '#a5adcb', '#cad3f5', '#ffffff',
    // Row 2: Crimson / Ruby
    '#b91c1c', '#dc2626', '#ef4444', '#f87171', '#fca5a5', '#fee2e2',
    // Row 3: Bright Red
    '#e11d48', '#f43f5e', '#fb7185', '#fda4af', '#fecdd3', '#fff1f2',
    // Row 4: Orange-Red / Coral
    '#c2410c', '#ea580c', '#f97316', '#fb923c', '#fdba74', '#ffedd5',
    // Row 5: Warm Orange / Amber
    '#d97706', '#f59e0b', '#fbbf24', '#fcd34d', '#fde68a', '#fef3c7',
    // Row 6: Golden Yellow
    '#ca8a04', '#eab308', '#facc15', '#fde047', '#fef08a', '#fef9c3',
    // Row 7: Chartreuse / Yellow-Green
    '#84cc16', '#a3e635', '#bef264', '#d9f99d', '#ecfccb', '#f7fee7',
    // Row 8: Bright Lime
    '#4d7c0f', '#65a30d', '#84cc16', '#bef264', '#d9f99d', '#ecfccb',
    // Row 9: Lush Green
    '#15803d', '#16a34a', '#22c55e', '#4ade80', '#86efac', '#dcfce7',
    // Row 10: Mint / Emerald
    '#047857', '#059669', '#10b981', '#34d399', '#6ee7b7', '#d1fae5',
    // Row 11: Vibrant Teal
    '#0f766e', '#0d9488', '#14b8a6', '#2dd4bf', '#5eead4', '#ccfbf1',
    // Row 12: Electric Cyan / Aqua
    '#0e7490', '#0891b2', '#06b6d4', '#22d3ee', '#67e8f9', '#cffafe',
    // Row 13: Vivid Sky Blue
    '#0369a1', '#0284c7', '#0ea5e9', '#38bdf8', '#7dd3fc', '#e0f2fe',
    // Row 14: Deep Ocean Blue
    '#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#dbeafe',
    // Row 15: Royal Indigo
    '#4338ca', '#4f46e5', '#6366f1', '#818cf8', '#a5b4fc', '#e0e7ff',
    // Row 16: Deep Violet
    '#6d28d9', '#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ede9fe',
    // Row 17: Purple / Orchid
    '#a21caf', '#c026d3', '#d946ef', '#e879f9', '#f0abfc', '#fae8ff',
    // Row 18: Hot Pink / Magenta
    '#be185d', '#db2777', '#ec4899', '#f472b6', '#f9a8d4', '#fce7f3',
    // Row 19: Deep Rose
    '#9f1239', '#be123c', '#e11d48', '#f43f5e', '#fb7185', '#ffe4e6',
    // Row 20: Warm Umber / Coffee
    '#451a03', '#78350f', '#92400e', '#b45309', '#d97706', '#fed7aa',
    // Row 21: Terracotta / Sand
    '#573a27', '#785135', '#9c6c49', '#be8d69', '#dcba9e', '#f5ebe0'
  ],
  vibrant32: [
    '#000000', '#1a1c23', '#43475b', '#7c819a', '#c2c6dc', '#ffffff',
    '#be123c', '#e11d48', '#fb7185', '#f43f5e', '#ea580c', '#f97316',
    '#f59e0b', '#fbbf24', '#fde047', '#84cc16', '#22c55e', '#10b981',
    '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6',
    '#a855f7', '#d946ef', '#ec4899', '#f472b6', '#78350f', '#92400e',
    '#b45309', '#fcd34d'
  ],
  cozyPet: [
    '#2d2538', '#493e52', '#72627a', '#a690af', '#ffffff', '#ffd1dc',
    '#f5c35b', '#fae084', '#d19736', '#f78fb3', '#e74c3c', '#6ab04c',
    '#7aa2f7', '#a9b1d6', '#70a1ff', '#eccc68', '#ff7f50', '#8b5a2b'
  ],
  pico8: [
    '#000000', '#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8',
    '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#83769c', '#ff77a8', '#ffccaa'
  ],
  pastel: [
    '#2d3436', '#ffffff', '#ffb8b8', '#ffdac1', '#e2f0cb', '#b5ead7',
    '#c7ceea', '#e8dff5', '#fce1e4', '#daeaf6', '#f3c4fb', '#fcd5ce',
    '#d8e2dc', '#ffe5d9', '#ffcad4', '#b7e4c7'
  ],
  retro: [
    '#000000', '#ffffff', '#e63946', '#f1faee', '#a8dadc', '#457b9d', '#1d3557', '#e9c46a',
    '#2a9d8f', '#f4a261', '#264653', '#d62828', '#003049', '#f77f00', '#fcbf49', '#eae2b7'
  ]
};

export class ToolManager {
  constructor() {
    this.currentTool = 'pen'; // 'pen', 'eraser', 'bucket', 'eyedropper', 'select'
    this.currentColor = '#000000';
    this.symmetry = false; // Horizontal mirror mode
    this.currentPalette = 'retro';
  }

  setTool(tool) {
    this.currentTool = tool;
  }

  setColor(color) {
    this.currentColor = color;
  }

  toggleSymmetry() {
    this.symmetry = !this.symmetry;
    return this.symmetry;
  }

  /**
   * Flood fill algorithm for bucket tool
   * @param {Array} frame 1D array of colors
   * @param {number} startX 
   * @param {number} startY 
   * @param {string} fillColor 
   * @param {number} size 
   * @returns {Array<{x: number, y: number, color: string}>} Array of modified pixels
   */
  floodFill(frame, startX, startY, fillColor, size = 24) {
    const targetColor = frame[startY * size + startX];
    if (targetColor === fillColor) return [];

    const modified = [];
    const queue = [[startX, startY]];
    const visited = new Set();
    const getKey = (x, y) => `${x},${y}`;

    while (queue.length > 0) {
      const [x, y] = queue.pop();
      const key = getKey(x, y);

      if (visited.has(key)) continue;
      if (x < 0 || x >= size || y < 0 || y >= size) continue;

      const currentColor = frame[y * size + x];
      if (currentColor !== targetColor) continue;

      visited.add(key);
      frame[y * size + x] = fillColor;
      modified.push({ x, y, color: fillColor });

      // Check 4 neighbors
      queue.push([x + 1, y]);
      queue.push([x - 1, y]);
      queue.push([x, y + 1]);
      queue.push([x, y - 1]);
    }

    return modified;
  }
}
