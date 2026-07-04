import * as THREE from 'three';
import { gsap } from 'gsap';
import { EventBus } from '../EventBus';
import { AppEventName, Domain, Action } from '../../types/events';
import { RobotCharacter } from '../../entities/RobotCharacter';
import { MobileControls } from '../../ui/MobileControls';

/**
 * Manages camera state, transitions, and movement within the 3D scene.
 * Supports standard cinematic autopilot and WASD free cyber-drone navigation.
 */
export class CameraSystem {
  private camera: THREE.PerspectiveCamera;
  private eventBus: EventBus;
  private mode: string = 'AUTO'; // AUTO (Autopilot) or MANUAL (Manual Flight)
  private scene?: THREE.Scene;
  private _isTetrisActive: boolean = false;
  public get isTetrisActive(): boolean {
    return this._isTetrisActive;
  }
  public set isTetrisActive(value: boolean) {
    this._isTetrisActive = value;
    if (!value) {
      this.keysPressed = {};
      this.mobileControls?.reset();
    }
  }

  private _isSnakeGameActive: boolean = false;
  public get isSnakeGameActive(): boolean {
    return this._isSnakeGameActive;
  }
  public set isSnakeGameActive(value: boolean) {
    this._isSnakeGameActive = value;
    if (!value) {
      this.keysPressed = {};
      this.mobileControls?.reset();
    }
  }

  private _isDrivingActive: boolean = false;
  private drivingCar: THREE.Object3D | null = null;

  public get isDrivingActive(): boolean {
    return this._isDrivingActive;
  }
  public set isDrivingActive(value: boolean) {
    this._isDrivingActive = value;
    if (!value) {
      this.keysPressed = {};
      this.mobileControls?.reset();
    }
  }

  private _isVoxelPainterActive: boolean = false;
  public get isVoxelPainterActive(): boolean {
    return this._isVoxelPainterActive;
  }
  public set isVoxelPainterActive(value: boolean) {
    this._isVoxelPainterActive = value;
    if (!value) {
      this.keysPressed = {};
      this.mobileControls?.reset();
    }
  }

  private _isRubiksCubeActive: boolean = false;
  public get isRubiksCubeActive(): boolean {
    return this._isRubiksCubeActive;
  }
  public set isRubiksCubeActive(value: boolean) {
    this._isRubiksCubeActive = value;
    if (!value) {
      this.keysPressed = {};
      this.mobileControls?.reset();
    }
  }

  private _isConnect4Active: boolean = false;
  public get isConnect4Active(): boolean {
    return this._isConnect4Active;
  }
  public set isConnect4Active(value: boolean) {
    this._isConnect4Active = value;
    if (!value) {
      this.keysPressed = {};
      this.mobileControls?.reset();
    }
  }

  public setDrivingCar(car: THREE.Object3D | null): void {
    this.drivingCar = car;
  }

  // Third-person character variables
  private robotCharacter?: RobotCharacter;
  private mobileControls?: MobileControls;
  private playerPosition: THREE.Vector3 = new THREE.Vector3(0, -4, 0);
  private precalculatedSpawnPosition: THREE.Vector3 | null = null;
  private isJumping: boolean = false;
  private jumpVelocity: number = 0;
  private jumpCount: number = 0;
  private spaceReleased: boolean = true;
  private voxelBoxes: THREE.Mesh[] = [];

  // Robot Spawning Variables
  private isRobotSpawning: boolean = false;
  private robotSpawnTimer: number = 0;
  private readonly robotSpawnDuration: number = 3.0; // Cinematic 3 seconds duration
  private spawnParticles: THREE.Points | null = null;
  private spawnParticlePositions: Float32Array | null = null;
  private spawnParticleTargets: Float32Array | null = null;
  private spawnLight: THREE.PointLight | null = null;
  private spawnGlowSphere: THREE.Mesh | null = null;
  private cameraStartPos: THREE.Vector3 = new THREE.Vector3();
  private cameraStartQuat: THREE.Quaternion = new THREE.Quaternion();

  public setVoxelBoxes(boxes: THREE.Mesh[]): void {
    this.voxelBoxes = boxes;
  }

  public setPlayerSpawnPosition(pos: THREE.Vector3): void {
    this.precalculatedSpawnPosition = pos.clone();
  }

  // Fly-through cockpit controls
  private keysPressed: Record<string, boolean> = {};
  private isDragging: boolean = false;
  private previousMousePosition = { x: 0, y: 0 };
  private pitch: number = 0; // Look up/down (rotation around X)
  private yaw: number = 0;   // Look left/right (rotation around Y)
  
  private readonly moveSpeed: number = 0.08;
  private readonly lookSensitivity: number = 0.002;
  private readonly boundingRadius: number = 50;

  // Radar target nodes
  private targets = [
    { id: 'radar-target-projects', name: 'PROJECTS', pos: new THREE.Vector3(-4, 0, -2) },
    { id: 'radar-target-skills', name: 'SKILLS', pos: new THREE.Vector3(4, 0, -2) },
    { id: 'radar-target-about', name: 'ABOUT', pos: new THREE.Vector3(-2, 3, -4) },
    { id: 'radar-target-resume', name: 'RESUME', pos: new THREE.Vector3(2, -3, -3) }
  ];

  constructor(camera: THREE.PerspectiveCamera, eventBus: EventBus) {
    this.camera = camera;
    this.eventBus = eventBus;

    this.setupListeners();
    this.bindInputEvents();

    // Instantiate Mobile Controls and link to the keysPressed map
    this.mobileControls = new MobileControls();
    this.mobileControls.registerCallbacks(
      (pressed) => {
        this.keysPressed[' '] = pressed;
        this.keysPressed['spacebar'] = pressed;
      },
      (pressed) => {
        this.keysPressed['shift'] = pressed;
      }
    );
  }

  private setupListeners(): void {
    // Listen for camera move requests from the system
    this.eventBus.on(
      `${Domain.CAMERA}:${Action.MOVE}` as AppEventName,
      (payload: any) => {
        if (payload && payload.position) {
          this.moveTo(payload.position, payload.rotation || [0, 0, 0], payload.fov || 75);
        }
      }
    );

    // Listen for camera mode changes
    this.eventBus.on(
      `${Domain.CAMERA}:${Action.CHANGE}` as AppEventName,
      (payload: any) => {
        if (payload && payload.mode) {
          this.setMode(payload.mode);
        }
      }
    );

    // Listen to update radar targets dynamically when randomized positions are set
    this.eventBus.on(
      'CAMERA:SET_RADAR_TARGETS' as any,
      (payload: { id: string; pos: [number, number, number] }[]) => {
        if (Array.isArray(payload)) {
          payload.forEach(item => {
            const target = this.targets.find(t => t.id === item.id);
            if (target) {
              target.pos.set(...item.pos);
            }
          });
        }
      }
    );
  }

  /**
   * Bind DOM event listeners for manual drone navigation
   */
  private bindInputEvents(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('blur', this.handleWindowBlur);

    // Touch dragging events for smooth mobile camera rotation
    window.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    window.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    window.addEventListener('touchend', this.handleTouchEnd, { passive: false });
  }

  private handleWindowBlur = (): void => {
    this.keysPressed = {};
    this.mobileControls?.reset();
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (this.mode !== 'MANUAL' && this.mode !== 'EXPERIENCE') return;
    this.keysPressed[e.key.toLowerCase()] = true;
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    if (this.mode !== 'MANUAL' && this.mode !== 'EXPERIENCE') return;
    this.keysPressed[e.key.toLowerCase()] = false;
  };

  private handleMouseDown = (e: MouseEvent): void => {
    if (this.mode !== 'MANUAL' && this.mode !== 'EXPERIENCE') return;
    if (this.isRubiksCubeActive) return; // Lock camera dragging during Rubik's Cube gameplay
    // Check if clicking on canvas
    const target = e.target as HTMLElement;
    if (target.tagName === 'CANVAS' || target.id === 'app') {
      this.isDragging = true;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    }
  };

  private handleMouseMove = (e: MouseEvent): void => {
    if ((this.mode !== 'MANUAL' && this.mode !== 'EXPERIENCE') || !this.isDragging) return;

    const deltaX = e.clientX - this.previousMousePosition.x;
    const deltaY = e.clientY - this.previousMousePosition.y;

    this.yaw += deltaX * this.lookSensitivity;
    this.pitch += deltaY * this.lookSensitivity;

    // Clamp pitch to prevent flipping upside down
    const maxPitch = Math.PI / 2 - 0.05;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));

    // Construct camera rotation using quaternions to prevent gimbal lock
    const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.pitch);
    
    this.camera.quaternion.copy(qYaw).multiply(qPitch);

    this.previousMousePosition = { x: e.clientX, y: e.clientY };
  };

  private handleMouseUp = (): void => {
    this.isDragging = false;
  };

  private handleTouchStart = (e: TouchEvent): void => {
    if (this.mode !== 'MANUAL' && this.mode !== 'EXPERIENCE') return;
    if (this.isRubiksCubeActive) return;

    const target = e.target as HTMLElement;
    if (target.closest('.mobile-joystick-container') || target.closest('.mobile-action-buttons')) {
      return;
    }

    if (target.tagName === 'CANVAS' || target.id === 'app') {
      const touch = e.touches[0];
      this.isDragging = true;
      this.previousMousePosition = { x: touch.clientX, y: touch.clientY };
    }
  };

  private handleTouchMove = (e: TouchEvent): void => {
    if ((this.mode !== 'MANUAL' && this.mode !== 'EXPERIENCE') || !this.isDragging) return;

    const target = e.target as HTMLElement;
    if (target.closest('.mobile-joystick-container') || target.closest('.mobile-action-buttons')) {
      return;
    }

    e.preventDefault();

    const touch = e.touches[0];
    const deltaX = touch.clientX - this.previousMousePosition.x;
    const deltaY = touch.clientY - this.previousMousePosition.y;

    // Smooth and responsive mobile camera rotation sensitivity
    const touchSensitivity = this.lookSensitivity * 1.5;
    this.yaw += deltaX * touchSensitivity;
    this.pitch += deltaY * touchSensitivity;

    const maxPitch = Math.PI / 2 - 0.05;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));

    const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.pitch);
    
    this.camera.quaternion.copy(qYaw).multiply(qPitch);

    this.previousMousePosition = { x: touch.clientX, y: touch.clientY };
  };

  private handleTouchEnd = (e: TouchEvent): void => {
    if (e.touches.length === 0) {
      this.isDragging = false;
    }
  };

  /**
   * Extracts yaw and pitch from the camera's current quaternion rotation
   * to guarantee zero orientation snapping when switching modes.
   */
  public initRotationFromCamera(): void {
    const euler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
    this.yaw = euler.y;
    this.pitch = euler.x;
  }

  /**
   * Smoothly transitions the camera to a new position, rotation, and FOV.
   */
  public moveTo(
    position: [number, number, number],
    rotation: [number, number, number],
    fov: number
  ): void {
    if (this.mode === 'MANUAL') return; // Block automated transitions during flight mode
    this.transitionTo(position, rotation, fov);
  }

  /**
   * Performs the GSAP tween on camera properties.
   */
  public transitionTo(
    position: [number, number, number],
    rotation: [number, number, number],
    fov: number
  ): void {
    const targetPosition = new THREE.Vector3(...position);
    const targetRotation = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(rotation[0], rotation[1], rotation[2], 'XYZ')
    );

    // Kill any active transitions
    gsap.killTweensOf(this.camera);
    gsap.killTweensOf(this.camera.position);
    gsap.killTweensOf(this.camera.quaternion);

    const duration = 2.2; // A sweeping, cinematic fly-through duration

    // Animate position
    gsap.to(this.camera.position, {
      x: targetPosition.x,
      y: targetPosition.y,
      z: targetPosition.z,
      duration: duration,
      ease: 'power4.inOut',
    });

    // Animate rotation (using quaternion to avoid gimbal lock)
    gsap.to(this.camera.quaternion, {
      x: targetRotation.x,
      y: targetRotation.y,
      z: targetRotation.z,
      w: targetRotation.w,
      duration: duration,
      ease: 'power4.inOut',
    });

    // FOV stretching wormhole effect to simulate warp speed
    const fovTimeline = gsap.timeline();
    fovTimeline.to(this.camera, {
      fov: 115,
      duration: duration * 0.35, // Stretch in first 35% of the travel
      ease: 'power2.out',
      onUpdate: () => this.camera.updateProjectionMatrix()
    });
    fovTimeline.to(this.camera, {
      fov: fov,
      duration: duration * 0.65, // Settle back during the remainder
      ease: 'power3.inOut',
      onUpdate: () => this.camera.updateProjectionMatrix()
    });
  }

  /**
   * Sets the camera system's current mode (AUTO or MANUAL).
   */
  public setScene(scene: THREE.Scene): void {
    this.scene = scene;
  }

  public setMode(mode: string): void {
    this.mode = mode;
    console.log(`CameraSystem: Mode set to ${mode}`);

    const hint = document.getElementById('flight-controls-hint');

    if (mode === 'MANUAL' || mode === 'EXPERIENCE') {
      this.initRotationFromCamera();
      if (hint) hint.style.display = 'flex';
    } else {
      this.keysPressed = {};
      this.isDragging = false;
      if (hint) hint.style.display = 'none';
    }

    // Spawn or remove character model when EXPERIENCE mode is toggled
    if (mode === 'EXPERIENCE') {
      this.mobileControls?.show();
      if (this.scene && !this.robotCharacter) {
        this.robotCharacter = new RobotCharacter();
        
        // 1. Randomize spawn position within bounding radius (staying on flat floor grid, y = -4)
        // Avoid spawning right on top of other showcase assets or too close to the origin.
        let angle = Math.random() * Math.PI * 2.0; // Fallback random heading angle
        if (this.precalculatedSpawnPosition) {
          this.playerPosition.copy(this.precalculatedSpawnPosition);
          // Calculate heading angle from the origin to face the center
          angle = Math.atan2(this.playerPosition.z, this.playerPosition.x);
          this.precalculatedSpawnPosition = null; // Clear after use
        } else {
          const radius = Math.random() * 20.0 + 8.0; // Random distance between 8 and 28 units
          const fallbackAngle = Math.random() * Math.PI * 2.0;
          const spawnX = Math.cos(fallbackAngle) * radius;
          const spawnZ = Math.sin(fallbackAngle) * radius;
          this.playerPosition.set(spawnX, -4, spawnZ);
          angle = fallbackAngle;
        }
        
        this.robotCharacter.mesh.position.copy(this.playerPosition);
        this.scene.add(this.robotCharacter.mesh);
        
        // 2. Set initial robot transparency (completely invisible, will fade in as particles merge)
        this.robotCharacter.setOpacity(0.0);
        
        // 3. Setup Camera starting flight values for smooth cinematic fly-in
        this.cameraStartPos.copy(this.camera.position);
        this.cameraStartQuat.copy(this.camera.quaternion);
        
        // Face camera offset behind robot initially
        this.yaw = angle + Math.PI; // Face the spawn center
        this.pitch = 0.2; // looking slightly down
        
        // 4. Initialize particle system & lock controls
        this.isRobotSpawning = true;
        this.robotSpawnTimer = 0;
        this.createSpawnParticles(this.playerPosition);
      }
    } else {
      this.mobileControls?.hide();
      // Cancel spawn and clean up if active
      if (this.isRobotSpawning) {
        this.completeRobotSpawn();
      }
      if (this.scene && this.robotCharacter) {
        this.scene.remove(this.robotCharacter.mesh);
        this.robotCharacter = undefined;
      }
    }
  }

  /**
   * Builds the localized particle system that swirls and collapses to form the robot.
   */
  private createSpawnParticles(spawnPos: THREE.Vector3): void {
    if (!this.scene) return;

    // Clean up any lingering particles and lights/spheres
    if (this.spawnParticles) {
      this.scene.remove(this.spawnParticles);
      this.spawnParticles.geometry.dispose();
      (this.spawnParticles.material as THREE.Material).dispose();
      this.spawnParticles = null;
    }
    if (this.spawnLight) {
      this.scene.remove(this.spawnLight);
      this.spawnLight = null;
    }
    if (this.spawnGlowSphere) {
      this.scene.remove(this.spawnGlowSphere);
      this.spawnGlowSphere.geometry.dispose();
      (this.spawnGlowSphere.material as THREE.Material).dispose();
      this.spawnGlowSphere = null;
    }

    // Create the white center light and white glow sphere for spawn flare
    const lightY = spawnPos.y + 0.8;
    this.spawnLight = new THREE.PointLight(0xffffff, 0, 8);
    this.spawnLight.position.set(spawnPos.x, lightY, spawnPos.z);
    this.scene.add(this.spawnLight);

    const sphereGeo = new THREE.SphereGeometry(0.35, 16, 16);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.0,
      depthWrite: false
    });
    this.spawnGlowSphere = new THREE.Mesh(sphereGeo, sphereMat);
    this.spawnGlowSphere.position.set(spawnPos.x, lightY, spawnPos.z);
    this.scene.add(this.spawnGlowSphere);

    const particleCount = 300;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const targets = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      // Starts scattered in a wide swirling cone around the spawn point
      const pAngle = Math.random() * Math.PI * 2;
      const pRadius = Math.random() * 4.5 + 2.5; // scattered 2.5 to 7.0 units wide
      const pHeight = Math.random() * 6.0 - 2.0; // scattered from -2.0 to 4.0 units high

      positions[i * 3] = spawnPos.x + Math.cos(pAngle) * pRadius;
      positions[i * 3 + 1] = spawnPos.y + pHeight + 4.5; // offset slightly higher
      positions[i * 3 + 2] = spawnPos.z + Math.sin(pAngle) * pRadius;

      // Target position: distributed inside the volume box of the robot
      targets[i * 3] = spawnPos.x + (Math.random() - 0.5) * 0.7;
      targets[i * 3 + 1] = spawnPos.y + Math.random() * 1.6;
      targets[i * 3 + 2] = spawnPos.z + (Math.random() - 0.5) * 0.7;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.spawnParticlePositions = positions;
    this.spawnParticleTargets = targets;

    // A beautiful glowing cyan neon additive point material
    const material = new THREE.PointsMaterial({
      color: 0x00f3ff,
      size: 0.18,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.spawnParticles = new THREE.Points(geometry, material);
    this.scene.add(this.spawnParticles);
  }

  /**
   * Animates particles merging into the robot and fades in the robot body.
   */
  private updateSpawnParticles(dt: number): void {
    if (!this.spawnParticles || !this.spawnParticlePositions || !this.spawnParticleTargets) return;

    this.robotSpawnTimer += dt;
    const progress = Math.min(this.robotSpawnTimer / this.robotSpawnDuration, 1.0);

    const positions = this.spawnParticlePositions;
    const targets = this.spawnParticleTargets;
    const count = positions.length / 3;

    const geoAttr = this.spawnParticles.geometry.getAttribute('position') as THREE.BufferAttribute;

    for (let i = 0; i < count; i++) {
      const idx = i * 3;

      const startX = positions[idx];
      const startY = positions[idx + 1];
      const startZ = positions[idx + 2];

      const targetX = targets[idx];
      const targetY = targets[idx + 1];
      const targetZ = targets[idx + 2];

      // Swirling spiral effect: as progress increases, particles rotate and contract towards targets
      const swirlProgress = progress;
      const rotationSpeed = Math.PI * 6.0; // 3 full spins
      const angle = swirlProgress * rotationSpeed + (i * 0.08);
      const spiralRadius = (1.0 - swirlProgress) * 3.5; // spiral collapses down to target center

      const curX = THREE.MathUtils.lerp(startX, targetX, swirlProgress) + Math.cos(angle) * spiralRadius;
      const curY = THREE.MathUtils.lerp(startY, targetY, swirlProgress);
      const curZ = THREE.MathUtils.lerp(startZ, targetZ, swirlProgress) + Math.sin(angle) * spiralRadius;

      geoAttr.setXYZ(i, curX, curY, curZ);
    }

    geoAttr.needsUpdate = true;

    // Spawning Sequence:
    // 1. Swirling particles (0.0 to 0.45) - robot completely invisible
    // 2. White center light flares up (0.45 to 0.65)
    // 3. White center light dims, robot model emerges/fades in (0.65 to 0.95)
    
    let robotOpacity = 0.0;
    let lightIntensity = 0.0;
    let sphereOpacity = 0.0;
    let sphereScale = 0.1;

    if (progress < 0.45) {
      // Phase 1: Only particles swirling
      robotOpacity = 0.0;
      lightIntensity = 0.0;
      sphereOpacity = 0.0;
      sphereScale = 0.1;
    } else if (progress >= 0.45 && progress < 0.65) {
      // Phase 2: White center light flare-up
      const flareProgress = (progress - 0.45) / 0.20; // 0.0 to 1.0
      robotOpacity = 0.0;
      lightIntensity = flareProgress * 15.0; // Flare up to 15.0 intensity
      sphereOpacity = flareProgress;
      sphereScale = 0.1 + flareProgress * 1.4; // Grow up to 1.5x scale
    } else if (progress >= 0.65 && progress < 0.95) {
      // Phase 3: Light fades down, Robot model emerges/fades in
      const emergeProgress = (progress - 0.65) / 0.30; // 0.0 to 1.0
      robotOpacity = emergeProgress; // Robot fades in 0.0 -> 1.0
      lightIntensity = (1.0 - emergeProgress) * 15.0; // Light fades down to 0
      sphereOpacity = 1.0 - emergeProgress; // Sphere fades to 0
      sphereScale = 1.5 * (1.0 - emergeProgress); // Sphere shrinks back
    } else {
      // Phase 4: Full opacity robot, clean up light and sphere
      robotOpacity = 1.0;
      lightIntensity = 0.0;
      sphereOpacity = 0.0;
      sphereScale = 0.0;
    }

    // Apply opacities, scales, and intensities
    if (this.robotCharacter) {
      this.robotCharacter.setOpacity(robotOpacity);
    }

    if (this.spawnLight) {
      this.spawnLight.intensity = lightIntensity;
    }

    if (this.spawnGlowSphere) {
      const mat = this.spawnGlowSphere.material as THREE.MeshBasicMaterial;
      mat.opacity = sphereOpacity * 0.95; // peak soft brightness
      this.spawnGlowSphere.scale.setScalar(Math.max(0.001, sphereScale));
    }

    // Fade out particles near the end of the merge animation
    const mat = this.spawnParticles.material as THREE.PointsMaterial;
    if (progress > 0.8) {
      mat.opacity = (1.0 - progress) * 5.0 * 0.9;
    }

    if (progress >= 1.0) {
      this.completeRobotSpawn();
    }
  }

  /**
   * Finalizes the spawning, clean up particles, triggers a nice wave, and unlocks controls.
   */
  private completeRobotSpawn(): void {
    this.isRobotSpawning = false;
    
    if (this.spawnParticles) {
      this.scene?.remove(this.spawnParticles);
      this.spawnParticles.geometry.dispose();
      (this.spawnParticles.material as THREE.Material).dispose();
      this.spawnParticles = null;
    }

    if (this.spawnLight) {
      this.scene?.remove(this.spawnLight);
      this.spawnLight = null;
    }

    if (this.spawnGlowSphere) {
      this.scene?.remove(this.spawnGlowSphere);
      this.spawnGlowSphere.geometry.dispose();
      (this.spawnGlowSphere.material as THREE.Material).dispose();
      this.spawnGlowSphere = null;
    }

    this.spawnParticlePositions = null;
    this.spawnParticleTargets = null;

    if (this.robotCharacter) {
      this.robotCharacter.setOpacity(1.0);
      // Trigger friendly greeting emote
      this.robotCharacter.playEmote('Wave', 0.25);
    }
  }

  /**
   * Returns the camera system's current mode.
   */
  public getMode(): string {
    return this.mode;
  }

  /**
   * Resets camera to a default state.
   */
  public reset(position: [number, number, number], fov: number): void {
    this.moveTo(position, [0, 0, 0], fov);
  }

  /**
   * Called per frame in the main render loop.
   */
  public update(dt: number = 0.016): void {
    const clampedDt = Math.min(dt, 0.1);

    // 1. Process Fly-Through Drone Cockpit Movement
    if (this.mode === 'MANUAL') {
      const moveDirection = new THREE.Vector3();

      if (this.keysPressed['w'] || this.keysPressed['arrowup']) {
        moveDirection.z -= 1;
      }
      if (this.keysPressed['s'] || this.keysPressed['arrowdown']) {
        moveDirection.z += 1;
      }
      if (this.keysPressed['a'] || this.keysPressed['arrowleft']) {
        moveDirection.x -= 1;
      }
      if (this.keysPressed['d'] || this.keysPressed['arrowright']) {
        moveDirection.x += 1;
      }

      // Integrate Mobile Joystick inputs into navigation vectors
      if (this.mobileControls) {
        const joystickVec = this.mobileControls.getJoystickVector();
        if (joystickVec.x !== 0 || joystickVec.y !== 0) {
          moveDirection.x = joystickVec.x;
          moveDirection.z = joystickVec.y;
        }
      }
      if (this.keysPressed[' '] || this.keysPressed['spacebar']) {
        moveDirection.y += 1;
      }
      if (this.keysPressed['shift']) {
        moveDirection.y -= 1;
      }

      if (moveDirection.lengthSq() > 0) {
        moveDirection.normalize();

        // Standard directions scaled by move speed
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
        const up = new THREE.Vector3(0, 1, 0); // World up for rising/sinking

        const targetPos = this.camera.position.clone()
          .addScaledVector(forward, -moveDirection.z * this.moveSpeed)
          .addScaledVector(right, moveDirection.x * this.moveSpeed)
          .addScaledVector(up, moveDirection.y * this.moveSpeed);

        // Keep drone flight enclosed within the exploration bounding sphere
        if (targetPos.length() <= this.boundingRadius) {
          this.camera.position.copy(targetPos);
        } else {
          targetPos.normalize().multiplyScalar(this.boundingRadius);
          this.camera.position.copy(targetPos);
        }
      }
    }

    // 1b. Process Walk-Through Grid Experience Movement with 3rd Person tracking
    if (this.mode === 'EXPERIENCE' && this.robotCharacter) {
      if (this.isRobotSpawning) {
        // Update particles merging swirling vortex
        this.updateSpawnParticles(clampedDt);

        // Smooth camera fly-in during spawn
        const progress = Math.min(this.robotSpawnTimer / this.robotSpawnDuration, 1.0);
        const easeOut = 1.0 - Math.pow(1.0 - progress, 3.0); // cubic ease out

        const distance = 4.0;
        const height = 1.3;
        const cameraOffset = new THREE.Vector3(
          Math.sin(this.yaw) * Math.cos(this.pitch) * distance,
          Math.sin(this.pitch) * distance + height,
          Math.cos(this.yaw) * Math.cos(this.pitch) * distance
        );
        const targetCamPos = this.playerPosition.clone().add(cameraOffset);

        // Lerp position smoothly
        this.camera.position.lerpVectors(this.cameraStartPos, targetCamPos, easeOut);

        // Slerp rotation smoothly
        const tempCam = this.camera.clone();
        const targetLook = this.playerPosition.clone().add(new THREE.Vector3(0, 1.1, 0));
        tempCam.position.copy(this.camera.position);
        tempCam.lookAt(targetLook);
        this.camera.quaternion.slerpQuaternions(this.cameraStartQuat, tempCam.quaternion, easeOut);

        // Update animation mixer to play Idle state during spawn
        this.robotCharacter.update(clampedDt, 'Idle');

        this.updateHUDTelemetry();
        return;
      }

      if (this.isDrivingActive && this.drivingCar) {
        // Freezed during active gameplay - update character animations to Idle
        this.robotCharacter.update(clampedDt, 'Idle');
        
        // Car follow camera logic
        const carPos = this.drivingCar.position;
        const carYaw = (this.drivingCar as any).yaw !== undefined ? (this.drivingCar as any).yaw : 0;
        const carSpeed = (this.drivingCar as any).speed !== undefined ? (this.drivingCar as any).speed : 0;

        // Detect narrow viewports for portrait adaptation
        const isNarrow = window.innerWidth < 768;

        // Position camera behind the car
        const distance = isNarrow ? 5.2 : 4.8;
        const height = isNarrow ? 1.4 : 1.1;

        // Smoothly transition camera yaw and pitch back to behind the car when not dragging (just like the robot)
        if (!this.isDragging) {
          const defaultPitch = isNarrow ? 0.24 : 0.20;
          this.pitch += (defaultPitch - this.pitch) * 0.05;

          // Target yaw is the backview of the car (carYaw is the facing direction, so + Math.PI is behind it)
          const targetYaw = carYaw + Math.PI;
          let diff = targetYaw - this.yaw;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          
          // Slightly faster follow when moving to keep up with high-speed drifts
          const lerpFactor = Math.abs(carSpeed) > 0.1 ? 0.08 : 0.05;
          this.yaw += diff * lerpFactor;
        }

        // Restrict look pitch in third-person mode so it doesn't clip underneath the floor grid
        const minPitch = -0.1;
        const maxPitch = 0.8;
        this.pitch = Math.max(minPitch, Math.min(maxPitch, this.pitch));

        const cameraOffset = new THREE.Vector3(
          Math.sin(this.yaw) * Math.cos(this.pitch) * distance,
          Math.sin(this.pitch) * distance + height,
          Math.cos(this.yaw) * Math.cos(this.pitch) * distance
        );

        // Smoothly lerp camera position to follow behind the car
        const targetCamPos = carPos.clone().add(cameraOffset);
        this.camera.position.lerp(targetCamPos, 0.12);

        // Look at the car's position slightly offset vertically
        const targetLook = carPos.clone().add(new THREE.Vector3(0, 0.5, 0));
        this.camera.lookAt(targetLook);

        this.updateHUDTelemetry();
        return;
      }
      if (this.isRubiksCubeActive) {
        // Freezed during active gameplay - just update character animations to Idle
        this.robotCharacter.mesh.position.copy(this.playerPosition);
        this.robotCharacter.update(clampedDt, 'Idle');
        this.updateHUDTelemetry();
        return;
      }
      if (this.isConnect4Active) {
        // Freezed during active gameplay - just update character animations to Idle
        this.robotCharacter.mesh.position.copy(this.playerPosition);
        this.robotCharacter.update(clampedDt, 'Idle');
        this.updateHUDTelemetry();
        return;
      }
      if (this.isSnakeGameActive) {
        // Freezed during active gameplay - just update character animations to Idle
        this.robotCharacter.mesh.position.copy(this.playerPosition);
        this.robotCharacter.update(clampedDt, 'Idle');
        this.updateHUDTelemetry();
        return;
      }
      if (this.isTetrisActive) {
        // Freezed during active gameplay - just update character animations to Idle
        this.robotCharacter.mesh.position.copy(this.playerPosition);
        this.robotCharacter.update(clampedDt, 'Idle');
        this.updateHUDTelemetry();
        return;
      }
      const moveDirection = new THREE.Vector3();

      if (this.keysPressed['w'] || this.keysPressed['arrowup']) {
        moveDirection.z -= 1;
      }
      if (this.keysPressed['s'] || this.keysPressed['arrowdown']) {
        moveDirection.z += 1;
      }
      if (this.keysPressed['a'] || this.keysPressed['arrowleft']) {
        moveDirection.x -= 1;
      }
      if (this.keysPressed['d'] || this.keysPressed['arrowright']) {
        moveDirection.x += 1;
      }

      // Integrate Mobile Joystick inputs into navigation vectors
      if (this.mobileControls) {
        const joystickVec = this.mobileControls.getJoystickVector();
        if (joystickVec.x !== 0 || joystickVec.y !== 0) {
          moveDirection.x = joystickVec.x;
          moveDirection.z = joystickVec.y;
        }
      }

      // Compute dynamic ground height based on voxel box colliders
      let groundHeight = -4;
      if (this.voxelBoxes && this.voxelBoxes.length > 0) {
        const px = this.playerPosition.x;
        const pz = this.playerPosition.z;

        for (const box of this.voxelBoxes) {
          const bx = box.position.x;
          const bz = box.position.z;

          // Broad-phase horizontal filter
          if (Math.abs(px - bx) > 1.0 || Math.abs(pz - bz) > 1.0) {
            continue;
          }

          const boxSize = 1.2;
          const halfSize = boxSize / 2;
          const playerRadius = 0.35; // collision detection horizontal buffer

          if (
            px >= bx - halfSize - playerRadius &&
            px <= bx + halfSize + playerRadius &&
            pz >= bz - halfSize - playerRadius &&
            pz <= bz + halfSize + playerRadius
          ) {
            const boxTop = box.position.y + halfSize;
            // If the player's feet are above or very close to the box top, they can land on it
            if (this.playerPosition.y >= boxTop - 0.2) {
              if (boxTop > groundHeight) {
                groundHeight = boxTop;
              }
            }
          }
        }
      }

      // 1b.i) Jumping and falling physics
      const spacePressed = this.keysPressed[' '] || this.keysPressed['spacebar'];
      if (!spacePressed) {
        this.spaceReleased = true;
      }

      if (spacePressed && this.spaceReleased) {
        if (!this.isJumping) {
          this.isJumping = true;
          this.jumpVelocity = 7.5;
          this.jumpCount = 1;
          this.spaceReleased = false;
          if (this.robotCharacter) {
            this.robotCharacter.triggerJump();
          }
        } else if (this.jumpCount < 2) {
          this.isJumping = true;
          this.jumpVelocity = 7.5;
          this.jumpCount = 2;
          this.spaceReleased = false;
          if (this.robotCharacter) {
            this.robotCharacter.triggerJump();
          }
        }
      }

      if (this.isJumping) {
        this.playerPosition.y += this.jumpVelocity * clampedDt;
        this.jumpVelocity -= 18.0 * clampedDt; // gravity
        if (this.playerPosition.y <= groundHeight) {
          this.playerPosition.y = groundHeight;
          this.isJumping = false;
          this.jumpVelocity = 0;
          this.jumpCount = 0;
        }
      } else if (this.playerPosition.y > groundHeight) {
        // Fall off the box
        this.isJumping = true;
        this.jumpVelocity = 0;
        if (this.jumpCount === 0) {
          this.jumpCount = 1; // Fell off, first jump already used
        }
      } else {
        // Keep aligned to the current ground height
        this.playerPosition.y = groundHeight;
        this.jumpCount = 0;
      }

      // Determine speed and animation states
      const isMoving = moveDirection.lengthSq() > 0;
      const isRunning = isMoving && this.keysPressed['shift'];
      const movementState = this.isJumping ? 'Jumping' : (isRunning ? 'Running' : (isMoving ? 'Walking' : 'Idle'));

      if (isMoving) {
        moveDirection.normalize();

        // Standard directions projected on horizontal plane based on current camera Yaw
        const forward = new THREE.Vector3(
          -Math.sin(this.yaw),
          0,
          -Math.cos(this.yaw)
        ).normalize();

        const right = new THREE.Vector3(
          -Math.cos(this.yaw),
          0,
          Math.sin(this.yaw)
        ).normalize();

        const speed = (isRunning ? 0.08 : 0.035) * (clampedDt / 0.016);

        // Save horizontal position to revert in case of box blockages
        const prevX = this.playerPosition.x;
        const prevZ = this.playerPosition.z;

        // Move the player's position
        this.playerPosition.addScaledVector(forward, -moveDirection.z * speed);
        this.playerPosition.addScaledVector(right, -moveDirection.x * speed);

        // Horizontal collision blocking check for voxels (if player is vertically overlap the block body)
        if (this.voxelBoxes && this.voxelBoxes.length > 0) {
          const px = this.playerPosition.x;
          const pz = this.playerPosition.z;
          for (const box of this.voxelBoxes) {
            const bx = box.position.x;
            const bz = box.position.z;

            // Broad-phase horizontal filter
            if (Math.abs(px - bx) > 1.0 || Math.abs(pz - bz) > 1.0) {
              continue;
            }

            const boxSize = 1.2;
            const halfSize = boxSize / 2;
            const playerRadius = 0.22; // horizontal collision radius

            const boxBottom = box.position.y - halfSize;
            const boxTop = box.position.y + halfSize;

            if (this.playerPosition.y < boxTop - 0.1 && this.playerPosition.y >= boxBottom - 0.1) {
              if (
                px >= bx - halfSize - playerRadius &&
                px <= bx + halfSize + playerRadius &&
                pz >= bz - halfSize - playerRadius &&
                pz <= bz + halfSize + playerRadius
              ) {
                // COLLISION: revert movement
                this.playerPosition.x = prevX;
                this.playerPosition.z = prevZ;
                break;
              }
            }
          }
        }

        // Turn character mesh to look in direction of walking
        let moveAngle = Math.atan2(-moveDirection.x, -moveDirection.z);
        
        // Scale/limit the side rotation angle (e.g. max 45 degrees or Math.PI / 4)
        // to prevent extreme 90-degree snapping, making camera follow much smoother.
        const maxAngle = Math.PI / 4; // 45 degrees (0.785 rad)
        moveAngle = Math.max(-maxAngle, Math.min(maxAngle, moveAngle));

        // If the movement direction is mostly backwards, we clamp/limit the mesh's visual rotation
        // to prevent the robot from facing the camera, which avoids the 180-degree camera feedback loop.
        if (moveDirection.z > 0) {
          if (Math.abs(moveDirection.x) < 0.1) {
            moveAngle = 0; // Face forward and walk backward (backing up)
          } else {
            moveAngle = moveDirection.x < 0 ? -maxAngle : maxAngle; // Face sideways
          }
        }
        
        // Smoothly interpolate (lerp) the robot's orientation using shortest angular distance
        const targetRotationY = this.yaw + moveAngle;
        let diff = targetRotationY - this.robotCharacter.mesh.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        this.robotCharacter.mesh.rotation.y += diff * 0.12;
      }

      // Constrain player position inside the bounding cylinder/radius
      const horizontalDist = Math.sqrt(this.playerPosition.x * this.playerPosition.x + this.playerPosition.z * this.playerPosition.z);
      if (horizontalDist > this.boundingRadius) {
        this.playerPosition.setLength(this.boundingRadius);
        // keep vertical position correctly preserved
        this.playerPosition.y = this.isJumping ? this.playerPosition.y : -4;
      }

      // Update robot position and trigger procedural limbs swinging
      this.robotCharacter.mesh.position.copy(this.playerPosition);
      this.robotCharacter.update(clampedDt, movementState);

      // 1b.ii) Position camera in Third-Person behind the RobotCharacter using yaw and pitch
      const distance = 4.0;
      const height = 1.3;

      // Smoothly transition camera yaw and pitch back to behind the robot when not dragging
      if (!this.isDragging) {
        const defaultPitch = 0.2;
        this.pitch += (defaultPitch - this.pitch) * 0.05;

        // Target yaw is the backview of the robot (aligned with robot mesh rotation)
        const targetYaw = this.robotCharacter.mesh.rotation.y;
        let diff = targetYaw - this.yaw;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        
        // Slightly faster follow when moving, gentle snap back when idle
        const lerpFactor = isMoving ? 0.04 : 0.05;
        this.yaw += diff * lerpFactor;
      }

      // Restrict look pitch in third-person mode so it doesn't clip underneath the floor grid
      const minPitch = -0.1;
      const maxPitch = 0.8;
      this.pitch = Math.max(minPitch, Math.min(maxPitch, this.pitch));

      const cameraOffset = new THREE.Vector3(
        Math.sin(this.yaw) * Math.cos(this.pitch) * distance,
        Math.sin(this.pitch) * distance + height,
        Math.cos(this.yaw) * Math.cos(this.pitch) * distance
      );

      this.camera.position.copy(this.playerPosition).add(cameraOffset);

      // Target character's chest/head height
      const targetLook = this.playerPosition.clone().add(new THREE.Vector3(0, 1.1, 0));
      this.camera.lookAt(targetLook);
    }

    // 2. Real-time Telemetry & Breathtaking Proximity Radar Update
    this.updateHUDTelemetry();
  }

  /**
   * Updates coordinates, heading angle, and the dynamic top-down radar scan.
   */
  private updateHUDTelemetry(): void {
    const coordsEl = document.getElementById('telemetry-coords');
    const headingEl = document.getElementById('telemetry-heading');
    const nearestEl = document.getElementById('telemetry-nearest');

    // Coordinates update
    if (coordsEl) {
      coordsEl.textContent = `X: ${this.camera.position.x.toFixed(2)} | Y: ${this.camera.position.y.toFixed(2)} | Z: ${this.camera.position.z.toFixed(2)}`;
    }

    // Heading update
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    let headingRad = Math.atan2(dir.x, -dir.z);
    if (headingRad < 0) headingRad += Math.PI * 2;
    const headingDeg = Math.round(headingRad * (180 / Math.PI));

    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const dirName = directions[Math.round(((headingDeg % 360) / 45)) % 8];

    if (headingEl) {
      headingEl.textContent = `${headingDeg.toString().padStart(3, '0')}° (${dirName})`;
    }

    // Nearest item calculations
    let nearestName = 'NONE';
    let minDist = Infinity;

    // Update targets on circular radar relative to drone position & orientation
    this.targets.forEach(t => {
      const dist = this.camera.position.distanceTo(t.pos);
      if (dist < minDist) {
        minDist = dist;
        nearestName = t.name;
      }

      const dx = t.pos.x - this.camera.position.x;
      const dz = t.pos.z - this.camera.position.z;

      // Project and rotate relative to cockpit heading
      const cos = Math.cos(-headingRad);
      const sin = Math.sin(-headingRad);
      const rx = dx * cos - dz * sin;
      const rz = dx * sin + dz * cos;

      const dotEl = document.getElementById(t.id);
      if (dotEl) {
        const radarRange = 50;
        const relativeDist = Math.sqrt(rx * rx + rz * rz);

        if (relativeDist <= radarRange) {
          const cx = 50 + (rx / radarRange) * 48;
          const cy = 50 + (rz / radarRange) * 48;
          dotEl.setAttribute('cx', cx.toString());
          dotEl.setAttribute('cy', cy.toString());
          dotEl.style.opacity = '0.8';
        } else {
          // Clamp target dots out of bounds to the outer perimeter
          const angle = Math.atan2(rz, rx);
          const clampX = 50 + Math.cos(angle) * 46;
          const clampY = 50 + Math.sin(angle) * 46;
          dotEl.setAttribute('cx', clampX.toString());
          dotEl.setAttribute('cy', clampY.toString());
          dotEl.style.opacity = '0.2'; // Dim out-of-range targets
        }
      }
    });

    if (nearestEl) {
      nearestEl.textContent = minDist < Infinity ? `${nearestName} (${minDist.toFixed(1)}u)` : 'NONE';
    }
  }

  /**
   * Returns the player's 3D coordinate position.
   */
  public getPlayerPosition(): THREE.Vector3 {
    return this.playerPosition;
  }

  /**
   * Returns the RobotCharacter instance if spawned.
   */
  public getRobotCharacter(): RobotCharacter | undefined {
    return this.robotCharacter;
  }

  public getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  public dispose(): void {
    gsap.killTweensOf(this.camera);
    gsap.killTweensOf(this.camera.position);
    gsap.killTweensOf(this.camera.quaternion);

    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
  }
}
