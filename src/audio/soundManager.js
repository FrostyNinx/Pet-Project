// Sound Management Engine for Pixel Pet Studio

export class SoundManager {
  constructor() {
    this.soundEnabled = localStorage.getItem('coop_pet_sound_enabled') !== 'false';
    this.toolSoundsEnabled = localStorage.getItem('coop_pet_tool_sounds_enabled') !== 'false';
    this.buttonSoundsEnabled = localStorage.getItem('coop_pet_btn_sounds_enabled') !== 'false';
    this.notifySoundsEnabled = localStorage.getItem('coop_pet_notify_sounds_enabled') !== 'false';
    
    const savedVol = localStorage.getItem('coop_pet_sound_volume');
    this.volume = savedVol !== null ? parseFloat(savedVol) : 0.7;

    // Audio pool
    this.audioSources = {
      bucket: './sounds/Bucket_Sound.mp3',
      click: './sounds/Clicking_Sound.mp3',
      eraser: './sounds/Eraser_Sound.mp3',
      message: './sounds/Message_Sound.mp3',
      pencil: './sounds/Pencil_Sound.mp3',
      picker: './sounds/Picker_Sound.wav'
    };

    this.activeAudioInstances = [];
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    localStorage.setItem('coop_pet_sound_volume', this.volume.toString());
  }

  setSoundEnabled(enabled) {
    this.soundEnabled = !!enabled;
    localStorage.setItem('coop_pet_sound_enabled', this.soundEnabled.toString());
  }

  setToolSoundsEnabled(enabled) {
    this.toolSoundsEnabled = !!enabled;
    localStorage.setItem('coop_pet_tool_sounds_enabled', this.toolSoundsEnabled.toString());
  }

  setButtonSoundsEnabled(enabled) {
    this.buttonSoundsEnabled = !!enabled;
    localStorage.setItem('coop_pet_btn_sounds_enabled', this.buttonSoundsEnabled.toString());
  }

  setNotifySoundsEnabled(enabled) {
    this.notifySoundsEnabled = !!enabled;
    localStorage.setItem('coop_pet_notify_sounds_enabled', this.notifySoundsEnabled.toString());
  }

  playAudio(sourceUrl, durationMs = null) {
    if (!this.soundEnabled || this.volume <= 0) return;
    try {
      const audio = new Audio(sourceUrl);
      audio.volume = this.volume;
      this.activeAudioInstances.push(audio);

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Ignore autoplay restriction or rapid interaction errors
        });
      }

      if (durationMs && durationMs > 0) {
        setTimeout(() => {
          try {
            audio.pause();
            audio.currentTime = 0;
            const idx = this.activeAudioInstances.indexOf(audio);
            if (idx !== -1) this.activeAudioInstances.splice(idx, 1);
          } catch (_) {}
        }, durationMs);
      } else {
        audio.onended = () => {
          const idx = this.activeAudioInstances.indexOf(audio);
          if (idx !== -1) this.activeAudioInstances.splice(idx, 1);
        };
      }
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  }

  playClick() {
    if (!this.soundEnabled || !this.buttonSoundsEnabled) return;
    this.playAudio(this.audioSources.click);
  }

  playMessage() {
    if (!this.soundEnabled || !this.notifySoundsEnabled) return;
    this.playAudio(this.audioSources.message);
  }

  playTool(tool) {
    if (!this.soundEnabled || !this.toolSoundsEnabled) return;
    switch (tool) {
      case 'pencil':
      case 'pen':
        // Play satisfying pencil sketch sound (~1800ms) without cutting off prematurely
        this.playAudio(this.audioSources.pencil, 1800);
        break;
      case 'eraser':
        this.playAudio(this.audioSources.eraser);
        break;
      case 'bucket':
        this.playAudio(this.audioSources.bucket);
        break;
      case 'picker':
      case 'eyedropper':
        this.playAudio(this.audioSources.picker);
        break;
      default:
        this.playClick();
        break;
    }
  }
}

export const soundManager = new SoundManager();
