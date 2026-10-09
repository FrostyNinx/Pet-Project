// Pet Data Model and Starter Sprite Generator

export const PET_CANVAS_SIZE = 24; // 24x24 standard pixel grid

// Color constants for starter pet
const C_DARK = '#2d2538';
const C_WHITE = '#ffffff';
const C_FUR = '#f5c35b';
const C_FUR_LIGHT = '#fae084';
const C_FUR_DARK = '#d19736';
const C_CHEEK = '#f78fb3';
const C_EYE = '#1e1c24';
const C_BERRY = '#eb4d4b';
const C_BERRY_LEAF = '#6ab04c';

export function createBlankFrame(size = PET_CANVAS_SIZE) {
  return new Array(size * size).fill(null);
}

export function cloneFrame(frame) {
  return [...frame];
}

// Helper to set pixel on a 1D frame array
export function setPixel(frame, x, y, color, size = PET_CANVAS_SIZE) {
  if (x < 0 || x >= size || y < 0 || y >= size) return;
  frame[y * size + x] = color;
}

export function getPixel(frame, x, y, size = PET_CANVAS_SIZE) {
  if (x < 0 || x >= size || y < 0 || y >= size) return null;
  return frame[y * size + x];
}

// Generate a cute starter cat pet sprite for 24x24
function generateStarterCat() {
  const createBase = (earYOffset = 0, bodyYOffset = 0, eyeType = 'normal') => {
    const f = createBlankFrame(PET_CANVAS_SIZE);
    
    // Ears
    const ey = 5 + earYOffset;
    // Left ear
    setPixel(f, 6, ey, C_FUR_DARK);
    setPixel(f, 7, ey, C_FUR);
    setPixel(f, 6, ey + 1, C_FUR);
    setPixel(f, 7, ey + 1, C_CHEEK);
    setPixel(f, 8, ey + 1, C_FUR);
    
    // Right ear
    setPixel(f, 16, ey, C_FUR_DARK);
    setPixel(f, 17, ey, C_FUR);
    setPixel(f, 15, ey + 1, C_FUR);
    setPixel(f, 16, ey + 1, C_CHEEK);
    setPixel(f, 17, ey + 1, C_FUR);

    // Head (Y: 7 to 14)
    const by = bodyYOffset;
    for (let y = 7 + by; y <= 14 + by; y++) {
      for (let x = 6; x <= 17; x++) {
        // Round corners
        if ((y === 7 + by && (x === 6 || x === 17)) ||
            (y === 14 + by && (x === 6 || x === 17))) {
          continue;
        }
        setPixel(f, x, y, C_FUR);
      }
    }

    // Cheeks & Muzzle
    setPixel(f, 7, 12 + by, C_CHEEK);
    setPixel(f, 16, 12 + by, C_CHEEK);
    setPixel(f, 11, 12 + by, C_FUR_LIGHT);
    setPixel(f, 12, 12 + by, C_FUR_LIGHT);
    setPixel(f, 11, 11 + by, C_CHEEK); // Nose

    // Eyes
    if (eyeType === 'normal') {
      setPixel(f, 9, 10 + by, C_EYE);
      setPixel(f, 9, 11 + by, C_EYE);
      setPixel(f, 14, 10 + by, C_EYE);
      setPixel(f, 14, 11 + by, C_EYE);
      setPixel(f, 9, 10 + by, C_WHITE); // Highlight
      setPixel(f, 14, 10 + by, C_WHITE);
    } else if (eyeType === 'happy') {
      // ^ ^ happy eyes
      setPixel(f, 8, 11 + by, C_EYE);
      setPixel(f, 9, 10 + by, C_EYE);
      setPixel(f, 10, 11 + by, C_EYE);
      setPixel(f, 13, 11 + by, C_EYE);
      setPixel(f, 14, 10 + by, C_EYE);
      setPixel(f, 15, 11 + by, C_EYE);
    } else if (eyeType === 'closed') {
      // - - sleeping eyes
      setPixel(f, 8, 11 + by, C_EYE);
      setPixel(f, 9, 11 + by, C_EYE);
      setPixel(f, 10, 11 + by, C_EYE);
      setPixel(f, 13, 11 + by, C_EYE);
      setPixel(f, 14, 11 + by, C_EYE);
      setPixel(f, 15, 11 + by, C_EYE);
    }

    // Body
    for (let y = 15 + by; y <= 19 + by; y++) {
      for (let x = 7; x <= 16; x++) {
        setPixel(f, x, y, (x >= 10 && x <= 13) ? C_FUR_LIGHT : C_FUR);
      }
    }

    // Paws
    setPixel(f, 7, 20 + by, C_WHITE);
    setPixel(f, 8, 20 + by, C_WHITE);
    setPixel(f, 15, 20 + by, C_WHITE);
    setPixel(f, 16, 20 + by, C_WHITE);

    // Tail
    setPixel(f, 17, 18 + by, C_FUR_DARK);
    setPixel(f, 18, 17 + by, C_FUR_DARK);
    setPixel(f, 19, 16 + by, C_FUR);

    return f;
  };

  // 1. Idle Frames (Breathing animation)
  const idle1 = createBase(0, 0, 'normal');
  const idle2 = createBase(0, 1, 'normal'); // Slight breath down

  // 2. Walk Frames (4 frames stepping)
  const walk1 = createBase(0, 0, 'normal');
  setPixel(walk1, 7, 20, null); setPixel(walk1, 6, 19, C_WHITE); // Left paw forward
  
  const walk2 = createBase(0, 1, 'normal');
  
  const walk3 = createBase(0, 0, 'normal');
  setPixel(walk3, 16, 20, null); setPixel(walk3, 17, 19, C_WHITE); // Right paw forward

  const walk4 = createBase(0, 1, 'normal');

  // 3. Happy Frames (Heart eyes / jumping)
  const happy1 = createBase(-1, -1, 'happy');
  // Add little sparkles
  setPixel(happy1, 3, 5, C_FUR_LIGHT);
  setPixel(happy1, 20, 5, C_FUR_LIGHT);

  const happy2 = createBase(0, 0, 'happy');
  setPixel(happy2, 4, 7, C_CHEEK);
  setPixel(happy2, 19, 7, C_CHEEK);

  // 4. Eat Frames (With a little strawberry treat)
  const eat1 = createBase(0, 0, 'happy');
  // Strawberry in front of paws
  setPixel(eat1, 11, 18, C_BERRY);
  setPixel(eat1, 12, 18, C_BERRY);
  setPixel(eat1, 11, 19, C_BERRY);
  setPixel(eat1, 12, 19, C_BERRY);
  setPixel(eat1, 11, 17, C_BERRY_LEAF);
  setPixel(eat1, 12, 17, C_BERRY_LEAF);

  const eat2 = createBase(0, 1, 'normal');
  setPixel(eat2, 11, 19, C_BERRY); // Bitten
  setPixel(eat2, 12, 19, C_BERRY);

  // 5. Sleep Frames (Curled up with Z's)
  const sleep1 = createBase(1, 2, 'closed');
  setPixel(sleep1, 19, 6, '#7aa2f7');
  setPixel(sleep1, 20, 6, '#7aa2f7');
  setPixel(sleep1, 20, 7, '#7aa2f7');
  setPixel(sleep1, 19, 8, '#7aa2f7');
  setPixel(sleep1, 20, 8, '#7aa2f7'); // Little Z

  const sleep2 = createBase(1, 2, 'closed');
  setPixel(sleep2, 21, 4, '#7aa2f7');
  setPixel(sleep2, 22, 4, '#7aa2f7');
  setPixel(sleep2, 22, 5, '#7aa2f7');
  setPixel(sleep2, 21, 6, '#7aa2f7');
  setPixel(sleep2, 22, 6, '#7aa2f7'); // Bigger Z

  return {
    idle: [idle1, idle2],
    walk: [walk1, walk2, walk3, walk4],
    happy: [happy1, happy2],
    eat: [eat1, eat2],
    sleep: [sleep1, sleep2]
  };
}

export const DEFAULT_QUOTES = {
  scared: [
    'Eep! Too open! 🏃💨',
    'Too exposed! Heading to the wall!',
    'Ahhh the middle! Finding safety! 💨',
    'Gotta find a cozy edge! 🏃'
  ],
  safe: [
    'Phew! Safe! 🐾',
    'Cozy border acquired! ✨',
    'Ah, nice solid wall! 💖',
    'Feels much safer here! 🐾'
  ],
  jump: [
    'Hup! 🐾',
    'Look out below!',
    'Leap! ✨',
    'Going to the next monitor! 🚀',
    'Wheee! 🐾'
  ],
  feed: [
    'Yummy! 🍓',
    'Delicious treats!',
    'Nom nom nom~ 🍓',
    'My absolute favorite! ✨'
  ],
  pet: [
    'Purr~ <3',
    'Warm cuddles! 💖',
    'Hehe, that tickles! ✨',
    'You are the best! 🐾'
  ],
  nudge: [
    'Partner sent love! ✨',
    'Thinking of you too! 💖',
    'Bzz! Love incoming! ✨'
  ],
  sleep: [
    'Zzz... 🌙',
    'Sleepy time! 💤',
    'Counting pixel sheep... 🌙'
  ],
  wake: [
    'Good morning! ☀️',
    'Yawn~ Ready to play!',
    'Rise and shine! ✨'
  ]
};

export class PetModel {
  constructor() {
    this.name = 'Mochi';
    this.size = PET_CANVAS_SIZE;
    this.hunger = 85;    // 0 to 100
    this.happiness = 90; // 0 to 100
    this.energy = 95;    // 0 to 100
    this.fps = 4;
    this.updatedAt = Date.now();

    // Customizable quotes for variety
    this.quotes = JSON.parse(JSON.stringify(DEFAULT_QUOTES));

    // Animation clips
    this.clips = generateStarterCat();

    // Try loading saved data from localStorage
    this.loadFromStorage();
  }

  getRandomQuote(category, fallback = '') {
    const list = this.quotes[category];
    if (list && list.length > 0) {
      return list[Math.floor(Math.random() * list.length)];
    }
    return fallback;
  }

  addQuote(category, text) {
    if (!this.quotes[category]) this.quotes[category] = [];
    if (text && text.trim()) {
      this.quotes[category].push(text.trim());
      this.updatedAt = Date.now();
      this.saveToStorage();
    }
  }

  removeQuote(category, index) {
    if (this.quotes[category] && index >= 0 && index < this.quotes[category].length) {
      this.quotes[category].splice(index, 1);
      this.updatedAt = Date.now();
      this.saveToStorage();
    }
  }

  resetQuotes(category = null) {
    if (category && DEFAULT_QUOTES[category]) {
      this.quotes[category] = [...DEFAULT_QUOTES[category]];
    } else {
      this.quotes = JSON.parse(JSON.stringify(DEFAULT_QUOTES));
    }
    this.updatedAt = Date.now();
    this.saveToStorage();
  }

  getClip(clipName) {
    if (!this.clips[clipName]) {
      this.clips[clipName] = [createBlankFrame(this.size)];
    }
    return this.clips[clipName];
  }

  getFrame(clipName, frameIndex) {
    const clip = this.getClip(clipName);
    if (frameIndex >= 0 && frameIndex < clip.length) {
      return clip[frameIndex];
    }
    return null;
  }

  setPixel(clipName, frameIndex, x, y, color) {
    const frame = this.getFrame(clipName, frameIndex);
    if (frame) {
      setPixel(frame, x, y, color, this.size);
      this.updatedAt = Date.now();
      this.saveToStorage();
    }
  }

  addFrame(clipName, afterIndex = -1) {
    const clip = this.getClip(clipName);
    const blank = createBlankFrame(this.size);
    if (afterIndex >= 0 && afterIndex < clip.length) {
      clip.splice(afterIndex + 1, 0, blank);
      this.updatedAt = Date.now();
      this.saveToStorage();
      return afterIndex + 1;
    } else {
      clip.push(blank);
      this.updatedAt = Date.now();
      this.saveToStorage();
      return clip.length - 1;
    }
  }

  duplicateFrame(clipName, frameIndex) {
    const clip = this.getClip(clipName);
    if (frameIndex >= 0 && frameIndex < clip.length) {
      const cloned = cloneFrame(clip[frameIndex]);
      clip.splice(frameIndex + 1, 0, cloned);
      this.updatedAt = Date.now();
      this.saveToStorage();
      return frameIndex + 1;
    }
    return frameIndex;
  }

  deleteFrame(clipName, frameIndex) {
    const clip = this.getClip(clipName);
    if (clip.length > 1 && frameIndex >= 0 && frameIndex < clip.length) {
      clip.splice(frameIndex, 1);
      this.updatedAt = Date.now();
      this.saveToStorage();
      return Math.min(frameIndex, clip.length - 1);
    }
    return frameIndex;
  }

  flipFrameH(clipName, frameIndex) {
    const frame = this.getFrame(clipName, frameIndex);
    if (!frame) return;
    const size = this.size;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < Math.floor(size / 2); x++) {
        const leftIdx = y * size + x;
        const rightIdx = y * size + (size - 1 - x);
        const temp = frame[leftIdx];
        frame[leftIdx] = frame[rightIdx];
        frame[rightIdx] = temp;
      }
    }
    this.updatedAt = Date.now();
    this.saveToStorage();
  }

  flipFrameV(clipName, frameIndex) {
    const frame = this.getFrame(clipName, frameIndex);
    if (!frame) return;
    const size = this.size;
    for (let y = 0; y < Math.floor(size / 2); y++) {
      for (let x = 0; x < size; x++) {
        const topIdx = y * size + x;
        const bottomIdx = (size - 1 - y) * size + x;
        const temp = frame[topIdx];
        frame[topIdx] = frame[bottomIdx];
        frame[bottomIdx] = temp;
      }
    }
    this.updatedAt = Date.now();
    this.saveToStorage();
  }

  rotateFrame90CW(clipName, frameIndex) {
    const frame = this.getFrame(clipName, frameIndex);
    if (!frame) return;
    const size = this.size;
    const copy = [...frame];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        frame[x * size + (size - 1 - y)] = copy[y * size + x];
      }
    }
    this.updatedAt = Date.now();
    this.saveToStorage();
  }

  rotateFrame90CCW(clipName, frameIndex) {
    const frame = this.getFrame(clipName, frameIndex);
    if (!frame) return;
    const size = this.size;
    const copy = [...frame];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        frame[(size - 1 - x) * size + y] = copy[y * size + x];
      }
    }
    this.updatedAt = Date.now();
    this.saveToStorage();
  }

  /**
   * Reorder a frame in clip from fromIndex to toIndex (drag-and-drop)
   */
  reorderFrame(clipName, fromIndex, toIndex) {
    const clip = this.getClip(clipName);
    if (!clip || fromIndex < 0 || fromIndex >= clip.length || toIndex < 0 || toIndex >= clip.length || fromIndex === toIndex) {
      return;
    }
    const [movedFrame] = clip.splice(fromIndex, 1);
    clip.splice(toIndex, 0, movedFrame);
    this.updatedAt = Date.now();
    this.saveToStorage();
  }

  /**
   * Copy a single frame from source clip to target clip(s)
   */
  copyFrameToClip(srcClip, srcIndex, targetClip, replace = false) {
    const srcFrame = this.getFrame(srcClip, srcIndex);
    if (!srcFrame) return -1;

    const copyToSingle = (clipName) => {
      const target = this.getClip(clipName);
      if (!target) return;
      const cloned = cloneFrame(srcFrame);

      if (replace) {
        this.clips[clipName] = [cloned];
      } else {
        const isSingleBlank = target.length === 1 && target[0].every(p => p === null);
        if (isSingleBlank) {
          target[0] = cloned;
        } else {
          target.push(cloned);
        }
      }
    };

    if (targetClip === 'all') {
      const allClips = ['idle', 'walk', 'happy', 'eat', 'sleep'];
      for (const clip of allClips) {
        if (clip !== srcClip) {
          copyToSingle(clip);
        }
      }
    } else {
      copyToSingle(targetClip);
    }

    this.updatedAt = Date.now();
    this.saveToStorage();
    return 0;
  }

  /**
   * Copy all frames of source clip to target clip (or 'all' other clips)
   */
  copyClipToClip(srcClip, targetClip, replace = true) {
    const src = this.getClip(srcClip);
    if (!src || src.length === 0) return;

    const copyToSingle = (clipName) => {
      const target = this.getClip(clipName);
      if (!target) return;
      const clonedFrames = src.map(f => cloneFrame(f));

      if (replace) {
        this.clips[clipName] = clonedFrames;
      } else {
        const isSingleBlank = target.length === 1 && target[0].every(p => p === null);
        if (isSingleBlank) {
          this.clips[clipName] = clonedFrames;
        } else {
          target.push(...clonedFrames);
        }
      }
    };

    if (targetClip === 'all') {
      const allClips = ['idle', 'walk', 'happy', 'eat', 'sleep'];
      for (const clip of allClips) {
        if (clip !== srcClip) {
          copyToSingle(clip);
        }
      }
    } else {
      copyToSingle(targetClip);
    }

    this.updatedAt = Date.now();
    this.saveToStorage();
  }

  // Pet Care Interactions
  feed(amount = 25) {
    this.hunger = Math.min(100, this.hunger + amount);
    this.happiness = Math.min(100, this.happiness + 5);
    this.updatedAt = Date.now();
    this.saveToStorage();
  }

  pet(amount = 20) {
    this.happiness = Math.min(100, this.happiness + amount);
    this.updatedAt = Date.now();
    this.saveToStorage();
  }

  decayStats() {
    // Called periodically (e.g., every minute)
    this.hunger = Math.max(0, this.hunger - 0.2);
    this.happiness = Math.max(0, this.happiness - 0.1);
    this.energy = Math.max(0, this.energy - 0.1);
    this.saveToStorage();
  }

  // Serialization for P2P sync and local storage
  toJSON() {
    return {
      name: this.name,
      size: this.size,
      hunger: this.hunger,
      happiness: this.happiness,
      energy: this.energy,
      fps: this.fps,
      updatedAt: this.updatedAt,
      clips: this.clips,
      quotes: this.quotes
    };
  }

  fromJSON(data) {
    if (!data) return;
    if (data.name) this.name = data.name;
    if (data.size) this.size = data.size;
    if (typeof data.hunger === 'number') this.hunger = data.hunger;
    if (typeof data.happiness === 'number') this.happiness = data.happiness;
    if (typeof data.energy === 'number') this.energy = data.energy;
    if (typeof data.fps === 'number') this.fps = data.fps;
    if (data.clips) this.clips = data.clips;
    if (data.quotes) this.quotes = data.quotes;
    if (data.updatedAt) this.updatedAt = data.updatedAt;
    this.saveToStorage();
  }

  saveToStorage() {
    try {
      localStorage.setItem('coop_desktop_pet_data', JSON.stringify(this.toJSON()));
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
  }

  loadFromStorage() {
    try {
      const saved = localStorage.getItem('coop_desktop_pet_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.clips && parsed.clips.idle) {
          this.fromJSON(parsed);
        }
      }
    } catch (e) {
      console.warn('Failed to load from localStorage:', e);
    }
  }
}
