import * as THREE from 'three';
import { Scene } from '../../types/scenes';
import { gsap } from 'gsap';
import { EventBus } from '../../core/EventBus';
import { Domain, Action, AppEventName } from '../../types/events';
import { ProjectActor } from '../../entities/actors/ProjectActor';
import { SkillsActor } from '../../entities/actors/SkillsActor';
import { ResumeActor } from '../../entities/actors/ResumeActor';
import { AboutActor } from '../../entities/actors/AboutActor';
import { JellyFaceActor } from '../../entities/actors/JellyFaceActor';
import { BackgroundPeopleActor } from '../../entities/actors/BackgroundPeopleActor';
import { Stage } from '../stage/Stage';
import { TetrisPileActor } from '../../entities/actors/TetrisPileActor';
import { TetrisBoardActor } from '../../entities/actors/TetrisBoardActor';
import { CameraSystem } from '../../core/camera/CameraSystem';
import { CarActor } from '../../entities/actors/CarActor';
import { SnakeActor } from '../../entities/actors/SnakeActor';
import { SnakeGameActor } from '../../entities/actors/SnakeGameActor';
import { RubiksCubeActor } from '../../entities/actors/RubiksCubeActor';
import { Connect4Actor } from '../../entities/actors/Connect4Actor';

export class PortfolioScene implements Scene {
  public name = 'PortfolioScene';
  public cameraSystem?: CameraSystem;
  
  private projectActor!: ProjectActor;
  private tetrisPileActor!: TetrisPileActor;
  private tetrisBoardActor!: TetrisBoardActor;
  private tetrisPopupEl: HTMLElement | null = null;
  private tetrisGamepadEl: HTMLElement | null = null;
  private handleTetrisResize = () => {
    this.updateTetrisCamera(false);
  };

  private handleConnect4Resize = () => {
    this.updateConnect4Camera(false);
  };

  private updateConnect4Camera(isInitial: boolean): void {
    if (!this.cameraSystem) return;
    const c4x = this.connect4Actor.mesh.position.x;
    const c4z = this.connect4Actor.mesh.position.z;
    const isPortrait = window.innerWidth / window.innerHeight < 1.0;
    const aspect = window.innerWidth / window.innerHeight;
    
    // Increased distance for portrait/mobile view to zoom out the board responsively
    const targetZ = isPortrait ? c4z + Math.max(16.5, 7.5 / aspect) : c4z + 10.4;
    const targetFov = isPortrait ? 35 : 30;

    if (isInitial) {
      this.cameraSystem.moveTo([c4x, -2.1, targetZ], [0, 0, 0], targetFov);
    } else {
      const camera = this.cameraSystem.getCamera();
      gsap.killTweensOf(camera);
      gsap.killTweensOf(camera.position);
      gsap.killTweensOf(camera.quaternion);

      camera.position.set(c4x, -2.1, targetZ);
      camera.quaternion.setFromEuler(new THREE.Euler(0, 0, 0, 'XYZ'));
      camera.fov = targetFov;
      camera.updateProjectionMatrix();
    }
  }

  // Rubik's Cube components
  private rubiksCubeActor!: RubiksCubeActor;
  private rubiksPopupEl: HTMLElement | null = null;
  private rubiksGameActive: boolean = false;
  private rubiksState: 'scattered' | 'assembling' | 'assembled' | 'dissolving' = 'scattered';
  private rubiksGamepadEl: HTMLElement | null = null;
  private hasWalkedAwayFromRubiks: boolean = true;

  // Connect 4 components
  private connect4Actor!: Connect4Actor;
  private connect4PopupEl: HTMLElement | null = null;
  private connect4GamepadEl: HTMLElement | null = null;
  private connect4GameActive: boolean = false;
  private connect4Score = { player: 0, cpu: 0 };
  private activeColumn: number = 3;
  private connect4Turn: 'R' | 'Y' = 'R';
  private isCPUMoving: boolean = false;
  private hasWalkedAwayFromConnect4: boolean = true;

  // Snake Game components
  private snakeActor!: SnakeActor;
  private snakeGameActor!: SnakeGameActor;
  private snakePopupEl: HTMLElement | null = null;
  private snakeGameActive: boolean = false;
  private snakeDpadEl: HTMLElement | null = null;
  private handleSnakeResize = () => {
    this.updateSnakeGameCamera(false);
  };

  // Driving Game components
  private carActor!: CarActor;
  private carPopupEl: HTMLElement | null = null;
  private orbs: THREE.Mesh[] = [];
  private carGameActive: boolean = false;
  private carGameTimer: number = 30;
  private carGameScore: number = 0;
  private carGameTimerInterval: any = null;
  private drivingGamepadEl: HTMLElement | null = null;

  // Voxel Painter components
  private voxelBoxes: THREE.Mesh[] = [];
  private initialStackedBoxes: THREE.Mesh[] = [];
  private initialStackCenter: THREE.Vector3 = new THREE.Vector3();
  private voxelPopupEl: HTMLElement | null = null;
  private voxelPainterActive: boolean = false;
  private voxelMobileMode: 'add' | 'remove' | 'color' = 'add';
  private voxelGamepadEl: HTMLElement | null = null;
  private isShiftDown: boolean = false;
  private rollOverMesh!: THREE.Mesh;
  private voxelGridHelper: THREE.GridHelper | null = null;
  private voxelGridBase: THREE.Mesh | null = null;
  private voxelPlane: THREE.Mesh | null = null;
  private paintPointer: THREE.Vector2 = new THREE.Vector2();
  private paintRaycaster: THREE.Raycaster = new THREE.Raycaster();
  private voxelObjects: THREE.Object3D[] = [];
  private mainScene!: THREE.Scene;

  private skillsActor!: SkillsActor;
  private resumeActor!: ResumeActor;
  private aboutActor!: AboutActor;
  private jellyFaceActor!: JellyFaceActor;
  private backgroundPeopleActor!: BackgroundPeopleActor;
  private stage!: Stage;
  
  private eventBus!: EventBus;

  private lastUpdateTime: number = 0;

  private projectsInitialPos!: THREE.Vector3;
  private skillsInitialPos!: THREE.Vector3;
  private aboutInitialPos!: THREE.Vector3;
  private resumeInitialPos!: THREE.Vector3;

  // Viewpoint mappings
  private viewpoints: Record<string, { position: [number, number, number]; rotation: [number, number, number]; fov: number }> = {
    home: {
      position: [0, 0, 7],
      rotation: [0, 0, 0],
      fov: 75
    },
    projects: {
      position: [-4, 0, 1.8],
      rotation: [0, -0.3, 0],
      fov: 65
    },
    skills: {
      position: [4, 0, 1.8],
      rotation: [0, 0.3, 0],
      fov: 65
    },
    skillsGame: {
      position: [4, 0.1, -0.65],
      rotation: [0, 0.3, 0],
      fov: 40
    },
    about: {
      position: [-2, 3, -1],
      rotation: [-0.2, -0.3, 0],
      fov: 65
    },
    resume: {
      position: [2, -3, 0],
      rotation: [0.2, 0.3, 0],
      fov: 65
    }
  };

  private handleEKeyPress = (e: KeyboardEvent): void => {
    if (this.snakeGameActive) {
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        e.preventDefault();
        this.snakeGameActor.handleInput(e.key);
      }
      return;
    }

    if (e.key.toLowerCase() === 'e') {
      if (this.carPopupEl && !this.carPopupEl.classList.contains('hidden') && !this.carGameActive) {
        console.log('PortfolioScene: E key pressed while near car. Starting driving game.');
        this.hideCarPopup();
        this.startDrivingGame();
      } else if (this.snakePopupEl && !this.snakePopupEl.classList.contains('hidden') && !this.snakeGameActive) {
        console.log('PortfolioScene: E key pressed while near snake. Starting snake game.');
        this.hideSnakePopup();
        this.startSnakeGame();
      } else if (this.rubiksPopupEl && !this.rubiksPopupEl.classList.contains('hidden') && !this.rubiksGameActive) {
        console.log('PortfolioScene: E key pressed while near Rubiks Cube. Starting Rubiks game.');
        this.hideRubiksPopup();
        this.startRubiksGame();
      } else if (this.connect4PopupEl && !this.connect4PopupEl.classList.contains('hidden') && !this.connect4GameActive) {
        console.log('PortfolioScene: E key pressed while near Connect 4. Starting Connect 4.');
        this.hideConnect4Popup();
        this.startConnect4Game();
      }
    }
  };

  constructor() {}

  public randomizeExperienceEntities(): THREE.Vector3 {
    const positions: THREE.Vector3[] = [];
    const minDistance = 9.0;
    const minRadius = 8.0;
    const maxRadius = 24.0;

    for (let i = 0; i < 7; i++) {
      let attempts = 0;
      let placed = false;
      while (attempts < 1000 && !placed) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * (maxRadius - minRadius) + minRadius;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        let tooClose = false;
        for (const pos of positions) {
          const dx = pos.x - x;
          const dz = pos.z - z;
          if (Math.sqrt(dx * dx + dz * dz) < minDistance) {
            tooClose = true;
            break;
          }
        }

        if (!tooClose) {
          positions.push(new THREE.Vector3(x, -4, z));
          placed = true;
        }
        attempts++;
      }
      
      // Fallback if loop couldn't place without overlap
      if (!placed) {
        const angle = (i / 7) * Math.PI * 2;
        const radius = 15.0;
        positions.push(new THREE.Vector3(Math.cos(angle) * radius, -4, Math.sin(angle) * radius));
      }
    }

    // Assign the generated well-spaced positions:
    // 0: Tetris Pile
    this.tetrisPileActor.mesh.position.copy(positions[0]);
    this.tetrisPileActor.mesh.updateMatrixWorld(true);
    
    // 1: Car Actor (height offset -3.7 for standard vehicle base)
    const carPos = positions[1].clone();
    carPos.y = -3.7;
    this.carActor.relocateCar(carPos);

    // 2: Snake Actor (South-West Quadrant random offset within relocateSnake)
    this.snakeActor.relocateSnake(positions[2]);

    // 3: Rubiks Cube
    this.rubiksCubeActor.mesh.position.copy(positions[3]);

    // 4: Connect 4
    this.connect4Actor.mesh.position.copy(positions[4]);

    // 5: Voxel Painter stacked boxes center (snapped to 1.2 intervals to align with absolute grid)
    const rx = Math.floor(positions[5].x / 1.2) * 1.2;
    const rz = Math.floor(positions[5].z / 1.2) * 1.2;
    this.initialStackCenter.set(rx, -2.2, rz);

    // 6: Return the 7th position for safe player character spawn
    return positions[6];
  }

  public setup(scene: THREE.Scene, camera: THREE.Camera, eventBus: EventBus): void {
    this.eventBus = eventBus;
    this.mainScene = scene;

    console.log('PortfolioScene: Setting up 3D environment & showcase actors with camera:', camera.name);

    // 0. Dynamic stage (Grid floor and Swirling Particle Nebula)
    this.stage = new Stage(scene, camera);

    // 1. Environmental Stage Lighting
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);

    const ambientLight = new THREE.AmbientLight(0x202040, 0.6);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x7f00ff, 1.5, 15);
    pointLight.position.set(0, 0, 2);
    scene.add(pointLight);

    // 2. Initialize and place showcase actors in spatial 3D positions with random spatial scattering
    const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;

    // Projects Sector: Left, Lower, Deep Back
    const px = randomRange(-15, -10);
    const py = randomRange(-10, -5);
    const pz = randomRange(-15, -10);
    this.projectsInitialPos = new THREE.Vector3(px, py, pz);

    // Skills Sector: Right, Middle, Deep Back
    const sx = randomRange(10, 15);
    const sy = randomRange(-5, 5);
    const sz = randomRange(-15, -10);
    this.skillsInitialPos = new THREE.Vector3(sx, sy, sz);

    // About Sector: Left, Upper, Deep Front
    const ax = randomRange(-15, -10);
    const ay = randomRange(10, 15);
    const az = randomRange(10, 15);
    this.aboutInitialPos = new THREE.Vector3(ax, ay, az);

    // Resume Sector: Right, Lower, Deep Front
    const rx = randomRange(10, 15);
    const ry = randomRange(-15, -10);
    const rz = randomRange(5, 12);
    this.resumeInitialPos = new THREE.Vector3(rx, ry, rz);

    // Ambient Background Particle People
    this.backgroundPeopleActor = new BackgroundPeopleActor();
    this.backgroundPeopleActor.setup();
    scene.add(this.backgroundPeopleActor.mesh);

    // Home/Center Showcase (Jelly Deformation Cyber Face)
    this.jellyFaceActor = new JellyFaceActor();
    this.jellyFaceActor.setup();
    this.jellyFaceActor.mesh.position.set(0, 0, 0); // Center of home view
    scene.add(this.jellyFaceActor.mesh);

    // Projects Showcase
    this.projectActor = new ProjectActor();
    this.projectActor.eventBus = eventBus;
    this.projectActor.setup();
    this.projectActor.mesh.position.copy(this.projectsInitialPos);
    scene.add(this.projectActor.mesh);

    // Skills Showcase
    this.skillsActor = new SkillsActor();
    this.skillsActor.setup();
    this.skillsActor.mesh.position.copy(this.skillsInitialPos);
    scene.add(this.skillsActor.mesh);

    // About Showcase
    this.aboutActor = new AboutActor();
    this.aboutActor.setup();
    this.aboutActor.mesh.position.copy(this.aboutInitialPos);
    scene.add(this.aboutActor.mesh);

    // Resume Showcase
    this.resumeActor = new ResumeActor();
    this.resumeActor.setup();
    this.resumeActor.mesh.position.copy(this.resumeInitialPos);
    scene.add(this.resumeActor.mesh);

    // Spawn Tetris Pile Showcase (Phase 1 Setup)
    this.tetrisPileActor = new TetrisPileActor();
    this.tetrisPileActor.setup();
    scene.add(this.tetrisPileActor.mesh);

    // Tetris Board Showcase (Phase 3 Setup)
    this.tetrisBoardActor = new TetrisBoardActor();
    this.tetrisBoardActor.eventBus = eventBus;
    this.tetrisBoardActor.setup();
    scene.add(this.tetrisBoardActor.mesh);

    // Spawn Driving Car Actor
    this.carActor = new CarActor();
    this.carActor.setup();
    scene.add(this.carActor.mesh);

    // Spawn Snake Actor
    this.snakeActor = new SnakeActor();
    this.snakeActor.setup();
    scene.add(this.snakeActor.mesh);

    // Spawn Snake Game Board Actor
    this.snakeGameActor = new SnakeGameActor();
    this.snakeGameActor.eventBus = eventBus;
    this.snakeGameActor.setup();
    scene.add(this.snakeGameActor.mesh);

    // Spawn Rubiks Cube Actor
    this.rubiksCubeActor = new RubiksCubeActor();
    this.rubiksCubeActor.setup();
    this.rubiksCubeActor.setToPile();
    this.rubiksCubeActor.mesh.visible = false; // Hidden initially, shown only in experience mode
    scene.add(this.rubiksCubeActor.mesh);

    // Spawn Connect 4 Actor
    this.connect4Actor = new Connect4Actor();
    this.connect4Actor.setup();
    this.connect4Actor.setToPile();
    this.connect4Actor.mesh.visible = false; // Hidden initially, shown only in experience mode
    scene.add(this.connect4Actor.mesh);

    // Run the spacing-constrained randomizer to dynamically arrange all 6 experiences and reserve the safe player spawn pos
    this.randomizeExperienceEntities();

    // Dynamically update viewpoints to focus perfectly on the randomized coordinates
    const isMobile = window.innerWidth < 768;
    // Align viewpoints based on camera's rotational angle (0.3 rad) to keep the actor perfectly centered on screen
    this.viewpoints.projects.position = [px + 3.8 * Math.sin(-0.3), py, pz + 3.8 * Math.cos(-0.3)];
    this.viewpoints.skills.position = [sx + 5.5 * Math.sin(0.3), sy, sz + 5.5 * Math.cos(0.3)]; // Pushed viewport back from +3.8 to +5.5 for a wider view of expanded orbits
    this.viewpoints.skillsGame.position = [sx + 2.5 * Math.sin(0.3), sy + 0.1, sz + 2.5 * Math.cos(0.3)]; // Pushed game/arcade console view back slightly as well
    this.viewpoints.about.position = [ax, ay, az + 3.0];
    this.viewpoints.resume.position = [rx, ry, rz + (isMobile ? 9.5 : 7.5)];
    if (isMobile) {
      this.viewpoints.resume.rotation = [0.2, 0, 0];
    }

    // Emit event to update radar targets in CameraSystem
    this.eventBus.emit('CAMERA:SET_RADAR_TARGETS' as any, [
      { id: 'radar-target-projects', pos: [px, py, pz] },
      { id: 'radar-target-skills', pos: [sx, sy, sz] },
      { id: 'radar-target-about', pos: [ax, ay, az] },
      { id: 'radar-target-resume', pos: [rx, ry, rz] }
    ]);

    // 3. Setup Navigation & Interaction event listeners
    this.setupListeners();
  }

  private setupListeners(): void {
    window.addEventListener('keydown', this.handleEKeyPress);

    // Listen to Navigation changes to update Camera viewpoints
    this.eventBus.on(`${Domain.NAV}:${Action.NAVIGATE}` as AppEventName, (payload: any) => {
      const target = typeof payload === 'string' ? payload : payload?.target;

      // If the user clicks any navigation menu tab while playing Tetris, automatically exit Tetris first
      if (this.cameraSystem?.isTetrisActive) {
        this.stopTetrisTransition();
      }
      if (this.snakeGameActive) {
        this.stopSnakeGame();
      }
      if (this.rubiksGameActive) {
        this.stopRubiksGame();
      }

      if (this.jellyFaceActor) {
        if (target !== 'home') {
          this.jellyFaceActor.reset();
          this.jellyFaceActor.setHomeActive(false);
        } else {
          this.jellyFaceActor.setHomeActive(true);
        }
      }
      if (this.skillsActor) {
        if (target === 'skills' || target === 'skillsGame') {
          this.skillsActor.setSkillsActive(true);
        } else {
          this.skillsActor.setSkillsActive(false);
        }
      }
      if (target && this.viewpoints[target]) {
        const vp = this.viewpoints[target];
        console.log(`PortfolioScene: Navigating to ${target}, moving camera.`);
        this.eventBus.emit(`${Domain.CAMERA}:${Action.MOVE}` as AppEventName, {
          position: vp.position,
          rotation: vp.rotation,
          fov: vp.fov
        });
      }
    });

    // Listen to 3D Entity Clicks to trigger modal overlays
    this.eventBus.on(`${Domain.ENTITY}:${Action.CLICK}` as AppEventName, (payload: any) => {
      const entityId = payload?.entityId;
      console.log(`PortfolioScene: Entity clicked -> ${entityId}`);

      if (!entityId) return;

      if (entityId === 'jelly-face') {
        if (this.jellyFaceActor) {
          this.jellyFaceActor.click(this.lastUpdateTime);
        }
        return;
      }

      if (entityId === 'projects-arrow-left') {
        this.projectActor.navigateCarousel('left');
        return;
      } else if (entityId === 'projects-arrow-right') {
        this.projectActor.navigateCarousel('right');
        return;
      }

      if (entityId.startsWith('projects-') && entityId !== 'projects-arrow-left' && entityId !== 'projects-arrow-right') {
        this.eventBus.emit(`${Domain.MODAL}:${Action.OPEN}` as AppEventName, { contentId: entityId });
      } else if (entityId === 'resume' || entityId === 'resume-showcase') {
        this.eventBus.emit(`${Domain.NAV}:${Action.NAVIGATE}` as AppEventName, { target: 'resume' });
        if (this.resumeActor) {
          this.resumeActor.handleCentralHubClick();
        }
      } else if (entityId === 'skills-core') {
        // Navigate to Skills view
        this.eventBus.emit(`${Domain.NAV}:${Action.NAVIGATE}` as AppEventName, { target: 'skills' });
        // Open details modal
        this.eventBus.emit(`${Domain.MODAL}:${Action.OPEN}` as AppEventName, { contentId: 'skills-core' });
      } else if (entityId.startsWith('skills-')) {
        // Navigate to Skills view
        this.eventBus.emit(`${Domain.NAV}:${Action.NAVIGATE}` as AppEventName, { target: 'skills' });
        // Open details modal
        this.eventBus.emit(`${Domain.MODAL}:${Action.OPEN}` as AppEventName, { contentId: entityId });
      } else if (entityId === 'about-core') {
        // Navigate to About view
        this.eventBus.emit(`${Domain.NAV}:${Action.NAVIGATE}` as AppEventName, { target: 'about' });
        // Open details modal
        this.eventBus.emit(`${Domain.MODAL}:${Action.OPEN}` as AppEventName, { contentId: 'about-core' });
      }
    });

    // Listen to Tetris Start trigger
    this.eventBus.on('TETRIS:START' as any, () => {
      this.startTetrisTransition();
    });

    // Listen to Tetris Quit trigger
    this.eventBus.on('TETRIS:QUIT' as any, () => {
      this.stopTetrisTransition();
      this.relocateTetrisConsole();
    });

    // Listen to Tetris Game Over trigger
    this.eventBus.on('TETRIS:GAME_OVER' as any, (payload: any) => {
      const score = payload?.score || 0;
      this.handleGameOver(score);
    });

    // Listen to Snake Game Score updates
    this.eventBus.on('SNAKE_GAME:SCORE' as any, (payload: any) => {
      const scoreVal = document.getElementById('snake-score-val');
      if (scoreVal) {
        scoreVal.textContent = payload?.score?.toString().padStart(5, '0') || '00000';
        if (payload?.isTurbo) {
          scoreVal.style.color = '#ffeb3b';
          scoreVal.style.textShadow = '0 0 8px rgba(255, 235, 59, 0.6)';
        } else if (payload?.isSlowMo) {
          scoreVal.style.color = '#00ffff';
          scoreVal.style.textShadow = '0 0 8px rgba(0, 255, 255, 0.6)';
        } else if (payload?.isGhost) {
          scoreVal.style.color = '#9c27b0';
          scoreVal.style.textShadow = '0 0 8px rgba(156, 39, 176, 0.6)';
        } else {
          scoreVal.style.color = '#39ff14';
          scoreVal.style.textShadow = '0 0 8px rgba(57, 255, 20, 0.5)';
        }
      }

      // Check and update High Score
      const currentHighScore = parseInt(localStorage.getItem('snake_high_score') || '0', 10);
      if (payload?.score > currentHighScore) {
        localStorage.setItem('snake_high_score', payload.score.toString());
        const hsVal = document.getElementById('snake-highscore-val');
        if (hsVal) {
          hsVal.textContent = payload.score.toString().padStart(5, '0');
        }
      }

      // Spawns floating score popups
      const points = payload?.pointsGained || 10;
      const popup = document.createElement('div');
      
      const isSpecialEaten = payload?.isTurboEaten || payload?.isSlowMoEaten || payload?.isGhostEaten;
      if (payload?.isTurboEaten) {
        popup.innerHTML = `<span style="font-size: 0.6em; display: block; letter-spacing: 2px;">⚡ TURBO SPEED ⚡</span>+${points}`;
      } else if (payload?.isSlowMoEaten) {
        popup.innerHTML = `<span style="font-size: 0.6em; display: block; letter-spacing: 2px;">🐢 SLOW MOTION 🐢</span>+${points}`;
      } else if (payload?.isGhostEaten) {
        popup.innerHTML = `<span style="font-size: 0.6em; display: block; letter-spacing: 2px;">🛡️ GHOST MODE 🛡️</span>+${points}`;
      } else {
        popup.textContent = `+${points}`;
      }

      const randomOffsetX = (Math.random() - 0.5) * 80;
      const randomOffsetY = (Math.random() - 0.5) * 80;
      
      popup.style.position = 'absolute';
      popup.style.left = '50%';
      popup.style.top = '50%';
      popup.style.transform = `translate(-50%, -50%) translate(${randomOffsetX}px, ${randomOffsetY}px)`;
      popup.style.fontFamily = "'Courier New', Courier, monospace";
      popup.style.fontSize = isSpecialEaten ? '3.5rem' : '2.5rem';
      popup.style.fontWeight = 'bold';
      
      let popupColor = '#39ff14';
      if (payload?.isTurbo) {
        popupColor = '#ffeb3b';
      } else if (payload?.isSlowMo) {
        popupColor = '#00ffff';
      } else if (payload?.isGhost) {
        popupColor = '#9c27b0';
      }
      popup.style.color = popupColor;
      popup.style.textShadow = `0 0 10px ${popupColor}, 0 0 20px ${popupColor}`;
      popup.style.zIndex = '999999';
      popup.style.pointerEvents = 'none';
      popup.style.textAlign = 'center';

      document.body.appendChild(popup);

      gsap.to(popup, {
        y: -120,
        opacity: 0,
        duration: 1.5,
        ease: 'power2.out',
        onComplete: () => {
          if (popup.parentNode) {
            popup.parentNode.removeChild(popup);
          }
        }
      });
    });

    // Listen to Snake Game Over trigger
    this.eventBus.on('SNAKE_GAME:GAME_OVER' as any, (payload: any) => {
      const score = payload?.score || 0;
      this.handleSnakeGameOver(score);
    });

    // Listen to Camera Mode changes to cleanly stop driving game on experience exit
    this.eventBus.on(`${Domain.CAMERA}:${Action.CHANGE}` as AppEventName, (payload: any) => {
      if (payload?.mode === 'EXPERIENCE') {
        const safeSpawn = this.randomizeExperienceEntities();
        if (this.cameraSystem) {
          this.cameraSystem.setPlayerSpawnPosition(safeSpawn);
        }
        this.spawnStackedBoxes();
        this.rubiksCubeActor.mesh.visible = true;
        this.connect4Actor.mesh.visible = true;
      } else {
        if (this.carGameActive) {
          this.stopDrivingGame();
        }
        if (this.rubiksGameActive) {
          this.stopRubiksGame();
        }
        if (this.connect4GameActive) {
          this.stopConnect4Game();
        }
        this.cleanupVoxelPainter();
        this.rubiksCubeActor.mesh.visible = false;
        this.connect4Actor.mesh.visible = false;
        this.hideRubiksPopup();
        this.hideConnect4Popup();
      }
    });

  }

  private startTetrisTransition(): void {
    if (!this.cameraSystem) return;
    if (this.carGameActive || this.voxelPainterActive) return;

    document.body.classList.add('tetris-game-active');

    const pilePos = this.tetrisPileActor.mesh.position;

    // 1. Update HUD descriptions programmatically first so DOM elements exist when board starts
    const sectionHud = document.getElementById('section-hud');
    const hudTitle = document.getElementById('section-hud-title');
    const hudDesc = document.getElementById('section-hud-desc');
    const hudHint = document.getElementById('section-hud-hint');

    if (sectionHud) {
      sectionHud.classList.remove('hidden');
      sectionHud.classList.add('tetris-active-hud');
    }
    if (hudTitle) {
      hudTitle.textContent = 'ARCADE SIMULATION ACTIVE';
    }
    if (hudDesc) {
      hudDesc.textContent = 'PLAYING TETRIS...';
    }
    if (hudHint) {
      hudHint.innerHTML = `
        <div class="hud-desc-sub tetris-system-hint" style="color: var(--color-secondary); font-weight: bold; margin-bottom: 4px;">GIGGLE PHYSICS SIMULATION ENGINE IN EFFECT.</div>
        <div class="tetris-keyboard-hint" style="color: #fff; font-size: 0.75rem; line-height: 1.35; margin-bottom: 8px;">
          [A / D] or [Left / Right] to Slide.<br/>
          [W] or [Up] to Rotate.<br/>
          [S] or [Down] to Soft Drop.<br/>
          [Space] to Hard Drop.
        </div>
        <div id="tetris-score-panel" style="border-top: 1px dashed rgba(0, 240, 255, 0.2); padding-top: 6px; font-family: monospace;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span style="color: rgba(255, 255, 255, 0.65);">SCORE:</span>
            <span id="tetris-score-val" style="color: var(--color-primary); font-weight: bold;">00000</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span style="color: rgba(255, 255, 255, 0.65);">LEVEL:</span>
            <span id="tetris-level-val" style="color: var(--color-secondary); font-weight: bold;">1</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span style="color: rgba(255, 255, 255, 0.65);">LINES:</span>
            <span id="tetris-lines-val" style="color: #00ff55; font-weight: bold;">000</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: rgba(255, 255, 255, 0.65);">NEXT:</span>
            <span id="tetris-next-val" style="color: #ffffff; font-weight: bold;">-</span>
          </div>
          <button id="tetris-quit-btn" class="hud-tiny-btn" style="width: 100%; padding: 6px; font-size: 0.7rem; cursor: pointer; text-transform: uppercase;">QUIT / RETURN TO WORLD</button>
        </div>
      `;
    }

    const quitBtn = document.getElementById('tetris-quit-btn');
    if (quitBtn) {
      quitBtn.addEventListener('click', () => {
        this.stopTetrisTransition();
        this.relocateTetrisConsole();
      });
    }

    // Start the Tetris board gameplay and position it directly above the pile
    if (this.tetrisBoardActor) {
      this.tetrisBoardActor.mesh.position.set(pilePos.x, pilePos.y + 1.5, pilePos.z);
      this.tetrisBoardActor.start();
    }

    // 2. Mark camera system isTetrisActive to true
    this.cameraSystem.isTetrisActive = true;

    // 3. Dissolve the heap blocks
    if (this.tetrisPileActor) {
      this.tetrisPileActor.dissolve();
    }

    // 4. Animate player character scale down and position/rotation
    const robot = this.cameraSystem.getRobotCharacter();
    if (robot) {
      // Scale from 1.0 down to 0.25 (effective scale 0.2 -> 0.05)
      gsap.to(robot.mesh.scale, {
        x: 0.25,
        y: 0.25,
        z: 0.25,
        duration: 2.0,
        ease: 'power2.out'
      });

      // Angled slightly to the right to look at the board center
      gsap.to(robot.mesh.rotation, {
        y: 0.6,
        duration: 1.5,
        ease: 'power2.out'
      });
    }

    // Move player/robot position to a spectator offset relative to the pile
    const playerPos = this.cameraSystem.getPlayerPosition();
    gsap.to(playerPos, {
      x: pilePos.x - 1.2,
      y: pilePos.y,
      z: pilePos.z + 1.2,
      duration: 2.0,
      ease: 'power2.out'
    });

    // Set up responsive resize listener
    window.addEventListener('resize', this.handleTetrisResize);

    // Build Mobile virtual gamepad for Tetris Game
    if (!this.tetrisGamepadEl) {
      this.tetrisGamepadEl = document.createElement('div');
      this.tetrisGamepadEl.className = 'tetris-gamepad-container';
      this.tetrisGamepadEl.innerHTML = `
        <div class="tetris-pad-row">
          <button id="tetris-btn-left" class="tetris-pad-btn">◀</button>
          <button id="tetris-btn-rotate" class="tetris-pad-btn">↻</button>
          <button id="tetris-btn-right" class="tetris-pad-btn">▶</button>
        </div>
        <div class="tetris-pad-row" style="margin-top: 10px;">
          <button id="tetris-btn-soft" class="tetris-pad-btn long-btn">SOFT DROP</button>
          <button id="tetris-btn-hard" class="tetris-pad-btn long-btn">HARD DROP</button>
        </div>
      `;
      const uiLayer = document.getElementById('ui-layer') || document.body;
      uiLayer.appendChild(this.tetrisGamepadEl);

      // Bind interactions on gamepad buttons directly
      const btnLeft = document.getElementById('tetris-btn-left');
      const btnRotate = document.getElementById('tetris-btn-rotate');
      const btnRight = document.getElementById('tetris-btn-right');
      const btnSoft = document.getElementById('tetris-btn-soft');
      const btnHard = document.getElementById('tetris-btn-hard');

      if (btnLeft) {
        const triggerLeft = (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          if (this.tetrisBoardActor) this.tetrisBoardActor.slidePiece(-1);
        };
        btnLeft.addEventListener('touchstart', triggerLeft, { passive: false });
        btnLeft.addEventListener('mousedown', triggerLeft);
      }
      if (btnRotate) {
        const triggerRotate = (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          if (this.tetrisBoardActor) this.tetrisBoardActor.rotatePiece();
        };
        btnRotate.addEventListener('touchstart', triggerRotate, { passive: false });
        btnRotate.addEventListener('mousedown', triggerRotate);
      }
      if (btnRight) {
        const triggerRight = (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          if (this.tetrisBoardActor) this.tetrisBoardActor.slidePiece(1);
        };
        btnRight.addEventListener('touchstart', triggerRight, { passive: false });
        btnRight.addEventListener('mousedown', triggerRight);
      }
      if (btnSoft) {
        const triggerSoft = (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          if (this.tetrisBoardActor) this.tetrisBoardActor.softDrop(true);
        };
        btnSoft.addEventListener('touchstart', triggerSoft, { passive: false });
        btnSoft.addEventListener('mousedown', triggerSoft);
      }
      if (btnHard) {
        const triggerHard = (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          if (this.tetrisBoardActor) this.tetrisBoardActor.hardDrop();
        };
        btnHard.addEventListener('touchstart', triggerHard, { passive: false });
        btnHard.addEventListener('mousedown', triggerHard);
      }
    }

    // 5. Position the camera to a locked 3D viewport relative to the pile
    this.updateTetrisCamera(true);
  }

  private stopTetrisTransition(): void {
    if (!this.cameraSystem) return;

    document.body.classList.remove('tetris-game-active');

    // Clean up responsive resize listener & gamepad DOM elements
    window.removeEventListener('resize', this.handleTetrisResize);
    if (this.tetrisGamepadEl) {
      if (this.tetrisGamepadEl.parentNode) {
        this.tetrisGamepadEl.parentNode.removeChild(this.tetrisGamepadEl);
      }
      this.tetrisGamepadEl = null;
    }

    // 1. Stop the Tetris board gameplay
    if (this.tetrisBoardActor) {
      this.tetrisBoardActor.stop();
    }

    // 2. Reset and rebuild the scattered pile mesh
    if (this.tetrisPileActor) {
      this.tetrisPileActor.resetPile();
    }

    // 3. Animate player character scale back up to 1.0 (corresponds to normal 0.2 size)
    const robot = this.cameraSystem.getRobotCharacter();
    if (robot) {
      gsap.killTweensOf(robot.mesh.scale);
      gsap.to(robot.mesh.scale, {
        x: 1.0,
        y: 1.0,
        z: 1.0,
        duration: 2.0,
        ease: 'power2.out'
      });
    }

    // 4. Calculate camera's third-person target position and animate back smoothly
    const distance = 4.0;
    const height = 1.3;
    const playerPos = this.cameraSystem.getPlayerPosition();
    const yaw = robot ? robot.mesh.rotation.y : Math.PI;
    const pitch = 0.2; // default pitch

    const cameraOffset = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch) * distance,
      Math.sin(pitch) * distance + height,
      Math.cos(yaw) * Math.cos(pitch) * distance
    );
    const targetCamPos = playerPos.clone().add(cameraOffset);

    // Stop existing camera animations
    const camera = this.cameraSystem.getCamera();
    gsap.killTweensOf(camera.position);

    gsap.to(camera.position, {
      x: targetCamPos.x,
      y: targetCamPos.y,
      z: targetCamPos.z,
      duration: 2.0,
      ease: 'power2.out',
      onUpdate: () => {
        const currentLook = playerPos.clone().add(new THREE.Vector3(0, 1.1, 0));
        camera.lookAt(currentLook);
      },
      onComplete: () => {
        if (this.cameraSystem) {
          // Restore standard walking movement keyboard event listeners
          this.cameraSystem.isTetrisActive = false;
        }
      }
    });

    // 5. Update HUD descriptions back to standard system status descriptions
    const sectionHud = document.getElementById('section-hud');
    const hudTitle = document.getElementById('section-hud-title');
    const hudDesc = document.getElementById('section-hud-desc');
    const hudHint = document.getElementById('section-hud-hint');

    if (sectionHud) {
      sectionHud.classList.remove('tetris-active-hud');
    }
    if (hudTitle) {
      hudTitle.textContent = 'SECTOR: TECH SHOWCASE';
    }
    if (hudDesc) {
      hudDesc.textContent = 'COGNITIVE REPOSITORY OF SKILLS & ARCHITECTURAL PATTERNS ONLINE. 5 CORES ACTIVE.';
    }
    if (hudHint) {
      hudHint.textContent = '';
    }
  }

  /**
   * Called per frame to update 3D entities.
   */
  public update(time: number): void {
    let dt = 0.016;
    if (this.lastUpdateTime > 0) {
      dt = Math.min(time - this.lastUpdateTime, 0.1);
    }
    this.lastUpdateTime = time;

    // Rotate the internal Hilbert splines inside voxel boxes and rollover preview
    const splineTime = time * 0.25;
    this.voxelBoxes.forEach((box) => {
      box.children.forEach((child) => {
        if (child instanceof THREE.Line && !(child instanceof THREE.LineSegments)) {
          child.rotation.x = splineTime;
          child.rotation.y = splineTime;
        }
      });
    });

    if (this.rollOverMesh && this.rollOverMesh.visible) {
      this.rollOverMesh.children.forEach((child) => {
        if (child instanceof THREE.Line && !(child instanceof THREE.LineSegments)) {
          child.rotation.x = splineTime;
          child.rotation.y = splineTime;
        }
      });
    }

    const isExperienceActive = this.cameraSystem?.getMode() === 'EXPERIENCE';
    if (this.stage) this.stage.update(time, isExperienceActive);
    if (this.backgroundPeopleActor) this.backgroundPeopleActor.update(time);
    if (this.jellyFaceActor) this.jellyFaceActor.update(time);
    if (this.projectActor) this.projectActor.update(time);
    if (this.skillsActor) this.skillsActor.update(time);
    if (this.resumeActor) this.resumeActor.update(time);
    if (this.aboutActor) this.aboutActor.update(time);
    if (this.tetrisPileActor) this.tetrisPileActor.update(time);
    if (this.tetrisBoardActor) this.tetrisBoardActor.update(time);
    if (this.snakeActor) this.snakeActor.update(time);
    if (this.snakeGameActor) this.snakeGameActor.update(time);
    if (this.rubiksCubeActor) this.rubiksCubeActor.update(time);
    if (this.connect4Actor) this.connect4Actor.update(time);

    // Run custom arcade vehicle physics frame
    if (this.carActor) {
      this.carActor.updatePhysics(dt);

      // Update drift HUD telemetry status if game is active
      if (this.carGameActive) {
        const driftEl = document.getElementById('driving-drift-status');
        if (driftEl) {
          if (this.carActor.isDrifting) {
            driftEl.style.visibility = 'visible';
            driftEl.style.opacity = (0.6 + Math.sin(time * 15.0) * 0.4).toString();
          } else {
            driftEl.style.visibility = 'hidden';
          }
        }
      }
    }

    // Update floating collectible orbs
    if (this.carGameActive) {
      this.checkOrbCollisions();
      this.orbs.forEach((orb) => {
        orb.rotation.y += dt * 2.0;
        orb.rotation.x += dt * 1.5;
        // Float animation
        orb.position.y = -2.5 + Math.sin(time * 3.0 + orb.position.x * 2.0) * 0.4;
      });
    }

    // Trigger proximity checks
    if (this.cameraSystem) {
      if (
        this.cameraSystem.getMode() !== 'EXPERIENCE' ||
        this.cameraSystem.isTetrisActive ||
        this.cameraSystem.isConnect4Active ||
        this.cameraSystem.isRubiksCubeActive ||
        this.carGameActive ||
        this.voxelPainterActive ||
        this.snakeGameActive ||
        this.rubiksGameActive ||
        this.connect4GameActive
      ) {
        this.hideTetrisPopup();
        this.hideCarPopup();
        this.hideVoxelPopup();
        this.hideSnakePopup();
        this.hideRubiksPopup();
        this.hideConnect4Popup();
        return;
      }
      const playerPos = this.cameraSystem.getPlayerPosition();
      
      // Snake proximity
      const snakePos = this.snakeActor.mesh.position;
      const sdx = playerPos.x - snakePos.x;
      const sdz = playerPos.z - snakePos.z;
      const snakeDistance = Math.sqrt(sdx * sdx + sdz * sdz);

      // Tetris console proximity
      const targetPos = this.tetrisPileActor.mesh.position;
      const dx = playerPos.x - targetPos.x;
      const dz = playerPos.z - targetPos.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      // Car proximity
      const carPos = this.carActor.mesh.position;
      const cdx = playerPos.x - carPos.x;
      const cdz = playerPos.z - carPos.z;
      const carDistance = Math.sqrt(cdx * cdx + cdz * cdz);

      // Rubik's proximity
      const rubiksPos = this.rubiksCubeActor.mesh.position;
      const rdx = playerPos.x - rubiksPos.x;
      const rdz = playerPos.z - rubiksPos.z;
      const rubiksDistance = Math.sqrt(rdx * rdx + rdz * rdz);

      // Connect 4 proximity
      const connect4Pos = this.connect4Actor.mesh.position;
      const c4dx = playerPos.x - connect4Pos.x;
      const c4dz = playerPos.z - connect4Pos.z;
      const connect4Distance = Math.sqrt(c4dx * c4dx + c4dz * c4dz);

      // Reset walked-away flags if player leaves proximity zone
      if (connect4Distance > 3.0) {
        this.hasWalkedAwayFromConnect4 = true;
      }
      if (rubiksDistance > 3.0) {
        this.hasWalkedAwayFromRubiks = true;
      }

      if (snakeDistance < 2.2) {
        this.hideTetrisPopup();
        this.hideCarPopup();
        this.hideVoxelPopup();
        this.hideRubiksPopup();
        this.hideConnect4Popup();
        this.showSnakePopup();
      } else if (carDistance < 2.5) {
        this.hideTetrisPopup();
        this.hideVoxelPopup();
        this.hideSnakePopup();
        this.hideRubiksPopup();
        this.hideConnect4Popup();
        this.showCarPopup();
      } else if (distance < 1.8) {
        this.hideCarPopup();
        this.hideVoxelPopup();
        this.hideSnakePopup();
        this.hideRubiksPopup();
        this.hideConnect4Popup();
        this.showTetrisPopup();
      } else if (rubiksDistance < 2.5) {
        this.hideTetrisPopup();
        this.hideCarPopup();
        this.hideVoxelPopup();
        this.hideSnakePopup();
        this.hideConnect4Popup();
        
        if (this.rubiksState === 'scattered' && this.hasWalkedAwayFromRubiks) {
          this.rubiksState = 'assembling';
          // Smoothly hover the cube above the ground plane
          gsap.to(this.rubiksCubeActor.mesh.position, {
            y: -2.8,
            duration: 1.5,
            ease: 'power2.out'
          });
          this.rubiksCubeActor.assembleFromPile().then(() => {
            this.rubiksState = 'assembled';
            if (rubiksDistance < 2.5 && !this.rubiksGameActive && this.hasWalkedAwayFromRubiks) {
              this.showRubiksPopup();
            }
          });
        } else if (this.rubiksState === 'assembled') {
          if (!this.rubiksGameActive && this.hasWalkedAwayFromRubiks) {
            this.showRubiksPopup();
          }
        }
      } else if (connect4Distance < 2.5) {
        this.hideTetrisPopup();
        this.hideCarPopup();
        this.hideVoxelPopup();
        this.hideSnakePopup();
        this.hideRubiksPopup();

        if (!this.connect4GameActive && this.hasWalkedAwayFromConnect4) {
          this.showConnect4Popup();
        }
      } else {
        this.hideTetrisPopup();
        this.hideCarPopup();
        this.hideSnakePopup();
        this.hideRubiksPopup();
        this.hideConnect4Popup();
        
        if (this.rubiksState === 'assembled') {
          this.rubiksState = 'dissolving';
          // Smoothly drop the cube back to the ground pile position
          gsap.to(this.rubiksCubeActor.mesh.position, {
            y: -4.0,
            duration: 1.2,
            ease: 'power2.inOut'
          });
          this.rubiksCubeActor.dissolveToPile().then(() => {
            this.rubiksState = 'scattered';
          });
        }
        
        this.checkVoxelProximity();
      }
    }
  }

  private showCarPopup(): void {
    if (!this.carPopupEl) {
      this.carPopupEl = document.createElement('div');
      this.carPopupEl.id = 'car-proximity-popup';
      this.carPopupEl.className = 'tetris-popup glass hidden';
      this.carPopupEl.innerHTML = `
        <div class="tetris-popup__title" style="color: #ff3333; text-shadow: 0 0 8px rgba(255, 51, 51, 0.5);">DRIVE VEHICLE?</div>
        <div style="font-size: 0.8rem; color: #aaa; margin-bottom: 12px; text-align: center;">Press [E] or click below to start driving</div>
        <button id="car-drive-now-btn" class="tetris-popup__btn" style="background: linear-gradient(135deg, rgba(255, 51, 51, 0.8), rgba(255, 102, 0, 0.8));">DRIVE NOW</button>
      `;

      const uiLayer = document.getElementById('ui-layer') || document.body;
      uiLayer.appendChild(this.carPopupEl);

      const driveBtn = document.getElementById('car-drive-now-btn');
      if (driveBtn) {
        driveBtn.addEventListener('click', () => {
          console.log('PortfolioScene: Drive Vehicle clicked!');
          this.hideCarPopup();
          this.startDrivingGame();
        });
      }

      setTimeout(() => {
        if (this.carPopupEl) {
          this.carPopupEl.classList.remove('hidden');
        }
      }, 50);
    } else {
      this.carPopupEl.classList.remove('hidden');
    }
  }

  private hideCarPopup(): void {
    if (this.carPopupEl && !this.carPopupEl.classList.contains('hidden')) {
      this.carPopupEl.classList.add('hidden');
    }
  }

  private startDrivingGame(): void {
    if (!this.cameraSystem) return;
    if (this.cameraSystem.isTetrisActive || this.voxelPainterActive) return;

    // Blur any focused element (like the DRIVE NOW button) so pressing spacebar does not trigger it again
    (document.activeElement as HTMLElement)?.blur();

    // Defensively clear any existing timers to prevent duplicates or loops
    if (this.carGameTimerInterval) {
      clearInterval(this.carGameTimerInterval);
      this.carGameTimerInterval = null;
    }

    this.carGameActive = true;
    this.carGameScore = 0;
    this.carGameTimer = 30;

    document.body.classList.add('driving-game-active');

    // Build Mobile virtual gamepad for Driving Game
    if (!this.drivingGamepadEl) {
      this.drivingGamepadEl = document.createElement('div');
      this.drivingGamepadEl.id = 'driving-gamepad';
      this.drivingGamepadEl.className = 'driving-gamepad-container';
      this.drivingGamepadEl.innerHTML = `
        <div class="driving-steering-container">
          <button class="driving-btn steering-btn btn-left" id="driving-btn-left">◀</button>
          <button class="driving-btn steering-btn btn-right" id="driving-btn-right">▶</button>
        </div>
        <div class="driving-pedals-container">
          <button class="driving-btn pedal-btn btn-handbrake" id="driving-btn-handbrake">
            <span class="pedal-label">BRAKE</span>
            <span class="pedal-sub">DRIFT</span>
          </button>
          <div class="pedals-stacked">
            <button class="driving-btn stacked-pedal-btn btn-gas" id="driving-btn-gas">
              <span class="pedal-label">GAS</span>
            </button>
            <button class="driving-btn stacked-pedal-btn btn-reverse" id="driving-btn-reverse">
              <span class="pedal-label">REVERSE</span>
            </button>
          </div>
        </div>
      `;
      const uiLayer = document.getElementById('ui-layer') || document.body;
      uiLayer.appendChild(this.drivingGamepadEl);

      // Bind interactions on driving gamepad buttons directly
      const btnLeft = document.getElementById('driving-btn-left');
      const btnRight = document.getElementById('driving-btn-right');
      const btnGas = document.getElementById('driving-btn-gas');
      const btnReverse = document.getElementById('driving-btn-reverse');
      const btnHandbrake = document.getElementById('driving-btn-handbrake');

      const setupDrivingBtn = (btn: HTMLElement | null, startAction: () => void, endAction: () => void) => {
        if (!btn) return;
        const onStart = (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          startAction();
        };
        const onEnd = (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          endAction();
        };
        btn.addEventListener('touchstart', onStart, { passive: false });
        btn.addEventListener('touchend', onEnd, { passive: false });
        btn.addEventListener('touchcancel', onEnd, { passive: false });
        btn.addEventListener('mousedown', onStart);
        btn.addEventListener('mouseup', onEnd);
        btn.addEventListener('mouseleave', onEnd);
      };

      setupDrivingBtn(
        btnLeft,
        () => {
          this.carActor.inputs.steer = 1;
          btnLeft?.classList.add('active');
        },
        () => {
          if (this.carActor.inputs.steer === 1) this.carActor.inputs.steer = 0;
          btnLeft?.classList.remove('active');
        }
      );

      setupDrivingBtn(
        btnRight,
        () => {
          this.carActor.inputs.steer = -1;
          btnRight?.classList.add('active');
        },
        () => {
          if (this.carActor.inputs.steer === -1) this.carActor.inputs.steer = 0;
          btnRight?.classList.remove('active');
        }
      );

      setupDrivingBtn(
        btnGas,
        () => {
          this.carActor.inputs.forward = 1;
          btnGas?.classList.add('active');
        },
        () => {
          if (this.carActor.inputs.forward === 1) this.carActor.inputs.forward = 0;
          btnGas?.classList.remove('active');
        }
      );

      setupDrivingBtn(
        btnReverse,
        () => {
          this.carActor.inputs.forward = -1;
          btnReverse?.classList.add('active');
        },
        () => {
          if (this.carActor.inputs.forward === -1) this.carActor.inputs.forward = 0;
          btnReverse?.classList.remove('active');
        }
      );

      setupDrivingBtn(
        btnHandbrake,
        () => {
          this.carActor.inputs.brake = true;
          btnHandbrake?.classList.add('active');
        },
        () => {
          this.carActor.inputs.brake = false;
          btnHandbrake?.classList.remove('active');
        }
      );
    }

    // Reset and position vehicle (ensure visible and scaled)
    this.carActor.mesh.visible = true;
    const playerPos = this.cameraSystem.getPlayerPosition();
    this.carActor.relocateCar(playerPos.clone().add(new THREE.Vector3(0, 0.5, 0)));
    this.carActor.isActive = true;

    // Connect vehicle tracking camera
    this.cameraSystem.setDrivingCar(this.carActor.mesh);
    this.cameraSystem.isDrivingActive = true;

    // Animate character model down to hide it
    const robot = this.cameraSystem.getRobotCharacter();
    if (robot) {
      gsap.to(robot.mesh.scale, {
        x: 0,
        y: 0,
        z: 0,
        duration: 0.5,
        ease: 'power2.inOut'
      });
    }

    // Spawn 15 randomly spread floating orbs
    this.spawnOrbs();

    // Create and display the custom driving HUD
    const sectionHud = document.getElementById('section-hud');
    const hudTitle = document.getElementById('section-hud-title');
    const hudDesc = document.getElementById('section-hud-desc');
    const hudHint = document.getElementById('section-hud-hint');

    if (sectionHud) {
      sectionHud.classList.remove('hidden');
      sectionHud.classList.add('tetris-active-hud'); // borrows styling safely
    }
    if (hudTitle) {
      hudTitle.textContent = 'VEHICLE SYSTEM DIAGNOSTIC';
    }
    if (hudDesc) {
      hudDesc.textContent = 'ARCADE ORB CAPTURE IN PROGRESS';
    }
    if (hudHint) {
      hudHint.innerHTML = `
        <div class="hud-desc-sub" style="color: #ff3333; font-weight: bold; margin-bottom: 4px;">MISSION: COLLECT 15 ORBS IN 30 SECONDS.</div>
        <div class="driving-keyboard-hint" style="color: #fff; font-size: 0.75rem; line-height: 1.35; margin-bottom: 8px;">
          [WASD] or [Arrows] to Steer / Drive.<br/>
          [Space] to Handbrake / Stop.<br/>
          [R] to Reset Car Position.
        </div>
        <div id="driving-panel" style="border-top: 1px dashed rgba(255, 51, 51, 0.2); padding-top: 6px; font-family: monospace;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span style="color: rgba(255, 255, 255, 0.65);">TIME REMAINING:</span>
            <span id="driving-timer-val" style="color: #ffca00; font-weight: bold;">30s</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: rgba(255, 255, 255, 0.65);">ORBS FETCHED:</span>
            <span id="driving-score-val" style="color: #00ff55; font-weight: bold;">0 / 15</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: rgba(255, 255, 255, 0.65);">TELEMETRY:</span>
            <span id="driving-drift-status" style="color: #ff3333; font-weight: bold; text-shadow: 0 0 6px #ff3333; visibility: hidden;">DRIFTING!</span>
          </div>
          <button id="driving-quit-btn" class="hud-tiny-btn" style="width: 100%; padding: 6px; font-size: 0.7rem; cursor: pointer; text-transform: uppercase; border-color: rgba(255, 51, 51, 0.3);">EXIT VEHICLE</button>
        </div>
      `;
    }

    const quitBtn = document.getElementById('driving-quit-btn');
    if (quitBtn) {
      quitBtn.addEventListener('click', () => {
        this.stopDrivingGame();
      });
    }

    // Set countdown timer
    this.carGameTimerInterval = setInterval(() => {
      this.carGameTimer--;
      const timerEl = document.getElementById('driving-timer-val');
      if (timerEl) {
        timerEl.textContent = `${this.carGameTimer}s`;
        if (this.carGameTimer <= 5) {
          timerEl.style.color = '#ff3333';
        }
      }

      if (this.carGameTimer <= 0) {
        this.stopDrivingGame(true);
      }
    }, 1000);
  }

  private stopDrivingGame(timeFinished: boolean = false): void {
    if (this.carGameTimerInterval) {
      clearInterval(this.carGameTimerInterval);
      this.carGameTimerInterval = null;
    }

    this.carGameActive = false;
    this.carActor.isActive = false;

    // Reset inputs
    if (this.carActor) {
      this.carActor.inputs.forward = 0;
      this.carActor.inputs.steer = 0;
      this.carActor.inputs.brake = false;
    }

    document.body.classList.remove('driving-game-active');

    // Clean up driving gamepad DOM elements
    if (this.drivingGamepadEl) {
      if (this.drivingGamepadEl.parentNode) {
        this.drivingGamepadEl.parentNode.removeChild(this.drivingGamepadEl);
      }
      this.drivingGamepadEl = null;
    }

    // Vanish/Hide the car as requested
    this.carActor.mesh.visible = false;

    if (this.cameraSystem) {
      this.cameraSystem.isDrivingActive = false;
      this.cameraSystem.setDrivingCar(null);

      // Place player character model next to the car and restore its scale
      const robot = this.cameraSystem.getRobotCharacter();
      const carPos = this.carActor.mesh.position;
      const playerPos = this.cameraSystem.getPlayerPosition();

      // Position player offset from vehicle where the game ended
      playerPos.copy(carPos).add(new THREE.Vector3(1, -0.15, 1));

      if (robot) {
        gsap.to(robot.mesh.scale, {
          x: 1.0,
          y: 1.0,
          z: 1.0,
          duration: 0.5,
          ease: 'power2.inOut'
        });
      }
    }

    // Clean up orbs
    this.clearOrbs();

    // Reset HUD descriptions
    const sectionHud = document.getElementById('section-hud');
    const hudTitle = document.getElementById('section-hud-title');
    const hudDesc = document.getElementById('section-hud-desc');
    const hudHint = document.getElementById('section-hud-hint');

    if (sectionHud) {
      sectionHud.classList.remove('tetris-active-hud');
    }
    if (hudTitle) {
      hudTitle.textContent = 'SECTOR: TECH SHOWCASE';
    }
    if (hudDesc) {
      hudDesc.textContent = 'COGNITIVE REPOSITORY OF SKILLS & ARCHITECTURAL PATTERNS ONLINE. 5 CORES ACTIVE.';
    }
    if (hudHint) {
      hudHint.textContent = 'Tap the center console to enter GRID RUNNER arcade simulation. Hover and click orbiting capsules to decrypt sub-skill telemetry.';
    }

    // Relocate vehicle randomly again to another canvas location within the NW quadrant, and restore visibility
    const cx = -18 + (Math.random() - 0.5) * 10;
    const cz = 18 + (Math.random() - 0.5) * 10;
    this.carActor.relocateCar(new THREE.Vector3(cx, -3.7, cz));
    this.carActor.mesh.visible = true;

    // Display summary toast (ALWAYS display the score in a nice toast as requested)
    const toastContainer = document.getElementById('toast-container');
    if (toastContainer) {
      const toast = document.createElement('div');
      toast.className = 'hud-toast success';
      toast.style.borderColor = 'rgba(255, 51, 51, 0.4)';
      
      const titleText = timeFinished ? "TIME'S UP!" : "ARCADE TELEMETRY";
      toast.innerHTML = `
        <div class="hud-toast-header" style="color: #ff3333;">
          <span>MISSION DEBRIEFING</span>
          <span>COMPLETE</span>
        </div>
        <div class="hud-toast-body">
          <strong class="toast-glitch-text" style="color: #ff9900;">${titleText}</strong><br/>
          You collected <span style="color: #00ff55; font-weight: bold;">${this.carGameScore} / 15</span> floating orbs.<br/>
          The vehicle has vanished and relocated to a new diagnostic sector.
        </div>
      `;
      toastContainer.appendChild(toast);
      setTimeout(() => {
        toast.classList.add('toast-fade-out');
        setTimeout(() => {
          if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
      }, 5000);
    }
  }

  private spawnOrbs(): void {
    const scene = this.carActor.mesh.parent as THREE.Scene;
    if (!scene) return;

    this.clearOrbs();

    // Spawn 15 floating collectible orbs spread across the accessible bounding area (circle of radius 46)
    for (let i = 0; i < 15; i++) {
      const orbGeo = new THREE.SphereGeometry(0.4, 16, 16);
      const orbMat = new THREE.MeshBasicMaterial({
        color: 0x00ffcc,
        wireframe: true
      });
      const orb = new THREE.Mesh(orbGeo, orbMat);

      // Distribute uniformly in a circle with polar coordinates up to radius 46 (within 50u bounding limit)
      const angle = Math.random() * Math.PI * 2;
      const minRadius = 6;
      const maxRadius = 46;
      const radius = minRadius + Math.sqrt(Math.random()) * (maxRadius - minRadius);

      const ox = Math.cos(angle) * radius;
      const oz = Math.sin(angle) * radius;

      orb.position.set(ox, -2.5, oz);
      scene.add(orb);
      this.orbs.push(orb);
    }
  }

  private clearOrbs(): void {
    this.orbs.forEach((orb) => {
      if (orb.parent) {
        orb.parent.remove(orb);
      }
      if (orb.geometry) orb.geometry.dispose();
      if (orb.material) (orb.material as THREE.Material).dispose();
    });
    this.orbs = [];
  }

  private checkOrbCollisions(): void {
    const carPos = this.carActor.mesh.position;
    const collectionDist = 1.8;

    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const orb = this.orbs[i];
      const dist = carPos.distanceTo(orb.position);

      if (dist < collectionDist) {
        // Collect orb!
        this.carGameScore++;
        
        // Remove orb mesh
        if (orb.parent) orb.parent.remove(orb);
        orb.geometry.dispose();
        (orb.material as THREE.Material).dispose();
        this.orbs.splice(i, 1);

        // Update score HUD
        const scoreEl = document.getElementById('driving-score-val');
        if (scoreEl) {
          scoreEl.textContent = `${this.carGameScore} / 15`;
        }

        // Emit neat sparks/toast or visual splash
        if (this.carGameScore >= 15) {
          this.stopDrivingGame(true);
          break;
        }
      }
    }
  }

  private showTetrisPopup(): void {
    if (this.cameraSystem && this.cameraSystem.isTetrisActive) {
      this.hideTetrisPopup();
      return;
    }

    if (!this.tetrisPopupEl) {
      this.tetrisPopupEl = document.createElement('div');
      this.tetrisPopupEl.id = 'tetris-proximity-popup';
      this.tetrisPopupEl.className = 'tetris-popup glass hidden';
      this.tetrisPopupEl.innerHTML = `
        <div class="tetris-popup__title">WANT TO PLAY TETRIS?</div>
        <button id="tetris-play-now-btn" class="tetris-popup__btn">PLAY NOW</button>
      `;

      const uiLayer = document.getElementById('ui-layer') || document.body;
      uiLayer.appendChild(this.tetrisPopupEl);

      const playBtn = document.getElementById('tetris-play-now-btn');
      if (playBtn) {
        playBtn.addEventListener('click', () => {
          console.log('PortfolioScene: Play Tetris Now Clicked!');
          this.hideTetrisPopup();
          this.eventBus.emit('TETRIS:START' as any);
        });
      }

      // Small tick to animate after appending
      setTimeout(() => {
        if (this.tetrisPopupEl) {
          this.tetrisPopupEl.classList.remove('hidden');
        }
      }, 50);
    } else {
      this.tetrisPopupEl.classList.remove('hidden');
    }
  }

  private hideTetrisPopup(): void {
    if (this.tetrisPopupEl && !this.tetrisPopupEl.classList.contains('hidden')) {
      this.tetrisPopupEl.classList.add('hidden');
    }
  }

  private showGameOverToast(score: number): void {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = 'hud-toast success';
    toast.innerHTML = `
      <div class="hud-toast-header">
        <span>ARCADE TELEMETRY</span>
        <span>NOW</span>
      </div>
      <div class="hud-toast-body">
        <strong class="toast-glitch-text" style="color: #ff0055;">TETRIS GAME OVER</strong><br/>
        Final Score: <span style="color: var(--color-primary); font-weight: bold;">${score}</span><br/>
        The simulation matrix has relocated the console to a new coordinate!
      </div>
    `;

    toastContainer.appendChild(toast);

    // Fade out and remove after 5 seconds
    setTimeout(() => {
      toast.classList.add('toast-fade-out');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 5000);
  }

  private relocateTetrisConsole(): void {
    // Relocate to a random location in NE quadrant (on the floor)
    const rx = 18 + (Math.random() - 0.5) * 10;
    const rz = 18 + (Math.random() - 0.5) * 10;
    
    // Set position and force matrices to update so particle/mesh generation is correct
    if (this.tetrisPileActor) {
      this.tetrisPileActor.mesh.position.set(rx, -4, rz);
      this.tetrisPileActor.mesh.updateMatrixWorld(true);
    }

    console.log(`Tetris console relocated to X: ${rx.toFixed(2)}, Z: ${rz.toFixed(2)}`);
  }

  private handleGameOver(score: number): void {
    // 1. Side toast with score
    this.showGameOverToast(score);

    // 2. View changes back to the robot
    this.stopTetrisTransition();

    // 3. Relocate to a random location in canvas (on the floor)
    this.relocateTetrisConsole();
  }

  private showSnakePopup(): void {
    if (this.cameraSystem && this.cameraSystem.isSnakeGameActive) {
      this.hideSnakePopup();
      return;
    }

    if (!this.snakePopupEl) {
      this.snakePopupEl = document.createElement('div');
      this.snakePopupEl.id = 'snake-proximity-popup';
      this.snakePopupEl.className = 'tetris-popup glass hidden';
      this.snakePopupEl.innerHTML = `
        <div class="tetris-popup__title" style="color: #39ff14; text-shadow: 0 0 8px rgba(57, 255, 20, 0.5);">PLAY SNAKE GAME?</div>
        <div style="font-size: 0.8rem; color: #aaa; margin-bottom: 12px; text-align: center;">Press [E] or click below to start playing</div>
        <button id="snake-play-now-btn" class="tetris-popup__btn" style="background: linear-gradient(135deg, rgba(57, 255, 20, 0.8), rgba(0, 240, 255, 0.8)); border-color: rgba(57, 255, 20, 0.3);">PLAY NOW</button>
      `;

      const uiLayer = document.getElementById('ui-layer') || document.body;
      uiLayer.appendChild(this.snakePopupEl);

      const playBtn = document.getElementById('snake-play-now-btn');
      if (playBtn) {
        playBtn.addEventListener('click', () => {
          console.log('PortfolioScene: Play Snake clicked!');
          this.hideSnakePopup();
          this.startSnakeGame();
        });
      }

      setTimeout(() => {
        if (this.snakePopupEl) {
          this.snakePopupEl.classList.remove('hidden');
        }
      }, 50);
    } else {
      this.snakePopupEl.classList.remove('hidden');
    }
  }

  private hideSnakePopup(): void {
    if (this.snakePopupEl && !this.snakePopupEl.classList.contains('hidden')) {
      this.snakePopupEl.classList.add('hidden');
    }
  }

  private updateTetrisCamera(isInitial: boolean): void {
    if (!this.cameraSystem) return;
    const pilePos = this.tetrisPileActor.mesh.position;
    const aspect = window.innerWidth / window.innerHeight;

    let targetPos: [number, number, number];
    let targetRot: [number, number, number] = [0, 0, 0];
    let targetFov = 75;

    if (aspect < 1.0) {
      // Portrait mode: scale tower based on height/aspect.
      // Move camera back (larger Z offset) so that the entire vertical tower is perfectly centered and scaled
      const distOffset = Math.max(2.2, 2.2 / aspect);
      targetPos = [pilePos.x, pilePos.y + 1.65, pilePos.z + distOffset];
      targetRot = [-0.05, 0, 0]; // slight downward tilt to center it above the bottom controls
      targetFov = 75;
    } else {
      // Landscape mode
      targetPos = [pilePos.x, pilePos.y + 1.5, pilePos.z + 2.2];
      targetRot = [0, 0, 0];
      targetFov = 75;
    }

    if (isInitial) {
      this.cameraSystem.moveTo(targetPos, targetRot, targetFov);
    } else {
      const camera = this.cameraSystem.getCamera();
      gsap.killTweensOf(camera);
      gsap.killTweensOf(camera.position);
      gsap.killTweensOf(camera.quaternion);

      camera.position.set(targetPos[0], targetPos[1], targetPos[2]);
      camera.quaternion.setFromEuler(new THREE.Euler(targetRot[0], targetRot[1], targetRot[2], 'XYZ'));
      camera.fov = targetFov;
      camera.updateProjectionMatrix();
    }
  }

  private updateSnakeGameCamera(isInitial: boolean): void {
    if (!this.cameraSystem) return;
    const snakePos = this.snakeActor.mesh.position;
    const aspect = window.innerWidth / window.innerHeight;

    let targetPos: [number, number, number];
    let targetRot: [number, number, number];
    let targetFov = 75;

    if (aspect < 1.0) {
      // Portrait mode: tilt the camera up (elevate tilt angle), higher Y, offset Z to keep board on the top half of viewport
      targetPos = [snakePos.x, 5.8, snakePos.z + 1.4];
      targetRot = [-1.15, 0, 0];
      targetFov = Math.max(75, Math.min(95, 75 / aspect)); // Dynamic FOV stretch to fit board width perfectly
    } else {
      // Landscape mode: standard overhead top view
      targetPos = [snakePos.x, 4.6, snakePos.z + 0.1];
      targetRot = [-Math.PI / 2, 0, 0];
      targetFov = 75;
    }

    if (isInitial) {
      // Initial cinematic transition on game start
      this.cameraSystem.moveTo(targetPos, targetRot, targetFov);
    } else {
      // Instant updates during active resizing
      const camera = this.cameraSystem.getCamera();
      gsap.killTweensOf(camera);
      gsap.killTweensOf(camera.position);
      gsap.killTweensOf(camera.quaternion);

      camera.position.set(targetPos[0], targetPos[1], targetPos[2]);
      camera.quaternion.setFromEuler(new THREE.Euler(targetRot[0], targetRot[1], targetRot[2], 'XYZ'));
      camera.fov = targetFov;
      camera.updateProjectionMatrix();
    }
  }

  private startSnakeGame(): void {
    if (!this.cameraSystem) return;
    if (this.cameraSystem.isTetrisActive || this.carGameActive || this.voxelPainterActive) return;

    (document.activeElement as HTMLElement)?.blur();

    this.snakeGameActive = true;
    this.cameraSystem.isSnakeGameActive = true;
    document.body.classList.add('snake-game-active');

    // Position snake game board on floor where snake was
    const snakePos = this.snakeActor.mesh.position;
    this.snakeGameActor.mesh.position.set(snakePos.x, -3.98, snakePos.z);
    this.snakeGameActor.start();

    // Hide physical roaming snake mesh
    this.snakeActor.mesh.visible = false;

    // Make character hover/fly mid-air above the grid
    const robot = this.cameraSystem.getRobotCharacter();
    const playerPos = this.cameraSystem.getPlayerPosition();

    if (robot) {
      robot.setTransparency(true);
    }

    // Robot flies up
    gsap.to(playerPos, {
      x: snakePos.x,
      y: -2.3, // hovering
      z: snakePos.z + 1.2,
      duration: 1.5,
      ease: 'power2.out'
    });

    if (robot) {
      // Slightly scale up or keep size, but rotate to face board center
      gsap.to(robot.mesh.scale, {
        x: 1.0,
        y: 1.0,
        z: 1.0,
        duration: 1.5,
        ease: 'power2.out'
      });
      gsap.to(robot.mesh.rotation, {
        y: 0,
        duration: 1.2,
        ease: 'power2.out'
      });
    }

    // Overhead top camera view adapted dynamically based on orientation
    this.updateSnakeGameCamera(true);

    // Set up responsive resize listener
    window.addEventListener('resize', this.handleSnakeResize);

    // Build Mobile virtual D-pad Component
    if (!this.snakeDpadEl) {
      this.snakeDpadEl = document.createElement('div');
      this.snakeDpadEl.className = 'snake-dpad-container';
      this.snakeDpadEl.innerHTML = `
        <button class="snake-dpad-btn snake-dpad-up" data-key="w">▲</button>
        <button class="snake-dpad-btn snake-dpad-left" data-key="a">◀</button>
        <button class="snake-dpad-btn snake-dpad-right" data-key="d">▶</button>
        <button class="snake-dpad-btn snake-dpad-down" data-key="s">▼</button>
      `;
      const uiLayer = document.getElementById('ui-layer') || document.body;
      uiLayer.appendChild(this.snakeDpadEl);

      // Bind touch and mouse interaction on D-pad buttons directly to handleInput
      const buttons = this.snakeDpadEl.querySelectorAll('.snake-dpad-btn');
      buttons.forEach(btn => {
        const key = btn.getAttribute('data-key') || '';
        
        const triggerInput = (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          this.snakeGameActor.handleInput(key);
          
          btn.classList.add('active');
          setTimeout(() => btn.classList.remove('active'), 100);
        };

        btn.addEventListener('touchstart', triggerInput, { passive: false });
        btn.addEventListener('mousedown', triggerInput);
      });
    }

    // Setup Custom HUD Score panel
    const sectionHud = document.getElementById('section-hud');
    const hudTitle = document.getElementById('section-hud-title');
    const hudDesc = document.getElementById('section-hud-desc');
    const hudHint = document.getElementById('section-hud-hint');

    if (sectionHud) {
      sectionHud.classList.remove('hidden');
      sectionHud.classList.add('tetris-active-hud');
    }
    if (hudTitle) {
      hudTitle.textContent = 'NEON SNAKE ACTIVE';
    }
    if (hudDesc) {
      hudDesc.textContent = 'SNAKE SIMULATION IN EFFECT';
    }
    if (hudHint) {
      const highScore = parseInt(localStorage.getItem('snake_high_score') || '0', 10);
      hudHint.innerHTML = `
        <div class="hud-desc-sub" style="color: #39ff14; font-weight: bold; margin-bottom: 4px;">MISSION: COLLECT GLOWING NODES & SURVIVE.</div>
        <div class="snake-keyboard-hint" style="color: #fff; font-size: 0.75rem; line-height: 1.35; margin-bottom: 8px;">
          [W / A / S / D] or [Arrows] to Slither.
        </div>
        <div id="snake-panel" style="border-top: 1px dashed rgba(57, 255, 20, 0.2); padding-top: 6px; font-family: monospace;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: rgba(255, 255, 255, 0.65);">HIGH SCORE:</span>
            <span id="snake-highscore-val" style="color: #00ffff; font-weight: bold;">${highScore.toString().padStart(5, '0')}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: rgba(255, 255, 255, 0.65);">SCORE:</span>
            <span id="snake-score-val" style="color: #39ff14; font-weight: bold;">00000</span>
          </div>
          <button id="snake-quit-btn" class="hud-tiny-btn" style="width: 100%; padding: 6px; font-size: 0.7rem; cursor: pointer; text-transform: uppercase; border-color: rgba(57, 255, 20, 0.3);">EXIT SIMULATION</button>
        </div>
      `;
    }

    const quitBtn = document.getElementById('snake-quit-btn');
    if (quitBtn) {
      quitBtn.addEventListener('click', () => {
        this.stopSnakeGame();
      });
    }
  }

  private stopSnakeGame(): void {
    if (!this.cameraSystem) return;

    document.body.classList.remove('snake-game-active');

    // Clean up event listeners and DOM elements
    window.removeEventListener('resize', this.handleSnakeResize);
    if (this.snakeDpadEl) {
      if (this.snakeDpadEl.parentNode) {
        this.snakeDpadEl.parentNode.removeChild(this.snakeDpadEl);
      }
      this.snakeDpadEl = null;
    }

    this.snakeGameActor.stop();
    this.snakeActor.mesh.visible = true;

    this.snakeGameActive = false;
    this.cameraSystem.isSnakeGameActive = false;

    // Robot drops back to the ground smoothly
    const robot = this.cameraSystem.getRobotCharacter();
    const playerPos = this.cameraSystem.getPlayerPosition();

    if (robot) {
      robot.setTransparency(false);
    }

    gsap.killTweensOf(playerPos);
    gsap.to(playerPos, {
      y: -4, // ground height
      duration: 1.0,
      ease: 'bounce.out'
    });

    if (robot) {
      gsap.killTweensOf(robot.mesh.scale);
      gsap.to(robot.mesh.scale, {
        x: 1.0,
        y: 1.0,
        z: 1.0,
        duration: 1.0,
        ease: 'power2.out'
      });
    }

    // Return camera back behind the player robot
    const distance = 4.0;
    const height = 1.3;
    const yaw = robot ? robot.mesh.rotation.y : Math.PI;
    const pitch = 0.2;

    const cameraOffset = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch) * distance,
      Math.sin(pitch) * distance + height,
      Math.cos(yaw) * Math.cos(pitch) * distance
    );
    const targetCamPos = playerPos.clone().add(cameraOffset);

    const camera = this.cameraSystem.getCamera();
    gsap.killTweensOf(camera.position);

    gsap.to(camera.position, {
      x: targetCamPos.x,
      y: targetCamPos.y,
      z: targetCamPos.z,
      duration: 1.8,
      ease: 'power2.out',
      onUpdate: () => {
        const currentLook = playerPos.clone().add(new THREE.Vector3(0, 1.1, 0));
        camera.lookAt(currentLook);
      }
    });

    // Reset HUD descriptions
    const sectionHud = document.getElementById('section-hud');
    const hudTitle = document.getElementById('section-hud-title');
    const hudDesc = document.getElementById('section-hud-desc');
    const hudHint = document.getElementById('section-hud-hint');

    if (sectionHud) {
      sectionHud.classList.remove('tetris-active-hud');
    }
    if (hudTitle) {
      hudTitle.textContent = 'SECTOR: TECH SHOWCASE';
    }
    if (hudDesc) {
      hudDesc.textContent = 'COGNITIVE REPOSITORY OF SKILLS & ARCHITECTURAL PATTERNS ONLINE. 5 CORES ACTIVE.';
    }
    if (hudHint) {
      hudHint.textContent = 'Tap the center console to enter GRID RUNNER arcade simulation. Hover and click orbiting capsules to decrypt sub-skill telemetry.';
    }

    // Relocate physical roaming snake randomly to another floor coordinate
    this.relocateSnakeActor();
  }

  private showSnakeGameOverToast(score: number): void {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = 'hud-toast success';
    toast.style.borderColor = 'rgba(57, 255, 20, 0.4)';
    toast.innerHTML = `
      <div class="hud-toast-header" style="color: #39ff14;">
        <span>ARCADE TELEMETRY</span>
        <span>NOW</span>
      </div>
      <div class="hud-toast-body">
        <strong class="toast-glitch-text" style="color: #39ff14;">SNAKE GAME OVER</strong><br/>
        Final Score: <span style="color: #00f0ff; font-weight: bold;">${score}</span><br/>
        The glowing neon snake has vanished and relocated on the world floor!
      </div>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-fade-out');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 5000);
  }

  private handleSnakeGameOver(score: number): void {
    this.showSnakeGameOverToast(score);
    // Delay stopping the snake game to allow the spectacular game over shatter particles to animate!
    setTimeout(() => {
      if (this.snakeGameActive) {
        this.stopSnakeGame();
      }
    }, 2000);
  }

  private relocateSnakeActor(): void {
    // Relocate to a random location in SW quadrant
    const rx = -18 + (Math.random() - 0.5) * 10;
    const rz = -18 + (Math.random() - 0.5) * 10;
    this.snakeActor.relocateSnake(new THREE.Vector3(rx, -4, rz));
    console.log(`Snake relocated to X: ${rx.toFixed(2)}, Z: ${rz.toFixed(2)}`);
  }

  private showRubiksPopup(): void {
    if (this.cameraSystem && this.cameraSystem.isRubiksCubeActive) {
      this.hideRubiksPopup();
      return;
    }

    if (!this.rubiksPopupEl) {
      this.rubiksPopupEl = document.createElement('div');
      this.rubiksPopupEl.id = 'rubiks-proximity-popup';
      this.rubiksPopupEl.className = 'tetris-popup glass hidden';
      this.rubiksPopupEl.innerHTML = `
        <div class="tetris-popup__title" style="color: #00f0ff; text-shadow: 0 0 8px rgba(0, 240, 255, 0.5);">WANT TO SHUFFLE AND SOLVE?</div>
        <div style="font-size: 0.8rem; color: #aaa; margin-bottom: 12px; text-align: center;">Approach the Rubik's Cube. Press [E] or click below.</div>
        <button id="rubiks-play-now-btn" class="tetris-popup__btn" style="background: linear-gradient(135deg, rgba(0, 240, 255, 0.8), rgba(0, 70, 173, 0.8)); border-color: rgba(0, 240, 255, 0.3);">START SYSTEM</button>
      `;

      const uiLayer = document.getElementById('ui-layer') || document.body;
      uiLayer.appendChild(this.rubiksPopupEl);

      const playBtn = document.getElementById('rubiks-play-now-btn');
      if (playBtn) {
        playBtn.addEventListener('click', () => {
          console.log('PortfolioScene: Play Rubiks Now Clicked!');
          this.hideRubiksPopup();
          this.startRubiksGame();
        });
      }

      setTimeout(() => {
        if (this.rubiksPopupEl) {
          this.rubiksPopupEl.classList.remove('hidden');
        }
      }, 50);
    } else {
      this.rubiksPopupEl.classList.remove('hidden');
    }
  }

  private hideRubiksPopup(): void {
    if (this.rubiksPopupEl && !this.rubiksPopupEl.classList.contains('hidden')) {
      this.rubiksPopupEl.classList.add('hidden');
    }
  }

  private startRubiksGame(): void {
    if (!this.cameraSystem) return;
    if (this.cameraSystem.isTetrisActive || this.carGameActive || this.voxelPainterActive || this.snakeGameActive) return;

    (document.activeElement as HTMLElement)?.blur();

    this.hasWalkedAwayFromRubiks = false;
    this.rubiksGameActive = true;
    this.cameraSystem.isRubiksCubeActive = true;
    document.body.classList.add('rubiks-game-active');

    // Reset interaction blocked state
    this.rubiksCubeActor.isInteractionBlocked = false;
    this.rubiksCubeActor.isCubeRotationMode = false;

    // Activate mouse pointer controls in actor
    const camera = this.cameraSystem.getCamera();
    const canvasEl = document.getElementById('webgl-canvas') as HTMLCanvasElement;
    this.rubiksCubeActor.activate(camera, canvasEl);

    // Hover/float the Rubik's cube up smoothly (elevated higher to -1.3 for clear visibility on mobile views)
    gsap.to(this.rubiksCubeActor.mesh.position, {
      y: -1.7,
      duration: 1.5,
      ease: 'power2.out'
    });

    // Hide physical character model scale to zero
    const robot = this.cameraSystem.getRobotCharacter();
    if (robot) {
      gsap.to(robot.mesh.scale, {
        x: 0,
        y: 0,
        z: 0,
        duration: 1.5,
        ease: 'power2.inOut'
      });
    }

    // Detection for mobile screens & dynamic aspect ratio wider FOV
    const aspect = window.innerWidth / window.innerHeight;
    const rx_rubiks = this.rubiksCubeActor.mesh.position.x;
    const rz_rubiks = this.rubiksCubeActor.mesh.position.z;
    let targetFov = 60;
    let targetCamPos: [number, number, number] = [rx_rubiks, -3.2, rz_rubiks + 4.8];
    if (aspect < 1.0) {
      targetFov = 75;
      targetCamPos = [rx_rubiks, -2.8, rz_rubiks + 5.5];
    }
    this.cameraSystem.moveTo(targetCamPos, [0.18, 0, 0], targetFov);

    // Setup Custom HUD for Rubik's Cube
    const sectionHud = document.getElementById('section-hud');
    const hudTitle = document.getElementById('section-hud-title');
    const hudDesc = document.getElementById('section-hud-desc');
    const hudHint = document.getElementById('section-hud-hint');

    if (sectionHud) {
      sectionHud.classList.remove('hidden');
      sectionHud.classList.add('tetris-active-hud');
    }
    if (hudTitle) {
      hudTitle.textContent = "RUBIK'S CUBE ARCHITECT";
    }
    if (hudDesc) {
      hudDesc.textContent = '3D QUANTUM CRYPTOGRAPHIC RESOLVER';
    }
    if (hudHint) {
      const isMobile = window.innerWidth <= 1024;
      if (isMobile) {
        hudHint.innerHTML = `
          <div class="hud-desc-sub" style="color: #00f0ff; font-weight: bold; margin-bottom: 4px;">INTERACTION GUIDE</div>
          <div style="color: #fff; font-size: 0.75rem; line-height: 1.4; margin-bottom: 8px;">
            <strong style="color: #00f0ff;">SWIPE LAYER:</strong> Drag faces on screen<br/>
            <strong style="color: #ffca00;">DRAG MODE:</strong> Switch to VIEW ANGLE to rotate cube<br/>
            <strong style="color: #ff33ff;">GAMEPAD:</strong> Use bottom selectors to turn slices
          </div>
          <div id="rubiks-panel" style="border-top: 1px dashed rgba(0, 240, 255, 0.2); padding-top: 6px; font-family: monospace;">
            <button id="rubiks-solve-btn" class="hud-tiny-btn" style="width: 100%; padding: 6px; font-size: 0.7rem; cursor: pointer; text-transform: uppercase; margin-bottom: 6px; background: linear-gradient(135deg, rgba(0, 240, 255, 0.8), rgba(0, 70, 173, 0.8)); border-color: rgba(0, 240, 255, 0.3);">AUTO SOLVE</button>
            <button id="rubiks-quit-btn" class="hud-tiny-btn" style="width: 100%; padding: 6px; font-size: 0.7rem; cursor: pointer; text-transform: uppercase; border-color: rgba(255, 51, 51, 0.3);">EXIT SIMULATION</button>
          </div>
        `;
      } else {
        hudHint.innerHTML = `
          <div class="hud-desc-sub" style="color: #00f0ff; font-weight: bold; margin-bottom: 4px;">INTERACTION GUIDE</div>
          <div style="color: #fff; font-size: 0.75rem; line-height: 1.4; margin-bottom: 8px;">
            <strong style="color: #00f0ff;">DRAG FACE:</strong> Rotate layer<br/>
            <strong style="color: #ffca00;">Ctrl + DRAG:</strong> Rotate whole cube<br/>
            <strong style="color: #ff33ff;">SHUFFLED MOVES:</strong> Automated on start
          </div>
          <div id="rubiks-panel" style="border-top: 1px dashed rgba(0, 240, 255, 0.2); padding-top: 6px; font-family: monospace;">
            <button id="rubiks-solve-btn" class="hud-tiny-btn" style="width: 100%; padding: 6px; font-size: 0.7rem; cursor: pointer; text-transform: uppercase; margin-bottom: 6px; background: linear-gradient(135deg, rgba(0, 240, 255, 0.8), rgba(0, 70, 173, 0.8)); border-color: rgba(0, 240, 255, 0.3);">AUTO SOLVE</button>
            <button id="rubiks-quit-btn" class="hud-tiny-btn" style="width: 100%; padding: 6px; font-size: 0.7rem; cursor: pointer; text-transform: uppercase; border-color: rgba(255, 51, 51, 0.3);">EXIT SIMULATION</button>
          </div>
        `;
      }
    }

    const solveBtn = document.getElementById('rubiks-solve-btn');
    if (solveBtn) {
      solveBtn.addEventListener('click', async () => {
        if (this.rubiksCubeActor.isAnimating || this.rubiksCubeActor.isInteractionBlocked) return;
        console.log('PortfolioScene: Auto-solve clicked!');
        
        const quitBtnEl = document.getElementById('rubiks-quit-btn') as HTMLButtonElement;
        if (quitBtnEl) quitBtnEl.disabled = true;
        (solveBtn as HTMLButtonElement).disabled = true;

        await this.rubiksCubeActor.autoSolve();

        if (quitBtnEl) quitBtnEl.disabled = false;
        (solveBtn as HTMLButtonElement).disabled = false;

        // Trigger victory/solved HUD and toast on auto-solve completion
        this.handleRubiksVictory(false);
      });
    }

    const quitBtn = document.getElementById('rubiks-quit-btn');
    if (quitBtn) {
      quitBtn.addEventListener('click', () => {
        if (this.rubiksCubeActor.isAnimating) return;
        this.stopRubiksGame();
      });
    }

    // Build Mobile virtual gamepad for Rubik's Cube
    if (!this.rubiksGamepadEl) {
      this.rubiksGamepadEl = document.createElement('div');
      this.rubiksGamepadEl.id = 'rubiks-gamepad';
      this.rubiksGamepadEl.className = 'rubiks-gamepad-container';
      this.rubiksGamepadEl.innerHTML = `
        <div class="rubiks-gamepad-title">Rubik's Interface</div>
        
        <!-- Drag Mode Toggle -->
        <div class="rubiks-selector-group">
          <div class="rubiks-selector-label">DRAG MODE</div>
          <div class="rubiks-drag-toggle-container">
            <button class="rubiks-drag-btn active" id="rubiks-drag-slices">SLICES (SWIPE)</button>
            <button class="rubiks-drag-btn" id="rubiks-drag-cube">VIEW ANGLE</button>
          </div>
        </div>

        <!-- Standard Selectors Container -->
        <div class="rubiks-standard-settings" id="rubiks-standard-settings">
          <!-- Face Selector -->
          <div class="rubiks-selector-group">
            <div class="rubiks-selector-label">FACE SELECTOR</div>
            <div class="rubiks-btn-row">
              <button class="rubiks-pad-btn active" data-face="U">U</button>
              <button class="rubiks-pad-btn" data-face="D">D</button>
              <button class="rubiks-pad-btn" data-face="L">L</button>
              <button class="rubiks-pad-btn" data-face="R">R</button>
              <button class="rubiks-pad-btn" data-face="F">F</button>
              <button class="rubiks-pad-btn" data-face="B">B</button>
            </div>
          </div>

          <!-- Layer Selector -->
          <div class="rubiks-selector-group">
            <div class="rubiks-selector-label">LAYER LEVEL</div>
            <div class="rubiks-btn-row">
              <button class="rubiks-pad-btn" data-layer="-1">-1</button>
              <button class="rubiks-pad-btn" data-layer="0">0</button>
              <button class="rubiks-pad-btn active" data-layer="1">1</button>
            </div>
          </div>

          <!-- Angle Selector -->
          <div class="rubiks-selector-group">
            <div class="rubiks-selector-label">DIRECTION</div>
            <div class="rubiks-btn-row">
              <button class="rubiks-pad-btn active" data-angle="1">CW (↻)</button>
              <button class="rubiks-pad-btn" data-angle="-1">CCW (↺)</button>
            </div>
          </div>

          <!-- Execute Button -->
          <button class="rubiks-execute-btn" id="rubiks-execute-btn">EXECUTE ROTATION</button>
        </div>

        <!-- Cyber Gimbal/Trackball Controller (visible only in VIEW ANGLE mode) -->
        <div class="rubiks-gimbal-settings hidden" id="rubiks-gimbal-settings">
          <div class="rubiks-selector-label">GIMBAL ROTATION PAD</div>
          <div class="rubiks-gimbal-trackpad" id="rubiks-gimbal-trackpad">
            <div class="rubiks-gimbal-ring">
              <div class="rubiks-gimbal-radar"></div>
              <div class="rubiks-gimbal-knob" id="rubiks-gimbal-knob"></div>
            </div>
          </div>
          <div style="font-size: 0.65rem; color: rgba(0, 240, 255, 0.5); text-align: center; margin-top: 4px; font-family: monospace; letter-spacing: 0.5px;">DRAG INSIDE RING TO ROTATE CUBE FREELY</div>
        </div>
      `;

      const uiLayer = document.getElementById('ui-layer') || document.body;
      uiLayer.appendChild(this.rubiksGamepadEl);

      let selectedFace = 'U';
      let selectedLayer = 1;
      let selectedAngle = 1;

      // Handle selector button clicks
      const faceButtons = this.rubiksGamepadEl.querySelectorAll('[data-face]');
      faceButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          faceButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          selectedFace = btn.getAttribute('data-face') || 'U';
          
          // Auto-adjust default layer logic based on selected face
          const layerButtonsList = this.rubiksGamepadEl!.querySelectorAll('[data-layer]');
          if (selectedFace === 'D' || selectedFace === 'L' || selectedFace === 'B') {
            layerButtonsList.forEach(b => {
              b.classList.remove('active');
              if (b.getAttribute('data-layer') === '-1') b.classList.add('active');
            });
            selectedLayer = -1;
          } else if (selectedFace === 'U' || selectedFace === 'R' || selectedFace === 'F') {
            layerButtonsList.forEach(b => {
              b.classList.remove('active');
              if (b.getAttribute('data-layer') === '1') b.classList.add('active');
            });
            selectedLayer = 1;
          }
        });
      });

      const layerButtonsList = this.rubiksGamepadEl.querySelectorAll('[data-layer]');
      layerButtonsList.forEach(btn => {
        btn.addEventListener('click', () => {
          layerButtonsList.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          selectedLayer = parseInt(btn.getAttribute('data-layer') || '1', 10);
        });
      });

      const angleButtons = this.rubiksGamepadEl.querySelectorAll('[data-angle]');
      angleButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          angleButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          selectedAngle = parseInt(btn.getAttribute('data-angle') || '1', 10);
        });
      });

      // Drag mode buttons
      const btnSlices = this.rubiksGamepadEl.querySelector('#rubiks-drag-slices');
      const btnCube = this.rubiksGamepadEl.querySelector('#rubiks-drag-cube');
      
      btnSlices?.addEventListener('click', () => {
        btnSlices.classList.add('active');
        btnCube?.classList.remove('active');
        this.rubiksCubeActor.isCubeRotationMode = false;

        // Show standard, hide gimbal
        this.rubiksGamepadEl?.querySelector('#rubiks-standard-settings')?.classList.remove('hidden');
        this.rubiksGamepadEl?.querySelector('#rubiks-gimbal-settings')?.classList.add('hidden');
      });

      btnCube?.addEventListener('click', () => {
        btnCube.classList.add('active');
        btnSlices?.classList.remove('active');
        this.rubiksCubeActor.isCubeRotationMode = true;

        // Hide standard, show gimbal
        this.rubiksGamepadEl?.querySelector('#rubiks-standard-settings')?.classList.add('hidden');
        this.rubiksGamepadEl?.querySelector('#rubiks-gimbal-settings')?.classList.remove('hidden');
      });

      // Execute button click
      const executeBtn = this.rubiksGamepadEl.querySelector('#rubiks-execute-btn') as HTMLButtonElement;
      executeBtn?.addEventListener('click', async () => {
        if (this.rubiksCubeActor.isAnimating || this.rubiksCubeActor.isInteractionBlocked) return;
        executeBtn.disabled = true;
        await this.rubiksCubeActor.rotateProgrammatic(selectedFace, selectedLayer, selectedAngle);
        executeBtn.disabled = false;
      });

      // Cyber Gimbal pointer drag tracking
      let isDraggingGimbal = false;
      let lastGimbalX = 0;
      let lastGimbalY = 0;

      const gimbalTrackpad = this.rubiksGamepadEl.querySelector('#rubiks-gimbal-trackpad') as HTMLElement;
      const gimbalKnob = this.rubiksGamepadEl.querySelector('#rubiks-gimbal-knob') as HTMLElement;

      if (gimbalTrackpad && gimbalKnob) {
        gimbalTrackpad.addEventListener('pointerdown', (e: PointerEvent) => {
          isDraggingGimbal = true;
          try {
            gimbalTrackpad.setPointerCapture(e.pointerId);
          } catch (err) {}
          lastGimbalX = e.clientX;
          lastGimbalY = e.clientY;

          const rect = gimbalTrackpad.getBoundingClientRect();
          const cx = rect.width / 2;
          const cy = rect.height / 2;
          const touchX = e.clientX - rect.left;
          const touchY = e.clientY - rect.top;

          let dx = touchX - cx;
          let dy = touchY - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxR = cx - 16;
          if (dist > maxR) {
            dx = (dx / dist) * maxR;
            dy = (dy / dist) * maxR;
          }
          gimbalKnob.style.transform = `translate(${dx}px, ${dy}px)`;
          e.preventDefault();
        });

        gimbalTrackpad.addEventListener('pointermove', (e: PointerEvent) => {
          if (!isDraggingGimbal) return;

          const deltaX = e.clientX - lastGimbalX;
          const deltaY = e.clientY - lastGimbalY;

          lastGimbalX = e.clientX;
          lastGimbalY = e.clientY;

          // Free rotate the cube with amazing, highly tactile sensitivity!
          const sensitivity = 0.015;
          this.rubiksCubeActor.mesh.rotation.y += deltaX * sensitivity;
          this.rubiksCubeActor.mesh.rotation.x += deltaY * sensitivity;

          const rect = gimbalTrackpad.getBoundingClientRect();
          const cx = rect.width / 2;
          const cy = rect.height / 2;
          const touchX = e.clientX - rect.left;
          const touchY = e.clientY - rect.top;

          let dx = touchX - cx;
          let dy = touchY - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxR = cx - 16;
          if (dist > maxR) {
            dx = (dx / dist) * maxR;
            dy = (dy / dist) * maxR;
          }
          gimbalKnob.style.transform = `translate(${dx}px, ${dy}px)`;
          e.preventDefault();
        });

        const stopGimbalDrag = (e: PointerEvent) => {
          if (!isDraggingGimbal) return;
          isDraggingGimbal = false;
          try {
            gimbalTrackpad.releasePointerCapture(e.pointerId);
          } catch (err) {}

          // Animate knob smoothly back to center
          gsap.to(gimbalKnob, {
            x: 0,
            y: 0,
            duration: 0.3,
            ease: 'back.out(1.5)',
            onUpdate: () => {
              const tx = gsap.getProperty(gimbalKnob, 'x');
              const ty = gsap.getProperty(gimbalKnob, 'y');
              gimbalKnob.style.transform = `translate(${tx}px, ${ty}px)`;
            }
          });
        };

        gimbalTrackpad.addEventListener('pointerup', stopGimbalDrag);
        gimbalTrackpad.addEventListener('pointercancel', stopGimbalDrag);
      }
    }

    // Trigger shuffle automatically with 15 random moves
    setTimeout(async () => {
      await this.rubiksCubeActor.shuffle(15);

      // Setup manual solve victory callback after shuffle is complete
      this.rubiksCubeActor.onSolvedCallback = () => {
        this.handleRubiksVictory();
      };
    }, 1000);
  }

  private handleRubiksVictory(isManual: boolean = true): void {
    // 1. Block further interactions to lock the solved state
    this.rubiksCubeActor.isInteractionBlocked = true;
    this.rubiksCubeActor.onSolvedCallback = null;

    // 2. Disable AUTO SOLVE button and update HUD
    const solveBtn = document.getElementById('rubiks-solve-btn') as HTMLButtonElement;
    if (solveBtn) {
      solveBtn.disabled = true;
      solveBtn.textContent = 'DECRYPTED / SOLVED';
      solveBtn.style.background = 'linear-gradient(135deg, rgba(57, 255, 20, 0.8), rgba(0, 100, 30, 0.8))';
      solveBtn.style.borderColor = 'rgba(57, 255, 20, 0.3)';
    }

    // 3. Display summary victory toast
    const toastContainer = document.getElementById('toast-container');
    if (toastContainer) {
      const toast = document.createElement('div');
      toast.className = 'hud-toast success';
      toast.style.borderColor = 'rgba(0, 240, 255, 0.4)';

      const methodText = isManual 
        ? "You have successfully solved the Rubik's Cube manually!" 
        : "The system auto-solve sequence completed successfully!";

      toast.innerHTML = `
        <div class="hud-toast-header" style="color: #00f0ff;">
          <span>QUANTUM RESOLVED</span>
          <span>SUCCESS</span>
        </div>
        <div class="hud-toast-body">
          <strong class="toast-glitch-text" style="color: #39ff14;">${isManual ? 'VICTORY!' : 'DECRYPTED!'}</strong><br/>
          ${methodText}<br/>
          The security matrix has been decrypted.
        </div>
      `;
      toastContainer.appendChild(toast);
      setTimeout(() => {
        toast.classList.add('toast-fade-out');
        setTimeout(() => {
          if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
      }, 6000);
    }
  }

  private stopRubiksGame(): void {
    if (!this.cameraSystem) return;

    document.body.classList.remove('rubiks-game-active');

    // Clean up gamepad DOM elements
    if (this.rubiksGamepadEl) {
      if (this.rubiksGamepadEl.parentNode) {
        this.rubiksGamepadEl.parentNode.removeChild(this.rubiksGamepadEl);
      }
      this.rubiksGamepadEl = null;
    }

    this.rubiksCubeActor.onSolvedCallback = null;
    this.rubiksCubeActor.deactivate();
    this.rubiksCubeActor.isInteractionBlocked = false;
    this.rubiksGameActive = false;
    this.rubiksState = 'dissolving';

    // Smoothly drop the cube back to the ground pile position
    gsap.to(this.rubiksCubeActor.mesh.position, {
      y: -4.0,
      duration: 1.5,
      ease: 'power2.out'
    });

    // Reset cube rotation smoothly
    gsap.to(this.rubiksCubeActor.mesh.rotation, {
      x: 0,
      y: 0,
      z: 0,
      duration: 1.5,
      ease: 'power2.out'
    });

    this.rubiksCubeActor.dissolveToPile().then(() => {
      this.rubiksState = 'scattered';
    });

    const robot = this.cameraSystem.getRobotCharacter();
    const playerPos = this.cameraSystem.getPlayerPosition();

    if (robot) {
      gsap.to(robot.mesh.scale, {
        x: 1.0,
        y: 1.0,
        z: 1.0,
        duration: 1.5,
        ease: 'power2.out'
      });
    }

    // Return camera back behind the player robot
    const distance = 4.0;
    const height = 1.3;
    const yaw = robot ? robot.mesh.rotation.y : Math.PI;
    const pitch = 0.2;

    const cameraOffset = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch) * distance,
      Math.sin(pitch) * distance + height,
      Math.cos(yaw) * Math.cos(pitch) * distance
    );
    const targetCamPos = playerPos.clone().add(cameraOffset);

    const camera = this.cameraSystem.getCamera();
    gsap.killTweensOf(camera);
    gsap.killTweensOf(camera.position);

    // Animate FOV smoothly back to 75
    gsap.to(camera, {
      fov: 75,
      duration: 1.8,
      ease: 'power2.out',
      onUpdate: () => {
        camera.updateProjectionMatrix();
      }
    });

    gsap.to(camera.position, {
      x: targetCamPos.x,
      y: targetCamPos.y,
      z: targetCamPos.z,
      duration: 1.8,
      ease: 'power2.out',
      onUpdate: () => {
        const currentLook = playerPos.clone().add(new THREE.Vector3(0, 1.1, 0));
        camera.lookAt(currentLook);
      },
      onComplete: () => {
        if (this.cameraSystem) {
          this.cameraSystem.isRubiksCubeActive = false;
        }
      }
    });

    // Reset HUD descriptions back to standard status
    const sectionHud = document.getElementById('section-hud');
    const hudTitle = document.getElementById('section-hud-title');
    const hudDesc = document.getElementById('section-hud-desc');
    const hudHint = document.getElementById('section-hud-hint');

    if (sectionHud) {
      sectionHud.classList.remove('tetris-active-hud');
    }
    if (hudTitle) {
      hudTitle.textContent = 'SECTOR: TECH SHOWCASE';
    }
    if (hudDesc) {
      hudDesc.textContent = 'COGNITIVE REPOSITORY OF SKILLS & ARCHITECTURAL PATTERNS ONLINE. 5 CORES ACTIVE.';
    }
    if (hudHint) {
      hudHint.textContent = 'Tap the center console to enter GRID RUNNER arcade simulation. Hover and click orbiting capsules to decrypt sub-skill telemetry.';
    }
  }

  public dispose(): void {
    console.log('PortfolioScene: Disposing showcase assets');
    document.body.classList.remove('snake-game-active');
    document.body.classList.remove('tetris-game-active');
    window.removeEventListener('keydown', this.handleEKeyPress);
    if (this.stage) this.stage.dispose();
    if (this.backgroundPeopleActor) this.backgroundPeopleActor.dispose();
    if (this.jellyFaceActor) this.jellyFaceActor.dispose();
    if (this.projectActor) this.projectActor.dispose();
    if (this.skillsActor) this.skillsActor.dispose();
    if (this.resumeActor) this.resumeActor.dispose();
    if (this.aboutActor) this.aboutActor.dispose();
    if (this.tetrisPileActor) this.tetrisPileActor.dispose();
    if (this.tetrisBoardActor) this.tetrisBoardActor.dispose();
    if (this.carActor) this.carActor.dispose();
    if (this.snakeActor) this.snakeActor.dispose();
    if (this.snakeGameActor) this.snakeGameActor.dispose();
    if (this.rubiksCubeActor) this.rubiksCubeActor.dispose();
    if (this.connect4Actor) this.connect4Actor.dispose();
    this.clearOrbs();
    if (this.carGameTimerInterval) {
      clearInterval(this.carGameTimerInterval);
    }

    if (this.tetrisPopupEl && this.tetrisPopupEl.parentElement) {
      this.tetrisPopupEl.parentElement.removeChild(this.tetrisPopupEl);
      this.tetrisPopupEl = null;
    }
    if (this.carPopupEl && this.carPopupEl.parentElement) {
      this.carPopupEl.parentElement.removeChild(this.carPopupEl);
      this.carPopupEl = null;
    }
    if (this.snakePopupEl && this.snakePopupEl.parentElement) {
      this.snakePopupEl.parentElement.removeChild(this.snakePopupEl);
      this.snakePopupEl = null;
    }
    if (this.rubiksPopupEl && this.rubiksPopupEl.parentElement) {
      this.rubiksPopupEl.parentElement.removeChild(this.rubiksPopupEl);
      this.rubiksPopupEl = null;
    }
    if (this.rubiksGamepadEl) {
      if (this.rubiksGamepadEl.parentNode) {
        this.rubiksGamepadEl.parentNode.removeChild(this.rubiksGamepadEl);
      }
      this.rubiksGamepadEl = null;
    }
    if (this.connect4PopupEl && this.connect4PopupEl.parentElement) {
      this.connect4PopupEl.parentElement.removeChild(this.connect4PopupEl);
      this.connect4PopupEl = null;
    }
    if (this.connect4GamepadEl) {
      if (this.connect4GamepadEl.parentNode) {
        this.connect4GamepadEl.parentNode.removeChild(this.connect4GamepadEl);
      }
      this.connect4GamepadEl = null;
    }
    
    window.removeEventListener('resize', this.handleConnect4Resize);
    this.cleanupVoxelPainter();
  }

  private showConnect4Popup(): void {
    if (this.cameraSystem && this.cameraSystem.isConnect4Active) {
      this.hideConnect4Popup();
      return;
    }

    if (!this.connect4PopupEl) {
      this.connect4PopupEl = document.createElement('div');
      this.connect4PopupEl.id = 'connect4-proximity-popup';
      this.connect4PopupEl.className = 'tetris-popup glass hidden';
      this.connect4PopupEl.innerHTML = `
        <div class="tetris-popup__title" style="color: #00f0ff; text-shadow: 0 0 8px rgba(0, 240, 255, 0.5);">PLAY CONNECT 4?</div>
        <div style="font-size: 0.8rem; color: #aaa; margin-bottom: 12px; text-align: center;">Press [E] or click below to play vs AI</div>
        <button id="connect4-play-now-btn" class="tetris-popup__btn" style="background: linear-gradient(135deg, rgba(0, 240, 255, 0.8), rgba(0, 70, 173, 0.8)); border-color: rgba(0, 240, 255, 0.3);">PLAY NOW</button>
      `;

      const uiLayer = document.getElementById('ui-layer') || document.body;
      uiLayer.appendChild(this.connect4PopupEl);

      const playBtn = document.getElementById('connect4-play-now-btn');
      if (playBtn) {
        playBtn.addEventListener('click', () => {
          console.log('PortfolioScene: Play Connect 4 clicked!');
          this.hideConnect4Popup();
          this.startConnect4Game();
        });
      }

      setTimeout(() => {
        if (this.connect4PopupEl) {
          this.connect4PopupEl.classList.remove('hidden');
        }
      }, 50);
    } else {
      this.connect4PopupEl.classList.remove('hidden');
    }
  }

  private hideConnect4Popup(): void {
    if (this.connect4PopupEl && !this.connect4PopupEl.classList.contains('hidden')) {
      this.connect4PopupEl.classList.add('hidden');
    }
  }

  private startConnect4Game(): void {
    if (!this.cameraSystem) return;
    if (this.cameraSystem.isTetrisActive || this.carGameActive || this.voxelPainterActive || this.snakeGameActive || this.rubiksGameActive) return;

    (document.activeElement as HTMLElement)?.blur();

    this.hasWalkedAwayFromConnect4 = false;
    this.connect4GameActive = true;
    this.cameraSystem.isConnect4Active = true;
    document.body.classList.add('connect4-game-active');

    // Register 3D direct pointer/touch click raycaster on the main canvas
    const canvas = document.getElementById('webgl-canvas');
    if (canvas) {
      canvas.addEventListener('pointerdown', this.handleConnect4CanvasPointerDown);
    }

    // Load score from local storage if available
    const savedScore = localStorage.getItem('connect4_record');
    if (savedScore) {
      try {
        this.connect4Score = JSON.parse(savedScore);
      } catch (e) {
        this.connect4Score = { player: 0, cpu: 0 };
      }
    } else {
      this.connect4Score = { player: 0, cpu: 0 };
    }

    // Initialize/clear board in actor
    this.connect4Actor.resetGrid();

    // Smoothly scale down robot
    const robot = this.cameraSystem.getRobotCharacter();
    if (robot) {
      gsap.to(robot.mesh.scale, {
        x: 0,
        y: 0,
        z: 0,
        duration: 1.0,
        ease: 'power2.inOut'
      });
    }

    // Make the board visible and animate it rising up
    this.connect4Actor.boardGroup.visible = true;
    this.connect4Actor.boardGroup.position.y = 0;
    gsap.to(this.connect4Actor.boardGroup.position, {
      y: 1.5,
      duration: 1.5,
      ease: 'power2.out'
    });

    // Dynamic horizontal row selector button container overlay for mobile/touch screens
    if (!this.connect4GamepadEl) {
      this.connect4GamepadEl = document.createElement('div');
      this.connect4GamepadEl.id = 'connect4-gamepad';
      this.connect4GamepadEl.className = 'connect4-gamepad-container';
      this.connect4GamepadEl.innerHTML = `
        <div class="connect4-gamepad-title">Drop Discs</div>
        <div class="connect4-btn-row">
          ${[0, 1, 2, 3, 4, 5, 6].map(i => `
            <button class="connect4-pad-btn connect4-mobile-col-btn" data-col="${i}" ${this.connect4Actor.getLowestEmptyRow(i) === -1 ? 'disabled class="connect4-pad-btn disabled"' : ''}>${i + 1}</button>
          `).join('')}
        </div>
      `;

      const uiLayer = document.getElementById('ui-layer') || document.body;
      uiLayer.appendChild(this.connect4GamepadEl);

      // Add click/tap event listener on mobile buttons to trigger immediate disc drops
      this.connect4GamepadEl.querySelectorAll('.connect4-mobile-col-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          if (this.isCPUMoving || this.connect4Turn !== 'R') return;
          const col = parseInt((e.currentTarget as HTMLElement).getAttribute('data-col') || '0');
          this.playerDropDisc(col);
        });
      });
    }

    // Trigger board assembly animation
    this.connect4Actor.assembleFromPile(() => {
      // Assemble finished, start active game
      // Randomize turn order
      this.connect4Turn = Math.random() < 0.5 ? 'R' : 'Y';
      this.isCPUMoving = false;
      this.activeColumn = 3;

      this.updateConnect4HUD();

      // Listen to keyboard inputs
      window.addEventListener('keydown', this.handleConnect4KeyboardInput);

      if (this.connect4Turn === 'Y') {
        this.cpuMove();
      }
    });

    // Move camera to a perfect flat orthographic-like viewport relative to the board
    this.updateConnect4Camera(true);

    // Register responsive resize listener
    window.addEventListener('resize', this.handleConnect4Resize);
  }

  private handleConnect4CanvasPointerDown = (e: PointerEvent): void => {
    if (!this.connect4GameActive || this.isCPUMoving || this.connect4Turn !== 'R') return;

    const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;
    if (!canvas || !this.cameraSystem) return;

    // Convert mouse/pointer client coords to NDC (-1 to +1)
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(x, y);
    const camera = this.cameraSystem.getCamera();

    raycaster.setFromCamera(mouse, camera);

    // Perform direct raycast check against invisible column hitboxes
    const intersects = raycaster.intersectObjects(this.connect4Actor.columnHitBoxes);
    if (intersects.length > 0) {
      const hitObject = intersects[0].object;
      const colIndex = (hitObject as any).colIndex;
      if (typeof colIndex === 'number' && colIndex >= 0 && colIndex < 7) {
        if (this.connect4Actor.getLowestEmptyRow(colIndex) !== -1) {
          e.preventDefault();
          this.playerDropDisc(colIndex);
        }
      }
    }
  };

  private handleConnect4KeyboardInput = (e: KeyboardEvent): void => {
    if (!this.connect4GameActive || this.isCPUMoving || this.connect4Turn !== 'R') return;

    const key = e.key.toLowerCase();
    if (key === 'a' || key === 'arrowleft') {
      e.preventDefault();
      this.activeColumn = (this.activeColumn - 1 + 7) % 7;
      this.updateColumnHoverVisuals();
    } else if (key === 'd' || key === 'arrowright') {
      e.preventDefault();
      this.activeColumn = (this.activeColumn + 1) % 7;
      this.updateColumnHoverVisuals();
    } else if (key === ' ' || key === 'enter') {
      e.preventDefault();
      this.playerDropDisc(this.activeColumn);
    }
  };

  private playerDropDisc(col: number): void {
    if (this.isCPUMoving || this.connect4Turn !== 'R') return;

    const lowestRow = this.connect4Actor.getLowestEmptyRow(col);
    if (lowestRow === -1) {
      console.warn('Column full!');
      return;
    }

    this.isCPUMoving = true;

    // Physically drop player's disc
    this.connect4Actor.dropDisc(col, 'R', () => {
      // Drop complete, check victory
      const victory = this.connect4Actor.checkVictory();
      if (victory) {
        this.handleConnect4Victory(victory.winner, victory.cells);
        return;
      }

      if (this.connect4Actor.isGridFull()) {
        this.handleConnect4Draw();
        return;
      }

      // Switch turn to CPU
      this.connect4Turn = 'Y';
      this.updateConnect4HUD();
      this.cpuMove();
    });
  }

  private cpuMove(): void {
    this.isCPUMoving = true;
    this.updateConnect4HUD();

    // Let the minimax think for a short delay to feel organic
    setTimeout(() => {
      if (!this.connect4GameActive) return;

      const bestCol = this.connect4Actor.getBestMove(6); // Depth 6
      if (bestCol === -1) {
        this.handleConnect4Draw();
        return;
      }

      this.connect4Actor.dropDisc(bestCol, 'Y', () => {
        // Drop complete, check victory
        const victory = this.connect4Actor.checkVictory();
        if (victory) {
          this.handleConnect4Victory(victory.winner, victory.cells);
          return;
        }

        if (this.connect4Actor.isGridFull()) {
          this.handleConnect4Draw();
          return;
        }

        // Switch back to player
        this.connect4Turn = 'R';
        this.isCPUMoving = false;
        this.updateConnect4HUD();
      });
    }, 800);
  }

  private handleConnect4Victory(winner: string, cells: [number, number][]): void {
    const isPlayerWin = winner === 'R';
    if (isPlayerWin) {
      this.connect4Score.player++;
    } else {
      this.connect4Score.cpu++;
    }

    // Save record across sessions
    localStorage.setItem('connect4_record', JSON.stringify(this.connect4Score));

    // Highlight winning discs with a beautiful scaling pulse animation!
    const winningDiscs = this.connect4Actor.discs.filter(d => 
      cells.some(cell => (d as any).row === cell[0] && (d as any).col === cell[1])
    );

    winningDiscs.forEach(disc => {
      gsap.to(disc.scale, {
        x: 1.3,
        y: 1.3,
        z: 1.3,
        duration: 0.25,
        yoyo: true,
        repeat: 9,
        ease: 'power2.inOut'
      });
    });

    this.showConnect4DebriefToast(isPlayerWin ? 'VICTORY' : 'DEFEAT', isPlayerWin);

    // Stop game and exit gracefully after the pulsing highlight finishes (3.5 seconds)
    setTimeout(() => {
      this.stopConnect4Game();
    }, 3500);
  }

  private handleConnect4Draw(): void {
    this.showConnect4DebriefToast('DRAW', null);
    setTimeout(() => {
      this.stopConnect4Game();
    }, 3000);
  }

  private stopConnect4Game(): void {
    this.connect4GameActive = false;

    window.removeEventListener('keydown', this.handleConnect4KeyboardInput);
    window.removeEventListener('resize', this.handleConnect4Resize);

    // Unregister 3D pointer raycast tapping
    const canvas = document.getElementById('webgl-canvas');
    if (canvas) {
      canvas.removeEventListener('pointerdown', this.handleConnect4CanvasPointerDown);
    }

    // Clean up Mobile layout virtual controls overlay
    if (this.connect4GamepadEl) {
      if (this.connect4GamepadEl.parentNode) {
        this.connect4GamepadEl.parentNode.removeChild(this.connect4GamepadEl);
      }
      this.connect4GamepadEl = null;
    }

    document.body.classList.remove('connect4-game-active');

    // Slide board down and hide on complete
    gsap.to(this.connect4Actor.boardGroup.position, {
      y: 0,
      duration: 1.2,
      ease: 'power2.inOut',
      onComplete: () => {
        this.connect4Actor.boardGroup.visible = false;
      }
    });

    // Fade and return to pile animation
    this.connect4Actor.dissolveToPile(() => {
      this.connect4Actor.resetGrid();
    });

    if (this.cameraSystem) {
      const robot = this.cameraSystem.getRobotCharacter();
      const playerPos = this.cameraSystem.getPlayerPosition();

      if (robot) {
        gsap.to(robot.mesh.scale, {
          x: 1.0,
          y: 1.0,
          z: 1.0,
          duration: 1.0,
          ease: 'power2.out'
        });
      }

      // Return camera back behind the player robot
      const distance = 4.0;
      const height = 1.3;
      const yaw = robot ? robot.mesh.rotation.y : Math.PI;
      const pitch = 0.2;

      const cameraOffset = new THREE.Vector3(
        Math.sin(yaw) * Math.cos(pitch) * distance,
        Math.sin(pitch) * distance + height,
        Math.cos(yaw) * Math.cos(pitch) * distance
      );
      const targetCamPos = playerPos.clone().add(cameraOffset);

      const camera = this.cameraSystem.getCamera();
      gsap.killTweensOf(camera);
      gsap.killTweensOf(camera.position);

      // Animate FOV smoothly back to 75
      gsap.to(camera, {
        fov: 75,
        duration: 1.8,
        ease: 'power2.out',
        onUpdate: () => {
          camera.updateProjectionMatrix();
        }
      });

      gsap.to(camera.position, {
        x: targetCamPos.x,
        y: targetCamPos.y,
        z: targetCamPos.z,
        duration: 1.8,
        ease: 'power2.out',
        onUpdate: () => {
          const currentLook = playerPos.clone().add(new THREE.Vector3(0, 1.1, 0));
          camera.lookAt(currentLook);
        },
        onComplete: () => {
          if (this.cameraSystem) {
            this.cameraSystem.isConnect4Active = false;
          }
        }
      });
    }

    // Reset HUD descriptions back to standard status
    const sectionHud = document.getElementById('section-hud');
    const hudTitle = document.getElementById('section-hud-title');
    const hudDesc = document.getElementById('section-hud-desc');
    const hudHint = document.getElementById('section-hud-hint');

    if (sectionHud) {
      sectionHud.classList.remove('tetris-active-hud');
    }
    if (hudTitle) {
      hudTitle.textContent = 'SECTOR: TECH SHOWCASE';
    }
    if (hudDesc) {
      hudDesc.textContent = 'COGNITIVE REPOSITORY OF SKILLS & ARCHITECTURAL PATTERNS ONLINE. 5 CORES ACTIVE.';
    }
    if (hudHint) {
      hudHint.textContent = 'Tap the center console to enter GRID RUNNER arcade simulation. Hover and click orbiting capsules to decrypt sub-skill telemetry.';
    }
  }

  private updateConnect4HUD(): void {
    const sectionHud = document.getElementById('section-hud');
    const hudTitle = document.getElementById('section-hud-title');
    const hudDesc = document.getElementById('section-hud-desc');
    const hudHint = document.getElementById('section-hud-hint');

    if (sectionHud) {
      sectionHud.classList.remove('hidden');
      sectionHud.classList.add('tetris-active-hud');
    }
    if (hudTitle) {
      hudTitle.textContent = 'CONNECT 4 QUANTUM BOARD';
    }
    if (hudDesc) {
      hudDesc.textContent = this.connect4Turn === 'R' 
        ? (this.isCPUMoving ? 'PROCESSING PLAYER ACTION...' : 'YOUR TURN (RED DISCS)') 
        : 'CPU THINKING (YELLOW DISCS)...';
    }
    if (hudHint) {
      const turnColor = this.connect4Turn === 'R' ? '#ff3333' : '#ffdd00';
      const indicatorText = this.connect4Turn === 'R' 
        ? (this.isCPUMoving ? 'WAIT' : 'SELECT COLUMN') 
        : 'MINIMAX SEARCHING...';

      hudHint.innerHTML = `
        <div class="hud-desc-sub" style="color: ${turnColor}; font-weight: bold; margin-bottom: 4px;">TURN STATUS: ${indicatorText}</div>
        <div class="connect4-tips" style="color: #fff; font-size: 0.75rem; line-height: 1.35; margin-bottom: 8px;">
          [A / D] or [Left / Right] to Select Column.<br/>
          [Space / Enter] to Drop Disc.
        </div>
        <div id="connect4-panel" style="border-top: 1px dashed rgba(0, 240, 255, 0.2); padding-top: 6px; font-family: monospace;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span style="color: rgba(255, 255, 255, 0.65);">PLAYER RECORD:</span>
            <span style="color: #ff3333; font-weight: bold;">${this.connect4Score.player} WINS</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span style="color: rgba(255, 255, 255, 0.65);">CPU RECORD:</span>
            <span style="color: #ffdd00; font-weight: bold;">${this.connect4Score.cpu} WINS</span>
          </div>
          <div class="connect4-col-selector-container" style="margin-bottom: 8px; text-align: center;">
            <span class="connect4-current-hover" style="color: #00f0ff; font-size: 0.75rem;">CURRENT HOVER: COLUMN ${this.activeColumn + 1}</span>
            <div style="display: flex; justify-content: center; gap: 4px; margin-top: 4px;">
              ${[0, 1, 2, 3, 4, 5, 6].map(i => `
                <button class="hud-tiny-btn connect4-col-btn" data-col="${i}" style="width: 24px; padding: 4px; font-size: 0.65rem; text-align: center; border-color: ${this.activeColumn === i ? '#00f0ff' : 'rgba(0, 240, 255, 0.2)'}; ${this.connect4Actor.getLowestEmptyRow(i) === -1 ? 'opacity: 0.3; cursor: not-allowed;' : ''}">${i + 1}</button>
              `).join('')}
            </div>
          </div>
          <button id="connect4-drop-btn" class="hud-tiny-btn connect4-drop-btn-class" style="width: 100%; padding: 6px; font-size: 0.7rem; cursor: pointer; text-transform: uppercase; margin-bottom: 6px; background: linear-gradient(135deg, rgba(0, 240, 255, 0.8), rgba(0, 70, 173, 0.8)); border-color: rgba(0, 240, 255, 0.3);" ${this.isCPUMoving || this.connect4Turn !== 'R' ? 'disabled' : ''}>DROP DISC</button>
          <button id="connect4-quit-btn" class="hud-tiny-btn" style="width: 100%; padding: 6px; font-size: 0.7rem; cursor: pointer; text-transform: uppercase; border-color: rgba(255, 51, 51, 0.3);">FORFEIT / QUIT</button>
        </div>
      `;

      // Add listeners to col buttons
      document.querySelectorAll('.connect4-col-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const col = parseInt((e.currentTarget as HTMLElement).getAttribute('data-col') || '3');
          if (this.connect4Actor.getLowestEmptyRow(col) !== -1) {
            this.activeColumn = col;
            this.updateColumnHoverVisuals();
          }
        });
      });

      const dropBtn = document.getElementById('connect4-drop-btn');
      if (dropBtn) {
        dropBtn.addEventListener('click', () => {
          this.playerDropDisc(this.activeColumn);
        });
      }

      const quitBtn = document.getElementById('connect4-quit-btn');
      if (quitBtn) {
        quitBtn.addEventListener('click', () => {
          this.stopConnect4Game();
        });
      }
    }

    // Also update mobile gamepad overlay if it exists
    if (this.connect4GamepadEl) {
      const isDisabled = this.isCPUMoving || this.connect4Turn !== 'R';
      this.connect4GamepadEl.querySelectorAll('.connect4-mobile-col-btn').forEach(btn => {
        const col = parseInt(btn.getAttribute('data-col') || '0');
        const isColumnFull = this.connect4Actor.getLowestEmptyRow(col) === -1;
        const btnEl = btn as HTMLButtonElement;
        if (isDisabled || isColumnFull) {
          btnEl.disabled = true;
          btnEl.classList.add('disabled');
        } else {
          btnEl.disabled = false;
          btnEl.classList.remove('disabled');
        }
      });
    }
  }

  private updateColumnHoverVisuals(): void {
    this.updateConnect4HUD();
  }

  private showConnect4DebriefToast(title: string, success: boolean | null): void {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = 'hud-toast success';
    
    let accentColor = '#00f0ff';
    if (success === true) {
      accentColor = '#ff3333';
    } else if (success === false) {
      accentColor = '#ffdd00';
    }

    toast.style.borderColor = accentColor;
    toast.innerHTML = `
      <div class="hud-toast-header" style="color: ${accentColor};">
        <span>CONNECT 4 DEBRIEF</span>
        <span>SYSTEM</span>
      </div>
      <div class="hud-toast-body">
        <strong class="toast-glitch-text" style="color: ${accentColor};">${title}!</strong><br/>
        Record: <span style="color: #ff3333; font-weight: bold;">${this.connect4Score.player} WINS</span> vs <span style="color: #ffdd00; font-weight: bold;">${this.connect4Score.cpu} WINS</span>
      </div>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-fade-out');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 5000);
  }

  private spawnStackedBoxes(atEdge: boolean = false): void {
    if (!this.cameraSystem || !this.mainScene) return;

    // Clean up any old ones first (and preserve existing custom voxels if atEdge is true)
    this.cleanupVoxelPainter(atEdge);

    let rx = 0;
    let rz = 0;

    if (!atEdge) {
      // Respect already-set initialStackCenter coordinate if it is non-zero
      if (this.initialStackCenter.lengthSq() === 0) {
        rx = 18 + (Math.random() - 0.5) * 10;
        rz = -18 + (Math.random() - 0.5) * 10;
        rx = Math.floor(rx / 1.2) * 1.2;
        rz = Math.floor(rz / 1.2) * 1.2;
        this.initialStackCenter.set(rx, -2.2, rz);
      } else {
        rx = this.initialStackCenter.x;
        rz = this.initialStackCenter.z;
      }
    } else {
      // Position at the edge of the grid, perfectly aligned to grid intervals
      rx = this.initialStackCenter.x + 12;
      rz = this.initialStackCenter.z + 12;
    }

    const boxSize = 1.2;
    const cubeGeo = new THREE.BoxGeometry(boxSize, boxSize, boxSize);

    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false
    });

    // Create 3 stacked stair boxes centered perfectly on grid divisions
    const offsets = [
      { x: 0, y: -3.4, z: 0 },
      { x: 1.2, y: -2.2, z: 0 },
      { x: 2.4, y: -1.0, z: 0 }
    ];

    offsets.forEach((offset) => {
      const box = new THREE.Mesh(cubeGeo, material);
      box.position.set(rx + offset.x, offset.y, rz + offset.z);

      const edges = new THREE.EdgesGeometry(cubeGeo);
      const line = new THREE.LineSegments(edges, new THREE.LineDashedMaterial({ color: 0xffaa00, dashSize: 0.15, gapSize: 0.05 }));
      line.computeLineDistances();
      line.raycast = () => {}; // Disable raycasting on wireframe edges to prevent collisions and TypeError crashes
      box.add(line);

      // Add 3D Hilbert spline
      const spline = createHilbertSpline(boxSize, 0xffffff);
      box.add(spline);

      this.mainScene.add(box);
      this.initialStackedBoxes.push(box);
    });

    this.cameraSystem.setVoxelBoxes(this.voxelBoxes);
    console.log(`Voxel Painter: Stacked boxes spawned at X: ${rx.toFixed(2)}, Z: ${rz.toFixed(2)}`);
  }

  private cleanupVoxelPainter(keepVoxels: boolean = false): void {
    this.voxelPainterActive = false;
    if (this.cameraSystem) {
      this.cameraSystem.isVoxelPainterActive = false;
    }
    this.isShiftDown = false;
    (document.activeElement as HTMLElement)?.blur();

    // Remove event listeners
    document.removeEventListener('pointermove', this.onPaintPointerMove);
    document.removeEventListener('pointerdown', this.onPaintPointerDown);
    document.removeEventListener('keydown', this.onPaintDocumentKeyDown);
    document.removeEventListener('keyup', this.onPaintDocumentKeyUp);

    // Remove popups & gamepad
    if (this.voxelPopupEl && this.voxelPopupEl.parentElement) {
      this.voxelPopupEl.parentElement.removeChild(this.voxelPopupEl);
    }
    this.voxelPopupEl = null;

    if (this.voxelGamepadEl && this.voxelGamepadEl.parentNode) {
      this.voxelGamepadEl.parentNode.removeChild(this.voxelGamepadEl);
    }
    this.voxelGamepadEl = null;
    this.voxelMobileMode = 'add';
    document.body.classList.remove('voxel-painter-active');

    const exitBtn = document.getElementById('voxel-exit-btn');
    if (exitBtn && exitBtn.parentElement) {
      exitBtn.parentElement.removeChild(exitBtn);
    }

    // Clean up initial stacked boxes
    this.initialStackedBoxes.forEach((box) => {
      if (box.parent) box.parent.remove(box);
      box.geometry.dispose();
      if (Array.isArray(box.material)) {
        box.material.forEach(m => m.dispose());
      } else {
        box.material.dispose();
      }
    });
    this.initialStackedBoxes = [];

    // Clean up custom painted voxels if not keeping them
    if (!keepVoxels) {
      this.voxelBoxes.forEach((box) => {
        if (box.parent) box.parent.remove(box);
        box.geometry.dispose();
        if (Array.isArray(box.material)) {
          box.material.forEach(m => m.dispose());
        } else {
          box.material.dispose();
        }
      });
      this.voxelBoxes = [];

      if (this.cameraSystem) {
        this.cameraSystem.setVoxelBoxes([]);
      }
    } else {
      // If keeping them, make sure they remain registered as colliders
      if (this.cameraSystem) {
        this.cameraSystem.setVoxelBoxes(this.voxelBoxes);
      }
    }

    // Clean up grid helper & plane
    if (this.voxelGridHelper && this.voxelGridHelper.parent) {
      this.voxelGridHelper.parent.remove(this.voxelGridHelper);
    }
    this.voxelGridHelper = null;

    if (this.voxelGridBase && this.voxelGridBase.parent) {
      this.voxelGridBase.parent.remove(this.voxelGridBase);
      this.voxelGridBase.geometry.dispose();
      if (Array.isArray(this.voxelGridBase.material)) {
        this.voxelGridBase.material.forEach(m => m.dispose());
      } else {
        this.voxelGridBase.material.dispose();
      }
    }
    this.voxelGridBase = null;

    if (this.voxelPlane && this.voxelPlane.parent) {
      this.voxelPlane.parent.remove(this.voxelPlane);
    }
    this.voxelPlane = null;

    if (this.rollOverMesh && this.rollOverMesh.parent) {
      this.rollOverMesh.parent.remove(this.rollOverMesh);
    }

    this.voxelObjects = [];
  }

  private checkVoxelProximity(): void {
    if (this.voxelPainterActive || this.initialStackedBoxes.length === 0 || !this.cameraSystem) {
      this.hideVoxelPopup();
      return;
    }

    const playerPos = this.cameraSystem.getPlayerPosition();
    const startObj = this.initialStackedBoxes[0];
    const dx = playerPos.x - startObj.position.x;
    const dz = playerPos.z - startObj.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 2.5) {
      this.showVoxelPopup();
    } else {
      this.hideVoxelPopup();
    }
  }

  private showVoxelPopup(): void {
    if (this.voxelPopupEl) {
      this.voxelPopupEl.classList.remove('hidden');
      return;
    }

    this.voxelPopupEl = document.createElement('div');
    this.voxelPopupEl.id = 'voxel-proximity-popup';
    this.voxelPopupEl.className = 'tetris-popup glass hidden';

    if (this.voxelBoxes.length > 0) {
      this.voxelPopupEl.innerHTML = `
        <div class="tetris-popup__title" style="color: #00f0ff; text-shadow: 0 0 8px rgba(0, 240, 255, 0.5);">VOXEL PAINTER ACTIVE</div>
        <button id="voxel-continue-btn" class="tetris-popup__btn" style="background: linear-gradient(135deg, rgba(0, 240, 255, 0.8), rgba(112, 0, 255, 0.8)); margin-bottom: 8px;">CONTINUE WORK</button>
        <button id="voxel-start-btn" class="tetris-popup__btn" style="background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); font-size: 0.8rem; padding: 8px;">START NEW</button>
      `;
    } else {
      this.voxelPopupEl.innerHTML = `
        <div class="tetris-popup__title" style="color: #00f0ff; text-shadow: 0 0 8px rgba(0, 240, 255, 0.5);">START VOXEL PAINTER?</div>
        <button id="voxel-start-btn" class="tetris-popup__btn" style="background: linear-gradient(135deg, rgba(0, 240, 255, 0.8), rgba(112, 0, 255, 0.8));">START NOW</button>
      `;
    }

    const uiLayer = document.getElementById('ui-layer') || document.body;
    uiLayer.appendChild(this.voxelPopupEl);

    const startBtn = document.getElementById('voxel-start-btn');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        console.log('PortfolioScene: Start Voxel Painter clicked!');
        this.hideVoxelPopup();
        this.startVoxelPainter(false);
      });
    }

    const continueBtn = document.getElementById('voxel-continue-btn');
    if (continueBtn) {
      continueBtn.addEventListener('click', () => {
        console.log('PortfolioScene: Continue Voxel Painter clicked!');
        this.hideVoxelPopup();
        this.startVoxelPainter(true);
      });
    }

    setTimeout(() => {
      if (this.voxelPopupEl) {
        this.voxelPopupEl.classList.remove('hidden');
      }
    }, 50);
  }

  private hideVoxelPopup(): void {
    if (this.voxelPopupEl) {
      if (this.voxelPopupEl.parentElement) {
        this.voxelPopupEl.parentElement.removeChild(this.voxelPopupEl);
      }
      this.voxelPopupEl = null;
    }
  }

  private startVoxelPainter(isContinue: boolean = false): void {
    if (!this.cameraSystem || !this.mainScene) return;
    if (this.cameraSystem.isTetrisActive || this.carGameActive) return;

    this.voxelPainterActive = true;
    this.cameraSystem.isVoxelPainterActive = true;

    // Build Mobile Voxel Gamepad Toolbar if touch/mobile
    const isMobile = window.innerWidth <= 1024;
    if (isMobile) {
      document.body.classList.add('voxel-painter-active');
      // On mobile, we move the controls inside the HUD instead of createVoxelGamepad overlay
    }

    // Blur current button focus
    (document.activeElement as HTMLElement)?.blur();

    if (!isContinue) {
      // Clear custom painted voxels if starting fresh
      this.voxelBoxes.forEach((box) => {
        if (box.parent) box.parent.remove(box);
        box.geometry.dispose();
        if (Array.isArray(box.material)) {
          box.material.forEach(m => m.dispose());
        } else {
          box.material.dispose();
        }
      });
      this.voxelBoxes = [];

      // 1. DISSOLVE STACKED BOXES INTO PARTICLES
      this.initialStackedBoxes.forEach((box) => {
        // Spawn tiny particle boxes that explode outward
        const pCount = 12;
        const particles: THREE.Mesh[] = [];
        const pGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
        const pMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 1 });

        for (let i = 0; i < pCount; i++) {
          const p = new THREE.Mesh(pGeo, pMat);
          p.position.copy(box.position);
          this.mainScene.add(p);
          particles.push(p);

          // Animate using GSAP
          const tx = box.position.x + (Math.random() - 0.5) * 3.5;
          const ty = box.position.y + Math.random() * 2.5 + 0.5;
          const tz = box.position.z + (Math.random() - 0.5) * 3.5;

          gsap.to(p.position, {
            x: tx,
            y: ty,
            z: tz,
            duration: 1.2 + Math.random() * 0.6,
            ease: 'power2.out'
          });

          gsap.to(pMat, {
            opacity: 0,
            duration: 1.2 + Math.random() * 0.6,
            ease: 'power2.out',
            onComplete: () => {
              if (p.parent) p.parent.remove(p);
              pGeo.dispose();
              pMat.dispose();
            }
          });
        }

        // Hide and fade out the original box
        gsap.to(box.scale, {
          x: 0,
          y: 0,
          z: 0,
          duration: 0.5,
          ease: 'power2.inOut',
          onComplete: () => {
            if (box.parent) box.parent.remove(box);
          }
        });
      });

      this.initialStackedBoxes = [];
      this.cameraSystem.setVoxelBoxes([]);
    }

    // 2. SPAWN VOXEL GRID HELPER (Y = -4)
    this.voxelGridHelper = new THREE.GridHelper(30, 25, 0x00f0ff, 0x7000ff);
    this.voxelGridHelper.position.set(this.initialStackCenter.x, -3.99, this.initialStackCenter.z);
    this.mainScene.add(this.voxelGridHelper);

    // SPAWN SEMI-OPAQUE DARK BACKING PLANE TO BLOCK BACKGROUND CANVAS GRID
    const baseGeo = new THREE.PlaneGeometry(30, 30);
    baseGeo.rotateX(-Math.PI / 2);
    const baseMat = new THREE.MeshBasicMaterial({
      color: 0x0a0a16, // Dark cyberpunk backing color
      transparent: true,
      opacity: 0.85, // Highly opaque to obscure the background canvas grid
      depthWrite: false // Prevent depth buffer fighting with grid floor / grid helper
    });
    this.voxelGridBase = new THREE.Mesh(baseGeo, baseMat);
    this.voxelGridBase.position.set(this.initialStackCenter.x, -4.01, this.initialStackCenter.z);
    this.mainScene.add(this.voxelGridBase);

    // 3. SPAWN INVISIBLE RAYCAST PLANE (Y = -4)
    const planeGeo = new THREE.PlaneGeometry(100, 100);
    planeGeo.rotateX(-Math.PI / 2); // Rotate the geometry, not the mesh, to keep the face normal pointing straight up (0, 1, 0)
    this.voxelPlane = new THREE.Mesh(
      planeGeo,
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.voxelPlane.position.set(this.initialStackCenter.x, -4.0, this.initialStackCenter.z);
    this.mainScene.add(this.voxelPlane);
    
    // Clear voxelObjects and load elements
    this.voxelObjects = [this.voxelPlane];
    if (isContinue) {
      // Add existing voxel meshes to raycast objects so we can paint relative to them
      this.voxelObjects.push(...this.voxelBoxes);
    }

    // 4. SPAWN ROLL-OVER PREVIEW MESH
    const rollOverGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
    const rollOverMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false
    });
    this.rollOverMesh = new THREE.Mesh(rollOverGeo, rollOverMaterial);
    
    // Add sharp wireframe to rollover preview
    const edges = new THREE.EdgesGeometry(rollOverGeo);
    const line = new THREE.LineSegments(edges, new THREE.LineDashedMaterial({ color: 0x00f0ff, dashSize: 0.15, gapSize: 0.05 }));
    line.computeLineDistances();
    line.raycast = () => {}; // Disable raycasting on wireframe edges
    this.rollOverMesh.add(line);

    // Add 3D Hilbert spline
    const spline = createHilbertSpline(1.2, 0x00f0ff);
    this.rollOverMesh.add(spline);

    this.rollOverMesh.visible = false;
    this.mainScene.add(this.rollOverMesh);

    // 5. BIND INTERACTIVE LISTENERS
    document.addEventListener('pointermove', this.onPaintPointerMove);
    document.addEventListener('pointerdown', this.onPaintPointerDown);
    document.addEventListener('keydown', this.onPaintDocumentKeyDown);
    document.addEventListener('keyup', this.onPaintDocumentKeyUp);

    // 6. DEPLOY CUSTOM EXIT OVERLAY BUTTON CONTAINER (Desktop only)
    if (!isMobile) {
      const container = document.createElement('div');
      container.id = 'voxel-exit-btn';
      container.style.position = 'fixed';
      container.style.bottom = '24px';
      container.style.left = '50%';
      container.style.transform = 'translateX(-50%)';
      container.style.zIndex = '999';
      container.style.display = 'flex';
      container.style.gap = '16px';

      const continueLaterBtn = document.createElement('button');
      continueLaterBtn.className = 'interactive-btn';
      continueLaterBtn.textContent = 'CONTINUE LATER';
      continueLaterBtn.style.padding = '12px 24px';
      continueLaterBtn.style.background = 'linear-gradient(135deg, rgba(0, 240, 255, 0.8), rgba(112, 0, 255, 0.8))';
      continueLaterBtn.style.color = '#fff';
      continueLaterBtn.style.border = '1px solid rgba(255, 255, 255, 0.2)';
      continueLaterBtn.style.borderRadius = '8px';
      continueLaterBtn.style.fontFamily = 'monospace';
      continueLaterBtn.style.fontSize = '0.85rem';
      continueLaterBtn.style.fontWeight = 'bold';
      continueLaterBtn.style.cursor = 'pointer';
      continueLaterBtn.style.boxShadow = '0 0 15px rgba(0, 240, 255, 0.4)';
      continueLaterBtn.addEventListener('click', () => {
        this.stopVoxelPainter(true);
      });

      const resetExitBtn = document.createElement('button');
      resetExitBtn.className = 'interactive-btn';
      resetExitBtn.textContent = 'RESET & EXIT';
      resetExitBtn.style.padding = '12px 24px';
      resetExitBtn.style.background = 'linear-gradient(135deg, rgba(255, 0, 127, 0.8), rgba(112, 0, 255, 0.8))';
      resetExitBtn.style.color = '#fff';
      resetExitBtn.style.border = '1px solid rgba(255, 255, 255, 0.2)';
      resetExitBtn.style.borderRadius = '8px';
      resetExitBtn.style.fontFamily = 'monospace';
      resetExitBtn.style.fontSize = '0.85rem';
      resetExitBtn.style.fontWeight = 'bold';
      resetExitBtn.style.cursor = 'pointer';
      resetExitBtn.style.boxShadow = '0 0 15px rgba(255, 0, 127, 0.4)';
      resetExitBtn.addEventListener('click', () => {
        this.stopVoxelPainter(false);
      });

      container.appendChild(continueLaterBtn);
      container.appendChild(resetExitBtn);
      document.body.appendChild(container);
    }

    // 7. UPDATE HUD telemetries
    const sectionHud = document.getElementById('section-hud');
    const hudTitle = document.getElementById('section-hud-title');
    const hudDesc = document.getElementById('section-hud-desc');
    const hudHint = document.getElementById('section-hud-hint');

    if (sectionHud) {
      sectionHud.classList.remove('hidden');
      sectionHud.classList.add('tetris-active-hud');
    }
    if (hudTitle) {
      hudTitle.textContent = 'VOXEL CONSTRUCTOR ONLINE';
    }
    if (hudDesc) {
      hudDesc.textContent = 'CONSTRUCTING SANDBOX MATRIX...';
    }
    if (hudHint) {
      if (isMobile) {
        hudHint.innerHTML = `
          <div id="voxel-hud-controls" style="display: flex; flex-direction: column; gap: 8px; font-family: monospace; width: 100%;">
            <div class="voxel-btn-row" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; width: 100%;">
              <button class="voxel-pad-btn active" data-mode="add" style="height: 34px; border-radius: 6px; font-size: 0.7rem; padding: 0;">
                <span>ADD</span>
                <span class="voxel-sub" style="font-size: 0.5rem; opacity: 0.6;">BLOCK</span>
              </button>
              <button class="voxel-pad-btn" data-mode="remove" style="height: 34px; border-radius: 6px; font-size: 0.7rem; padding: 0;">
                <span>REMOVE</span>
                <span class="voxel-sub" style="font-size: 0.5rem; opacity: 0.6;">SHIFT</span>
              </button>
              <button class="voxel-pad-btn" data-mode="color" style="height: 34px; border-radius: 6px; font-size: 0.7rem; padding: 0;">
                <span>PAINT</span>
                <span class="voxel-sub" style="font-size: 0.5rem; opacity: 0.6;">ALT</span>
              </button>
            </div>
            <div style="display: flex; gap: 6px; width: 100%;">
              <button id="voxel-hud-continue-btn" class="hud-tiny-btn" style="flex: 1; padding: 6px; font-size: 0.65rem; font-weight: bold; cursor: pointer; text-transform: uppercase; border-color: rgba(0, 240, 255, 0.3); background: linear-gradient(135deg, rgba(0, 240, 255, 0.8), rgba(112, 0, 255, 0.8)); color: #fff; border-radius: 4px; font-family: monospace;">CONTINUE LATER</button>
              <button id="voxel-hud-reset-btn" class="hud-tiny-btn" style="flex: 1; padding: 6px; font-size: 0.65rem; font-weight: bold; cursor: pointer; text-transform: uppercase; border-color: rgba(255, 0, 127, 0.3); background: linear-gradient(135deg, rgba(255, 0, 127, 0.8), rgba(112, 0, 255, 0.8)); color: #fff; border-radius: 4px; font-family: monospace;">RESET & EXIT</button>
            </div>
          </div>
        `;

        // Bind events for the tools inside the HUD on mobile view
        const buttons = hudHint.querySelectorAll('.voxel-pad-btn');
        buttons.forEach(btn => {
          btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.voxelMobileMode = btn.getAttribute('data-mode') as 'add' | 'remove' | 'color';
            console.log(`Voxel Painter (HUD Mobile): Selected Mobile Mode -> ${this.voxelMobileMode}`);
          });
        });

        // Bind events for continue & reset buttons inside the HUD on mobile view
        const continueBtn = document.getElementById('voxel-hud-continue-btn');
        if (continueBtn) {
          continueBtn.addEventListener('click', () => {
            this.stopVoxelPainter(true);
          });
        }

        const resetBtn = document.getElementById('voxel-hud-reset-btn');
        if (resetBtn) {
          resetBtn.addEventListener('click', () => {
            this.stopVoxelPainter(false);
          });
        }
      } else {
        hudHint.innerHTML = `
          <div class="hud-desc-sub" style="color: #00f0ff; font-weight: bold; margin-bottom: 4px;">COSMIC VOXEL INTERACTIVE CANVAS.</div>
          <div style="color: #fff; font-size: 0.75rem; line-height: 1.45;">
            <strong style="color: #00f0ff;">CLICK:</strong> Add Voxel block<br/>
            <strong style="color: #ff007f;">SHIFT + CLICK:</strong> Remove Voxel block<br/>
            <strong style="color: #ffca00;">ALT + CLICK:</strong> Cycle solid color of block<br/>
            <strong style="color: #00ff55;">WASD + SPACE:</strong> Walk & Jump around structures!
          </div>
        `;
      }
    }
  }

  private stopVoxelPainter(continueLater: boolean = false): void {
    this.cleanupVoxelPainter(continueLater);

    // Reset HUD descriptions back to standard status
    const sectionHud = document.getElementById('section-hud');
    const hudTitle = document.getElementById('section-hud-title');
    const hudDesc = document.getElementById('section-hud-desc');
    const hudHint = document.getElementById('section-hud-hint');

    if (sectionHud) {
      sectionHud.classList.remove('tetris-active-hud');
    }
    if (hudTitle) {
      hudTitle.textContent = 'SECTOR: TECH SHOWCASE';
    }
    if (hudDesc) {
      hudDesc.textContent = 'COGNITIVE REPOSITORY OF SKILLS & ARCHITECTURAL PATTERNS ONLINE. 5 CORES ACTIVE.';
    }
    if (hudHint) {
      hudHint.textContent = 'Tap the center console to enter GRID RUNNER arcade simulation. Hover and click orbiting capsules to decrypt sub-skill telemetry.';
    }

    // Respawn the initial boxes at another location (or at edge of grid if continuing)
    this.spawnStackedBoxes(continueLater);
  }

  private onPaintPointerMove = (event: PointerEvent): void => {
    if (!this.cameraSystem || !this.voxelPainterActive) return;

    const target = event.target as HTMLElement;
    if (target.tagName !== 'CANVAS') return;

    this.paintPointer.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
    this.paintRaycaster.setFromCamera(this.paintPointer, this.cameraSystem.getCamera());

    const intersects = this.paintRaycaster.intersectObjects(this.voxelObjects, true);

    if (intersects.length > 0) {
      const intersect = intersects[0];

      // Defensively read the face normal (fallback to upward vector if undefined/lines intersected)
      const normal = intersect.face ? intersect.face.normal.clone() : new THREE.Vector3(0, 1, 0);
      const pos = new THREE.Vector3().copy(intersect.point).add(normal.multiplyScalar(0.6));
      pos.y -= -4.0;

      pos.x = Math.round((pos.x - this.initialStackCenter.x) / 1.2) * 1.2 + this.initialStackCenter.x;
      pos.y = Math.floor(pos.y / 1.2) * 1.2 + 0.6;
      pos.z = Math.round((pos.z - this.initialStackCenter.z) / 1.2) * 1.2 + this.initialStackCenter.z;

      pos.y += -4.0;
      this.rollOverMesh.position.copy(pos);
      this.rollOverMesh.visible = true;
    } else {
      this.rollOverMesh.visible = false;
    }
  };

  private onPaintPointerDown = (event: PointerEvent): void => {
    if (!this.cameraSystem || !this.voxelPainterActive) return;

    const target = event.target as HTMLElement;
    if (target.tagName !== 'CANVAS') return;

    this.paintPointer.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
    this.paintRaycaster.setFromCamera(this.paintPointer, this.cameraSystem.getCamera());

    const intersects = this.paintRaycaster.intersectObjects(this.voxelObjects, true);

    if (intersects.length > 0) {
      const intersect = intersects[0];

      const isColorMode = event.altKey || (this.voxelMobileMode === 'color');
      const isRemoveMode = this.isShiftDown || (this.voxelMobileMode === 'remove');

      if (isColorMode) {
        if (intersect.object !== this.voxelPlane) {
          let rootObj: THREE.Object3D | null = intersect.object;
          while (rootObj && rootObj.parent && rootObj.parent !== this.mainScene) {
            rootObj = rootObj.parent;
          }

          if (rootObj && rootObj instanceof THREE.Mesh && rootObj !== this.voxelPlane) {
            const colors = [
              0xff3333, // Neon Red
              0x33ff33, // Neon Green
              0x3333ff, // Neon Blue
              0xffff33, // Neon Yellow
              0xff33ff, // Neon Magenta
              0x33ffff, // Neon Cyan
              0xff9933, // Neon Orange
              0x9933ff  // Neon Violet
            ];

            if (rootObj.userData.colorIndex === undefined) {
              rootObj.userData.colorIndex = 0;
            } else {
              rootObj.userData.colorIndex = (rootObj.userData.colorIndex + 1) % (colors.length + 1);
            }

            const colorIndex = rootObj.userData.colorIndex;
            const material = rootObj.material as THREE.MeshBasicMaterial;

            if (colorIndex === colors.length) {
              // Reset back to transparent wireframe
              material.transparent = true;
              material.opacity = 0;
              material.depthWrite = false;
              material.color.setHex(0xffffff);
            } else {
              material.transparent = false;
              material.opacity = 1;
              material.depthWrite = true;
              material.color.setHex(colors[colorIndex]);
            }
            material.needsUpdate = true;
          }
        }
      } else if (isRemoveMode) {
        if (intersect.object !== this.voxelPlane) {
          let rootObj: THREE.Object3D | null = intersect.object;
          while (rootObj && rootObj.parent && rootObj.parent !== this.mainScene) {
            rootObj = rootObj.parent;
          }

          if (rootObj && rootObj instanceof THREE.Mesh && rootObj !== this.voxelPlane) {
            this.mainScene.remove(rootObj);
            
            const indexObj = this.voxelObjects.indexOf(rootObj);
            if (indexObj !== -1) this.voxelObjects.splice(indexObj, 1);

            const indexBox = this.voxelBoxes.indexOf(rootObj);
            if (indexBox !== -1) {
              this.voxelBoxes.splice(indexBox, 1);
              this.cameraSystem.setVoxelBoxes(this.voxelBoxes);
            }
          }
        }
      } else {
        // Defensively read the face normal (fallback to upward vector if undefined)
        const normal = intersect.face ? intersect.face.normal.clone() : new THREE.Vector3(0, 1, 0);
        const pos = new THREE.Vector3().copy(intersect.point).add(normal.multiplyScalar(0.6));
        pos.y -= -4.0;

        pos.x = Math.round((pos.x - this.initialStackCenter.x) / 1.2) * 1.2 + this.initialStackCenter.x;
        pos.y = Math.floor(pos.y / 1.2) * 1.2 + 0.6;
        pos.z = Math.round((pos.z - this.initialStackCenter.z) / 1.2) * 1.2 + this.initialStackCenter.z;

        pos.y += -4.0;

        // Prevent double placing on same coordinate
        let collisionDetected = false;
        for (const box of this.voxelBoxes) {
          if (box.position.distanceTo(pos) < 0.1) {
            collisionDetected = true;
            break;
          }
        }

        if (!collisionDetected) {
          const cubeGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
          const cubeMaterial = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            depthWrite: false
          });

          const voxel = new THREE.Mesh(cubeGeo, cubeMaterial);
          voxel.position.copy(pos);

          const edges = new THREE.EdgesGeometry(cubeGeo);
          const line = new THREE.LineSegments(edges, new THREE.LineDashedMaterial({ color: 0xffaa00, dashSize: 0.15, gapSize: 0.05 }));
          line.computeLineDistances();
          line.raycast = () => {}; // Disable raycasting on wireframe edges
          voxel.add(line);

          // Add 3D Hilbert spline
          const spline = createHilbertSpline(1.2, 0xffffff);
          voxel.add(spline);

          this.mainScene.add(voxel);
          this.voxelObjects.push(voxel);
          this.voxelBoxes.push(voxel);
          this.cameraSystem.setVoxelBoxes(this.voxelBoxes);
        }
      }
    }
  };

  private onPaintDocumentKeyDown = (event: KeyboardEvent): void => {
    if (event.key.toLowerCase() === 'shift') {
      this.isShiftDown = true;
    }
  };

  private onPaintDocumentKeyUp = (event: KeyboardEvent): void => {
    if (event.key.toLowerCase() === 'shift') {
      this.isShiftDown = false;
    }
  };
}

function hilbert3D(
  center: THREE.Vector3 = new THREE.Vector3(0, 0, 0),
  size: number = 10,
  iterations: number = 1,
  v0 = 0, v1 = 1, v2 = 2, v3 = 3, v4 = 4, v5 = 5, v6 = 6, v7 = 7
): THREE.Vector3[] {
  const cs = [
    new THREE.Vector3(-1, -1, -1),
    new THREE.Vector3(-1, -1, 1),
    new THREE.Vector3(-1, 1, 1),
    new THREE.Vector3(-1, 1, -1),
    new THREE.Vector3(1, 1, -1),
    new THREE.Vector3(1, 1, 1),
    new THREE.Vector3(1, -1, 1),
    new THREE.Vector3(1, -1, -1)
  ];

  const vec = [
    cs[v0],
    cs[v1],
    cs[v2],
    cs[v3],
    cs[v4],
    cs[v5],
    cs[v6],
    cs[v7]
  ];

  const half = size / 2;

  if (iterations > 1) {
    return [
      ...hilbert3D(new THREE.Vector3(center.x + vec[0].x * half, center.y + vec[0].y * half, center.z + vec[0].z * half), half, iterations - 1, v0, v3, v4, v7, v6, v5, v2, v1),
      ...hilbert3D(new THREE.Vector3(center.x + vec[1].x * half, center.y + vec[1].y * half, center.z + vec[1].z * half), half, iterations - 1, v0, v7, v6, v1, v2, v5, v4, v3),
      ...hilbert3D(new THREE.Vector3(center.x + vec[2].x * half, center.y + vec[2].y * half, center.z + vec[2].z * half), half, iterations - 1, v0, v7, v6, v1, v2, v5, v4, v3),
      ...hilbert3D(new THREE.Vector3(center.x + vec[3].x * half, center.y + vec[3].y * half, center.z + vec[3].z * half), half, iterations - 1, v2, v3, v0, v1, v6, v7, v4, v5),
      ...hilbert3D(new THREE.Vector3(center.x + vec[4].x * half, center.y + vec[4].y * half, center.z + vec[4].z * half), half, iterations - 1, v2, v3, v0, v1, v6, v7, v4, v5),
      ...hilbert3D(new THREE.Vector3(center.x + vec[5].x * half, center.y + vec[5].y * half, center.z + vec[5].z * half), half, iterations - 1, v4, v3, v2, v5, v6, v1, v0, v7),
      ...hilbert3D(new THREE.Vector3(center.x + vec[6].x * half, center.y + vec[6].y * half, center.z + vec[6].z * half), half, iterations - 1, v4, v3, v2, v5, v6, v1, v0, v7),
      ...hilbert3D(new THREE.Vector3(center.x + vec[7].x * half, center.y + vec[7].y * half, center.z + vec[7].z * half), half, iterations - 1, v6, v5, v2, v1, v0, v3, v4, v7)
    ];
  }

  return [
    new THREE.Vector3(center.x + vec[0].x * half, center.y + vec[0].y * half, center.z + vec[0].z * half),
    new THREE.Vector3(center.x + vec[1].x * half, center.y + vec[1].y * half, center.z + vec[1].z * half),
    new THREE.Vector3(center.x + vec[2].x * half, center.y + vec[2].y * half, center.z + vec[2].z * half),
    new THREE.Vector3(center.x + vec[3].x * half, center.y + vec[3].y * half, center.z + vec[3].z * half),
    new THREE.Vector3(center.x + vec[4].x * half, center.y + vec[4].y * half, center.z + vec[4].z * half),
    new THREE.Vector3(center.x + vec[5].x * half, center.y + vec[5].y * half, center.z + vec[5].z * half),
    new THREE.Vector3(center.x + vec[6].x * half, center.y + vec[6].y * half, center.z + vec[6].z * half),
    new THREE.Vector3(center.x + vec[7].x * half, center.y + vec[7].y * half, center.z + vec[7].z * half)
  ];
}

function createHilbertSpline(boxSize: number, color: number = 0xffffff): THREE.Line {
  const subdivisions = 6;
  const recursion = 1;
  const points = hilbert3D(new THREE.Vector3(0, 0, 0), boxSize * 0.5, recursion, 0, 1, 2, 3, 4, 5, 6, 7);
  const spline = new THREE.CatmullRomCurve3(points);
  const samples = spline.getPoints(points.length * subdivisions);
  const geometrySpline = new THREE.BufferGeometry().setFromPoints(samples);
  const line = new THREE.Line(geometrySpline, new THREE.LineDashedMaterial({
    color: color,
    dashSize: 0.05,
    gapSize: 0.025
  }));
  line.computeLineDistances();
  line.raycast = () => {}; // Disable raycasting on spline lines
  return line;
}
