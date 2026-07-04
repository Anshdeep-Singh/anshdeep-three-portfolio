import * as THREE from 'three';
import { BaseActor } from '../base/BaseActor';
import { EventBus } from '../../core/EventBus';

export class SnakeGameActor extends BaseActor {
  public eventBus?: EventBus;

  // Grid Configuration
  private gridWidth = 22;
  private gridHeight = 22;
  private cellSize = 0.4;

  // Game State
  public score = 0;
  private isPlaying = false;
  private tickInterval = 180; // ms per step
  private lastTickTime = 0;

  // Turbo Speed Boost State
  private isTurboActive = false;
  private turboTimeRemaining = 0; // ms remaining
  private isSlowMoActive = false;
  private slowMoTimeRemaining = 0; // ms remaining
  private isGhostActive = false;
  private ghostTimeRemaining = 0; // ms remaining
  private foodAuraMesh?: THREE.Mesh;
  private shieldMesh?: THREE.Mesh;

  // Independent Powerups on Board
  private powerupMesh!: THREE.Mesh;
  private powerupAuraMesh?: THREE.Mesh;
  private powerupMat!: THREE.MeshBasicMaterial;
  private powerupCoord: { x: number; y: number } | null = null;
  private currentPowerupType: 'turbo' | 'slowmo' | 'ghost' | null = null;
  private powerupTimeRemaining = 0; // ms remaining on board

  // Snake State
  private snakeCoords: { x: number; y: number }[] = [];
  private direction = { x: 0, y: -1 }; // Initial moving direction (up/forward on flat grid)
  private nextDirection = { x: 0, y: -1 };
  private foodCoord = { x: 0, y: 0 };

  // Visual Snake Segments (for smooth LERP movement)
  private visualSegments: {
    mesh: THREE.Mesh;
    prevX: number;
    prevY: number;
    targetX: number;
    targetY: number;
    scale: number;
    isTailShrinking?: boolean;
  }[] = [];
  private shrinkingSegments: {
    mesh: THREE.Mesh;
    prevX: number;
    prevY: number;
    targetX: number;
    targetY: number;
    scale: number;
    isTailShrinking?: boolean;
  }[] = [];

  // Visual Groups
  private gridMesh!: THREE.LineSegments;
  private backingPlane!: THREE.Mesh;
  private borderLine!: THREE.Line;
  private snakeGroup!: THREE.Group;
  private foodMesh!: THREE.Mesh;

  // Geometries and Material cache
  private segmentGeo!: THREE.BoxGeometry;
  private foodGeo!: THREE.SphereGeometry;
  private snakeMaterials: THREE.MeshStandardMaterial[] = [];
  private foodMat!: THREE.MeshBasicMaterial;
  private eyeGeo!: THREE.SphereGeometry;
  private eyeMat!: THREE.MeshStandardMaterial;

  // Particle System fields
  private particleGeo!: THREE.BoxGeometry;
  private lastFrameTime = 0;
  private particles: {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    rotationSpeed: THREE.Vector3;
    life: number;
    maxLife: number;
    gravity?: boolean;
    deceleration?: number;
  }[] = [];

  constructor() {
    super('snake-game');
  }

  public setup(): void {
    const totalWidth = this.gridWidth * this.cellSize;
    const totalHeight = this.gridHeight * this.cellSize;

    // Dark Backing plane to obscure floor
    const planeGeo = new THREE.PlaneGeometry(totalWidth, totalHeight);
    const planeMat = new THREE.MeshBasicMaterial({
      color: 0x050510,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });
    this.backingPlane = new THREE.Mesh(planeGeo, planeMat);
    this.backingPlane.rotation.x = -Math.PI / 2;
    this.backingPlane.position.set(0, 0.01, 0); // slightly above ground Y=-4
    this.mesh.add(this.backingPlane);

    // Neon Border
    const borderGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-totalWidth / 2, 0.02, -totalHeight / 2),
      new THREE.Vector3(totalWidth / 2, 0.02, -totalHeight / 2),
      new THREE.Vector3(totalWidth / 2, 0.02, totalHeight / 2),
      new THREE.Vector3(-totalWidth / 2, 0.02, totalHeight / 2),
      new THREE.Vector3(-totalWidth / 2, 0.02, -totalHeight / 2),
    ]);
    const borderMat = new THREE.LineBasicMaterial({
      color: 0xff00aa, // glowing neon pink border
      linewidth: 3,
    });
    this.borderLine = new THREE.Line(borderGeo, borderMat);
    this.mesh.add(this.borderLine);

    // Grid Inner lines
    const gridPoints: THREE.Vector3[] = [];
    for (let i = 1; i < this.gridWidth; i++) {
      const x = -totalWidth / 2 + i * this.cellSize;
      gridPoints.push(new THREE.Vector3(x, 0.015, -totalHeight / 2));
      gridPoints.push(new THREE.Vector3(x, 0.015, totalHeight / 2));
    }
    for (let j = 1; j < this.gridHeight; j++) {
      const z = -totalHeight / 2 + j * this.cellSize;
      gridPoints.push(new THREE.Vector3(-totalWidth / 2, 0.015, z));
      gridPoints.push(new THREE.Vector3(totalWidth / 2, 0.015, z));
    }
    const innerGridGeo = new THREE.BufferGeometry().setFromPoints(gridPoints);
    const innerGridMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.25
    });
    this.gridMesh = new THREE.LineSegments(innerGridGeo, innerGridMat);
    this.mesh.add(this.gridMesh);

    // Group to hold snake body segments
    this.snakeGroup = new THREE.Group();
    this.mesh.add(this.snakeGroup);

    // Food Mesh Setup
    this.foodGeo = new THREE.SphereGeometry(this.cellSize * 0.35, 12, 12);
    this.foodMat = new THREE.MeshBasicMaterial({
      color: 0xff0055, // neon magenta/red food
      toneMapped: false
    });
    this.foodMesh = new THREE.Mesh(this.foodGeo, this.foodMat);
    this.mesh.add(this.foodMesh);

    // Food Aura Mesh Setup (Yellow glow for Turbo)
    const auraGeo = new THREE.SphereGeometry(this.cellSize * 0.55, 12, 12);
    const auraMat = new THREE.MeshBasicMaterial({
      color: 0xffeb3b, // Yellow neon glow
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      toneMapped: false
    });
    this.foodAuraMesh = new THREE.Mesh(auraGeo, auraMat);
    this.foodAuraMesh.visible = false; // Hidden by default
    this.foodMesh.add(this.foodAuraMesh);

    // Powerup Mesh Setup
    this.powerupMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      toneMapped: false
    });
    this.powerupMesh = new THREE.Mesh(this.foodGeo, this.powerupMat);
    this.powerupMesh.visible = false;
    this.mesh.add(this.powerupMesh);

    // Powerup Aura Mesh Setup
    const powerupAuraMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      toneMapped: false
    });
    this.powerupAuraMesh = new THREE.Mesh(auraGeo, powerupAuraMat);
    this.powerupMesh.add(this.powerupAuraMesh);

    // Geometries & Materials Cache
    this.segmentGeo = new THREE.BoxGeometry(this.cellSize * 0.9, 0.15, this.cellSize * 0.9);
    this.snakeMaterials = [];

    // Particle Geometry Setup
    this.particleGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);

    // Default position
    this.mesh.position.set(0, -3.98, 0); // floor-aligned
    this.mesh.visible = false;

    // Shield Mesh Setup (Purple Neon Shield/Bubble)
    const shieldGeo = new THREE.SphereGeometry(this.cellSize * 0.85, 16, 16);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0x9c27b0, // glowing purple
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      toneMapped: false
    });
    this.shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    this.shieldMesh.visible = false;
    this.mesh.add(this.shieldMesh);

    // Eye setup
    this.eyeGeo = new THREE.SphereGeometry(this.cellSize * 0.15, 8, 8);
    this.eyeMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff, // Glowing neon cyan eyes
      emissive: 0x00ffff,
      emissiveIntensity: 2.0, // High intensity glow
      roughness: 0.1,
      metalness: 0.1,
    });
  }

  private addEyesToHead(headMesh: THREE.Mesh): void {
    const leftEye = new THREE.Mesh(this.eyeGeo, this.eyeMat);
    leftEye.position.set(-this.cellSize * 0.22, 0.05, this.cellSize * 0.25);
    leftEye.name = 'eye';

    const rightEye = new THREE.Mesh(this.eyeGeo, this.eyeMat);
    rightEye.position.set(this.cellSize * 0.22, 0.05, this.cellSize * 0.25);
    rightEye.name = 'eye';

    headMesh.add(leftEye);
    headMesh.add(rightEye);
  }

  private getSegmentColor(index: number): number {
    if (index === 0) return 0x2ecc71; // Head is green
    const colorPool = [
      0x1abc9c, // Turquoise
      0x3498db, // Blue
      0x9b59b6, // Purple
      0xe91e63, // Pink
      0xe74c3c, // Red
      0xe67e22, // Orange
      0xf1c40f, // Yellow
    ];
    return colorPool[(index - 1) % colorPool.length];
  }

  public start(): void {
    this.score = 0;
    this.isPlaying = true;
    this.mesh.visible = true;
    this.direction = { x: 0, y: -1 };
    this.nextDirection = { x: 0, y: -1 };

    // Reset turbo, slowmo and ghost state
    this.isTurboActive = false;
    this.turboTimeRemaining = 0;
    this.isSlowMoActive = false;
    this.slowMoTimeRemaining = 0;
    this.isGhostActive = false;
    this.ghostTimeRemaining = 0;
    this.tickInterval = 180;
    this.currentPowerupType = null;
    this.powerupCoord = null;
    this.powerupMesh.visible = false;
    this.powerupTimeRemaining = 0;
    if (this.foodAuraMesh) {
      this.foodAuraMesh.visible = false;
    }
    if (this.shieldMesh) {
      this.shieldMesh.visible = false;
    }
    if (this.eyeMat) {
      this.eyeMat.color.setHex(0x00ffff);
      this.eyeMat.emissive.setHex(0x00ffff);
    }

    // Clear particles
    this.particles.forEach(p => {
      this.mesh.remove(p.mesh);
      if (p.mesh.material && !(p.mesh.material instanceof Array)) {
        p.mesh.material.dispose();
      }
    });
    this.particles = [];

    // Initial 3-segment snake in middle
    const startX = Math.floor(this.gridWidth / 2);
    const startY = Math.floor(this.gridHeight / 2);
    this.snakeCoords = [
      { x: startX, y: startY },
      { x: startX, y: startY + 1 },
      { x: startX, y: startY + 2 },
    ];

    // Clean up existing materials first
    this.snakeMaterials.forEach(m => m.dispose());
    this.snakeMaterials = this.snakeCoords.map((_, index) => {
      const color = this.getSegmentColor(index);
      return new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.1, // 10% glow
        roughness: 0.9,
        metalness: 0.1,
      });
    });

    // Clean up existing active and shrinking segments
    this.visualSegments.forEach(seg => {
      this.snakeGroup.remove(seg.mesh);
    });
    this.shrinkingSegments.forEach(seg => {
      this.snakeGroup.remove(seg.mesh);
      if (seg.mesh.material && !(seg.mesh.material instanceof Array)) {
        seg.mesh.material.dispose();
      }
    });
    this.visualSegments = [];
    this.shrinkingSegments = [];

    while (this.snakeGroup.children.length > 0) {
      this.snakeGroup.remove(this.snakeGroup.children[0]);
    }

    // Populate initial visualSegments
    this.snakeCoords.forEach((coord, index) => {
      const mat = this.snakeMaterials[index];
      const segMesh = new THREE.Mesh(this.segmentGeo, mat);

      const sx = - (this.gridWidth * this.cellSize) / 2 + coord.x * this.cellSize + this.cellSize / 2;
      const sz = - (this.gridHeight * this.cellSize) / 2 + coord.y * this.cellSize + this.cellSize / 2;
      segMesh.position.set(sx, 0.08, sz);
      this.snakeGroup.add(segMesh);

      // If head segment, add eyes!
      if (index === 0) {
        this.addEyesToHead(segMesh);
      }

      this.visualSegments.push({
        mesh: segMesh,
        prevX: coord.x,
        prevY: coord.y,
        targetX: coord.x,
        targetY: coord.y,
        scale: 1.0
      });
    });

    this.spawnFood();
    this.lastTickTime = performance.now();
  }

  public stop(): void {
    this.isPlaying = false;
    this.mesh.visible = false;
  }

  public handleInput(key: string): void {
    if (!this.isPlaying) return;

    const k = key.toLowerCase();
    if ((k === 'w' || k === 'arrowup') && this.direction.y === 0) {
      this.nextDirection = { x: 0, y: -1 };
    } else if ((k === 's' || k === 'arrowdown') && this.direction.y === 0) {
      this.nextDirection = { x: 0, y: 1 };
    } else if ((k === 'a' || k === 'arrowleft') && this.direction.x === 0) {
      this.nextDirection = { x: -1, y: 0 };
    } else if ((k === 'd' || k === 'arrowright') && this.direction.x === 0) {
      this.nextDirection = { x: 1, y: 0 };
    }
  }

  private spawnFood(): void {
    // Generate food coordinate not overlapping with snake body or active powerup
    let attempts = 0;
    while (attempts < 200) {
      const rx = Math.floor(Math.random() * this.gridWidth);
      const ry = Math.floor(Math.random() * this.gridHeight);
      const overlapsSnake = this.snakeCoords.some(seg => seg.x === rx && seg.y === ry);
      const overlapsPowerup = this.powerupCoord && this.powerupCoord.x === rx && this.powerupCoord.y === ry;
      if (!overlapsSnake && !overlapsPowerup) {
        this.foodCoord = { x: rx, y: ry };
        break;
      }
      attempts++;
    }

    this.foodMat.color.setHex(0xff0055); // neon magenta
    if (this.foodAuraMesh) {
      this.foodAuraMesh.visible = false;
    }

    // Position food mesh on 3D Board
    const fx = - (this.gridWidth * this.cellSize) / 2 + this.foodCoord.x * this.cellSize + this.cellSize / 2;
    const fz = - (this.gridHeight * this.cellSize) / 2 + this.foodCoord.y * this.cellSize + this.cellSize / 2;
    this.foodMesh.position.set(fx, 0.1, fz);
  }

  private spawnPowerup(): void {
    // Generate powerup coordinate not overlapping with snake body or standard food
    let attempts = 0;
    while (attempts < 200) {
      const rx = Math.floor(Math.random() * this.gridWidth);
      const ry = Math.floor(Math.random() * this.gridHeight);
      const overlapsSnake = this.snakeCoords.some(seg => seg.x === rx && seg.y === ry);
      const overlapsFood = this.foodCoord.x === rx && this.foodCoord.y === ry;
      if (!overlapsSnake && !overlapsFood) {
        this.powerupCoord = { x: rx, y: ry };
        break;
      }
      attempts++;
    }

    if (!this.powerupCoord) return;

    // Determine powerup type: equal chance for turbo, slowmo, ghost
    const types: ('turbo' | 'slowmo' | 'ghost')[] = ['turbo', 'slowmo', 'ghost'];
    this.currentPowerupType = types[Math.floor(Math.random() * types.length)];
    this.powerupTimeRemaining = 12000; // 12 seconds to collect before it expires

    let color = 0xffeb3b; // turbo yellow
    if (this.currentPowerupType === 'slowmo') {
      color = 0x00ffff; // cyan
    } else if (this.currentPowerupType === 'ghost') {
      color = 0x9c27b0; // purple
    }

    this.powerupMat.color.setHex(color);
    if (this.powerupAuraMesh) {
      (this.powerupAuraMesh.material as THREE.MeshBasicMaterial).color.setHex(color);
      this.powerupAuraMesh.visible = true;
    }

    // Position powerup mesh on 3D Board
    const px = - (this.gridWidth * this.cellSize) / 2 + this.powerupCoord.x * this.cellSize + this.cellSize / 2;
    const pz = - (this.gridHeight * this.cellSize) / 2 + this.powerupCoord.y * this.cellSize + this.cellSize / 2;
    this.powerupMesh.position.set(px, 0.1, pz);
    this.powerupMesh.visible = true;
  }

  public update(time: number): void {
    const now = performance.now();
    if (this.lastFrameTime === 0) this.lastFrameTime = now;
    const dt = Math.min((now - this.lastFrameTime) / 1000, 0.1);
    this.lastFrameTime = now;

    // Update active particles regardless of playing state
    this.updateParticles(dt);

    if (!this.isPlaying) return;

    // Handle active on-board powerup timer
    if (this.currentPowerupType) {
      this.powerupTimeRemaining -= dt * 1000;
      if (this.powerupTimeRemaining <= 0) {
        this.powerupCoord = null;
        this.currentPowerupType = null;
        this.powerupMesh.visible = false;
        this.powerupTimeRemaining = 0;
      }
    }

    // Handle Turbo, Slow Mo and Ghost Timers
    if (this.isTurboActive) {
      this.turboTimeRemaining -= dt * 1000;
      if (this.turboTimeRemaining <= 0) {
        this.isTurboActive = false;
        this.tickInterval = 180;
        if (this.eyeMat) {
          this.eyeMat.color.setHex(0x00ffff);
          this.eyeMat.emissive.setHex(0x00ffff);
        }
      } else {
        this.tickInterval = 120; // 1.5x speed
      }
    } else if (this.isSlowMoActive) {
      this.slowMoTimeRemaining -= dt * 1000;
      if (this.slowMoTimeRemaining <= 0) {
        this.isSlowMoActive = false;
        this.tickInterval = 180;
        if (this.eyeMat) {
          this.eyeMat.color.setHex(0x00ffff);
          this.eyeMat.emissive.setHex(0x00ffff);
        }
      } else {
        this.tickInterval = 300; // Slow down to 300ms
      }
    } else if (this.isGhostActive) {
      this.ghostTimeRemaining -= dt * 1000;
      if (this.ghostTimeRemaining <= 0) {
        this.isGhostActive = false;
        this.tickInterval = 180;
        if (this.eyeMat) {
          this.eyeMat.color.setHex(0x00ffff);
          this.eyeMat.emissive.setHex(0x00ffff);
        }
      } else {
        this.tickInterval = 180;
      }
    } else {
      this.tickInterval = 180;
    }

    // Shield positioning and pulsation
    if (this.isGhostActive && this.visualSegments.length > 0 && this.shieldMesh) {
      this.shieldMesh.position.copy(this.visualSegments[0].mesh.position);
      this.shieldMesh.visible = true;
      const shieldPulse = 1.0 + Math.sin(time * 10) * 0.15;
      this.shieldMesh.scale.set(shieldPulse, shieldPulse, shieldPulse);
    } else if (this.shieldMesh) {
      this.shieldMesh.visible = false;
    }

    // Glow border line depending on active powerups (board edges glow specification)
    if (this.borderLine) {
      const borderMat = this.borderLine.material as THREE.LineBasicMaterial;
      if (this.isTurboActive) {
        borderMat.color.setHex(0xffeb3b); // Turbo Yellow Glow
      } else if (this.isSlowMoActive) {
        borderMat.color.setHex(0x00ffff); // SlowMo Cyan Glow
      } else if (this.isGhostActive) {
        borderMat.color.setHex(0x9c27b0); // Ghost Purple Glow
      } else {
        borderMat.color.setHex(0xff00aa); // standard neon pink
      }
    }

    let t = (now - this.lastTickTime) / this.tickInterval;
    if (t > 1) t = 1;
    if (t < 0) t = 0;

    if (now - this.lastTickTime >= this.tickInterval) {
      this.lastTickTime = now;
      this.tick();
      // Reset t after tick
      t = 0;
    }

    // Spawn turbo trail if active
    if (this.isTurboActive && this.visualSegments.length > 0) {
      this.spawnTurboTrail(this.visualSegments[0].mesh.position);
    }

    // Smoothly position and scale active visual segments using linear interpolation (LERP)
    this.visualSegments.forEach((seg, index) => {
      const sxPrev = - (this.gridWidth * this.cellSize) / 2 + seg.prevX * this.cellSize + this.cellSize / 2;
      const szPrev = - (this.gridHeight * this.cellSize) / 2 + seg.prevY * this.cellSize + this.cellSize / 2;
      const sxTarget = - (this.gridWidth * this.cellSize) / 2 + seg.targetX * this.cellSize + this.cellSize / 2;
      const szTarget = - (this.gridHeight * this.cellSize) / 2 + seg.targetY * this.cellSize + this.cellSize / 2;

      const sx = sxPrev + (sxTarget - sxPrev) * t;
      const sz = szPrev + (szTarget - szPrev) * t;
      seg.mesh.position.set(sx, 0.08, sz);

      // Rotate head segment (index 0) to face the movement direction
      if (index === 0) {
        const dx = seg.targetX - seg.prevX;
        const dy = seg.targetY - seg.prevY;
        const dirX = dx !== 0 ? dx : this.direction.x;
        const dirY = dy !== 0 ? dy : this.direction.y;
        const angle = Math.atan2(dirX, dirY) + Math.PI;
        seg.mesh.rotation.y = angle;
      } else {
        seg.mesh.rotation.y = 0;
      }

      // Smooth scale for growing segments (like a newly added head)
      let currentScale = 1.0;
      if (seg.scale < 1.0) {
        currentScale = seg.scale + (1.0 - seg.scale) * t;
      }
      seg.mesh.scale.set(currentScale, currentScale, currentScale);
    });

    // Smoothly position and shrink departing tail segments
    this.shrinkingSegments.forEach((seg) => {
      const sxPrev = - (this.gridWidth * this.cellSize) / 2 + seg.prevX * this.cellSize + this.cellSize / 2;
      const szPrev = - (this.gridHeight * this.cellSize) / 2 + seg.prevY * this.cellSize + this.cellSize / 2;
      const sxTarget = - (this.gridWidth * this.cellSize) / 2 + seg.targetX * this.cellSize + this.cellSize / 2;
      const szTarget = - (this.gridHeight * this.cellSize) / 2 + seg.targetY * this.cellSize + this.cellSize / 2;

      const sx = sxPrev + (sxTarget - sxPrev) * t;
      const sz = szPrev + (szTarget - szPrev) * t;
      seg.mesh.position.set(sx, 0.08, sz);

      const currentScale = Math.max(0, 1.0 - t);
      seg.mesh.scale.set(currentScale, currentScale, currentScale);
    });

    // Gentle pulse animation for food so it looks amazing
    if (this.foodMesh) {
      const pulse = 1.0 + Math.sin(time * 12) * 0.15;
      this.foodMesh.scale.set(pulse, pulse, pulse);
      if (this.foodAuraMesh && this.foodAuraMesh.visible) {
        const auraPulse = 1.25 + Math.sin(time * 16) * 0.25;
        this.foodAuraMesh.scale.set(auraPulse, auraPulse, auraPulse);
      }
    }

    if (this.powerupMesh && this.powerupMesh.visible) {
      let scale = 1.0;
      // Shrink if expiring (last 2 seconds / 2000 ms)
      if (this.powerupTimeRemaining < 2000) {
        scale = Math.max(0, this.powerupTimeRemaining / 2000);
      } else {
        scale = 1.0 + Math.sin(time * 12) * 0.15;
      }
      this.powerupMesh.scale.set(scale, scale, scale);
      if (this.powerupAuraMesh && this.powerupAuraMesh.visible) {
        const auraPulse = (1.25 + Math.sin(time * 16) * 0.25) * scale;
        this.powerupAuraMesh.scale.set(auraPulse, auraPulse, auraPulse);
      }
    }
  }

  private tick(): void {
    // Clean up finished shrinking segments from the PREVIOUS tick cycle
    this.shrinkingSegments.forEach(seg => {
      this.snakeGroup.remove(seg.mesh);
      if (seg.mesh.material && !(seg.mesh.material instanceof Array)) {
        seg.mesh.material.dispose();
      }
    });
    this.shrinkingSegments = [];

    this.direction = this.nextDirection;

    // Head's next coordinate
    const head = this.snakeCoords[0];
    const newHead = {
      x: head.x + this.direction.x,
      y: head.y + this.direction.y,
    };

    // Boundary Check
    if (newHead.x < 0 || newHead.x >= this.gridWidth || newHead.y < 0 || newHead.y >= this.gridHeight) {
      this.gameOver();
      return;
    }

    // Self Collision Check (excluding tail if it moves)
    const selfCollision = this.snakeCoords.slice(0, -1).some(seg => seg.x === newHead.x && seg.y === newHead.y);
    if (selfCollision && !this.isGhostActive) {
      this.gameOver();
      return;
    }

    // Add new head to coordinates list
    this.snakeCoords.unshift(newHead);

    // Create standard material for new head
    const newHeadMat = new THREE.MeshStandardMaterial({
      color: 0x2ecc71, // Head is green
      emissive: 0x2ecc71,
      emissiveIntensity: 0.1, // 10% glow
      roughness: 0.9,
      metalness: 0.1,
    });

    this.snakeMaterials.unshift(newHeadMat);

    // Update ALL materials to have beautiful, stable defined colors based on their index
    this.snakeMaterials.forEach((mat, index) => {
      const color = this.getSegmentColor(index);
      mat.color.setHex(color);
      mat.emissive.setHex(color);
    });

    // Eat check
    const ateFood = (newHead.x === this.foodCoord.x && newHead.y === this.foodCoord.y);
    const atePowerup = !!(this.powerupCoord && newHead.x === this.powerupCoord.x && newHead.y === this.powerupCoord.y);
    const ateSomething = ateFood || atePowerup;

    if (ateSomething) {
      const wasTurboBefore = this.isTurboActive;

      if (atePowerup) {
        const isTurboEaten = this.currentPowerupType === 'turbo';
        const isSlowMoEaten = this.currentPowerupType === 'slowmo';
        const isGhostEaten = this.currentPowerupType === 'ghost';
        
        if (isTurboEaten) {
          this.isTurboActive = true;
          this.turboTimeRemaining = 10000; // 10 seconds of turbo
          this.isSlowMoActive = false; // Cancel slowmo
          this.slowMoTimeRemaining = 0;
          this.isGhostActive = false; // Cancel ghost
          this.ghostTimeRemaining = 0;
          this.tickInterval = 120; // 1.5x accelerated speed
          if (this.eyeMat) {
            this.eyeMat.color.setHex(0xffeb3b); // Glowing yellow neon eyes
            this.eyeMat.emissive.setHex(0xffeb3b);
          }
        } else if (isSlowMoEaten) {
          this.isSlowMoActive = true;
          this.slowMoTimeRemaining = 10000; // 10 seconds of slowmo
          this.isTurboActive = false; // Cancel turbo
          this.turboTimeRemaining = 0;
          this.isGhostActive = false; // Cancel ghost
          this.ghostTimeRemaining = 0;
          this.tickInterval = 300; // Slow motion ticks
          if (this.eyeMat) {
            this.eyeMat.color.setHex(0x00ffff); // Glowing cyan eyes
            this.eyeMat.emissive.setHex(0x00ffff);
          }
        } else if (isGhostEaten) {
          this.isGhostActive = true;
          this.ghostTimeRemaining = 10000; // 10 seconds of ghost mode
          this.isTurboActive = false; // Cancel turbo
          this.turboTimeRemaining = 0;
          this.isSlowMoActive = false; // Cancel slowmo
          this.slowMoTimeRemaining = 0;
          this.tickInterval = 180; // Normal speed
          if (this.eyeMat) {
            this.eyeMat.color.setHex(0x9c27b0); // Glowing purple eyes
            this.eyeMat.emissive.setHex(0x9c27b0);
          }
        }

        // If already under turbo or eating turbo powerup, double all points scored
        const pointsGained = (wasTurboBefore || isTurboEaten) ? 20 : 10;
        this.score += pointsGained;

        if (this.eventBus) {
          this.eventBus.emit('SNAKE_GAME:SCORE' as any, { 
            score: this.score,
            isTurbo: this.isTurboActive,
            isSlowMo: this.isSlowMoActive,
            isGhost: this.isGhostActive,
            pointsGained: pointsGained,
            isTurboEaten: isTurboEaten,
            isSlowMoEaten: isSlowMoEaten,
            isGhostEaten: isGhostEaten
          });
        }

        // Color-matched splash particles (Yellow burst for turbo, Cyan for slowmo, Purple for ghost)
        let splashColor = 0xff00ff;
        if (isTurboEaten) {
          splashColor = 0xffeb3b;
        } else if (isSlowMoEaten) {
          splashColor = 0x00ffff;
        } else if (isGhostEaten) {
          splashColor = 0x9c27b0;
        }
        this.spawnFoodSplash(this.powerupMesh.position, splashColor);

        // Clear powerup from board
        this.powerupCoord = null;
        this.currentPowerupType = null;
        this.powerupMesh.visible = false;
        this.powerupTimeRemaining = 0;

      } else {
        // Standard food eaten
        const pointsGained = wasTurboBefore ? 20 : 10;
        this.score += pointsGained;

        if (this.eventBus) {
          this.eventBus.emit('SNAKE_GAME:SCORE' as any, { 
            score: this.score,
            isTurbo: this.isTurboActive,
            isSlowMo: this.isSlowMoActive,
            isGhost: this.isGhostActive,
            pointsGained: pointsGained,
            isTurboEaten: false,
            isSlowMoEaten: false,
            isGhostEaten: false
          });
        }

        this.spawnFoodSplash(this.foodMesh.position, 0xff0055);
        this.spawnFood();

        // 35% chance to spawn an independent powerup if none on board
        if (!this.currentPowerupType && Math.random() < 0.35) {
          this.spawnPowerup();
        }
      }
    } else {
      // Remove tail
      this.snakeCoords.pop();
      this.snakeMaterials.pop(); // Note: we let the shrinking segments handle disposal of their mesh/material
    }

    // Synchronize visual segments for interpolation
    if (ateSomething) {
      // Shift target positions for all existing segments
      for (let i = this.visualSegments.length - 1; i > 0; i--) {
        const seg = this.visualSegments[i];
        const prevSeg = this.visualSegments[i - 1];
        seg.prevX = seg.targetX;
        seg.prevY = seg.targetY;
        seg.targetX = prevSeg.targetX;
        seg.targetY = prevSeg.targetY;
        seg.scale = 1.0;
      }
      if (this.visualSegments.length > 0) {
        const oldHeadSeg = this.visualSegments[0];
        oldHeadSeg.prevX = oldHeadSeg.targetX;
        oldHeadSeg.prevY = oldHeadSeg.targetY;
        oldHeadSeg.scale = 1.0;
        // Remove eyes from the old head mesh so only the active head has eyes
        while (oldHeadSeg.mesh.children.length > 0) {
          oldHeadSeg.mesh.remove(oldHeadSeg.mesh.children[0]);
        }
      }

      // Add new head segment
      const newHeadMesh = new THREE.Mesh(this.segmentGeo, newHeadMat);
      this.addEyesToHead(newHeadMesh);
      this.snakeGroup.add(newHeadMesh);
      this.visualSegments.unshift({
        mesh: newHeadMesh,
        prevX: head.x,
        prevY: head.y,
        targetX: newHead.x,
        targetY: newHead.y,
        scale: 1.0 // Make head size static (no pulsing scale animation)
      });
    } else {
      // Pop the tail segment from the active list and make it a shrinking segment
      const departingTail = this.visualSegments.pop();
      if (departingTail) {
        departingTail.isTailShrinking = true;
        this.shrinkingSegments.push(departingTail);
      }

      // Shift target positions for all remaining segments
      for (let i = this.visualSegments.length - 1; i > 0; i--) {
        const seg = this.visualSegments[i];
        const prevSeg = this.visualSegments[i - 1];
        seg.prevX = seg.targetX;
        seg.prevY = seg.targetY;
        seg.targetX = prevSeg.targetX;
        seg.targetY = prevSeg.targetY;
        seg.scale = 1.0;
      }
      if (this.visualSegments.length > 0) {
        const oldHeadSeg = this.visualSegments[0];
        oldHeadSeg.prevX = oldHeadSeg.targetX;
        oldHeadSeg.prevY = oldHeadSeg.targetY;
        oldHeadSeg.scale = 1.0;
        // Remove eyes from the old head mesh so only the active head has eyes
        while (oldHeadSeg.mesh.children.length > 0) {
          oldHeadSeg.mesh.remove(oldHeadSeg.mesh.children[0]);
        }
      }

      // Add new head segment
      const newHeadMesh = new THREE.Mesh(this.segmentGeo, newHeadMat);
      this.addEyesToHead(newHeadMesh);
      this.snakeGroup.add(newHeadMesh);
      this.visualSegments.unshift({
        mesh: newHeadMesh,
        prevX: head.x,
        prevY: head.y,
        targetX: newHead.x,
        targetY: newHead.y,
        scale: 1.0 // Make head size static (no pulsing scale animation)
      });
    }
  }

  private gameOver(): void {
    this.isPlaying = false;
    this.spawnGameOverShatter();
    if (this.eventBus) {
      this.eventBus.emit('SNAKE_GAME:GAME_OVER' as any, { score: this.score });
    }
  }

  public dispose(): void {
    super.dispose();
    if (this.segmentGeo) this.segmentGeo.dispose();
    if (this.foodGeo) this.foodGeo.dispose();
    if (this.particleGeo) this.particleGeo.dispose();
    if (this.eyeGeo) this.eyeGeo.dispose();
    if (this.eyeMat) this.eyeMat.dispose();
    if (this.shieldMesh) {
      this.mesh.remove(this.shieldMesh);
      this.shieldMesh.geometry.dispose();
      if (this.shieldMesh.material && !(this.shieldMesh.material instanceof Array)) {
        this.shieldMesh.material.dispose();
      }
    }
    this.snakeMaterials.forEach(m => m.dispose());
    this.visualSegments.forEach(seg => {
      if (seg.mesh.material && !(seg.mesh.material instanceof Array)) {
        seg.mesh.material.dispose();
      }
    });
    this.shrinkingSegments.forEach(seg => {
      if (seg.mesh.material && !(seg.mesh.material instanceof Array)) {
        seg.mesh.material.dispose();
      }
    });
    this.particles.forEach(p => {
      if (p.mesh.material && !(p.mesh.material instanceof Array)) {
        p.mesh.material.dispose();
      }
    });
    this.particles = [];
    if (this.foodMat) this.foodMat.dispose();
  }

  private spawnTurboTrail(pos: THREE.Vector3): void {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffeb3b, // bright yellow
      transparent: true,
      opacity: 0.8,
      toneMapped: false
    });
    const pMesh = new THREE.Mesh(this.particleGeo, mat);
    
    pMesh.position.copy(pos);
    pMesh.position.y += 0.05;

    const angle = Math.random() * Math.PI * 2;
    const speed = 0.5 + Math.random() * 1.0;
    const vx = Math.cos(angle) * speed;
    const vz = Math.sin(angle) * speed;
    const vy = 0.2 + Math.random() * 0.8;

    const velocity = new THREE.Vector3(vx, vy, vz);
    const rotationSpeed = new THREE.Vector3(
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10
    );

    this.mesh.add(pMesh);

    this.particles.push({
      mesh: pMesh,
      velocity: velocity,
      rotationSpeed: rotationSpeed,
      life: 0,
      maxLife: 0.3 + Math.random() * 0.3,
      gravity: true,
      deceleration: 0.95
    });
  }

  private spawnFoodSplash(pos: THREE.Vector3, color: number = 0xff00ff): void {
    const count = 15 + Math.floor(Math.random() * 6); // 15-20 particles
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: color, // custom color
        transparent: true,
        opacity: 1.0,
        toneMapped: false
      });
      const pMesh = new THREE.Mesh(this.particleGeo, mat);
      
      pMesh.position.copy(pos);
      pMesh.position.y += 0.05;

      const angle = Math.random() * Math.PI * 2;
      const speed = 1.0 + Math.random() * 2.5;
      const vx = Math.cos(angle) * speed;
      const vz = Math.sin(angle) * speed;
      const vy = 0.5 + Math.random() * 2.0;

      const velocity = new THREE.Vector3(vx, vy, vz);
      const rotationSpeed = new THREE.Vector3(
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15
      );

      this.mesh.add(pMesh);

      this.particles.push({
        mesh: pMesh,
        velocity: velocity,
        rotationSpeed: rotationSpeed,
        life: 0,
        maxLife: 0.6 + Math.random() * 0.4,
        gravity: true,
        deceleration: 0.98
      });
    }
  }

  private spawnGameOverShatter(): void {
    const segmentsToShatter = [...this.visualSegments, ...this.shrinkingSegments];
    
    segmentsToShatter.forEach(seg => {
      seg.mesh.visible = false;
      
      let color = 0x2ecc71;
      if (seg.mesh.material && !(seg.mesh.material instanceof Array)) {
        const mat = seg.mesh.material as THREE.MeshStandardMaterial;
        if (mat.color) {
          color = mat.color.getHex();
        }
      }

      const pos = seg.mesh.position;
      const particlesPerSegment = 6 + Math.floor(Math.random() * 4);

      for (let i = 0; i < particlesPerSegment; i++) {
        const mat = new THREE.MeshBasicMaterial({
          color: color,
          transparent: true,
          opacity: 1.0,
          toneMapped: false
        });
        const pMesh = new THREE.Mesh(this.particleGeo, mat);

        pMesh.position.set(
          pos.x + (Math.random() - 0.5) * (this.cellSize * 0.8),
          pos.y + (Math.random() - 0.5) * 0.1,
          pos.z + (Math.random() - 0.5) * (this.cellSize * 0.8)
        );

        const angle = Math.random() * Math.PI * 2;
        const speed = 1.2 + Math.random() * 2.0;
        const vx = Math.cos(angle) * speed;
        const vz = Math.sin(angle) * speed;
        const vy = 1.0 + Math.random() * 3.0;

        const velocity = new THREE.Vector3(vx, vy, vz);
        const rotationSpeed = new THREE.Vector3(
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20
        );

        this.mesh.add(pMesh);

        this.particles.push({
          mesh: pMesh,
          velocity: velocity,
          rotationSpeed: rotationSpeed,
          life: 0,
          maxLife: 1.0 + Math.random() * 0.8,
          gravity: true,
          deceleration: 0.95
        });
      }
    });

    this.visualSegments.forEach(seg => this.snakeGroup.remove(seg.mesh));
    this.shrinkingSegments.forEach(seg => this.snakeGroup.remove(seg.mesh));
    this.visualSegments = [];
    this.shrinkingSegments = [];
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;

      if (p.life >= p.maxLife) {
        this.mesh.remove(p.mesh);
        if (p.mesh.material && !(p.mesh.material instanceof Array)) {
          p.mesh.material.dispose();
        }
        this.particles.splice(i, 1);
        continue;
      }

      if (p.deceleration !== undefined) {
        p.velocity.x *= p.deceleration;
        p.velocity.y *= p.deceleration;
        p.velocity.z *= p.deceleration;
      }

      if (p.gravity) {
        p.velocity.y -= 9.8 * dt;
      }

      p.mesh.position.addScaledVector(p.velocity, dt);

      if (p.mesh.position.y < 0.02) {
        p.mesh.position.y = 0.02;
        p.velocity.y = -p.velocity.y * 0.4;
        p.velocity.x *= 0.8;
        p.velocity.z *= 0.8;
      }

      p.mesh.rotation.x += p.rotationSpeed.x * dt;
      p.mesh.rotation.y += p.rotationSpeed.y * dt;
      p.mesh.rotation.z += p.rotationSpeed.z * dt;

      const progress = p.life / p.maxLife;
      const fade = 1.0 - progress;

      if (p.mesh.material && !(p.mesh.material instanceof Array)) {
        p.mesh.material.opacity = fade;
      }
      p.mesh.scale.set(fade, fade, fade);
    }
  }
}
