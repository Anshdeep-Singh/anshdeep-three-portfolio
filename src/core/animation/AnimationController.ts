import { gsap } from 'gsap';
import { EventBus } from '../EventBus';
import { Domain, Action, AppEventName } from '../../types/events';

/**
 * Coordinates complex, multi-layer animation sequences across DOM and WebGL.
 * Manages high-level timelines that cross-cut UI and 3D.
 */
export class AnimationController {
  private eventBus: EventBus;
  private activeTimelines: Map<string, gsap.core.Timeline> = new Map();

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.setupListeners();
  }

  /**
   * Set up event listeners for the animation trigger actions.
   */
  private setupListeners(): void {
    this.eventBus.on(
      `${Domain.ANIMATION}:${Action.TRIGGER}` as AppEventName,
      (payload: any) => {
        if (payload && payload.sequenceName) {
          this.playSequence(payload.sequenceName, payload.data);
        }
      }
    );
  }

  /**
   * Coordinates and plays a predefined animation sequence.
   * @param sequenceName Name of the transition/animation timeline to execute
   * @param data Contextual properties for the sequence
   */
  public playSequence(sequenceName: string, data?: any): gsap.core.Timeline | null {
    console.log(`AnimationController: Triggering sequence -> "${sequenceName}"`, data);

    // Stop any existing timeline running for this key to prevent overlapping conflicts
    this.stopSequence(sequenceName);

    const tl = gsap.timeline({
      onComplete: () => {
        this.activeTimelines.delete(sequenceName);
        this.eventBus.emit(`${Domain.ANIMATION}:${Action.TRIGGER}_COMPLETE` as any, { sequenceName });
      }
    });

    this.activeTimelines.set(sequenceName, tl);

    switch (sequenceName) {
      case 'intro':
        this.buildIntroSequence(tl, data);
        break;
      case 'transition':
        this.buildTransitionSequence(tl, data);
        break;
      case 'glitch':
        this.buildGlitchSequence(tl, data);
        break;
      case 'cameraFocus':
        this.buildCameraFocusSequence(tl, data);
        break;
      default:
        console.warn(`AnimationController: Sequence "${sequenceName}" is not registered.`);
        this.activeTimelines.delete(sequenceName);
        return null;
    }

    return tl;
  }

  /**
   * Stops a specific active animation sequence.
   */
  public stopSequence(sequenceName: string): void {
    const tl = this.activeTimelines.get(sequenceName);
    if (tl) {
      tl.kill();
      this.activeTimelines.delete(sequenceName);
    }
  }

  /**
   * Stops and kills all registered animations.
   */
  public stopAll(): void {
    this.activeTimelines.forEach((tl) => tl.kill());
    this.activeTimelines.clear();
    console.log('AnimationController: Stopped all active timelines.');
  }

  /**
   * Pre-set intro elements to be hidden/offset during loading to prevent double-load flash.
   */
  public prepareIntroState(): void {
    const navbar = document.getElementById('navbar');
    const canvas = document.getElementById('webgl-canvas');
    const links = navbar?.querySelectorAll('.navbar__link');
    const logo = navbar?.querySelector('.navbar__logo');
    const uiLayer = document.getElementById('ui-layer');

    // Restore ui-layer opacity (initially hidden inline in index.html to prevent FOUC)
    if (uiLayer) gsap.set(uiLayer, { opacity: 1 });

    if (navbar) gsap.set(navbar, { opacity: 0, y: -30 });
    if (logo) gsap.set(logo, { opacity: 0, scale: 0.8 });
    if (links) gsap.set(links, { opacity: 0, y: -10 });
    if (canvas) gsap.set(canvas, { opacity: 0 });
  }

  /**
   * Intro cinematic entry animation sequence.
   * Slides in navigation buttons, logo, and reveals the canvas smoothly.
   */
  private buildIntroSequence(tl: gsap.core.Timeline, _data?: any): void {
    const navbar = document.getElementById('navbar');
    const canvas = document.getElementById('webgl-canvas');
    const links = navbar?.querySelectorAll('.navbar__link');
    const logo = navbar?.querySelector('.navbar__logo');

    // Initial setups for cinematic pop
    if (navbar) tl.set(navbar, { opacity: 0, y: -30 });
    if (logo) tl.set(logo, { opacity: 0, scale: 0.8 });
    if (links) tl.set(links, { opacity: 0, y: -10 });
    if (canvas) tl.set(canvas, { opacity: 0 });

    // Sequence timeline orchestration
    if (canvas) {
      tl.to(canvas, { opacity: 1, duration: 2.0, ease: 'power2.out' });
    }
    if (navbar) {
      tl.to(navbar, { opacity: 1, y: 0, duration: 1.0, ease: 'back.out(1.2)' }, '-=1.2');
    }
    if (logo) {
      tl.to(logo, { opacity: 1, scale: 1, duration: 0.6, ease: 'power3.out' }, '-=0.6');
    }
    if (links && links.length > 0) {
      tl.to(links, {
        opacity: 1,
        y: 0,
        stagger: 0.12,
        duration: 0.5,
        ease: 'power2.out'
      }, '-=0.3');
    }
  }

  /**
   * Section Transition sequence (cinematic sweep).
   * Cross-fades/flashes UI elements or slightly tweaks ambient scaling.
   */
  private buildTransitionSequence(tl: gsap.core.Timeline, _data?: any): void {
    const uiLayer = document.getElementById('ui-layer');
    if (!uiLayer) return;

    // Fast dip-to-black/glass flash for visual depth
    tl.to(uiLayer, { opacity: 0.3, duration: 0.25, ease: 'power2.in' })
      .to(uiLayer, { opacity: 1, duration: 0.45, ease: 'power2.out' });
  }

  /**
   * Cinematic HUD glitch/vibration overlay sequence.
   */
  private buildGlitchSequence(tl: gsap.core.Timeline, _data?: any): void {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;

    const originalX = 0;
    
    // Quick jitter values to simulate cybernetic feed
    tl.to(navbar, { x: -6, duration: 0.05, ease: 'rough' })
      .to(navbar, { x: 4, duration: 0.05, ease: 'rough' })
      .to(navbar, { x: -3, duration: 0.05, ease: 'rough' })
      .to(navbar, { x: originalX, duration: 0.05, ease: 'power1.out' });
  }

  /**
   * Zoom-in and rotate highlight action for 3D showcase items.
   */
  private buildCameraFocusSequence(tl: gsap.core.Timeline, data?: any): void {
    if (!data || !data.mesh) return;

    const originalScale = data.mesh.scale.x;
    const peakScale = originalScale * 1.15;

    tl.to(data.mesh.scale, {
      x: peakScale,
      y: peakScale,
      z: peakScale,
      duration: 0.4,
      ease: 'back.out(1.5)'
    })
    .to(data.mesh.rotation, {
      y: data.mesh.rotation.y + Math.PI * 2,
      duration: 1.0,
      ease: 'power2.out'
    }, '-=0.2')
    .to(data.mesh.scale, {
      x: originalScale,
      y: originalScale,
      z: originalScale,
      duration: 0.3,
      ease: 'power2.out'
    });
  }

  /**
   * Lifecyle dispose method.
   */
  public dispose(): void {
    this.stopAll();
  }
}
