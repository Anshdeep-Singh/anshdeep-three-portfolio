import './styles/base.css';
import { Engine } from './core/Engine';
import { EventBus } from './core/EventBus';
import { StateStore } from './core/State';
import { ResourceManager } from './core/ResourceManager';
import { AssetManifest } from './types/assets';
import { NavigationController } from './ui/controllers/NavigationController';
import { ModalController } from './ui/controllers/ModalController';
import { AnimationController } from './core/animation/AnimationController';
import { LoadingScreenController } from './ui/controllers/LoadingScreenController';

/**
 * Application Entry Point
 * Orchestrates the bootstrapping of the Core modules.
 */
async function bootstrap() {
  // 0. Start Loading Screen immediately
  const loadingScreen = new LoadingScreenController();

  // 1. Initialize Core Services
  const eventBus = new EventBus();
  
  // Initial state (Placeholder for now)
  const initialState = {
    appStatus: 'initializing',
    navigation: { current: 'home' },
    assets: { loaded: 0, total: 0 },
    camera: { mode: 'AUTO' },
    chronometer: { year: 2026 }
  };

  // Reducer for state transitions
  const reducer = (state: any, action: any) => {
    switch (action.type) {
      case 'CORE:STATE_CHANGE':
        return { ...state, ...action.payload };
      default:
        return state;
    }
  };

  const state = new StateStore(reducer, initialState, eventBus);
  const resourceManager = new ResourceManager(eventBus);
  
  // 2. Initialize UI Controllers & Animation Controllers
  const navigationController = new NavigationController(eventBus, state);
  const modalController = new ModalController(eventBus);
  const animationController = new AnimationController(eventBus);

  // Mount UI controllers on DOM ready
  navigationController.mount();
  modalController.mount();

  // Pre-set intro elements to be completely hidden during the loading phase
  animationController.prepareIntroState();

  // 3. Initialize Engine
  const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Main: Canvas element not found!');
    return;
  }

  const engine = new Engine(eventBus, state, resourceManager);

  // Expose to window for testing/debugging
  (window as any).app = {
    eventBus,
    state,
    navigationController,
    modalController,
    animationController,
    engine
  };

  // 4. Load Assets and Start
  // Dummy manifest for bootstrapping
  const manifest: AssetManifest = {
    assets: [] // Will be replaced by real manifest in production
  };

  // Register engine started listener BEFORE initializing to avoid race conditions
  eventBus.on('CORE:ENGINE_STARTED', () => {
    console.log('App: Engine started. Beginning loop.');
    engine.start();
  });

  try {
    console.log('App: Bootstrapping...');
    const loadingStartTime = Date.now();
    await engine.init(canvas, manifest);

    // Load PortfolioScene to see something on screen
    const { PortfolioScene } = await import('./scene/scenes/PortfolioScene');
    await engine.loadScene(new PortfolioScene());

    // Enforce a minimum of 3 seconds (3000ms) of loading screen display to enjoy the BufferGeometry animation
    const loadDuration = Date.now() - loadingStartTime;
    const minLoadingTime = 3000;
    if (loadDuration < minLoadingTime) {
      await new Promise((resolve) => setTimeout(resolve, minLoadingTime - loadDuration));
    }

    // Expand away and dismiss loading screen as soon as scene is fully prepared
    await loadingScreen.dismiss();

    // Trigger the beautiful cinematic intro animation
    animationController.playSequence('intro');

  } catch (error) {
    console.error('App: Critical initialization error:', error);
  }
}

// Start the application
window.addEventListener('DOMContentLoaded', bootstrap);
