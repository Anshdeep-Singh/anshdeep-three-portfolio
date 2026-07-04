import * as THREE from 'three';
import { EventBus } from './EventBus';
import { StateStore } from './State';
import { ResourceManager } from './ResourceManager';
import { AssetManifest } from '../types/assets';
import { CameraSystem } from './camera/CameraSystem';
import { InteractionManager } from './interaction/InteractionManager';
import { Scene } from '../types/scenes';
import { PhysicsEngine } from './physics/PhysicsEngine';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

/**
 * The core orchestration layer. 
 * Manages the lifecycle of the application, the main loop, and coordinates between 
 * the Renderer, ResourceManager, and State.
 */
export class Engine {
  private eventBus: EventBus;
  private state: StateStore<any>;
  private resourceManager: ResourceManager;
  private renderer?: THREE.WebGLRenderer;
  private composer?: EffectComposer;
  private camera?: THREE.PerspectiveCamera;
  private scene?: THREE.Scene;
  private currentScene?: Scene;
  private cameraSystem?: CameraSystem;
  private interactionManager!: InteractionManager;
  private physicsEngine!: PhysicsEngine;
  private animationFrameId?: number;
  private isRunning: boolean = false;
  private lastTime: number = 0;
  private cssRenderer?: CSS3DRenderer;
  private cssScene?: THREE.Scene;

  private readonly CORE_ENGINE_STARTED = 'CORE:ENGINE_STARTED';

  constructor(
    eventBus: EventBus,
    state: StateStore<any>,
    resourceManager: ResourceManager
  ) {
    this.eventBus = eventBus;
    this.state = state;
    this.resourceManager = resourceManager;
  }

  /**
   * Returns the global state store.
   */
  public getStateStore(): StateStore<any> {
    return this.state;
  }

  /**
   * Returns the camera system.
   */
  public getCameraSystem(): CameraSystem | undefined {
    return this.cameraSystem;
  }

  /**
   * Returns the CSS3D Scene.
   */
  public getCssScene(): THREE.Scene | undefined {
    return this.cssScene;
  }

  /**
   * Returns the interaction manager.
   */
  public getInteractionManager(): InteractionManager {
    return this.interactionManager;
  }

  /**
   * Returns the physics engine.
   */
  public getPhysicsEngine(): PhysicsEngine {
    return this.physicsEngine;
  }

  /**
   * Initializes the core engine components.
   * @param canvas - The HTML canvas element to render to.
   * @param manifest - The asset manifest to load.
   */
  public async init(canvas: HTMLCanvasElement, manifest: AssetManifest): Promise<void> {
    // 1. Setup Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance', // performance hint for hybrid GPUs
    });
    // Performance optimization: cap pixel ratio to max 2 to prevent rendering lag on ultra-high-DPI screens
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    
    // Enable ACES Filmic Tone Mapping to prevent bright light colors (yellow/white) from blowing out
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // 2. Setup Three.js Core
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 0, 7);

    // Setup selective post-processing bloom pass to make neon elements glow beautifully
    const renderPass = new RenderPass(this.scene, this.camera);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.75, // Bloom intensity
      0.4,  // Bloom radius
      0.85  // Bloom threshold (make only bright/neon emission glow, preventing general blowout)
    );
    const outputPass = new OutputPass();

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(renderPass);
    this.composer.addPass(bloomPass);
    this.composer.addPass(outputPass);

     // 3. Setup Systems
      this.physicsEngine = new PhysicsEngine();
      this.interactionManager = new InteractionManager(this.eventBus, this.physicsEngine);
      this.cameraSystem = new CameraSystem(this.camera, this.eventBus);
      if (this.scene) {
        this.cameraSystem.setScene(this.scene);
      }

    // Setup CSS3D Renderer
    this.cssScene = new THREE.Scene();
    this.cssRenderer = new CSS3DRenderer();
    this.cssRenderer.setSize(window.innerWidth, window.innerHeight);
    this.cssRenderer.domElement.style.position = 'absolute';
    this.cssRenderer.domElement.style.top = '0';
    this.cssRenderer.domElement.style.left = '0';
    this.cssRenderer.domElement.style.width = '100%';
    this.cssRenderer.domElement.style.height = '100%';
    this.cssRenderer.domElement.style.pointerEvents = 'none';
    this.cssRenderer.domElement.style.zIndex = '5';
    this.cssRenderer.domElement.id = 'css3d-container';
    
    const parentContainer = canvas.parentElement || document.body;
    parentContainer.appendChild(this.cssRenderer.domElement);

    // 4. Load Assets
    await this.resourceManager.loadAll(manifest);

    // 5. Setup Resize Listener
    window.addEventListener('resize', this.onResize.bind(this));

    // 6. Signal engine is ready
    this.eventBus.emit(this.CORE_ENGINE_STARTED);
  }

  /**
   * Loads and sets a new scene.
   * @param scene - The scene to load.
   */
  public async loadScene(scene: Scene): Promise<void> {
    // 1. Cleanup previous scene
    if (this.currentScene) {
      this.currentScene.dispose();
    }

    // 2. Clear the THREE.Scene
    this.scene?.clear();

    // 3. Setup new scene
    if (this.scene && this.camera && this.eventBus) {
      if (scene.name === 'PortfolioScene') {
        (scene as any).cameraSystem = this.cameraSystem;
      }
      await scene.setup(this.scene, this.camera, this.eventBus);
      this.currentScene = scene;

      // Register physics bodies when PortfolioScene is loaded
      if (scene.name === 'PortfolioScene') {
        const portfolioScene = scene as any;
        this.physicsEngine.clear();

        // Register Skills orbiting capsules (skip central arcade cabinet)
        if (portfolioScene.skillsActor && typeof portfolioScene.skillsActor.getNodes === 'function') {
          const nodes = portfolioScene.skillsActor.getNodes();
          console.log(`Engine: Registering ${nodes.length - 1} skills nodes to PhysicsEngine.`);
          for (let i = 1; i < nodes.length; i++) {
            const node = nodes[i];
            this.physicsEngine.registerBody(node, node.entityId || node.name, {
              mass: 1.0,
              radius: 0.45,
              springK: 12.0,      // Snap back stiffness
              damping: 2.2,       // Satisfying decay
              restitution: 0.85   // Extra elastic bouncy collisions
            });
          }
        }

        // Register Project Showcase components
        if (portfolioScene.projectActor) {
          if (typeof portfolioScene.projectActor.getSpaceExplorerMesh === 'function') {
            const orb = portfolioScene.projectActor.getSpaceExplorerMesh();
            console.log('Engine: Registering Space Explorer project orb to PhysicsEngine.');
            this.physicsEngine.registerBody(orb, orb.entityId || orb.name, {
              mass: 2.2,
              radius: 0.9,
              springK: 6.0,
              damping: 2.5,
              restitution: 0.65
            });
          }
          if (typeof portfolioScene.projectActor.getQuantumComputingMesh === 'function') {
            const box = portfolioScene.projectActor.getQuantumComputingMesh();
            console.log('Engine: Registering Quantum Computing project cube to PhysicsEngine.');
            this.physicsEngine.registerBody(box, box.entityId || box.name, {
              mass: 2.6,
              radius: 1.1,
              springK: 6.0,
              damping: 2.5,
              restitution: 0.6
            });
          }
        }
      }
    }
  }

  /**
   * Starts the main render loop.
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.loop();
  }

  /**
   * Stops the main render loop.
   */
  public stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== undefined) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  /**
   * The main animation loop.
   */
  private loop = (): void => {
    if (!this.isRunning) return;

    const currentTime = performance.now();
    const dt = (currentTime - this.lastTime) / 1000.0;
    this.lastTime = currentTime;

    // 1. Update Physics
    if (this.physicsEngine && this.camera) {
      const mouse = this.interactionManager?.getMouseCoords();
      this.physicsEngine.update(dt, this.camera, mouse);
    }

    // 2. Update Interaction and Camera
    if (this.camera && this.scene) {
      this.interactionManager?.checkIntersections(this.camera, this.scene);
      this.cameraSystem?.update(dt);
    }

    // 3. Update current scene objects if available
    if (this.currentScene && typeof (this.currentScene as any).update === 'function') {
      (this.currentScene as any).update(currentTime * 0.001);
    }

    // 4. Render Frame
    this.render();

    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  /**
   * Executes the render call.
   */
  private render(): void {
    if (!this.renderer || !this.camera || !this.scene) return;
    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
    if (this.cssRenderer && this.cssScene && this.camera) {
      this.cssRenderer.render(this.cssScene, this.camera);
    }
  }

  /**
   * Handles window resizing.
   */
  private onResize(): void {
    if (!this.renderer || !this.camera) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    if (this.composer) {
      this.composer.setSize(width, height);
      this.composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }

    if (this.cssRenderer) {
      this.cssRenderer.setSize(width, height);
    }

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Cleans up all resources used by the engine.
   */
  public dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.onResize);
    this.currentScene?.dispose();
    this.interactionManager?.dispose();
    this.cameraSystem?.dispose();
    this.resourceManager.dispose();
    this.renderer?.dispose();
    if (this.cssRenderer && this.cssRenderer.domElement.parentElement) {
      this.cssRenderer.domElement.parentElement.removeChild(this.cssRenderer.domElement);
    }
  }
}
