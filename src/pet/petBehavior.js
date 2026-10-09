// Desktop Pet Behavior Controller & Multi-Monitor Edge State Machine

export class PetBehaviorController {
  constructor({
    petModel,
    petRenderer,
    petCanvas,
    petContainer,
    bubbleElement,
    onCareAction
  }) {
    this.petModel = petModel;
    this.petRenderer = petRenderer;
    this.petCanvas = petCanvas;
    this.petContainer = petContainer;
    this.bubbleElement = bubbleElement;
    this.actionsDock = petContainer ? petContainer.querySelector('.pet-actions-dock') : null;
    this.currentDockMode = null;
    this.isLocked = false;
    this.onCareAction = onCareAction || (() => {});

    this.petSize = 96; // Rendered pet bounding box size

    // Multi-Monitor display list (local window coordinates)
    this.displays = [
      {
        id: 'primary',
        localBounds: { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }
      }
    ];

    // Position & Movement
    this.x = window.innerWidth / 2 - 48;
    this.y = window.innerHeight - 110;
    this.vx = 0;
    this.vy = 0;
    this.direction = 1; // 1 = right, -1 = left
    this.currentEdge = 'bottom'; // 'bottom', 'top', 'left', 'right'

    // Configuration
    this.allowWalking = true;
    this.walkCooldown = 12 + Math.random() * 8; // 12-20s calm rest between edge strolls

    // State machine
    this.state = 'idle'; // 'idle', 'walk', 'happy', 'eat', 'sleep'
    this.frameIndex = 0;
    this.stateTimer = 0;
    this.isDragging = false;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;

    // Fleeing / Jumping states
    this.isFleeing = false;
    this.fleeTarget = null;
    this.isJumping = false;
    this.jumpAnimation = null;

    this.initDragEvents();
    this.spawnAtBottomBorder();
    this.startLoop();
  }

  setDisplays(displayList) {
    if (displayList && displayList.length > 0) {
      this.displays = displayList;
      this.preventDeadSpace();
    }
  }

  getCurrentDisplay() {
    const cx = this.x + this.petSize / 2;
    const cy = this.y + this.petSize / 2;

    for (const d of this.displays) {
      const b = d.localBounds;
      if (cx >= b.x && cx <= b.x + b.width && cy >= b.y && cy <= b.y + b.height) {
        return d;
      }
    }
    // If not found in any display (in dead/empty space), return closest display
    return this.getClosestDisplay(cx, cy);
  }

  getClosestDisplay(x, y) {
    let closest = this.displays[0];
    let minDistance = Infinity;

    for (const d of this.displays) {
      const b = d.localBounds;
      const centerX = b.x + b.width / 2;
      const centerY = b.y + b.height / 2;
      const dist = Math.hypot(x - centerX, y - centerY);
      if (dist < minDistance) {
        minDistance = dist;
        closest = d;
      }
    }
    return closest;
  }

  preventDeadSpace() {
    const disp = this.getCurrentDisplay();
    if (!disp) return;

    const b = disp.localBounds;
    const minX = b.x;
    const maxX = b.x + b.width - this.petSize;
    const minY = b.y;
    const maxY = b.y + b.height - this.petSize;

    // If outside this monitor's bounds, clamp it onto this monitor
    const clampedX = Math.max(minX, Math.min(this.x, maxX));
    const clampedY = Math.max(minY, Math.min(this.y, maxY));

    if (clampedX !== this.x || clampedY !== this.y) {
      this.x = clampedX;
      this.y = clampedY;
      this.updatePosition();
    }
  }

  spawnAtBottomBorder() {
    const disp = this.getCurrentDisplay();
    if (disp) {
      const b = disp.localBounds;
      this.x = b.x + b.width / 2 - this.petSize / 2;
      this.y = b.y + b.height - this.petSize;
      this.currentEdge = 'bottom';
      this.updatePosition();
    }
  }

  setState(newState, durationSec = 0) {
    this.state = newState;
    this.frameIndex = 0;
    this.stateTimer = durationSec;

    const clip = this.petModel.getClip(newState);
    if (!clip || clip.length === 0) {
      this.state = 'idle';
    }

    this.renderCurrent();
  }

  showBubble(text, durationMs = 2500) {
    if (!this.bubbleElement) return;
    this.bubbleElement.textContent = text;
    this.bubbleElement.classList.add('active');

    if (!this.bubbleElement._hasDismissListener) {
      this.bubbleElement._hasDismissListener = true;
      this.bubbleElement.style.pointerEvents = 'auto';
      this.bubbleElement.style.cursor = 'pointer';
      this.bubbleElement.title = 'Click to dismiss';
      this.bubbleElement.addEventListener('click', () => {
        this.bubbleElement.classList.remove('active');
      });
    }

    clearTimeout(this.bubbleTimeout);
    this.bubbleTimeout = setTimeout(() => {
      this.bubbleElement.classList.remove('active');
    }, durationMs);
  }

  showPetMessage(senderName, text, durationMs = 7000) {
    this.setState('happy', 4.0);
    this.spawnParticle('💌', 3);
    this.spawnParticle('💖', 2);
    this.spawnParticle('✨', 3);
    this.showBubble(`💌 ${senderName}: "${text}"`, durationMs);
  }

  spawnParticle(emoji, count = 1) {
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.textContent = emoji;
      
      const rect = this.petContainer.getBoundingClientRect();
      p.style.left = `${rect.left + rect.width / 2 + (Math.random() * 40 - 20)}px`;
      p.style.top = `${rect.top + 20}px`;
      p.style.setProperty('--dx', `${(Math.random() - 0.5) * 60}px`);

      document.body.appendChild(p);
      setTimeout(() => p.remove(), 1200);
    }
  }

  feedPet(triggerNetwork = true) {
    this.petModel.feed(25);
    this.setState('eat', 3.0);
    const quote = this.petModel.getRandomQuote('feed', 'Yummy! 🍓');
    this.showBubble(quote);
    this.spawnParticle('🍓', 3);
    if (triggerNetwork) {
      this.onCareAction('feed', { quote });
    }
  }

  petPet(triggerNetwork = true) {
    this.petModel.pet(20);
    this.setState('happy', 3.0);
    const quote = this.petModel.getRandomQuote('pet', 'Purr~ <3');
    this.showBubble(quote);
    this.spawnParticle('💖', 4);
    if (triggerNetwork) {
      this.onCareAction('pet', { quote });
    }
  }

  sendNudge(triggerNetwork = true) {
    this.setState('happy', 3.0);
    const quote = this.petModel.getRandomQuote('nudge', 'Thinking of you! ✨');
    this.showBubble(quote);
    this.spawnParticle('✨', 5);
    if (triggerNetwork) {
      this.onCareAction('nudge', { quote });
    }
  }

  toggleSleep(triggerNetwork = true) {
    if (this.state === 'sleep') {
      this.setState('idle');
      const quote = this.petModel.getRandomQuote('wake', 'Good morning! ☀️');
      this.showBubble(quote);
      this.spawnParticle('☀️', 3);
      if (triggerNetwork) {
        this.onCareAction('wake', { quote });
      }
    } else {
      this.setState('sleep');
      const quote = this.petModel.getRandomQuote('sleep', 'Zzz... 🌙');
      this.showBubble(quote);
      this.spawnParticle('🌙', 3);
      if (triggerNetwork) {
        this.onCareAction('sleep', { quote });
      }
    }
  }

  setLockState(locked) {
    this.isLocked = !!locked;
    this.petContainer?.classList.toggle('is-locked', this.isLocked);
  }

  initDragEvents() {
    let startX = 0;
    let startY = 0;
    let totalMoved = 0;

    const onMouseDown = (e) => {
      // Only block dragging if locked or if clicking an actual action button
      if (this.isLocked || e.target.closest('.pet-action-btn')) return;
      this.isDragging = true;
      this.isFleeing = false;
      this.isJumping = false;
      this.jumpAnimation = null;
      if (this.state === 'walk') {
        this.setState('idle');
      }

      this.petContainer.classList.add('is-dragging');

      startX = e.clientX;
      startY = e.clientY;
      totalMoved = 0;

      const rect = this.petContainer.getBoundingClientRect();
      this.dragOffsetX = e.clientX - rect.left;
      this.dragOffsetY = e.clientY - rect.top;
    };

    const onMouseMove = (e) => {
      if (!this.isDragging) return;
      totalMoved += Math.hypot(e.movementX || 0, e.movementY || 0);
      this.x = e.clientX - this.dragOffsetX;
      this.y = e.clientY - this.dragOffsetY;
      this.updatePosition();
    };

    const onMouseUp = () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.petContainer.classList.remove('is-dragging');
        // If moved less than 8px, count as direct petting tap on the pet!
        if (totalMoved < 8) {
          this.petPet(true);
        } else {
          this.checkDroppedSafety();
        }
      }
    };

    this.petContainer.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  /**
   * "Scared of the Middle": When dropped in open center, runs back to closest border
   */
  checkDroppedSafety() {
    const disp = this.getCurrentDisplay();
    if (!disp) return;

    const b = disp.localBounds;
    const threshold = 55; // Pixels distance to consider "on border"

    const dBottom = Math.abs(this.y - (b.y + b.height - this.petSize));
    const dTop = Math.abs(this.y - b.y);
    const dLeft = Math.abs(this.x - b.x);
    const dRight = Math.abs(this.x - (b.x + b.width - this.petSize));

    const minDistance = Math.min(dBottom, dTop, dLeft, dRight);

    if (minDistance <= threshold) {
      // Safely close to a border - snap to it
      if (minDistance === dBottom) {
        this.y = b.y + b.height - this.petSize;
        this.currentEdge = 'bottom';
      } else if (minDistance === dTop) {
        this.y = b.y;
        this.currentEdge = 'top';
      } else if (minDistance === dLeft) {
        this.x = b.x;
        this.currentEdge = 'left';
      } else {
        this.x = b.x + b.width - this.petSize;
        this.currentEdge = 'right';
      }
      this.updatePosition();
      this.setState('idle');
      this.showBubble(this.petModel.getRandomQuote('safe', 'Cozy! 🐾'));
    } else {
      // In the middle of the screen! Pet is scared and runs to the nearest edge
      this.isFleeing = true;
      this.setState('walk');
      this.showBubble(this.petModel.getRandomQuote('scared', 'Eep! Too open! 🏃💨'), 2000);
      this.spawnParticle('💨', 3);

      let targetX = this.x;
      let targetY = this.y;
      let targetEdge = 'bottom';

      if (minDistance === dBottom) {
        targetY = b.y + b.height - this.petSize;
        targetEdge = 'bottom';
      } else if (minDistance === dTop) {
        targetY = b.y;
        targetEdge = 'top';
      } else if (minDistance === dLeft) {
        targetX = b.x;
        targetEdge = 'left';
      } else {
        targetX = b.x + b.width - this.petSize;
        targetEdge = 'right';
      }

      this.fleeTarget = { x: targetX, y: targetY, edge: targetEdge };
    }
  }

  /**
   * Jump animation between monitors or ledges
   */
  startJump(targetX, targetY, onComplete) {
    this.isJumping = true;
    this.setState('happy');
    this.showBubble(this.petModel.getRandomQuote('jump', 'Hup! 🐾'), 1200);
    this.spawnParticle('✨', 3);

    const startX = this.x;
    const startY = this.y;
    const startTime = performance.now();
    const duration = 750; // ms
    const arcHeight = Math.max(50, Math.abs(targetY - startY) * 0.5 + 40);

    this.jumpAnimation = {
      startX,
      startY,
      targetX,
      targetY,
      startTime,
      duration,
      arcHeight,
      onComplete
    };
  }

  updatePosition() {
    this.petContainer.style.left = `${this.x}px`;
    this.petContainer.style.top = `${this.y}px`;

    const disp = this.getCurrentDisplay();
    if (disp) {
      const b = disp.localBounds;
      const topSpace = this.y - b.y;
      const bottomSpace = (b.y + b.height) - (this.y + this.petSize);

      // Detect top vs bottom screen edge:
      // When at bottom of screen, dock flips to TOP of pet, and quote stacks above dock.
      // When at top of screen, dock is on BOTTOM of pet, and quote stacks below dock.
      // In middle area, quote is on top, dock is on bottom.
      let mode = 'split';
      if (bottomSpace < 80) {
        mode = 'bottom-edge';
      } else if (topSpace < 60) {
        mode = 'top-edge';
      }

      if (this.currentDockMode !== mode) {
        this.currentDockMode = mode;
        this.petContainer.classList.remove('pos-bottom-edge', 'pos-top-edge', 'pos-split');
        this.petContainer.classList.add(`pos-${mode}`);
      }

      // Horizontal edge protection: shift dock & bubble if too close to screen left/right
      const petCenterX = this.x + this.petSize / 2;

      if (this.actionsDock) {
        const dockHalfWidth = 125;
        let shiftX = 0;
        if (petCenterX - dockHalfWidth < b.x + 8) {
          shiftX = (b.x + 8) - (petCenterX - dockHalfWidth);
        } else if (petCenterX + dockHalfWidth > b.x + b.width - 8) {
          shiftX = (b.x + b.width - 8) - (petCenterX + dockHalfWidth);
        }
        this.actionsDock.style.setProperty('--dock-shift-x', `${shiftX}px`);
      }

      if (this.bubbleElement) {
        const bubbleWidth = this.bubbleElement.offsetWidth || 140;
        const bubbleHalfWidth = bubbleWidth / 2;
        let shiftX = 0;
        if (petCenterX - bubbleHalfWidth < b.x + 8) {
          shiftX = (b.x + 8) - (petCenterX - bubbleHalfWidth);
        } else if (petCenterX + bubbleHalfWidth > b.x + b.width - 8) {
          shiftX = (b.x + b.width - 8) - (petCenterX + bubbleHalfWidth);
        }
        this.bubbleElement.style.setProperty('--bubble-shift-x', `${shiftX}px`);
      }
    }
  }

  renderCurrent() {
    const flip = this.direction < 0;
    this.petRenderer.renderFrame(this.petCanvas, this.state, this.frameIndex, flip);
  }

  startLoop() {
    let lastTime = performance.now();
    let frameAcc = 0;

    const tick = (now) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      // 1. Handle Active Jump Animation (Parabolic arc)
      if (this.isJumping && this.jumpAnimation) {
        const anim = this.jumpAnimation;
        const elapsed = now - anim.startTime;
        const progress = Math.min(1, elapsed / anim.duration);

        // Smooth ease
        const t = progress;
        this.x = anim.startX + (anim.targetX - anim.startX) * t;
        // Parabolic arc: base linear lerp minus sine curve for height
        const linearY = anim.startY + (anim.targetY - anim.startY) * t;
        const arc = Math.sin(t * Math.PI) * anim.arcHeight;
        this.y = linearY - arc;
        this.updatePosition();

        if (progress >= 1) {
          this.isJumping = false;
          this.x = anim.targetX;
          this.y = anim.targetY;
          this.updatePosition();
          this.setState('idle');
          this.showBubble(this.petModel.getRandomQuote('safe', 'Landed! 🐾'), 1800);
          this.spawnParticle('✨', 2);
          if (anim.onComplete) anim.onComplete();
          this.jumpAnimation = null;
        }
      }
      // 2. Handle Fleeing to Safety (Running from center)
      else if (this.isFleeing && this.fleeTarget) {
        const speed = 320 * dt; // Fast panic sprint
        const dx = this.fleeTarget.x - this.x;
        const dy = this.fleeTarget.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 5) {
          this.direction = dx >= 0 ? 1 : -1;
          this.x += (dx / dist) * Math.min(speed, dist);
          this.y += (dy / dist) * Math.min(speed, dist);
          this.updatePosition();
        } else {
          // Reached the border!
          this.x = this.fleeTarget.x;
          this.y = this.fleeTarget.y;
          this.currentEdge = this.fleeTarget.edge;
          this.isFleeing = false;
          this.fleeTarget = null;
          this.updatePosition();
          this.setState('idle');
          this.showBubble(this.petModel.getRandomQuote('safe', 'Phew! Safe! 🐾'), 2000);
          this.spawnParticle('💖', 3);
          this.walkCooldown = 15; // Rest before next calm stroll
        }
      }
      // 3. Normal Idle & Border Edge Movement
      else if (!this.isDragging && this.state !== 'sleep') {
        const disp = this.getCurrentDisplay();

        if (disp) {
          const b = disp.localBounds;

          // State durations
          if (this.stateTimer > 0) {
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
              this.setState('idle');
              this.walkCooldown = 12 + Math.random() * 10;
            }
          } else if (this.allowWalking) {
            this.walkCooldown -= dt;
            if (this.walkCooldown <= 0 && this.state === 'idle') {
              // Trigger a peaceful walk along the edge (4 to 7 seconds)
              this.direction = Math.random() < 0.5 ? 1 : -1;
              this.setState('walk', 4.0 + Math.random() * 3.0);
            }
          }

          // Walking along current edge
          if (this.state === 'walk') {
            const walkSpeed = 48 * dt;

            if (this.currentEdge === 'bottom') {
              this.y = b.y + b.height - this.petSize; // Locked to bottom edge
              this.x += this.direction * walkSpeed;

              // Check right edge
              const rightBoundary = b.x + b.width - this.petSize;
              const leftBoundary = b.x;

              // If approaching right edge, check for adjacent monitor on right
              if (this.x >= rightBoundary) {
                const adjRight = this.displays.find(d => 
                  d.id !== disp.id && 
                  d.localBounds.x >= b.x + b.width - 20 &&
                  d.localBounds.x <= b.x + b.width + 60
                );

                if (adjRight) {
                  // Adjacent monitor found! Leap across to the other monitor!
                  const targetY = adjRight.localBounds.y + adjRight.localBounds.height - this.petSize;
                  const targetX = adjRight.localBounds.x + 20;
                  this.startJump(targetX, targetY, () => {
                    this.currentEdge = 'bottom';
                  });
                } else {
                  // No monitor to the right - turn corner onto right edge or turn around!
                  if (Math.random() < 0.5) {
                    this.direction = -1; // Turn around
                  } else {
                    this.currentEdge = 'right';
                    this.direction = -1; // Climb up
                  }
                }
              }
              // If approaching left edge, check for adjacent monitor on left
              else if (this.x <= leftBoundary) {
                const adjLeft = this.displays.find(d => 
                  d.id !== disp.id && 
                  d.localBounds.x + d.localBounds.width >= b.x - 60 &&
                  d.localBounds.x + d.localBounds.width <= b.x + 20
                );

                if (adjLeft) {
                  // Adjacent monitor to the left! Leap across!
                  const targetY = adjLeft.localBounds.y + adjLeft.localBounds.height - this.petSize;
                  const targetX = adjLeft.localBounds.x + adjLeft.localBounds.width - this.petSize - 20;
                  this.startJump(targetX, targetY, () => {
                    this.currentEdge = 'bottom';
                  });
                } else {
                  // No monitor to the left - turn corner onto left edge or turn around!
                  if (Math.random() < 0.5) {
                    this.direction = 1; // Turn around
                  } else {
                    this.currentEdge = 'left';
                    this.direction = -1; // Climb up
                  }
                }
              }
            } 
            else if (this.currentEdge === 'top') {
              this.y = b.y; // Locked to top edge
              this.x += this.direction * walkSpeed;
              if (this.x >= b.x + b.width - this.petSize) {
                this.direction = -1;
              } else if (this.x <= b.x) {
                this.direction = 1;
              }
            } 
            else if (this.currentEdge === 'left') {
              this.x = b.x; // Locked to left edge
              this.y += this.direction * walkSpeed;
              if (this.y >= b.y + b.height - this.petSize) {
                this.currentEdge = 'bottom';
                this.direction = 1;
              } else if (this.y <= b.y) {
                this.currentEdge = 'top';
                this.direction = 1;
              }
            } 
            else if (this.currentEdge === 'right') {
              this.x = b.x + b.width - this.petSize; // Locked to right edge
              this.y += this.direction * walkSpeed;
              if (this.y >= b.y + b.height - this.petSize) {
                this.currentEdge = 'bottom';
                this.direction = -1;
              } else if (this.y <= b.y) {
                this.currentEdge = 'top';
                this.direction = -1;
              }
            }

            this.updatePosition();
          }
        }
      }

      // Animation frame advancement
      const fps = Math.max(2, this.petModel.fps);
      frameAcc += dt;
      if (frameAcc >= 1 / fps) {
        frameAcc = 0;
        const clip = this.petModel.getClip(this.state);
        if (clip && clip.length > 0) {
          this.frameIndex = (this.frameIndex + 1) % clip.length;
          this.renderCurrent();
        }
      }

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }
}
