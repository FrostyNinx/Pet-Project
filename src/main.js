import { PetModel } from './pet/petModel.js';
import { PetRenderer } from './pet/petRenderer.js';
import { PetBehaviorController } from './pet/petBehavior.js';
import { ToolManager, PALETTES } from './editor/tools.js';
import { OnionSkinEngine } from './editor/onionSkin.js';
import { PixelCanvasController } from './editor/canvas.js';
import { TimelineController } from './editor/timeline.js';
import { PeerSyncEngine } from './network/peerSync.js';
import { soundManager } from './audio/soundManager.js';

// Initialize Core Models and Controllers
const petModel = new PetModel();
const petRenderer = new PetRenderer(petModel);
const toolManager = new ToolManager();
const onionSkinEngine = new OnionSkinEngine(petModel.size);

// UI Elements
const desktopPetView = document.getElementById('desktopPetView');
const studioView = document.getElementById('studioView');
const desktopPetCanvas = document.getElementById('desktopPetCanvas');
const petContainer = document.getElementById('petContainer');
const petBubble = document.getElementById('petBubble');

// Canvases
const mainCanvas = document.getElementById('mainCanvas');
const gridCanvas = document.getElementById('gridCanvas');
const selectionCanvas = document.getElementById('selectionCanvas');
const onionCanvasPrev = document.getElementById('onionCanvasPrev');
const onionCanvasNext = document.getElementById('onionCanvasNext');
const remoteCursorCanvas = document.getElementById('remoteCursorCanvas');
const previewPetCanvas = document.getElementById('previewPetCanvas');

// Stats Elements
const statHungerFill = document.getElementById('statHungerFill');
const statHappyFill = document.getElementById('statHappyFill');

// App Version & P2P Engine Instance
let currentAppVersion = '1.0.3';
let peerSync = null;

function showVersionMismatchAlert(localVersion, remoteVersion) {
  console.warn(`Version mismatch detected: local v${localVersion} vs remote v${remoteVersion}`);
  const msg = `You are on v${localVersion}, but your partner is on v${remoteVersion}. Please update to keep features and sync compatible!`;
  showSystemToast('⚠️ Version Mismatch!', msg, '⚠️', 8000);
  if (petBehavior) {
    petBehavior.showBubble(`⚠️ Version Mismatch! (v${localVersion} vs v${remoteVersion}) Connection blocked!`, 6000);
    petBehavior.spawnParticle('⚠️', 3);
  }
  const modal = document.getElementById('versionMismatchModal');
  const vmLocalVer = document.getElementById('vmLocalVer');
  const vmRemoteVer = document.getElementById('vmRemoteVer');
  if (modal) {
    if (vmLocalVer) vmLocalVer.textContent = `v${localVersion}`;
    if (vmRemoteVer) vmRemoteVer.textContent = `v${remoteVersion}`;
    modal.classList.remove('hidden');
  }
  const banner = document.getElementById('versionMismatchBanner');
  const bannerText = document.getElementById('versionMismatchText');
  if (banner && bannerText) {
    bannerText.textContent = `Version Mismatch: You have v${localVersion}, partner has v${remoteVersion}. Please update to ensure animations stay in sync.`;
    banner.classList.remove('hidden');
  }
  updateConnectionUI(false, null);
}

document.getElementById('btnCloseVersionMismatchModal')?.addEventListener('click', () => {
  document.getElementById('versionMismatchModal')?.classList.add('hidden');
});

document.getElementById('btnDismissMismatch')?.addEventListener('click', () => {
  document.getElementById('versionMismatchBanner')?.classList.add('hidden');
});

// Initialize Peer Networking
peerSync = new PeerSyncEngine({
  appVersion: currentAppVersion,
  onConnected: (code, isHost) => {
    soundManager.playMessage();
    updateConnectionUI(true, code);
    if (petBehavior) {
      petBehavior.showBubble('Partner connected! 🐾', 3000);
      petBehavior.spawnParticle('✨', 4);
    }
  },
  onDisconnected: () => {
    updateConnectionUI(false, null);
    if (canvasController) {
      canvasController.clearRemoteCursor();
    }
    showPartnerToast('💔 Partner Disconnected', 'Your partner has left the P2P session.');
    if (petBehavior) {
      petBehavior.showBubble('Partner left the room... 💔', 4000);
      petBehavior.spawnParticle('💧', 3);
    }
  },
  onVersionMismatch: ({ localVersion, remoteVersion }) => {
    showVersionMismatchAlert(localVersion, remoteVersion);
  },
  onRemoteStroke: (strokeData) => {
    if (canvasController) {
      canvasController.applyRemoteStroke(strokeData);
    }
    if (timelineController) {
      timelineController.updateCurrentThumb();
    }
  },
  onRemoteFrameAdd: ({ clip, newIndex }) => {
    petModel.addFrame(clip, newIndex - 1);
    if (timelineController) {
      timelineController.render();
    }
    if (canvasController) {
      canvasController.render();
    }
    updateFrameCountBadge();
  },
  onRemoteFrameDuplicate: ({ clip, index }) => {
    petModel.duplicateFrame(clip, index);
    if (timelineController) {
      timelineController.render();
    }
    if (canvasController) {
      canvasController.render();
    }
    updateFrameCountBadge();
  },
  onRemoteFrameDelete: ({ clip, index }) => {
    petModel.deleteFrame(clip, index);
    if (timelineController) {
      timelineController.render();
    }
    if (canvasController) {
      canvasController.render();
    }
    updateFrameCountBadge();
  },
  onRemoteCursor: ({ x, y, tool, clip, frameIndex }) => {
    if (currentAppMode === 'studio' && currentStudioSubView === 'editor' && canvasController) {
      if (clip === canvasController.currentClip && frameIndex === canvasController.currentFrameIndex) {
        canvasController.renderRemoteCursor(x, y, tool, 'Partner');
      } else {
        canvasController.clearRemoteCursor();
      }
    } else if (canvasController) {
      canvasController.clearRemoteCursor();
    }
  },
  onRemoteCareAction: (payload) => {
    soundManager.playMessage();
    const { action, quote } = payload || {};
    if (petBehavior) {
      if (action === 'feed') {
        petBehavior.feedPet(false);
        const text = quote ? `🍓 Partner fed treat: "${quote}"` : 'Partner fed the pet! 🍓';
        petBehavior.showBubble(text, 3500);
        showPartnerToast('🍓 Partner fed the pet a treat!', quote || 'Yummy! 🍓');
      } else if (action === 'pet') {
        petBehavior.petPet(false);
        const text = quote ? `💖 Partner petted: "${quote}"` : 'Partner is petting Mochi! 💖';
        petBehavior.showBubble(text, 3500);
        showPartnerToast('💖 Partner is petting your pet!', quote || 'Purr~ <3');
      } else if (action === 'nudge') {
        petBehavior.sendNudge(false);
        const text = quote ? `✨ Partner sent love: "${quote}"` : 'Partner sent love! ✨';
        petBehavior.showBubble(text, 3500);
        showPartnerToast('✨ Partner sent a love nudge!', quote || 'Thinking of you! ✨');
      } else if (action === 'sleep') {
        petBehavior.setState('sleep');
        petBehavior.showBubble('Partner put pet to sleep... 🌙', 3000);
        petBehavior.spawnParticle('🌙', 3);
        showPartnerToast('🌙 Partner put pet to sleep', 'Zzz...');
      } else if (action === 'wake') {
        petBehavior.setState('idle');
        petBehavior.showBubble('Partner woke up pet! ☀️', 3000);
        petBehavior.spawnParticle('☀️', 3);
        showPartnerToast('☀️ Partner woke up the pet', 'Good morning!');
      }
      updateStatsUI();
    }
  },
  onRemotePetMessage: ({ text, sender }) => {
    soundManager.playMessage();
    const senderName = sender || 'Partner';
    if (petBehavior) {
      petBehavior.showPetMessage(senderName, text, 8000);
    }
    showPartnerNoteToast(senderName, text);
  },
  onFullPetSync: (petData) => {
    console.log('Received full pet sync from partner!');
    petModel.fromJSON(petData);
    if (canvasController) {
      canvasController.render();
    }
    if (timelineController) {
      timelineController.render();
    }
    updateFrameCountBadge();
    updateStatsUI();
  }
});

// Broadcast full pet when host opens connection
document.addEventListener('p2p-request-full-sync', () => {
  peerSync.broadcastFullPet(petModel.toJSON());
});

// Initialize Desktop Pet Behavior
const petBehavior = new PetBehaviorController({
  petModel,
  petRenderer,
  petCanvas: desktopPetCanvas,
  petContainer,
  bubbleElement: petBubble,
  onCareAction: (action, data = {}) => {
    peerSync.broadcastCareAction(action, data);
    updateStatsUI();
  }
});

// Initialize Pixel Canvas Controller
const canvasController = new PixelCanvasController({
  mainCanvas,
  gridCanvas,
  selectionCanvas,
  prevOnionCanvas: onionCanvasPrev,
  nextOnionCanvas: onionCanvasNext,
  remoteCursorCanvas,
  petModel,
  toolManager,
  onionSkinEngine,
  onStrokeDrawn: (strokeData) => {
    peerSync.broadcastStroke(strokeData);
    timelineController.updateCurrentThumb();
  },
  onCursorMove: (x, y, tool, clip, frameIndex) => {
    peerSync.broadcastCursor(
      x,
      y,
      tool,
      clip || (canvasController ? canvasController.currentClip : 'idle'),
      frameIndex !== undefined ? frameIndex : (canvasController ? canvasController.currentFrameIndex : 0)
    );
  }
});

// Initialize Timeline Controller
const timelineFramesStrip = document.getElementById('timelineFramesStrip');
const timelineController = new TimelineController({
  container: timelineFramesStrip,
  petModel,
  onFrameSelect: (clip, index) => {
    canvasController.setClipAndFrame(clip, index);
    updateFrameCountBadge();
  },
  onFrameAdd: (clip, newIndex) => {
    peerSync.broadcastFrameAdd(clip, newIndex);
    peerSync.broadcastFullPet(petModel.toJSON());
    updateFrameCountBadge();
  },
  onFrameDuplicate: (clip, index) => {
    peerSync.broadcastFrameDuplicate(clip, index);
    peerSync.broadcastFullPet(petModel.toJSON());
    updateFrameCountBadge();
  },
  onFrameDelete: (clip, index) => {
    peerSync.broadcastFrameDelete(clip, index);
    peerSync.broadcastFullPet(petModel.toJSON());
    updateFrameCountBadge();
  },
  onFrameReorder: (clip, fromIndex, toIndex) => {
    peerSync.broadcastFullPet(petModel.toJSON());
    updateFrameCountBadge();
    showPartnerToast('🎞️ Frame Moved', `Moved frame #${fromIndex + 1} to position #${toIndex + 1}.`);
  }
});

// Real-Time Animated Preview Loop
let previewFrameIndex = 0;
let previewLastTime = performance.now();
let isFullscreenModalOpen = false;
let isFullscreenPlaying = true;
let fsActiveClip = 'idle';
let fsFrameIndex = 0;

function previewLoop(now) {
  const fps = petModel.fps;
  if (now - previewLastTime >= 1000 / fps) {
    previewLastTime = now;
    const clip = petModel.getClip(canvasController.currentClip);
    if (clip && clip.length > 0) {
      previewFrameIndex = (previewFrameIndex + 1) % clip.length;
      petRenderer.renderFrame(previewPetCanvas, canvasController.currentClip, previewFrameIndex, false);
    }

    if (isFullscreenModalOpen) {
      const fsCanvas = document.getElementById('fullscreenPetCanvas');
      const fsClip = petModel.getClip(fsActiveClip);
      if (fsCanvas && fsClip && fsClip.length > 0) {
        if (isFullscreenPlaying) {
          fsFrameIndex = (fsFrameIndex + 1) % fsClip.length;
        }
        petRenderer.renderFrame(fsCanvas, fsActiveClip, fsFrameIndex, false);
      }
    }
  }
  requestAnimationFrame(previewLoop);
}
requestAnimationFrame(previewLoop);

// View Switching & Click-Through Handling
let currentAppMode = 'studio';
let currentStudioSubView = 'editor';

function switchToStudio() {
  currentAppMode = 'studio';
  desktopPetView.classList.add('hidden');
  studioView.classList.remove('hidden');
  document.body.classList.remove('pet-mode');
  canvasController.render();
  timelineController.render();
  updateFrameCountBadge();
  if (window.electronAPI) {
    window.electronAPI.setFocusable?.(true);
    window.electronAPI.setIgnoreMouseEvents(false);
    window.electronAPI.setWindowMode('studio');
  }
}

function switchToPet() {
  currentAppMode = 'pet';
  canvasController?.clearRemoteCursor();
  studioView.classList.add('hidden');
  desktopPetView.classList.remove('hidden');
  document.body.classList.add('pet-mode');
  updateLockUI();
  if (window.electronAPI) {
    window.electronAPI.setWindowMode('pet');
    // Set non-focusable (WS_EX_NOACTIVATE) so pet NEVER steals focus from Wallpaper Engine or games!
    window.electronAPI.setFocusable?.(false);
    window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
    window.electronAPI.getDisplaysInfo?.().then(data => {
      if (data && data.displays) {
        petBehavior.setDisplays(data.displays);
        petBehavior.spawnAtBottomBorder();
      }
    });
  } else {
    petBehavior.spawnAtBottomBorder();
  }
}

// Pet Lock / Gaming Mode (100% click passthrough and mouse protection)
let isPetLocked = localStorage.getItem('coop_pet_locked') === 'true';

function updateLockUI() {
  document.body.classList.toggle('pet-locked', isPetLocked);
  if (typeof petBehavior !== 'undefined') {
    petBehavior.isLocked = isPetLocked;
  }
  const btnTopToggleLock = document.getElementById('btnTopToggleLock');
  if (btnTopToggleLock) {
    if (isPetLocked) {
      btnTopToggleLock.textContent = '🔒 Locked';
      btnTopToggleLock.classList.add('btn-locked-active');
    } else {
      btnTopToggleLock.textContent = '🔓 Lock';
      btnTopToggleLock.classList.remove('btn-locked-active');
    }
  }
  const lockToggleInput = document.getElementById('lockForGamingToggle');
  if (lockToggleInput) {
    lockToggleInput.checked = isPetLocked;
  }
}

function setPetLocked(locked, showToast = true) {
  isPetLocked = !!locked;
  localStorage.setItem('coop_pet_locked', isPetLocked);
  updateLockUI();
  petBehavior?.setLockState(isPetLocked);

  if (currentAppMode === 'pet' && showToast) {
    if (isPetLocked) {
      showSystemToast('Gaming Lock: ON', 'Pet clicks pass through to background apps. Top bar remains active!', '🔒');
    } else {
      showSystemToast('Gaming Lock: OFF', 'Pet interaction & dragging restored.', '🔓');
      const hovered = document.elementFromPoint(window.lastMouseX, window.lastMouseY);
      if (hovered?.closest('#petContainer') || hovered?.closest('#desktopTopWidget')) {
        window.electronAPI?.setIgnoreMouseEvents(false);
      }
    }
  }
}

function togglePetLock() {
  setPetLocked(!isPetLocked, true);
}

function togglePetWalking(showToast = true) {
  petBehavior.allowWalking = !petBehavior.allowWalking;
  if (!petBehavior.allowWalking && petBehavior.state === 'walk') {
    petBehavior.setState('idle');
  }

  const btnTopToggleWalk = document.getElementById('btnTopToggleWalk');
  if (btnTopToggleWalk) {
    btnTopToggleWalk.textContent = petBehavior.allowWalking ? '🚶 Walk: ON' : '🛑 Walk: OFF';
    btnTopToggleWalk.style.color = petBehavior.allowWalking ? '#a6da95' : '#eed49f';
  }

  const allowWalkingToggle = document.getElementById('allowWalkingToggle');
  if (allowWalkingToggle) {
    allowWalkingToggle.checked = petBehavior.allowWalking;
  }

  if (currentAppMode === 'pet' && showToast) {
    showSystemToast(
      petBehavior.allowWalking ? 'Dynamic Movement: ON' : 'Dynamic Movement: OFF',
      petBehavior.allowWalking ? 'Pet will stroll along screen borders. (Ctrl+Shift+W to toggle)' : 'Pet will stay in place so it won\'t distract you. (Ctrl+Shift+W to resume)',
      petBehavior.allowWalking ? '🚶' : '🛑'
    );
  }
}

// Helper: Check if any overlay modal is open
function isAnyModalOpen() {
  const p2pOpen = !document.getElementById('p2pModal')?.classList.contains('hidden');
  const msgOpen = !document.getElementById('petMessageModal')?.classList.contains('hidden');
  const copyOpen = !document.getElementById('copyAnimationModal')?.classList.contains('hidden');
  const patchOpen = !document.getElementById('patchNotesModal')?.classList.contains('hidden');
  return p2pOpen || msgOpen || copyOpen || patchOpen;
}

// Click-through hover listeners for pet overlay
const desktopTopWidget = document.getElementById('desktopTopWidget');

function setupPetClickThrough() {
  // 1. General UI (Top status bar, toasts, modals): ALWAYS enable mouse clicks!
  const enableUIInteraction = () => {
    if (currentAppMode === 'pet') {
      window.electronAPI?.setIgnoreMouseEvents(false);
    }
  };

  // 2. Pet character itself: if locked, pass clicks through to background; if unlocked, enable clicks!
  const enablePetInteraction = () => {
    if (currentAppMode === 'pet') {
      if (isPetLocked) {
        window.electronAPI?.setIgnoreMouseEvents(true, { forward: true });
        return;
      }
      window.electronAPI?.setIgnoreMouseEvents(false);
    }
  };

  const disableInteraction = (e) => {
    if (currentAppMode === 'pet' && !petBehavior?.isDragging && !petBehavior?.isFleeing) {
      if (isAnyModalOpen()) {
        window.electronAPI?.setIgnoreMouseEvents(false);
        return;
      }
      const related = e?.relatedTarget;
      if (related?.closest('#desktopTopWidget') ||
          related?.closest('#petMessageToast') ||
          related?.closest('#systemNotificationToast') ||
          (!isPetLocked && related?.closest('#petContainer'))) {
        window.electronAPI?.setIgnoreMouseEvents(false);
        return;
      }
      window.electronAPI?.setIgnoreMouseEvents(true, { forward: true });
    }
  };

  // Attach pet-specific interaction to pet container
  petContainer.addEventListener('mouseenter', enablePetInteraction);
  petContainer.addEventListener('mouseleave', disableInteraction);

  // Top status bar ALWAYS accepts clicks (never locks out!)
  if (desktopTopWidget) {
    desktopTopWidget.addEventListener('mouseenter', enableUIInteraction);
    desktopTopWidget.addEventListener('mouseleave', disableInteraction);
  }

  // Toasts always accept clicks
  const petMsgToastEl = document.getElementById('petMessageToast');
  if (petMsgToastEl) {
    petMsgToastEl.addEventListener('mouseenter', enableUIInteraction);
    petMsgToastEl.addEventListener('mouseleave', disableInteraction);
  }

  const sysToastEl = document.getElementById('systemNotificationToast');
  if (sysToastEl) {
    sysToastEl.addEventListener('mouseenter', enableUIInteraction);
    sysToastEl.addEventListener('mouseleave', disableInteraction);
  }

  const p2pModalEl = document.getElementById('p2pModal');
  if (p2pModalEl) {
    p2pModalEl.addEventListener('mouseenter', enableUIInteraction);
    p2pModalEl.addEventListener('mouseleave', disableInteraction);
  }

  const petMsgModalEl = document.getElementById('petMessageModal');
  if (petMsgModalEl) {
    petMsgModalEl.addEventListener('mouseenter', enableUIInteraction);
    petMsgModalEl.addEventListener('mouseleave', disableInteraction);
  }

  const copyModalEl = document.getElementById('copyAnimationModal');
  if (copyModalEl) {
    copyModalEl.addEventListener('mouseenter', enableUIInteraction);
    copyModalEl.addEventListener('mouseleave', disableInteraction);
  }

  const patchModalEl = document.getElementById('patchNotesModal');
  if (patchModalEl) {
    patchModalEl.addEventListener('mouseenter', enableUIInteraction);
    patchModalEl.addEventListener('mouseleave', disableInteraction);
  }

  const actionsDock = petContainer.querySelector('.pet-actions-dock');
  if (actionsDock) {
    actionsDock.addEventListener('mouseenter', enablePetInteraction);
    actionsDock.addEventListener('mouseleave', disableInteraction);
  }

  const petBubbleEl = document.getElementById('petBubble');
  if (petBubbleEl) {
    petBubbleEl.addEventListener('mouseenter', enablePetInteraction);
    petBubbleEl.addEventListener('mouseleave', disableInteraction);
  }

  window.addEventListener('mouseup', () => {
    if (currentAppMode === 'pet') {
      setTimeout(() => {
        if (isAnyModalOpen()) {
          window.electronAPI?.setIgnoreMouseEvents(false);
          return;
        }

        const hovered = document.elementFromPoint(window.lastMouseX, window.lastMouseY);
        const overUI = hovered?.closest('#desktopTopWidget') ||
                       hovered?.closest('#petMessageToast') ||
                       hovered?.closest('#systemNotificationToast') ||
                       hovered?.closest('#p2pModal') ||
                       hovered?.closest('#petMessageModal') ||
                       hovered?.closest('#copyAnimationModal') ||
                       hovered?.closest('#patchNotesModal');

        if (overUI) {
          window.electronAPI?.setIgnoreMouseEvents(false);
          return;
        }

        if (!isPetLocked && hovered?.closest('#petContainer')) {
          window.electronAPI?.setIgnoreMouseEvents(false);
          return;
        }

        window.electronAPI?.setIgnoreMouseEvents(true, { forward: true });
      }, 50);
    }
  });

  window.addEventListener('mousemove', (e) => {
    window.lastMouseX = e.clientX;
    window.lastMouseY = e.clientY;
  });
}
setupPetClickThrough();

// Multi-Monitor Roaming & Display Sync
const savedMultiMonitor = localStorage.getItem('coop_pet_multimonitor') === 'true';

// Listen to display changes from Electron
window.electronAPI?.onDisplaysInfo?.((data) => {
  if (data && data.displays) {
    petBehavior.setDisplays(data.displays);
  }
});

// Initial displays query
window.electronAPI?.getDisplaysInfo?.().then((data) => {
  if (data && data.displays) {
    petBehavior.setDisplays(data.displays);
  }
});

window.addEventListener('resize', () => {
  window.electronAPI?.getDisplaysInfo?.().then((data) => {
    if (data && data.displays) {
      petBehavior.setDisplays(data.displays);
    }
  });
});

window.electronAPI?.setMultiMonitor(savedMultiMonitor);

function setMultiMonitorRoaming(enabled) {
  localStorage.setItem('coop_pet_multimonitor', enabled);
  window.electronAPI?.setMultiMonitor(enabled);
  setTimeout(() => {
    window.electronAPI?.getDisplaysInfo?.().then((data) => {
      if (data && data.displays) {
        petBehavior.setDisplays(data.displays);
      }
    });
  }, 100);
}

const multiMonitorToggle = document.getElementById('multiMonitorToggle');
if (multiMonitorToggle) {
  multiMonitorToggle.checked = savedMultiMonitor;
  multiMonitorToggle.addEventListener('change', (e) => {
    setMultiMonitorRoaming(e.target.checked);
  });
}

// Autonomous Border Walking Toggle
const allowWalkingToggle = document.getElementById('allowWalkingToggle');
if (allowWalkingToggle) {
  allowWalkingToggle.addEventListener('change', (e) => {
    petBehavior.allowWalking = e.target.checked;
  });
}

// Global Tooltips
const globalTooltip = document.getElementById('globalTooltip');

document.addEventListener('mouseover', (e) => {
  const target = e.target.closest('[data-tooltip]');
  if (target && globalTooltip) {
    const text = target.getAttribute('data-tooltip');
    if (text) {
      globalTooltip.textContent = text;
      globalTooltip.classList.remove('hidden');

      const rect = target.getBoundingClientRect();
      let top = rect.bottom + 8;
      let left = rect.left + rect.width / 2 - 120;

      // Ensure tooltip stays on screen
      if (left < 10) left = 10;
      if (left + 260 > window.innerWidth) left = window.innerWidth - 270;
      if (top + 60 > window.innerHeight) top = rect.top - 45;

      globalTooltip.style.top = `${top}px`;
      globalTooltip.style.left = `${left}px`;
    }
  }
});

document.addEventListener('mouseout', (e) => {
  const target = e.target.closest('[data-tooltip]');
  if (target && globalTooltip) {
    globalTooltip.classList.add('hidden');
  }
});

document.getElementById('btnOpenStudioFromPet').addEventListener('click', switchToStudio);
document.getElementById('btnQuickStudio').addEventListener('click', switchToStudio);
document.getElementById('btnSwitchToPet').addEventListener('click', switchToPet);

document.getElementById('btnWinMinimize')?.addEventListener('click', () => {
  window.electronAPI?.minimizeApp();
});
document.getElementById('btnWinClose')?.addEventListener('click', () => {
  window.electronAPI?.closeApp();
});

// What's New / Patch Notes Modal Controller
const patchNotesModal = document.getElementById('patchNotesModal');
const patchNotesVersionTag = document.getElementById('patchNotesVersionTag');
const btnOpenPatchNotes = document.getElementById('btnOpenPatchNotes');
const btnClosePatchNotes = document.getElementById('btnClosePatchNotes');
const btnClosePatchNotesHeader = document.getElementById('btnClosePatchNotesHeader');
const appVersionBadge = document.getElementById('appVersionBadge');

function openPatchNotes() {
  patchNotesModal?.classList.remove('hidden');
  if (patchNotesVersionTag) {
    patchNotesVersionTag.textContent = `v${currentAppVersion}`;
  }
}

function closePatchNotes() {
  patchNotesModal?.classList.add('hidden');
  localStorage.setItem('coop_pet_last_seen_version', currentAppVersion);
}

btnOpenPatchNotes?.addEventListener('click', openPatchNotes);
appVersionBadge?.addEventListener('click', openPatchNotes);
btnClosePatchNotes?.addEventListener('click', closePatchNotes);
btnClosePatchNotesHeader?.addEventListener('click', closePatchNotes);

function checkAutoShowPatchNotes(ver) {
  const lastSeen = localStorage.getItem('coop_pet_last_seen_version');
  if (lastSeen && lastSeen !== ver) {
    // New version detected! Show patch notes celebration modal
    setTimeout(() => {
      openPatchNotes();
      localStorage.setItem('coop_pet_last_seen_version', ver);
      if (petBehavior) {
        petBehavior.showBubble(`Updated to v${ver}! 🐾 Check out What's New!`, 5000);
        petBehavior.spawnParticle('✨', 4);
      }
    }, 1200);
  } else if (!lastSeen) {
    localStorage.setItem('coop_pet_last_seen_version', ver);
  }
}

// App Version & Auto-Updater UI Controller
const updateStatusPill = document.getElementById('updateStatusPill');
const updateStatusLabel = document.getElementById('updateStatusLabel');
const updateIcon = document.getElementById('updateIcon');
const updateNotificationBanner = document.getElementById('updateNotificationBanner');
const updateBannerText = document.getElementById('updateBannerText');
const btnApplyUpdate = document.getElementById('btnApplyUpdate');
const btnDismissUpdate = document.getElementById('btnDismissUpdate');

let isUpdateReadyToInstall = false;

window.electronAPI?.getAppVersion?.().then(version => {
  if (version) {
    currentAppVersion = version;
    if (peerSync) peerSync.appVersion = version;
    if (appVersionBadge) appVersionBadge.textContent = `v${version}`;
    if (updateStatusLabel && !isUpdateReadyToInstall) updateStatusLabel.textContent = `v${version}`;
    if (patchNotesVersionTag) patchNotesVersionTag.textContent = `v${version}`;
    checkAutoShowPatchNotes(version);
  }
});

updateStatusPill?.addEventListener('click', () => {
  if (isUpdateReadyToInstall) {
    window.electronAPI?.restartAndInstallUpdate?.();
  } else {
    if (updateStatusLabel) updateStatusLabel.textContent = 'Checking...';
    if (updateIcon) updateIcon.textContent = '🔍';
    window.electronAPI?.checkForUpdates?.();
  }
});

btnApplyUpdate?.addEventListener('click', () => {
  window.electronAPI?.restartAndInstallUpdate?.();
});

btnDismissUpdate?.addEventListener('click', () => {
  updateNotificationBanner?.classList.add('hidden');
});

window.electronAPI?.onUpdaterStatus?.((data) => {
  if (!data) return;

  if (data.status === 'checking') {
    if (updateStatusLabel) updateStatusLabel.textContent = 'Checking...';
    if (updateIcon) updateIcon.textContent = '🔍';
  } else if (data.status === 'available') {
    if (updateStatusLabel) updateStatusLabel.textContent = `Downloading v${data.version}...`;
    if (updateIcon) updateIcon.textContent = '⬇️';
    updateStatusPill?.classList.add('downloading');
    showPartnerToast('🚀 Update Available!', `Downloading version ${data.version} in the background...`);
  } else if (data.status === 'downloading') {
    if (updateStatusLabel) updateStatusLabel.textContent = `${data.percent}%`;
    if (updateIcon) updateIcon.textContent = '⬇️';
  } else if (data.status === 'downloaded') {
    isUpdateReadyToInstall = true;
    updateStatusPill?.classList.remove('downloading');
    updateStatusPill?.classList.add('ready');
    if (updateStatusLabel) updateStatusLabel.textContent = 'Restart to Update!';
    if (updateIcon) updateIcon.textContent = '🎉';
    if (updateBannerText) updateBannerText.textContent = `Version ${data.version} is ready! Restart Pixel Pet Studio to apply update.`;
    updateNotificationBanner?.classList.remove('hidden');
    showPartnerToast('🎉 Update Ready!', `Version ${data.version} has finished downloading. Click "Restart to Update" to apply!`);
    if (petBehavior) {
      petBehavior.showBubble('Update downloaded! 🐾 Restart anytime to update', 5000);
      petBehavior.spawnParticle('✨', 4);
    }
  } else if (data.status === 'not-available') {
    if (updateStatusLabel) updateStatusLabel.textContent = 'Up to date';
    if (updateIcon) updateIcon.textContent = '✅';
    setTimeout(() => {
      if (updateStatusLabel && !isUpdateReadyToInstall) {
        updateStatusLabel.textContent = `v${currentAppVersion}`;
        if (updateIcon) updateIcon.textContent = '🚀';
      }
    }, 4000);
  } else if (data.status === 'dev') {
    if (updateStatusLabel) updateStatusLabel.textContent = 'Dev Mode';
    if (updateIcon) updateIcon.textContent = '🛠️';
    setTimeout(() => {
      if (updateStatusLabel) {
        updateStatusLabel.textContent = `v${currentAppVersion}`;
        if (updateIcon) updateIcon.textContent = '🚀';
      }
    }, 3000);
  } else if (data.status === 'error') {
    console.warn('Updater status error:', data.message);
    if (updateStatusPill) updateStatusPill.classList.remove('downloading');
    if (updateStatusLabel) updateStatusLabel.textContent = `v${currentAppVersion}`;
    if (updateIcon) updateIcon.textContent = '🚀';
  }
});

// Pet Action Buttons
document.getElementById('btnFeed').addEventListener('click', () => petBehavior.feedPet(true));
document.getElementById('btnPet').addEventListener('click', () => petBehavior.petPet(true));
document.getElementById('btnNudge').addEventListener('click', () => petBehavior.sendNudge(true));
document.getElementById('btnSleepToggle').addEventListener('click', () => petBehavior.toggleSleep(true));

// Animation Clip Selector Switching
const clipTabs = document.querySelectorAll('.clip-tab');
clipTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const clip = tab.dataset.clip;
    if (!clip) return;
    clipTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    timelineController.setClip(clip);
    previewFrameIndex = 0;
  });
});

// Drawing Tool Selection & Helper
const toolButtons = document.querySelectorAll('.tool-btn');

function setToolActive(toolName) {
  toolManager.setTool(toolName);
  toolButtons.forEach(b => {
    b.classList.toggle('active', b.dataset.tool === toolName);
  });
}

// Screen-wide Eyedropper using Native screen-picker.exe or Chromium API
async function activateScreenEyedropper() {
  if (window.electronAPI?.pickScreenColor) {
    try {
      const pickedColor = await window.electronAPI.pickScreenColor();
      if (pickedColor) {
        toolManager.setColor(pickedColor);
        if (currentColorBox) currentColorBox.style.backgroundColor = pickedColor;
        if (customColorInput) customColorInput.value = pickedColor;
        addRecentColor(pickedColor);
        soundManager.playTool('eyedropper');
        setToolActive('pen');
      }
      return;
    } catch (err) {
      console.warn('Native screen picker error:', err);
    }
  }

  // Fallback to Chromium EyeDropper if available
  if (window.EyeDropper) {
    try {
      const eyeDropper = new window.EyeDropper();
      const result = await eyeDropper.open();
      if (result && result.sRGBHex) {
        const pickedColor = result.sRGBHex;
        toolManager.setColor(pickedColor);
        if (currentColorBox) currentColorBox.style.backgroundColor = pickedColor;
        if (customColorInput) customColorInput.value = pickedColor;
        addRecentColor(pickedColor);
        soundManager.playTool('eyedropper');
        setToolActive('pen');
      }
    } catch (err) {
      // User canceled by pressing Esc
    }
  } else {
    // Fallback: use canvas eyedropper tool
    setToolActive('eyedropper');
  }
}

toolButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const tool = btn.dataset.tool;
    soundManager.playTool(tool);
    setToolActive(tool);
    if (tool === 'eyedropper') {
      activateScreenEyedropper();
    }
  });
});

// Sound Delegation: Play click sound for all studio buttons and interactive objects that are not tool buttons
document.addEventListener('click', (e) => {
  // Only play inside Studio mode or open modals (not on desktop windows when pet is floating)
  if (currentAppMode !== 'studio' && !isAnyModalOpen()) return;

  // Drawing on canvas has drawing actions, do not play button click
  if (e.target.closest('canvas')) return;

  // Tool buttons have their own dedicated tool sounds
  const toolBtn = e.target.closest('.tool-btn');
  if (toolBtn) return;

  // Check for interactive studio objects, controls, swatches, and modal elements
  const interactive = e.target.closest(
    'button, .connection-pill, .studio-nav-tab, .clip-tab, .fs-clip-tab, ' +
    '.swatch, .recent-swatch, .frame-card, .quote-cat-btn, .btn-copy-target, ' +
    'input[type="checkbox"], input[type="radio"], select, .quick-color-btn, ' +
    '.toggle-switch, .modal-close-btn, [role="button"]'
  );

  if (interactive) {
    soundManager.playClick();
  }
}, true);

// Symmetry Mode Toggle
const btnToggleSymmetry = document.getElementById('btnToggleSymmetry');
btnToggleSymmetry.addEventListener('click', () => {
  const sym = toolManager.toggleSymmetry();
  btnToggleSymmetry.textContent = sym ? '🪞 Symmetry Mode: ON' : '🪞 Symmetry Mode: OFF';
  btnToggleSymmetry.classList.toggle('active', sym);
});

// Onion Skin Controls
const onionSkinToggle = document.getElementById('onionSkinToggle');
const onionSkinMode = document.getElementById('onionSkinMode');

onionSkinToggle.addEventListener('change', (e) => {
  onionSkinEngine.enabled = e.target.checked;
  canvasController.renderOnionSkin();
});

onionSkinMode.addEventListener('change', (e) => {
  onionSkinEngine.mode = e.target.value;
  canvasController.renderOnionSkin();
});

// Grid & Clear Controls
const btnToggleGrid = document.getElementById('btnToggleGrid');
btnToggleGrid.addEventListener('click', () => {
  canvasController.showGrid = !canvasController.showGrid;
  btnToggleGrid.textContent = canvasController.showGrid ? 'Grid: ON' : 'Grid: OFF';
  canvasController.renderGrid();
});

document.getElementById('btnClearFrame').addEventListener('click', () => {
  if (confirm('Clear all pixels on the current frame? (Can be undone with Ctrl+Z)')) {
    canvasController.clearCurrentFrame();
    timelineController.updateCurrentThumb();
  }
});

// Ghost Active Layer (Semi-transparent drawing to see onion skin)
function updateGhostLayerUI(enabled) {
  const isGhost = canvasController.toggleTransparentLayer(enabled);
  const btnToggleGhostLayer = document.getElementById('btnToggleGhostLayer');
  if (btnToggleGhostLayer) {
    btnToggleGhostLayer.textContent = isGhost ? '👻 Ghost: ON' : '👻 Ghost: OFF';
    btnToggleGhostLayer.classList.toggle('active', isGhost);
  }
  const onionGhostToggle = document.getElementById('onionGhostToggle');
  if (onionGhostToggle) {
    onionGhostToggle.checked = isGhost;
  }
}

document.getElementById('btnToggleGhostLayer')?.addEventListener('click', () => {
  updateGhostLayerUI(null);
});

document.getElementById('onionGhostToggle')?.addEventListener('change', (e) => {
  updateGhostLayerUI(e.target.checked);
});

// Grid Over Paint Toggle
const btnToggleGridOnTop = document.getElementById('btnToggleGridOnTop');
function updateGridOnTopUI(onTop) {
  const isGridOnTop = canvasController.setGridOnTop(onTop);
  if (btnToggleGridOnTop) {
    btnToggleGridOnTop.textContent = isGridOnTop ? 'Grid on Top: ON' : 'Grid on Top: OFF';
    btnToggleGridOnTop.classList.toggle('active', isGridOnTop);
  }
}

btnToggleGridOnTop?.addEventListener('click', () => {
  updateGridOnTopUI(!canvasController.gridOnTop);
});

if (btnToggleGridOnTop) {
  btnToggleGridOnTop.textContent = canvasController.gridOnTop ? 'Grid on Top: ON' : 'Grid on Top: OFF';
  btnToggleGridOnTop.classList.toggle('active', canvasController.gridOnTop);
}

// Selection Toolbar Actions
document.getElementById('btnSelRotateCW')?.addEventListener('click', () => {
  canvasController.rotateSelection90CW();
});
document.getElementById('btnSelRotateCCW')?.addEventListener('click', () => {
  canvasController.rotateSelection90CCW();
});
document.getElementById('btnSelFlipH')?.addEventListener('click', () => {
  canvasController.flipSelectionH();
});
document.getElementById('btnSelFlipV')?.addEventListener('click', () => {
  canvasController.flipSelectionV();
});
document.getElementById('btnSelCopy')?.addEventListener('click', () => {
  canvasController.copySelection();
  showPartnerToast('📋 Selection Copied', 'Copied selection to clipboard.');
});
document.getElementById('btnSelDelete')?.addEventListener('click', () => {
  canvasController.deleteSelection();
  timelineController.updateCurrentThumb();
});
document.getElementById('btnSelCommit')?.addEventListener('click', () => {
  canvasController.commitSelection();
  timelineController.updateCurrentThumb();
});

// Sidebar Transforms (Operates on selection if active, otherwise whole frame)
document.getElementById('btnSideFlipH')?.addEventListener('click', () => {
  canvasController.flipHorizontal();
  timelineController.updateCurrentThumb();
});
document.getElementById('btnSideFlipV')?.addEventListener('click', () => {
  canvasController.flipVertical();
  timelineController.updateCurrentThumb();
});
document.getElementById('btnSideRotateCW')?.addEventListener('click', () => {
  canvasController.rotate90CW();
  timelineController.updateCurrentThumb();
});

// Drawing Undo & Redo (Buttons and Shortcuts)
const btnUndo = document.getElementById('btnUndo');
const btnRedo = document.getElementById('btnRedo');

btnUndo?.addEventListener('click', () => {
  if (canvasController.undo()) {
    timelineController.updateCurrentThumb();
    showPartnerToast('↩️ Undo', 'Drawing action reverted');
  }
});

btnRedo?.addEventListener('click', () => {
  if (canvasController.redo()) {
    timelineController.updateCurrentThumb();
    showPartnerToast('↪️ Redo', 'Reverted drawing action restored');
  }
});

window.addEventListener('keydown', (e) => {
  // Ignore shortcuts when editing text inputs
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  // S shortcut for Selection tool
  if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 's' || e.key === 'S')) {
    setToolActive('select');
    soundManager.playTool('select');
    return;
  }

  // Escape or Enter: commit selection if active
  if (e.key === 'Escape' || e.key === 'Enter') {
    if (canvasController.selection) {
      e.preventDefault();
      canvasController.commitSelection();
      timelineController.updateCurrentThumb();
      return;
    }
  }

  // Delete key: delete selected pixels
  if (e.key === 'Delete') {
    if (canvasController.selection) {
      e.preventDefault();
      canvasController.deleteSelection();
      timelineController.updateCurrentThumb();
      return;
    }
  }

  // Ctrl+C: copy selection
  if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
    if (canvasController.selection) {
      e.preventDefault();
      canvasController.copySelection();
      showPartnerToast('📋 Selection Copied', 'Copied selection to clipboard.');
      return;
    }
  }

  // Ctrl+V: paste selection
  if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
    if (canvasController.selectionClipboard) {
      e.preventDefault();
      canvasController.pasteSelection();
      return;
    }
  }

  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
    e.preventDefault();
    if (canvasController.undo()) {
      timelineController.updateCurrentThumb();
      showPartnerToast('↩️ Undo', 'Drawing action reverted');
    }
  } else if ((e.ctrlKey || e.metaKey) && ((e.shiftKey && (e.key === 'z' || e.key === 'Z')) || e.key === 'y' || e.key === 'Y')) {
    e.preventDefault();
    if (canvasController.redo()) {
      timelineController.updateCurrentThumb();
      showPartnerToast('↪️ Redo', 'Reverted drawing action restored');
    }
  }
});

// Copy Frames / Animation Feature (No Emojis, Powerful & Clean)
const copyAnimationModal = document.getElementById('copyAnimationModal');
const btnCopyAnimation = document.getElementById('btnCopyAnimation');
const btnCloseCopyModal = document.getElementById('btnCloseCopyModal');
const btnCloseCopyModalHeader = document.getElementById('btnCloseCopyModalHeader');
const btnCopyApplyToAll = document.getElementById('btnCopyApplyToAll');
const copySourceClipName = document.getElementById('copySourceClipName');
const copyCurrentFrameLabel = document.getElementById('copyCurrentFrameLabel');
const copyAllFramesCountLabel = document.getElementById('copyAllFramesCountLabel');
const copySpecificFrameSelect = document.getElementById('copySpecificFrameSelect');
const copyReplaceToggle = document.getElementById('copyReplaceToggle');
const copyScopeCurrent = document.getElementById('copyScopeCurrent');
const copyScopeSpecific = document.getElementById('copyScopeSpecific');
const copyScopeAll = document.getElementById('copyScopeAll');

function openCopyModal() {
  if (!copyAnimationModal) return;
  const srcClip = canvasController.currentClip || 'idle';
  const currentFrameIdx = timelineController.currentFrameIndex || 0;
  const clipFrames = petModel.getClip(srcClip) || [];
  const totalFrames = clipFrames.length;

  if (copySourceClipName) {
    copySourceClipName.textContent = srcClip.charAt(0).toUpperCase() + srcClip.slice(1);
  }
  if (copyCurrentFrameLabel) {
    copyCurrentFrameLabel.textContent = `Frame ${currentFrameIdx + 1}`;
  }
  if (copyAllFramesCountLabel) {
    copyAllFramesCountLabel.textContent = `All ${totalFrames} frame${totalFrames === 1 ? '' : 's'} in this clip`;
  }

  // Populate specific frame dropdown
  if (copySpecificFrameSelect) {
    copySpecificFrameSelect.innerHTML = '';
    for (let i = 0; i < totalFrames; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `Frame ${i + 1}`;
      if (i === currentFrameIdx) opt.selected = true;
      copySpecificFrameSelect.appendChild(opt);
    }
  }

  // Highlight / disable current active clip button
  document.querySelectorAll('.btn-copy-target').forEach(btn => {
    const isCurrent = btn.dataset.target === srcClip;
    btn.classList.toggle('disabled', isCurrent);
    btn.title = isCurrent ? `Currently editing "${srcClip}"` : `Copy to ${btn.dataset.target}`;
  });

  if (copyReplaceToggle) {
    copyReplaceToggle.checked = false;
  }

  copyAnimationModal.classList.remove('hidden');
}

function closeCopyModal() {
  copyAnimationModal?.classList.add('hidden');
}

btnCopyAnimation?.addEventListener('click', openCopyModal);
btnCloseCopyModal?.addEventListener('click', closeCopyModal);
btnCloseCopyModalHeader?.addEventListener('click', closeCopyModal);

copySpecificFrameSelect?.addEventListener('change', () => {
  if (copyScopeSpecific) copyScopeSpecific.checked = true;
});

function executeCopyAnimation(targetClip) {
  const srcClip = canvasController.currentClip || 'idle';
  if (targetClip === srcClip) {
    showPartnerToast('Notice', `Already editing the "${srcClip}" animation.`);
    return;
  }

  const replace = copyReplaceToggle ? copyReplaceToggle.checked : false;
  let scope = 'current';
  if (copyScopeSpecific?.checked) scope = 'specific';
  else if (copyScopeAll?.checked) scope = 'all';

  const currentFrameIdx = timelineController.currentFrameIndex || 0;
  const specificFrameIdx = copySpecificFrameSelect ? parseInt(copySpecificFrameSelect.value, 10) : currentFrameIdx;
  const srcFrameIdx = (scope === 'specific') ? specificFrameIdx : currentFrameIdx;

  const targetName = targetClip === 'all' ? 'all other animations' : `${targetClip} animation`;
  let toastDesc = '';

  if (scope === 'all') {
    petModel.copyClipToClip(srcClip, targetClip, replace);
    toastDesc = `Copied all frames of "${srcClip}" to ${targetName}.`;
  } else {
    petModel.copyFrameToClip(srcClip, srcFrameIdx, targetClip, replace);
    const frameNumber = srcFrameIdx + 1;
    toastDesc = `Copied Frame ${frameNumber} of "${srcClip}" to ${targetName}.`;
  }

  peerSync.broadcastFullPet(petModel.toJSON());
  timelineController.render();
  canvasController.render();
  updateFrameCountBadge();
  closeCopyModal();
  showPartnerToast('Frames Copied', toastDesc);
}

btnCopyApplyToAll?.addEventListener('click', () => {
  executeCopyAnimation('all');
});

document.querySelectorAll('.btn-copy-target').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.target;
    executeCopyAnimation(target);
  });
});

// Timeline Controls
document.getElementById('btnDuplicateFrame').addEventListener('click', () => {
  timelineController.duplicateCurrent();
});

document.getElementById('btnDeleteFrame').addEventListener('click', () => {
  timelineController.deleteCurrent();
});

const fpsRange = document.getElementById('fpsRange');
const fpsLabel = document.getElementById('fpsLabel');
fpsRange.addEventListener('input', (e) => {
  const fps = parseInt(e.target.value, 10);
  petModel.fps = fps;
  fpsLabel.textContent = `${fps} FPS`;
  petModel.saveToStorage();
});

function updateFrameCountBadge() {
  const clip = petModel.getClip(canvasController.currentClip);
  document.getElementById('frameCountLabel').textContent = `${clip.length}`;
}

// Color Palette & Recent Colors Setup
const swatchesContainer = document.getElementById('swatchesContainer');
const recentColorsContainer = document.getElementById('recentColorsContainer');
const currentColorBox = document.getElementById('currentColorBox');
const customColorInput = document.getElementById('customColorInput');
const paletteSelector = document.getElementById('paletteSelector');

let recentColors = [];
try {
  const saved = localStorage.getItem('coop_pet_recent_colors');
  if (saved) recentColors = JSON.parse(saved);
} catch (_) {}
if (!Array.isArray(recentColors) || recentColors.length === 0) {
  recentColors = ['#000000', '#ffffff', '#e63946', '#2a9d8f', '#f4a261'];
}

function renderRecentColors() {
  if (!recentColorsContainer) return;
  recentColorsContainer.innerHTML = '';
  recentColors.forEach(color => {
    const swatch = document.createElement('div');
    swatch.className = 'recent-swatch';
    swatch.style.backgroundColor = color;
    swatch.title = color;
    swatch.dataset.tooltip = `Recent: ${color}`;
    if (toolManager.currentColor.toLowerCase() === color.toLowerCase()) {
      swatch.classList.add('active');
    }
    swatch.addEventListener('click', () => {
      toolManager.setColor(color);
      currentColorBox.style.backgroundColor = color;
      customColorInput.value = color;
      document.querySelectorAll('.swatch, .recent-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
    });
    recentColorsContainer.appendChild(swatch);
  });
}

function addRecentColor(color) {
  if (!color || typeof color !== 'string') return;
  const hex = color.toLowerCase();
  recentColors = [hex, ...recentColors.filter(c => c.toLowerCase() !== hex)].slice(0, 5);
  try {
    localStorage.setItem('coop_pet_recent_colors', JSON.stringify(recentColors));
  } catch (_) {}
  renderRecentColors();
}

function renderPaletteSwatches(paletteName) {
  swatchesContainer.innerHTML = '';
  const colors = PALETTES[paletteName] || PALETTES.advanced || PALETTES.vibrant32 || PALETTES.retro;
  colors.forEach((color, idx) => {
    const swatch = document.createElement('div');
    swatch.className = `swatch ${idx === 0 ? 'active' : ''}`;
    swatch.style.backgroundColor = color;
    swatch.addEventListener('click', () => {
      document.querySelectorAll('.swatch, .recent-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      toolManager.setColor(color);
      currentColorBox.style.backgroundColor = color;
      customColorInput.value = color;
      addRecentColor(color);
    });
    swatchesContainer.appendChild(swatch);
  });
}

paletteSelector.addEventListener('change', (e) => {
  renderPaletteSwatches(e.target.value);
});

customColorInput.addEventListener('input', (e) => {
  const color = e.target.value;
  toolManager.setColor(color);
  currentColorBox.style.backgroundColor = color;
  document.querySelectorAll('.swatch, .recent-swatch').forEach(s => s.classList.remove('active'));
});

customColorInput.addEventListener('change', (e) => {
  addRecentColor(e.target.value);
});

document.addEventListener('color-picked', (e) => {
  const color = e.detail;
  if (color) {
    toolManager.setColor(color);
    currentColorBox.style.backgroundColor = color;
    customColorInput.value = color;
    addRecentColor(color);
    setToolActive('pen');
  }
});

renderPaletteSwatches('advanced');
paletteSelector.value = 'advanced';
renderRecentColors();

// UI Stats Updates
function updateStatsUI() {
  statHungerFill.style.width = `${petModel.hunger}%`;
  statHappyFill.style.width = `${petModel.happiness}%`;
}

// P2P Connection UI & Modal
const p2pModal = document.getElementById('p2pModal');
const studioRoomPill = document.getElementById('studioRoomPill');
const petViewRoomPill = document.getElementById('petViewRoomPill');
const btnCloseModal = document.getElementById('btnCloseModal');

const modalTabHost = document.getElementById('modalTabHost');
const modalTabJoin = document.getElementById('modalTabJoin');
const modalHostSection = document.getElementById('modalHostSection');
const modalJoinSection = document.getElementById('modalJoinSection');

const btnStartHost = document.getElementById('btnStartHost');
const hostCodeInput = document.getElementById('hostCodeInput');
const btnCopyHostCode = document.getElementById('btnCopyHostCode');
const hostStatusNote = document.getElementById('hostStatusNote');

const joinCodeInput = document.getElementById('joinCodeInput');
const btnConnectJoin = document.getElementById('btnConnectJoin');

function openP2PModal() {
  p2pModal.classList.remove('hidden');
  if (currentAppMode === 'pet') {
    window.electronAPI?.setFocusable?.(true);
    window.electronAPI?.setIgnoreMouseEvents(false);
  }
}

function closeP2PModal() {
  p2pModal.classList.add('hidden');
  if (currentAppMode === 'pet') {
    if (!isAnyModalOpen()) {
      window.electronAPI?.setFocusable?.(false);
      window.electronAPI?.setIgnoreMouseEvents(true, { forward: true });
    }
  }
}

studioRoomPill?.addEventListener('click', openP2PModal);
petViewRoomPill?.addEventListener('click', openP2PModal);
btnCloseModal?.addEventListener('click', closeP2PModal);

modalTabHost.addEventListener('click', () => {
  modalTabHost.classList.add('btn-primary');
  modalTabJoin.classList.remove('btn-primary');
  modalHostSection.classList.remove('hidden');
  modalJoinSection.classList.add('hidden');
});

modalTabJoin.addEventListener('click', () => {
  modalTabJoin.classList.add('btn-primary');
  modalTabHost.classList.remove('btn-primary');
  modalJoinSection.classList.remove('hidden');
  modalHostSection.classList.add('hidden');
});

btnStartHost.addEventListener('click', () => {
  hostStatusNote.textContent = 'Starting room...';
  peerSync.startHost();
});

document.addEventListener('p2p-host-ready', (e) => {
  const code = e.detail;
  hostCodeInput.value = code;
  hostStatusNote.textContent = `Room ready! Share "${code}" with your partner to connect.`;
  btnStartHost.textContent = 'Room Active (Waiting for partner)';
  btnStartHost.disabled = true;
});

btnCopyHostCode.addEventListener('click', () => {
  if (hostCodeInput.value && hostCodeInput.value.startsWith('PET-')) {
    navigator.clipboard.writeText(hostCodeInput.value);
    hostStatusNote.textContent = `📋 Copied room code: ${hostCodeInput.value}`;
    showPartnerToast('📋 Room Code Copied', hostCodeInput.value);
  }
});

btnConnectJoin.addEventListener('click', () => {
  const code = joinCodeInput.value.trim();
  if (!code) {
    showPartnerToast('⚠️ Code Required', 'Please enter a room code');
    return;
  }
  btnConnectJoin.textContent = 'Connecting...';
  peerSync.joinRoom(code);
});

document.addEventListener('p2p-error', (e) => {
  const msg = e.detail?.message || 'P2P network error';
  showPartnerToast('⚠️ P2P Notice', msg);
  if (btnConnectJoin) {
    btnConnectJoin.textContent = 'Connect & Join';
    btnConnectJoin.disabled = false;
  }
  if (hostStatusNote) {
    hostStatusNote.textContent = msg;
  }
});

function updateConnectionUI(connected, code) {
  const studioDot = document.getElementById('studioStatusDot');
  const petDot = document.getElementById('petViewStatusDot');
  const panelDot = document.getElementById('panelPartnerDot');
  const studioLabel = document.getElementById('studioRoomLabel');
  const petLabel = document.getElementById('petViewRoomLabel');
  const panelText = document.getElementById('panelPartnerText');
  const panelInfo = document.getElementById('panelPartnerRoomInfo');

  const btnSidebarDisconnect = document.getElementById('btnSidebarDisconnect');
  const modalDisconnectRow = document.getElementById('modalDisconnectRow');
  const btnSettingsDisconnect = document.getElementById('btnSettingsDisconnect');
  const settingP2pStatusDesc = document.getElementById('settingP2pStatusDesc');
  const settingP2pStatusBadge = document.getElementById('settingP2pStatusBadge');

  if (connected) {
    if (studioDot) studioDot.className = 'status-dot connected';
    if (petDot) petDot.className = 'status-dot connected';
    if (panelDot) panelDot.className = 'status-dot connected';

    if (studioLabel) studioLabel.textContent = `P2P: ${code}`;
    if (petLabel) petLabel.textContent = `P2P: ${code}`;
    if (panelText) panelText.textContent = `Connected (${code})`;
    if (panelInfo) panelInfo.textContent = 'Syncing strokes live in real-time!';

    btnSidebarDisconnect?.classList.remove('hidden');
    modalDisconnectRow?.classList.remove('hidden');
    btnSettingsDisconnect?.classList.remove('hidden');

    if (settingP2pStatusDesc) settingP2pStatusDesc.textContent = `Connected to room: ${code}`;
    if (settingP2pStatusBadge) {
      settingP2pStatusBadge.textContent = `Connected (${code})`;
      settingP2pStatusBadge.className = 'p2p-status-badge connected';
    }

    closeP2PModal();
  } else {
    if (studioDot) studioDot.className = 'status-dot';
    if (petDot) petDot.className = 'status-dot';
    if (panelDot) panelDot.className = 'status-dot';

    if (studioLabel) studioLabel.textContent = 'Connect P2P';
    if (petLabel) petLabel.textContent = 'P2P: Offline';
    if (panelText) panelText.textContent = 'Solo (Not connected)';
    if (panelInfo) panelInfo.textContent = 'Share room code to draw together live!';

    btnSidebarDisconnect?.classList.add('hidden');
    modalDisconnectRow?.classList.add('hidden');
    btnSettingsDisconnect?.classList.add('hidden');

    if (settingP2pStatusDesc) settingP2pStatusDesc.textContent = 'Offline (Not connected)';
    if (settingP2pStatusBadge) {
      settingP2pStatusBadge.textContent = 'Offline';
      settingP2pStatusBadge.className = 'p2p-status-badge';
    }

    if (btnStartHost) {
      btnStartHost.textContent = 'Generate Room Code & Host';
      btnStartHost.disabled = false;
    }
    if (hostCodeInput) {
      hostCodeInput.value = "Click 'Start Host' below";
    }
    if (hostStatusNote) {
      hostStatusNote.textContent = 'Click the button below to generate a room code and invite your partner.';
    }
  }
}

function handleDisconnectUser() {
  if (peerSync) {
    peerSync.disconnect();
    updateConnectionUI(false, null);
    showSystemToast('Disconnected', 'Left the P2P session.', '🔌');
    if (petBehavior) {
      petBehavior.showBubble('Disconnected from room. 🔌', 3000);
    }
  }
}

document.getElementById('btnSidebarDisconnect')?.addEventListener('click', handleDisconnectUser);
document.getElementById('btnModalDisconnect')?.addEventListener('click', () => {
  handleDisconnectUser();
  closeP2PModal();
});
document.getElementById('btnSettingsDisconnect')?.addEventListener('click', handleDisconnectUser);

// Pet Message System & Notification Toast
const petMessageModal = document.getElementById('petMessageModal');
const petMessageInput = document.getElementById('petMessageInput');
const petMessageCharCount = document.getElementById('petMessageCharCount');
const btnSendPetMessage = document.getElementById('btnSendPetMessage');
const btnClosePetMessage = document.getElementById('btnClosePetMessage');
const btnTopSendNote = document.getElementById('btnTopSendNote');
const btnPetActionMessage = document.getElementById('btnPetActionMessage');
const btnStudioSendNote = document.getElementById('btnStudioSendNote');

const petMessageToast = document.getElementById('petMessageToast');
const toastMessageText = document.getElementById('toastMessageText');
const btnToastReply = document.getElementById('btnToastReply');
const btnToastClose = document.getElementById('btnToastClose');

const systemNotificationToast = document.getElementById('systemNotificationToast');
const systemToastIcon = document.getElementById('systemToastIcon');
const systemToastTitle = document.getElementById('systemToastTitle');
const systemToastText = document.getElementById('systemToastText');
const btnSystemToastClose = document.getElementById('btnSystemToastClose');

let toastDismissTimer = null;
let systemToastTimer = null;

function showSystemToast(title, text, icon = 'ℹ️', durationMs = 3500) {
  if (!systemNotificationToast) return;
  if (systemToastIcon) systemToastIcon.textContent = icon;
  if (systemToastTitle) systemToastTitle.textContent = title;
  if (systemToastText) systemToastText.textContent = text;

  systemNotificationToast.classList.remove('hidden');

  clearTimeout(systemToastTimer);
  systemToastTimer = setTimeout(() => {
    systemNotificationToast.classList.add('hidden');
  }, durationMs);
}

btnSystemToastClose?.addEventListener('click', () => {
  systemNotificationToast?.classList.add('hidden');
});

function showPartnerNoteToast(senderName, noteText) {
  if (!petMessageToast) return;
  const titleEl = petMessageToast.querySelector('.toast-title');
  if (titleEl) titleEl.textContent = `Note from ${senderName}:`;
  if (toastMessageText) toastMessageText.textContent = `"${noteText}"`;

  petMessageToast.classList.remove('hidden');

  clearTimeout(toastDismissTimer);
  toastDismissTimer = setTimeout(() => {
    petMessageToast.classList.add('hidden');
  }, 8000);
}

// Backward-compatible router: general notices use clean system toast; love notes use petMessageToast
function showPartnerToast(title, text, isMessage = false) {
  if (isMessage) {
    showPartnerNoteToast('Partner', text);
  } else {
    showSystemToast(title, text, 'ℹ️');
  }
}

function openMessageModal() {
  if (petMessageModal) {
    petMessageModal.classList.remove('hidden');
    if (currentAppMode === 'pet') {
      window.electronAPI?.setFocusable?.(true);
      window.electronAPI?.setIgnoreMouseEvents(false);
    }
    setTimeout(() => {
      petMessageInput?.focus();
    }, 50);
  }
}

function closeMessageModal() {
  if (petMessageModal) {
    petMessageModal.classList.add('hidden');
    if (currentAppMode === 'pet') {
      if (!isAnyModalOpen()) {
        window.electronAPI?.setFocusable?.(false);
        window.electronAPI?.setIgnoreMouseEvents(true, { forward: true });
      }
    }
  }
}

btnTopSendNote?.addEventListener('click', openMessageModal);
btnPetActionMessage?.addEventListener('click', openMessageModal);
btnStudioSendNote?.addEventListener('click', openMessageModal);
btnClosePetMessage?.addEventListener('click', closeMessageModal);

btnToastReply?.addEventListener('click', () => {
  petMessageToast?.classList.add('hidden');
  openMessageModal();
});

btnToastClose?.addEventListener('click', () => {
  petMessageToast?.classList.add('hidden');
});

// Quick Preset Pills
document.querySelectorAll('.quick-note-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    const text = btn.dataset.text;
    if (petMessageInput) {
      petMessageInput.value = text;
      updateCharCount();
      petMessageInput.focus();
    }
  });
});

function updateCharCount() {
  if (petMessageInput && petMessageCharCount) {
    petMessageCharCount.textContent = `${petMessageInput.value.length} / 120`;
  }
}

petMessageInput?.addEventListener('input', updateCharCount);

function sendCurrentPetMessage() {
  const text = petMessageInput?.value?.trim();
  if (!text) {
    showPartnerToast('📝 Note Empty', 'Please enter a note to send!');
    return;
  }

  if (!peerSync.isConnected) {
    showPartnerToast('🔗 Partner Offline', 'Connect via P2P to exchange notes live!');
    closeMessageModal();
    openP2PModal();
    return;
  }

  // Transmit P2P
  peerSync.broadcastPetMessage(text);

  // Local pet visual delivery feedback
  petBehavior.setState('happy', 3.0);
  petBehavior.spawnParticle('💌', 3);
  petBehavior.spawnParticle('✨', 3);
  petBehavior.showBubble(`Delivering: "${text}" 💌`, 4000);

  if (petMessageInput) petMessageInput.value = '';
  updateCharCount();
  closeMessageModal();
}

btnSendPetMessage?.addEventListener('click', sendCurrentPetMessage);

petMessageInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendCurrentPetMessage();
  }
});

// Export / Import Pet Data
function exportPetData() {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(petModel.toJSON(), null, 2));
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute('href', dataStr);
  dlAnchor.setAttribute('download', `${petModel.name.toLowerCase()}_pet_data.json`);
  dlAnchor.click();
}

document.getElementById('btnExportPet')?.addEventListener('click', exportPetData);

const importFileInput = document.getElementById('importFileInput');
document.getElementById('btnImportPet')?.addEventListener('click', () => {
  importFileInput?.click();
});

importFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      petModel.fromJSON(data);
      canvasController.render();
      timelineController.render();
      updateStatsUI();
      peerSync.broadcastFullPet(petModel.toJSON());
      alert('Pet imported successfully!');
    } catch (err) {
      alert('Error importing JSON file: ' + err.message);
    }
  };
  reader.readAsText(file);
});

// Quotes Manager Controller
const navTabEditor = document.getElementById('navTabEditor');
const navTabQuotes = document.getElementById('navTabQuotes');
const editorWorkspace = document.getElementById('editorWorkspace');
const editorTimeline = document.getElementById('editorTimeline');
const stateTabsContainer = document.getElementById('stateTabsContainer');
const quotesWorkspace = document.getElementById('quotesWorkspace');
const quotesListContainer = document.getElementById('quotesListContainer');
const newQuoteInput = document.getElementById('newQuoteInput');
const btnAddQuote = document.getElementById('btnAddQuote');
const btnTestQuote = document.getElementById('btnTestQuote');
const btnResetQuotes = document.getElementById('btnResetQuotes');
const quoteCatIcon = document.getElementById('quoteCatIcon');
const quoteCatTitle = document.getElementById('quoteCatTitle');
const quoteCatDesc = document.getElementById('quoteCatDesc');

let currentQuoteCategory = 'scared';

const QUOTE_CATEGORIES = {
  scared: { icon: '🏃', title: 'Scared of Center Quotes', desc: 'Phrases spoken when the pet is dropped in the middle of the screen and sprints for safety.' },
  safe: { icon: '🛡️', title: 'Safe on Border Quotes', desc: 'Phrases spoken when the pet safely reaches a border or lands on solid ground.' },
  jump: { icon: '🦘', title: 'Ledge Jump Quotes', desc: 'Phrases spoken when jumping between different monitor heights or screen ledges.' },
  feed: { icon: '🍓', title: 'Eating Treats Quotes', desc: 'Phrases spoken when fed treats or strawberries.' },
  pet: { icon: '💖', title: 'Being Petted Quotes', desc: 'Phrases spoken when petted or cuddled.' },
  nudge: { icon: '✨', title: 'Love Nudges Quotes', desc: 'Phrases spoken when receiving a love nudge from your partner.' },
  sleep: { icon: '🌙', title: 'Sleep Time Quotes', desc: 'Phrases spoken when curling up to sleep.' },
  wake: { icon: '☀️', title: 'Waking Up Quotes', desc: 'Phrases spoken when waking up in the morning.' }
};

const quotesPetPreviewCanvas = document.getElementById('quotesPetPreviewCanvas');
const testQuoteBubble = document.getElementById('testQuoteBubble');

function getCategoryPreviewClip(cat) {
  switch (cat) {
    case 'scared': return 'walk';
    case 'jump': return 'happy';
    case 'feed': return 'eat';
    case 'pet': return 'happy';
    case 'nudge': return 'happy';
    case 'sleep': return 'sleep';
    case 'wake': return 'idle';
    case 'safe': return 'idle';
    default: return 'idle';
  }
}

function updateQuotesPreview(cat, specificText) {
  const quote = specificText || petModel.getRandomQuote(cat, 'Hello! 🐾');
  if (testQuoteBubble) {
    testQuoteBubble.textContent = quote;
    testQuoteBubble.style.animation = 'none';
    void testQuoteBubble.offsetWidth;
    testQuoteBubble.style.animation = 'bubblePop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
  }

  if (quotesPetPreviewCanvas) {
    const clipName = getCategoryPreviewClip(cat);
    petRenderer.renderFrame(quotesPetPreviewCanvas, clipName, 0, false);
  }

  // Also play on desktop overlay bubble if pet behavior is active
  petBehavior.showBubble(quote, 3000);
}

const navTabSettings = document.getElementById('navTabSettings');
const settingsWorkspace = document.getElementById('settingsWorkspace');

function syncSettingsUI() {
  const soundToggle = document.getElementById('settingSoundToggle');
  const volumeRange = document.getElementById('settingVolumeRange');
  const volumeLabel = document.getElementById('settingVolumeLabel');
  const toolSoundsToggle = document.getElementById('settingToolSoundsToggle');
  const btnSoundsToggle = document.getElementById('settingButtonSoundsToggle');
  const notifySoundsToggle = document.getElementById('settingNotifySoundsToggle');
  const roamToggle = document.getElementById('settingMultiMonitorToggle');

  if (soundToggle) soundToggle.checked = soundManager.soundEnabled;
  if (volumeRange) {
    const pct = Math.round(soundManager.volume * 100);
    volumeRange.value = pct;
    if (volumeLabel) volumeLabel.textContent = `${pct}%`;
  }
  if (toolSoundsToggle) toolSoundsToggle.checked = soundManager.toolSoundsEnabled;
  if (btnSoundsToggle) btnSoundsToggle.checked = soundManager.buttonSoundsEnabled;
  if (notifySoundsToggle) notifySoundsToggle.checked = soundManager.notifySoundsEnabled;
  if (roamToggle) roamToggle.checked = (localStorage.getItem('coop_pet_multimonitor') === 'true');

  const settingP2pStatusDesc = document.getElementById('settingP2pStatusDesc');
  const settingP2pStatusBadge = document.getElementById('settingP2pStatusBadge');
  const btnSettingsDisconnect = document.getElementById('btnSettingsDisconnect');
  if (peerSync && peerSync.isConnected) {
    if (settingP2pStatusDesc) settingP2pStatusDesc.textContent = `Connected to room: ${peerSync.roomCode || ''}`;
    if (settingP2pStatusBadge) {
      settingP2pStatusBadge.textContent = `Connected (${peerSync.roomCode || ''})`;
      settingP2pStatusBadge.className = 'p2p-status-badge connected';
    }
    btnSettingsDisconnect?.classList.remove('hidden');
  } else {
    if (settingP2pStatusDesc) settingP2pStatusDesc.textContent = 'Offline (Not connected)';
    if (settingP2pStatusBadge) {
      settingP2pStatusBadge.textContent = 'Offline';
      settingP2pStatusBadge.className = 'p2p-status-badge';
    }
    btnSettingsDisconnect?.classList.add('hidden');
  }
}

function switchStudioSubView(view) {
  currentStudioSubView = view;
  navTabEditor?.classList.toggle('active', view === 'editor');
  navTabQuotes?.classList.toggle('active', view === 'quotes');
  navTabSettings?.classList.toggle('active', view === 'settings');

  editorWorkspace?.classList.toggle('hidden', view !== 'editor');
  editorTimeline?.classList.toggle('hidden', view !== 'editor');
  quotesWorkspace?.classList.toggle('hidden', view !== 'quotes');
  settingsWorkspace?.classList.toggle('hidden', view !== 'settings');

  if (view !== 'editor') {
    canvasController?.clearRemoteCursor();
  }

  if (view === 'editor') {
    const activeClip = timelineController.currentClip || 'idle';
    const activeIndex = timelineController.currentFrameIndex || 0;

    clipTabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.clip === activeClip);
    });

    canvasController.setClipAndFrame(activeClip, activeIndex);
    timelineController.render();
    timelineController.updateCurrentThumb();
    updateFrameCountBadge();
  } else if (view === 'quotes') {
    renderQuotesCategory(currentQuoteCategory);
  } else if (view === 'settings') {
    syncSettingsUI();
  }
}

navTabEditor?.addEventListener('click', () => switchStudioSubView('editor'));
navTabQuotes?.addEventListener('click', () => switchStudioSubView('quotes'));
navTabSettings?.addEventListener('click', () => switchStudioSubView('settings'));

// Settings Event Listeners
document.getElementById('settingSoundToggle')?.addEventListener('change', (e) => {
  soundManager.setSoundEnabled(e.target.checked);
});
document.getElementById('settingVolumeRange')?.addEventListener('input', (e) => {
  const val = parseInt(e.target.value, 10) / 100;
  soundManager.setVolume(val);
  const volumeLabel = document.getElementById('settingVolumeLabel');
  if (volumeLabel) volumeLabel.textContent = `${e.target.value}%`;
});
document.getElementById('settingToolSoundsToggle')?.addEventListener('change', (e) => {
  soundManager.setToolSoundsEnabled(e.target.checked);
});
document.getElementById('settingButtonSoundsToggle')?.addEventListener('change', (e) => {
  soundManager.setButtonSoundsEnabled(e.target.checked);
});
document.getElementById('settingNotifySoundsToggle')?.addEventListener('change', (e) => {
  soundManager.setNotifySoundsEnabled(e.target.checked);
});
document.getElementById('settingMultiMonitorToggle')?.addEventListener('change', (e) => {
  setMultiMonitorRoaming(e.target.checked);
});
document.getElementById('btnSettingsOpenP2P')?.addEventListener('click', openP2PModal);
document.getElementById('btnSettingsDisconnect')?.addEventListener('click', handleDisconnectUser);
document.getElementById('btnSettingsExportPet')?.addEventListener('click', exportPetData);
document.getElementById('btnSettingsImportPet')?.addEventListener('click', () => {
  importFileInput?.click();
});

// Fullscreen Animation Theater Preview Controller
const fullscreenPreviewModal = document.getElementById('fullscreenPreviewModal');
const btnOpenFullscreenPreview = document.getElementById('btnOpenFullscreenPreview');
const btnCloseFsModal = document.getElementById('btnCloseFsModal');
const fsClipNameBadge = document.getElementById('fsClipNameBadge');
const fsClipTabs = document.querySelectorAll('.fs-clip-tab');
const btnFsPlayToggle = document.getElementById('btnFsPlayToggle');
const fsSpeedRange = document.getElementById('fsSpeedRange');
const fsSpeedLabel = document.getElementById('fsSpeedLabel');

function openFullscreenPreview() {
  isFullscreenModalOpen = true;
  fsActiveClip = canvasController.currentClip || 'idle';
  fsFrameIndex = 0;
  if (fsClipNameBadge) {
    fsClipNameBadge.textContent = fsActiveClip.charAt(0).toUpperCase() + fsActiveClip.slice(1);
  }
  fsClipTabs.forEach(t => t.classList.toggle('active', t.dataset.clip === fsActiveClip));
  if (fsSpeedRange) {
    fsSpeedRange.value = petModel.fps;
    if (fsSpeedLabel) fsSpeedLabel.textContent = `${petModel.fps} FPS`;
  }
  fullscreenPreviewModal?.classList.remove('hidden');
}

function closeFullscreenPreview() {
  isFullscreenModalOpen = false;
  fullscreenPreviewModal?.classList.add('hidden');
}

btnOpenFullscreenPreview?.addEventListener('click', openFullscreenPreview);
btnCloseFsModal?.addEventListener('click', closeFullscreenPreview);

fsClipTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    fsActiveClip = tab.dataset.clip;
    fsFrameIndex = 0;
    fsClipTabs.forEach(t => t.classList.toggle('active', t.dataset.clip === fsActiveClip));
    if (fsClipNameBadge) {
      fsClipNameBadge.textContent = fsActiveClip.charAt(0).toUpperCase() + fsActiveClip.slice(1);
    }
  });
});

btnFsPlayToggle?.addEventListener('click', () => {
  isFullscreenPlaying = !isFullscreenPlaying;
  btnFsPlayToggle.textContent = isFullscreenPlaying ? '⏸ Pause' : '▶ Play';
});

fsSpeedRange?.addEventListener('input', (e) => {
  const fps = parseInt(e.target.value, 10);
  petModel.fps = fps;
  if (fpsRange) fpsRange.value = fps;
  if (fpsLabel) fpsLabel.textContent = `${fps} FPS`;
  if (fsSpeedLabel) fsSpeedLabel.textContent = `${fps} FPS`;
});

function renderQuotesCategory(cat) {
  currentQuoteCategory = cat;
  const meta = QUOTE_CATEGORIES[cat] || QUOTE_CATEGORIES.scared;
  if (quoteCatIcon) quoteCatIcon.textContent = meta.icon;
  if (quoteCatTitle) quoteCatTitle.textContent = meta.title;
  if (quoteCatDesc) quoteCatDesc.textContent = meta.desc;

  // Highlight active category button
  document.querySelectorAll('.quote-category-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === cat);
  });

  if (!quotesListContainer) return;
  quotesListContainer.innerHTML = '';
  const list = petModel.quotes[cat] || [];

  if (list.length === 0) {
    quotesListContainer.innerHTML = '<div style="font-size:12px; color:#8087a2; padding:8px;">No quotes in this category yet. Add one below!</div>';
    updateQuotesPreview(cat, '...');
    return;
  }

  list.forEach((quote, idx) => {
    const card = document.createElement('div');
    card.className = 'quote-item-card';
    card.style.cursor = 'pointer';
    card.setAttribute('data-tooltip', 'Click to preview this quote in the live speech bubble!');

    const bubble = document.createElement('div');
    bubble.className = 'quote-bubble-preview';
    bubble.textContent = `"${quote}"`;

    const delBtn = document.createElement('button');
    delBtn.style.padding = '4px 8px';
    delBtn.style.color = '#ed8796';
    delBtn.style.fontSize = '12px';
    delBtn.innerHTML = '🗑️';
    delBtn.title = 'Delete quote';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      petModel.removeQuote(cat, idx);
      renderQuotesCategory(cat);
      peerSync.broadcastFullPet(petModel.toJSON());
    });

    card.addEventListener('click', () => {
      updateQuotesPreview(cat, quote);
    });

    card.appendChild(bubble);
    card.appendChild(delBtn);
    quotesListContainer.appendChild(card);
  });

  updateQuotesPreview(cat);
}

document.querySelectorAll('.quote-category-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    renderQuotesCategory(btn.dataset.category);
  });
});

btnAddQuote?.addEventListener('click', () => {
  const text = newQuoteInput?.value?.trim();
  if (!text) return;
  petModel.addQuote(currentQuoteCategory, text);
  if (newQuoteInput) newQuoteInput.value = '';
  renderQuotesCategory(currentQuoteCategory);
  updateQuotesPreview(currentQuoteCategory, text);
  peerSync.broadcastFullPet(petModel.toJSON());
});

newQuoteInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    btnAddQuote?.click();
  }
});

btnTestQuote?.addEventListener('click', () => {
  updateQuotesPreview(currentQuoteCategory);
});

btnResetQuotes?.addEventListener('click', () => {
  if (confirm(`Reset ${QUOTE_CATEGORIES[currentQuoteCategory]?.title || ''} to default phrases?`)) {
    petModel.resetQuotes(currentQuoteCategory);
    renderQuotesCategory(currentQuoteCategory);
    peerSync.broadcastFullPet(petModel.toJSON());
  }
});

// Status Bar Toggle via Hotkey (Ctrl+Shift+H / Ctrl+H)
function toggleStatusWidget() {
  if (desktopTopWidget) {
    desktopTopWidget.classList.toggle('hidden');
  }
}

window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && (e.key === 'H' || e.key === 'h')) {
    e.preventDefault();
    toggleStatusWidget();
  } else if ((e.ctrlKey || e.metaKey) && (e.key === 'L' || e.key === 'l')) {
    e.preventDefault();
    togglePetLock();
  } else if ((e.ctrlKey || e.metaKey) && (e.key === 'W' || e.key === 'w')) {
    if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
      e.preventDefault();
      togglePetWalking();
    }
  }
});

window.electronAPI?.onToggleStatusWidget?.(() => {
  toggleStatusWidget();
});

window.electronAPI?.onTogglePetLock?.(() => {
  togglePetLock();
});

window.electronAPI?.onTogglePetWalking?.(() => {
  togglePetWalking();
});

window.electronAPI?.onAppModeChanged?.((mode) => {
  if (mode === currentAppMode) return;
  if (mode === 'studio') {
    switchToStudio();
  } else if (mode === 'pet') {
    switchToPet();
  }
});

document.getElementById('btnTopToggleLock')?.addEventListener('click', () => {
  togglePetLock();
});

document.getElementById('btnTopToggleWalk')?.addEventListener('click', () => {
  togglePetWalking();
});

document.getElementById('lockForGamingToggle')?.addEventListener('change', (e) => {
  setPetLocked(e.target.checked);
});

document.getElementById('btnHideWidgetFromPet')?.addEventListener('click', () => {
  toggleStatusWidget();
});

document.getElementById('btnClosePetToStudio')?.addEventListener('click', () => {
  switchToStudio();
});

// Escape key safety handler: close open modals and unblock desktop
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    let closedAny = false;
    if (p2pModal && !p2pModal.classList.contains('hidden')) {
      closeP2PModal();
      closedAny = true;
    }
    if (petMessageModal && !petMessageModal.classList.contains('hidden')) {
      closeMessageModal();
      closedAny = true;
    }
    if (fullscreenPreviewModal && !fullscreenPreviewModal.classList.contains('hidden')) {
      closeFullscreenPreview();
      closedAny = true;
    }
    const versionMismatchModal = document.getElementById('versionMismatchModal');
    if (versionMismatchModal && !versionMismatchModal.classList.contains('hidden')) {
      versionMismatchModal.classList.add('hidden');
      closedAny = true;
    }
    if (currentAppMode === 'pet' && closedAny) {
      if (!isAnyModalOpen()) {
        window.electronAPI?.setIgnoreMouseEvents(true, { forward: true });
      }
    }
  }
});

// Periodic Stat Decay (tamagotchi health cycle)
setInterval(() => {
  petModel.decayStats();
  updateStatsUI();
}, 60000);

try {
  updateStatsUI();
  updateFrameCountBadge();
  updateLockUI();
} catch (err) {
  console.error('Initialization error during UI setup:', err);
}

// Start in Studio mode initially
try {
  switchToStudio();
} catch (err) {
  console.error('Error switching to studio on startup:', err);
}

