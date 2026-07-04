/**
 * Lightweight Custom SVG/CSS Virtual Joystick & Action Buttons for Mobile Devices.
 * Generates normalized direction vectors and replicates key presses for Jump/Boost.
 */
export class MobileControls {
  private container!: HTMLDivElement;
  private knob!: SVGElement;
  private jumpBtn!: HTMLDivElement;
  private boostBtn!: HTMLDivElement;

  private joystickActive = false;
  private joystickCenter = { x: 0, y: 0 };
  private joystickVector = { x: 0, y: 0 };
  private maxRadius = 40; // max drag radius in pixels
  private joystickTouchId: number | null = null;

  private onJumpChangeCallback?: (pressed: boolean) => void;
  private onBoostChangeCallback?: (pressed: boolean) => void;

  constructor() {
    this.createDOM();
    this.setupListeners();
  }

  private createDOM(): void {
    // Check if element already exists
    const existing = document.getElementById('mobile-controls-layer');
    if (existing) {
      this.container = existing as HTMLDivElement;
      this.knob = document.getElementById('joystick-knob') as unknown as SVGElement;
      this.jumpBtn = document.querySelector('.btn-jump') as HTMLDivElement;
      this.boostBtn = document.querySelector('.btn-boost') as HTMLDivElement;
      return;
    }

    // Create main overlay layer
    this.container = document.createElement('div');
    this.container.id = 'mobile-controls-layer';
    this.container.className = 'mobile-controls-layer';

    // 1. Virtual Joystick UI Component (SVG overlay)
    const joystickDiv = document.createElement('div');
    joystickDiv.className = 'mobile-joystick-container';
    joystickDiv.innerHTML = `
      <svg class="mobile-joystick-svg" viewBox="0 0 120 120">
        <!-- Outer ring with neon glow -->
        <circle cx="60" cy="60" r="50" fill="rgba(12, 15, 29, 0.45)" stroke="#00f0ff" stroke-width="2.5" opacity="0.8" style="filter: drop-shadow(0 0 4px rgba(0, 240, 255, 0.4));" />
        <circle cx="60" cy="60" r="28" fill="none" stroke="#00f0ff" stroke-width="1" stroke-dasharray="3 3" opacity="0.3" />
        <!-- Inner knob (centered at 60,60 initially) -->
        <g id="joystick-knob" transform="translate(60, 60)">
          <circle cx="0" cy="0" r="20" fill="rgba(255, 0, 127, 0.75)" stroke="#ff007f" stroke-width="2" style="filter: drop-shadow(0 0 6px rgba(255, 0, 127, 0.7));" />
          <circle cx="0" cy="0" r="5" fill="#ffffff" opacity="0.9" />
        </g>
      </svg>
    `;

    // 2. Action Buttons (Jump & Boost)
    const actionDiv = document.createElement('div');
    actionDiv.className = 'mobile-action-buttons';
    actionDiv.innerHTML = `
      <div class="mobile-btn btn-boost">
        <span>BOOST</span>
        <span class="mobile-btn-sub">SHIFT</span>
      </div>
      <div class="mobile-btn btn-jump">
        <span>JUMP</span>
        <span class="mobile-btn-sub">SPACE</span>
      </div>
    `;

    this.container.appendChild(joystickDiv);
    this.container.appendChild(actionDiv);

    // Append to UI Layer in DOM
    const uiLayer = document.getElementById('ui-layer') || document.body;
    uiLayer.appendChild(this.container);

    this.knob = document.getElementById('joystick-knob') as unknown as SVGElement;
    this.jumpBtn = this.container.querySelector('.btn-jump') as HTMLDivElement;
    this.boostBtn = this.container.querySelector('.btn-boost') as HTMLDivElement;
  }

  private setupListeners(): void {
    const joystickContainer = this.container.querySelector('.mobile-joystick-container') as HTMLDivElement;

    // Joystick Touch Listeners
    joystickContainer.addEventListener('touchstart', this.handleJoystickStart, { passive: false });
    window.addEventListener('touchmove', this.handleJoystickMove, { passive: false });
    window.addEventListener('touchend', this.handleJoystickEnd, { passive: false });

    // Jump Button Listeners
    this.jumpBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this.onJumpChangeCallback) this.onJumpChangeCallback(true);
    }, { passive: false });

    this.jumpBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (this.onJumpChangeCallback) this.onJumpChangeCallback(false);
    }, { passive: false });

    // Boost Button Listeners
    this.boostBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this.onBoostChangeCallback) this.onBoostChangeCallback(true);
    }, { passive: false });

    this.boostBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (this.onBoostChangeCallback) this.onBoostChangeCallback(false);
    }, { passive: false });
  }

  private handleJoystickStart = (e: TouchEvent): void => {
    e.preventDefault();
    const joystickContainer = this.container.querySelector('.mobile-joystick-container') as HTMLDivElement;
    const rect = joystickContainer.getBoundingClientRect();

    this.joystickActive = true;
    this.joystickCenter = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };

    if (e.changedTouches.length > 0) {
      this.joystickTouchId = e.changedTouches[0].identifier;
    }
  };

  private handleJoystickMove = (e: TouchEvent): void => {
    if (!this.joystickActive || this.joystickTouchId === null) return;
    
    // Find the touch that matches our joystick touch identifier
    let touch: Touch | null = null;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === this.joystickTouchId) {
        touch = e.touches[i];
        break;
      }
    }
    
    if (!touch) return;

    e.preventDefault();

    const dx = touch.clientX - this.joystickCenter.x;
    const dy = touch.clientY - this.joystickCenter.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    let finalDx = dx;
    let finalDy = dy;

    if (distance > this.maxRadius) {
      finalDx = (dx / distance) * this.maxRadius;
      finalDy = (dy / distance) * this.maxRadius;
    }

    // Normalized direction vectors (x, y)
    this.joystickVector.x = finalDx / this.maxRadius;
    this.joystickVector.y = finalDy / this.maxRadius; // Up is negative, Down is positive on screen

    if (this.knob) {
      this.knob.setAttribute('transform', `translate(${60 + finalDx}, ${60 + finalDy})`);
    }
  };

  private handleJoystickEnd = (e: TouchEvent): void => {
    if (!this.joystickActive || this.joystickTouchId === null) return;

    // Check if the joystick touch is still active
    let activeJoystickTouch = false;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === this.joystickTouchId) {
        activeJoystickTouch = true;
        break;
      }
    }

    if (!activeJoystickTouch) {
      this.joystickActive = false;
      this.joystickTouchId = null;
      this.joystickVector = { x: 0, y: 0 };
      if (this.knob) {
        this.knob.setAttribute('transform', 'translate(60, 60)');
      }
    }
  };

  public getJoystickVector(): { x: number; y: number } {
    return this.joystickVector;
  }

  public registerCallbacks(
    onJumpChange: (pressed: boolean) => void,
    onBoostChange: (pressed: boolean) => void
  ): void {
    this.onJumpChangeCallback = onJumpChange;
    this.onBoostChangeCallback = onBoostChange;
  }

  public show(): void {
    this.container.classList.add('active');
  }

  public hide(): void {
    this.container.classList.remove('active');
    this.reset();
  }

  public reset(): void {
    this.joystickActive = false;
    this.joystickTouchId = null;
    this.joystickVector = { x: 0, y: 0 };
    if (this.knob) {
      this.knob.setAttribute('transform', 'translate(60, 60)');
    }
    if (this.onJumpChangeCallback) this.onJumpChangeCallback(false);
    if (this.onBoostChangeCallback) this.onBoostChangeCallback(false);
  }
}
