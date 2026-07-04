import * as THREE from 'three';
import { BaseActor } from '../base/BaseActor';
import { gsap } from 'gsap';
import { EventBus } from '../../core/EventBus';

const SHAPES: Record<string, [number, number][]> = {
  I: [[0, 0], [-1, 0], [1, 0], [2, 0]],
  O: [[0, 0], [1, 0], [0, 1], [1, 1]],
  T: [[0, 0], [-1, 0], [1, 0], [0, 1]],
  S: [[0, 0], [1, 0], [0, 1], [-1, 1]],
  Z: [[0, 0], [-1, 0], [0, 1], [1, 1]],
  J: [[0, 0], [-1, 0], [1, 0], [-1, 1]],
  L: [[0, 0], [-1, 0], [1, 0], [1, 1]]
};

const COLORS: Record<string, number> = {
  I: 0x00f0ff, // Cyan
  O: 0xf0f000, // Yellow
  T: 0xa000f0, // Purple
  S: 0x00f000, // Green
  Z: 0xf00000, // Red
  J: 0x0000f0, // Blue
  L: 0xf0a000  // Orange
};

const HEX_COLORS: Record<string, string> = {
  I: '#00f0ff',
  O: '#f0f000',
  T: '#a000f0',
  S: '#00f000',
  Z: '#f00000',
  J: '#0000f0',
  L: '#f0a000'
};

export class TetrisBoardActor extends BaseActor {
  public eventBus?: EventBus;
  private grid: (number | null)[][] = Array(20).fill(null).map(() => Array(10).fill(null));
  
  // Active tetromino state
  private activePieceColor: number = 0x00f0ff;
  private activePieceBlocks: [number, number][] = [];
  private activePieceX: number = 4;
  private activePieceY: number = 0;

  // Next tetromino preview state
  private nextPieceType: string = '';

  // Visual groups
  private piecesGroup!: THREE.Group;
  private activePieceGroup!: THREE.Group;
  private landedBlocksGroup!: THREE.Group;
  private sparksGroup!: THREE.Group;
  private backboardMesh!: THREE.Mesh;
  private gridlinesGroup!: THREE.Group;
  private nextPiecePreviewGroup!: THREE.Group;

  // Landed meshes persistent tracking
  private landedMeshes: (THREE.Mesh | null)[][] = Array(20).fill(null).map(() => Array(10).fill(null));

  // Sparks/particle systems
  private activeSparks: {
    mesh: THREE.Mesh;
    vx: number;
    vy: number;
    vz: number;
    life: number;
    maxLife: number;
  }[] = [];

  // Material caches
  private blockMatCache: Record<number, THREE.MeshBasicMaterial> = {};
  private lineMatCache: Record<number, THREE.LineBasicMaterial> = {};

  // Cache geometries
  private blockGeometry!: THREE.BoxGeometry;
  private edgesGeometry!: THREE.EdgesGeometry;

  // Game state variables
  public score: number = 0;
  public linesCleared: number = 0;
  public level: number = 1;
  private isGameOver: boolean = false;
  private isPlaying: boolean = false;
  private isAnimatingLineClear: boolean = false;

  // Tick timer
  private lastTickTime: number = 0;
  private tickInterval: number = 800; // ms per tick

  constructor() {
    super('tetris-board');
  }

  public setup(): void {
    // 1. Setup groups
    this.piecesGroup = new THREE.Group();
    this.gridlinesGroup = new THREE.Group();
    this.nextPiecePreviewGroup = new THREE.Group();
    this.mesh.add(this.piecesGroup);
    this.mesh.add(this.gridlinesGroup);
    this.mesh.add(this.nextPiecePreviewGroup);

    // Position board centered at Z=3.0, Y=-2.5 (from Y=-4.0 to Y=-1.0), X=3.0
    this.mesh.position.set(3.0, -2.5, 3.0);

    // 2. Define sizing constants
    const cellWidth = 0.15;
    const boardWidth = 10 * cellWidth; // 1.5
    const boardHeight = 20 * cellWidth; // 3.0

    // Next piece preview box setup
    const previewWidth = 4.2 * cellWidth;
    const previewHeight = 4.2 * cellWidth;
    const previewBackboardGeo = new THREE.PlaneGeometry(previewWidth, previewHeight);
    const previewBackboardMat = new THREE.MeshBasicMaterial({
      color: 0x000511,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });
    const previewBackboard = new THREE.Mesh(previewBackboardGeo, previewBackboardMat);
    previewBackboard.position.set(0, 0, -0.01);
    this.nextPiecePreviewGroup.add(previewBackboard);

    // Neon border for preview box
    const previewBorderGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-previewWidth / 2, -previewHeight / 2, 0),
      new THREE.Vector3(previewWidth / 2, -previewHeight / 2, 0),
      new THREE.Vector3(previewWidth / 2, previewHeight / 2, 0),
      new THREE.Vector3(-previewWidth / 2, previewHeight / 2, 0),
      new THREE.Vector3(-previewWidth / 2, -previewHeight / 2, 0)
    ]);
    const previewBorderMat = new THREE.LineBasicMaterial({
      color: 0xff00aa, // Nice neon magenta border for next piece!
      linewidth: 2,
      transparent: true,
      opacity: 0.6
    });
    const previewBorder = new THREE.Line(previewBorderGeo, previewBorderMat);
    this.nextPiecePreviewGroup.add(previewBorder);

    // Position nextPiecePreviewGroup to the right of the board
    this.nextPiecePreviewGroup.position.set(boardWidth / 2 + 0.45, boardHeight / 2 - 0.45, 0);

    // Geometries
    this.blockGeometry = new THREE.BoxGeometry(cellWidth * 0.9, cellWidth * 0.9, cellWidth * 0.9);
    this.edgesGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(cellWidth * 0.95, cellWidth * 0.95, cellWidth * 0.95));

    // 3. Create transparent backboard
    const backboardGeo = new THREE.PlaneGeometry(boardWidth, boardHeight);
    const backboardMat = new THREE.MeshBasicMaterial({
      color: 0x000511,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });
    this.backboardMesh = new THREE.Mesh(backboardGeo, backboardMat);
    this.mesh.add(this.backboardMesh);

    // 4. Create thin neon cyan border lines
    const borderGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-boardWidth / 2, -boardHeight / 2, 0),
      new THREE.Vector3(boardWidth / 2, -boardHeight / 2, 0),
      new THREE.Vector3(boardWidth / 2, boardHeight / 2, 0),
      new THREE.Vector3(-boardWidth / 2, boardHeight / 2, 0),
      new THREE.Vector3(-boardWidth / 2, -boardHeight / 2, 0)
    ]);
    const borderMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      linewidth: 3,
      transparent: true,
      opacity: 0.4
    });
    const border = new THREE.Line(borderGeo, borderMat);
    this.mesh.add(border);

    // 5. Create gridlines
    const gridlineMat = new THREE.LineBasicMaterial({
      color: 0x0088cc,
      transparent: true,
      opacity: 0.15
    });

    // Vertical gridlines
    for (let col = 1; col < 10; col++) {
      const x = -boardWidth / 2 + col * cellWidth;
      const points = [
        new THREE.Vector3(x, -boardHeight / 2, 0),
        new THREE.Vector3(x, boardHeight / 2, 0)
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geo, gridlineMat);
      this.gridlinesGroup.add(line);
    }

    // Horizontal gridlines
    for (let row = 1; row < 20; row++) {
      const y = -boardHeight / 2 + row * cellWidth;
      const points = [
        new THREE.Vector3(-boardWidth / 2, y, 0),
        new THREE.Vector3(boardWidth / 2, y, 0)
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geo, gridlineMat);
      this.gridlinesGroup.add(line);
    }

    // Bug Fix 3: Hide internal cell gridlines to provide a sleek, minimalist aesthetic
    this.gridlinesGroup.visible = false;

    // Default: start hidden/inactive
    this.setVisible(false);
  }

  public start(): void {
    this.grid = Array(20).fill(null).map(() => Array(10).fill(null));
    this.landedMeshes = Array(20).fill(null).map(() => Array(10).fill(null));
    this.activeSparks = [];

    // Setup activePieceGroup, landedBlocksGroup and sparksGroup
    if (!this.activePieceGroup) {
      this.activePieceGroup = new THREE.Group();
      this.piecesGroup.add(this.activePieceGroup);
    }
    if (!this.landedBlocksGroup) {
      this.landedBlocksGroup = new THREE.Group();
      this.piecesGroup.add(this.landedBlocksGroup);
    }
    if (!this.sparksGroup) {
      this.sparksGroup = new THREE.Group();
      this.piecesGroup.add(this.sparksGroup);
    }

    // Clear sub-groups
    while (this.landedBlocksGroup.children.length > 0) {
      this.landedBlocksGroup.remove(this.landedBlocksGroup.children[0]);
    }
    while (this.activePieceGroup.children.length > 0) {
      this.activePieceGroup.remove(this.activePieceGroup.children[0]);
    }
    while (this.sparksGroup.children.length > 0) {
      this.sparksGroup.remove(this.sparksGroup.children[0]);
    }

    this.score = 0;
    this.linesCleared = 0;
    this.level = 1;
    this.tickInterval = 800;
    this.isGameOver = false;
    this.isPlaying = true;
    this.isAnimatingLineClear = false;
    this.lastTickTime = performance.now();

    // Pre-roll a secondary random piece inside TetrisBoardActor.ts on start.
    const keys = Object.keys(SHAPES);
    this.nextPieceType = keys[Math.floor(Math.random() * keys.length)];

    this.setVisible(true);
    this.spawnPiece();
    this.renderBoard();
    this.bindEvents();

    this.updateHUDScores();
  }

  public stop(): void {
    this.isPlaying = false;
    this.setVisible(false);
    this.unbindEvents();
    this.renderNextPiecePreview();
  }

  private setVisible(visible: boolean): void {
    this.mesh.visible = visible;
  }

  private spawnPiece(): void {
    const keys = Object.keys(SHAPES);
    
    // Fallback if not initialized (though we pre-roll it on start)
    if (!this.nextPieceType) {
      this.nextPieceType = keys[Math.floor(Math.random() * keys.length)];
    }

    const currentType = this.nextPieceType;
    // Roll the next piece
    this.nextPieceType = keys[Math.floor(Math.random() * keys.length)];

    // Update the visual 3D preview
    this.renderNextPiecePreview();

    this.activePieceColor = COLORS[currentType];
    this.activePieceBlocks = JSON.parse(JSON.stringify(SHAPES[currentType]));
    this.activePieceX = 4;
    this.activePieceY = 0;

    // Reset active piece group rotation and scale
    if (this.activePieceGroup) {
      gsap.killTweensOf(this.activePieceGroup.rotation);
      gsap.killTweensOf(this.activePieceGroup.scale);
      this.activePieceGroup.rotation.set(0, 0, 0);
      this.activePieceGroup.scale.set(1, 1, 1);
    }

    // Check game over
    if (!this.canPieceFit(this.activePieceBlocks, this.activePieceX, this.activePieceY)) {
      this.isGameOver = true;
      this.isPlaying = false;
      console.log('TETRIS GAME OVER!');
      this.showGameOverHUD();
      if (this.eventBus) {
        this.eventBus.emit('TETRIS:GAME_OVER' as any, { score: this.score });
      }
    }

    this.updateHUDScores();
  }

  private canPieceFit(blocks: [number, number][], px: number, py: number): boolean {
    for (const [bx, by] of blocks) {
      const gx = px + bx;
      const gy = py + by;

      if (gx < 0 || gx >= 10 || gy >= 20) {
        return false;
      }
      if (gy >= 0) {
        if (this.grid[gy][gx] !== null) {
          return false;
        }
      }
    }
    return true;
  }

  public rotatePiece(): void {
    if (this.isAnimatingLineClear || !this.isPlaying || this.isGameOver) return;
    
    // Clockwise rotation: (x, y) -> (-y, x)
    const rotated = this.activePieceBlocks.map(([bx, by]) => [-by, bx] as [number, number]);
    
    // Wall kick attempts
    const kicks = [0, -1, 1, -2, 2];
    for (const dx of kicks) {
      if (this.canPieceFit(rotated, this.activePieceX + dx, this.activePieceY)) {
        this.activePieceBlocks = rotated;
        this.activePieceX += dx;
        
        // Redraw blocks locally
        this.renderBoard();

        // Giggle Physics: Trigger springy rotation bounce starting from offset and returning to 0
        gsap.killTweensOf(this.activePieceGroup.rotation);
        this.activePieceGroup.rotation.z = Math.PI / 2;
        gsap.to(this.activePieceGroup.rotation, {
          z: 0,
          duration: 0.4,
          ease: "elastic.out(1.1, 0.4)"
        });
        return;
      }
    }
  }

  public slidePiece(dx: number): void {
    if (this.isAnimatingLineClear || !this.isPlaying || this.isGameOver) return;

    if (this.canPieceFit(this.activePieceBlocks, this.activePieceX + dx, this.activePieceY)) {
      this.activePieceX += dx;
      this.renderBoard();

      // Giggle Physics: squash & stretch on shift
      gsap.killTweensOf(this.activePieceGroup.scale);
      this.activePieceGroup.scale.set(0.85, 1.15, 1.0);
      gsap.to(this.activePieceGroup.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration: 0.4,
        ease: "elastic.out(1.1, 0.4)"
      });
    }
  }

  private spawnScorePopup(points: number): void {
    if (points <= 0) return;

    const popup = document.createElement('div');
    popup.textContent = `+${points}`;
    
    // Choose neon colors based on score size
    let color = '#00f0ff'; // Default cyan
    if (points >= 800) {
      color = '#ff0055'; // Mega score: neon magenta/pink
    } else if (points >= 300) {
      color = '#00ff55'; // Good score: neon green
    } else if (points >= 100) {
      color = '#ffaa00'; // Row clear: orange
    } else if (points > 10) {
      color = '#f0f000'; // Hard drop: yellow
    }

    const randomOffsetX = (Math.random() - 0.5) * 60; // offset in pixels
    const randomOffsetY = (Math.random() - 0.5) * 60;

    popup.style.position = 'absolute';
    popup.style.left = '50%';
    popup.style.top = '50%';
    popup.style.transform = `translate(-50%, -50%) translate(${randomOffsetX}px, ${randomOffsetY}px)`;
    popup.style.fontFamily = "'Courier New', Courier, monospace";
    popup.style.fontSize = points >= 100 ? '4rem' : '2rem';
    popup.style.fontWeight = 'bold';
    popup.style.color = color;
    popup.style.textShadow = `0 0 10px ${color}, 0 0 20px ${color}, 0 0 30px ${color}`;
    popup.style.zIndex = '999999';
    popup.style.pointerEvents = 'none';

    document.body.appendChild(popup);

    gsap.to(popup, {
      y: -100,
      opacity: 0,
      duration: 1.5,
      ease: 'power2.out',
      onComplete: () => {
        if (popup.parentNode) {
          popup.parentNode.removeChild(popup);
        }
      }
    });
  }

  public softDrop(isManual: boolean = false): void {
    if (this.isAnimatingLineClear || !this.isPlaying || this.isGameOver) return;

    if (this.canPieceFit(this.activePieceBlocks, this.activePieceX, this.activePieceY + 1)) {
      this.activePieceY += 1;
      if (isManual) {
        this.score += 1;
        this.spawnScorePopup(1);
      }
      this.lastTickTime = performance.now(); // reset tick timer
      this.renderBoard();
    } else {
      this.lockPiece();
    }
    this.updateHUDScores();
  }

  public hardDrop(): void {
    if (this.isAnimatingLineClear || !this.isPlaying || this.isGameOver) return;

    let dropDist = 0;
    while (this.canPieceFit(this.activePieceBlocks, this.activePieceX, this.activePieceY + 1)) {
      this.activePieceY += 1;
      dropDist++;
    }
    const points = dropDist * 2;
    this.score += points;
    if (points > 0) {
      this.spawnScorePopup(points);
    }
    this.lockPiece();
    this.updateHUDScores();
  }

  private lockPiece(): void {
    const landedBlockCoordinates: [number, number][] = [];
    for (const [bx, by] of this.activePieceBlocks) {
      const gx = this.activePieceX + bx;
      const gy = this.activePieceY + by;
      if (gy >= 0 && gy < 20 && gx >= 0 && gx < 10) {
        this.grid[gy][gx] = this.activePieceColor;
        landedBlockCoordinates.push([gx, gy]);
      }
    }

    // Create the persistent meshes for the newly landed blocks
    this.createLandedMeshesForCoordinates(landedBlockCoordinates, this.activePieceColor);

    // Apply Giggle Physics Landing Bounce & Propagation
    this.triggerLandingBounce(landedBlockCoordinates);

    // Check line clears
    this.checkLineClears();
  }

  private createLandedMeshesForCoordinates(coords: [number, number][], color: number): void {
    const cellWidth = 0.15;
    const boardWidth = 10 * cellWidth;
    const boardHeight = 20 * cellWidth;

    for (const [gx, gy] of coords) {
      // Clean up any old visual mesh at this spot
      const oldMesh = this.landedMeshes[gy][gx];
      if (oldMesh) {
        this.landedBlocksGroup.remove(oldMesh);
      }

      const cellMesh = new THREE.Mesh(this.blockGeometry, this.getBlockMaterial(color));
      const x_local = -boardWidth / 2 + gx * cellWidth + cellWidth / 2;
      const y_local = boardHeight / 2 - gy * cellWidth - cellWidth / 2;
      cellMesh.position.set(x_local, y_local, 0);

      const outline = new THREE.LineSegments(this.edgesGeometry, this.getLineMaterial(color));
      cellMesh.add(outline);
      this.landedBlocksGroup.add(cellMesh);

      this.landedMeshes[gy][gx] = cellMesh;
    }
  }

  private triggerLandingBounce(coords: [number, number][]): void {
    for (let r = 0; r < 20; r++) {
      for (let c = 0; c < 10; c++) {
        const mesh = this.landedMeshes[r][c];
        if (!mesh) continue;

        let minDist = Infinity;
        for (const [lx, ly] of coords) {
          const dist = Math.abs(c - lx) + Math.abs(r - ly);
          if (dist < minDist) {
            minDist = dist;
          }
        }

        if (minDist <= 4) {
          gsap.killTweensOf(mesh.scale);
          const delay = minDist * 0.05;
          mesh.scale.set(1.25, 0.75, 1.25);
          gsap.to(mesh.scale, {
            x: 1,
            y: 1,
            z: 1,
            duration: 0.5,
            delay: delay,
            ease: "elastic.out(1.2, 0.4)"
          });
        }
      }
    }
  }

  private checkLineClears(): void {
    const clearedRows: number[] = [];
    for (let row = 0; row < 20; row++) {
      if (this.grid[row].every(cell => cell !== null)) {
        clearedRows.push(row);
      }
    }

    if (clearedRows.length > 0) {
      this.isAnimatingLineClear = true;

      // Spawn beautiful line clear spark effects
      this.spawnSparksForLines(clearedRows);

      // Fade out and shrink cleared rows
      for (const row of clearedRows) {
        for (let col = 0; col < 10; col++) {
          const mesh = this.landedMeshes[row][col];
          if (mesh) {
            gsap.to(mesh.scale, {
              x: 0,
              y: 0,
              z: 0,
              duration: 0.35,
              onComplete: () => {
                this.landedBlocksGroup.remove(mesh);
              }
            });
            this.landedMeshes[row][col] = null;
          }
        }
      }

      // Delay physics and cascading
      setTimeout(() => {
        // Physical removal from grid buffer
        for (const row of clearedRows) {
          this.grid.splice(row, 1);
          this.grid.unshift(Array(10).fill(null));
        }

        // Cascade down remaining landed meshes
        this.cascadeLandedMeshes(clearedRows);

        // Update score
        this.linesCleared += clearedRows.length;
        const rewards = [0, 100, 300, 500, 800];
        const points = rewards[clearedRows.length] * this.level;
        this.score += points;
        if (points > 0) {
          this.spawnScorePopup(points);
        }
        this.level = Math.floor(this.linesCleared / 10) + 1;
        this.tickInterval = Math.max(100, 800 - (this.level - 1) * 100);

        this.isAnimatingLineClear = false;
        this.spawnPiece();
        this.renderBoard();
        this.lastTickTime = performance.now();
      }, 400);

    } else {
      this.spawnPiece();
      this.renderBoard();
    }
  }

  private cascadeLandedMeshes(clearedRows: number[]): void {
    const cellWidth = 0.15;
    const boardHeight = 20 * cellWidth;

    const nextLandedMeshes: (THREE.Mesh | null)[][] = Array(20).fill(null).map(() => Array(10).fill(null));

    for (let r = 0; r < 20; r++) {
      for (let c = 0; c < 10; c++) {
        const mesh = this.landedMeshes[r][c];
        if (!mesh) continue;

        const dropCount = clearedRows.filter(rowY => rowY > r).length;
        if (dropCount > 0) {
          const nextRow = r + dropCount;
          nextLandedMeshes[nextRow][c] = mesh;

          const targetY = boardHeight / 2 - nextRow * cellWidth - cellWidth / 2;

          gsap.killTweensOf(mesh.position);
          gsap.to(mesh.position, {
            y: targetY,
            duration: 0.45,
            ease: "bounce.out" // Bouncy vertical drop animation!
          });
        } else {
          nextLandedMeshes[r][c] = mesh;
        }
      }
    }

    this.landedMeshes = nextLandedMeshes;
  }

  private spawnSparksForLines(clearedRows: number[]): void {
    const cellWidth = 0.15;
    const boardWidth = 10 * cellWidth;
    const boardHeight = 20 * cellWidth;

    // Neon colors: yellow, orange, red-orange, neon magenta
    const colors = [0xffdd00, 0xffaa00, 0xff5500, 0xff0088];

    for (const row of clearedRows) {
      for (let col = 0; col < 10; col++) {
        const x_local = -boardWidth / 2 + col * cellWidth + cellWidth / 2;
        const y_local = boardHeight / 2 - row * cellWidth - cellWidth / 2;

        const count = Math.floor(Math.random() * 5) + 8;
        for (let i = 0; i < count; i++) {
          const color = colors[Math.floor(Math.random() * colors.length)];
          const sparkGeo = new THREE.BoxGeometry(0.015, 0.015, 0.015);
          const sparkMat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending
          });
          const sparkMesh = new THREE.Mesh(sparkGeo, sparkMat);
          sparkMesh.position.set(x_local, y_local, 0);
          this.sparksGroup.add(sparkMesh);

          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 1.5 + 0.5;
          const vx = Math.cos(angle) * speed;
          const vy = Math.sin(angle) * speed;
          const vz = (Math.random() - 0.5) * 0.5;

          this.activeSparks.push({
            mesh: sparkMesh,
            vx,
            vy,
            vz,
            life: 0.6,
            maxLife: 0.6
          });
        }
      }
    }
  }

  private getBlockMaterial(color: number): THREE.MeshBasicMaterial {
    if (!this.blockMatCache[color]) {
      this.blockMatCache[color] = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.15,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
      });
    }
    return this.blockMatCache[color];
  }

  private getLineMaterial(color: number): THREE.LineBasicMaterial {
    if (!this.lineMatCache[color]) {
      this.lineMatCache[color] = new THREE.LineBasicMaterial({
        color: color,
        linewidth: 2,
        transparent: true,
        opacity: 0.5
      });
    }
    return this.lineMatCache[color];
  }

  private renderBoard(): void {
    if (!this.activePieceGroup) return;

    // Clear old visual children inside the activePieceGroup only
    while (this.activePieceGroup.children.length > 0) {
      this.activePieceGroup.remove(this.activePieceGroup.children[0]);
    }

    if (!this.isPlaying || this.isGameOver) return;

    const cellWidth = 0.15;
    const boardWidth = 10 * cellWidth;
    const boardHeight = 20 * cellWidth;

    // Position the active group pivot at (activePieceX, activePieceY)
    const pivotX = -boardWidth / 2 + this.activePieceX * cellWidth + cellWidth / 2;
    const pivotY = boardHeight / 2 - this.activePieceY * cellWidth - cellWidth / 2;
    this.activePieceGroup.position.set(pivotX, pivotY, 0);

    // Render active piece cells relative to this pivot
    for (const [bx, by] of this.activePieceBlocks) {
      const cellMesh = new THREE.Mesh(this.blockGeometry, this.getBlockMaterial(this.activePieceColor));
      cellMesh.position.set(bx * cellWidth, -by * cellWidth, 0);

      const outline = new THREE.LineSegments(this.edgesGeometry, this.getLineMaterial(this.activePieceColor));
      cellMesh.add(outline);
      this.activePieceGroup.add(cellMesh);
    }
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' || e.key === 'Esc') {
      if (this.eventBus) {
        this.eventBus.emit('TETRIS:QUIT' as any);
      }
      return;
    }

    if (!this.isPlaying || this.isGameOver || this.isAnimatingLineClear) return;

    switch (e.key.toLowerCase()) {
      case 'a':
      case 'arrowleft':
        this.slidePiece(-1);
        break;
      case 'd':
      case 'arrowright':
        this.slidePiece(1);
        break;
      case 'w':
      case 'arrowup':
        this.rotatePiece();
        break;
      case 's':
      case 'arrowdown':
        this.softDrop(true);
        break;
      case ' ':
        e.preventDefault();
        this.hardDrop();
        break;
    }
  };

  private bindEvents(): void {
    window.addEventListener('keydown', this.handleKeyDown);
  }

  private unbindEvents(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
  }

  public update(time: number): void {
    // 1. Update line clear spark particles
    const dt = 0.016; // Standard delta time
    for (let i = this.activeSparks.length - 1; i >= 0; i--) {
      const spark = this.activeSparks[i];
      spark.mesh.position.x += spark.vx * dt;
      spark.mesh.position.y += spark.vy * dt;
      spark.mesh.position.z += spark.vz * dt;

      // Drag
      spark.vx *= 0.92;
      spark.vy *= 0.92;
      spark.vz *= 0.92;

      spark.life -= dt;

      if (spark.life <= 0) {
        this.sparksGroup.remove(spark.mesh);
        spark.mesh.geometry.dispose();
        if (Array.isArray(spark.mesh.material)) {
          spark.mesh.material.forEach(m => m.dispose());
        } else {
          spark.mesh.material.dispose();
        }
        this.activeSparks.splice(i, 1);
      } else {
        const mat = spark.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, spark.life / spark.maxLife);
      }
    }

    if (!this.isPlaying || this.isGameOver || this.isAnimatingLineClear) return;

    // Convert seconds from scene to milliseconds
    const currentTimeMs = time * 1000;
    if (currentTimeMs - this.lastTickTime > this.tickInterval) {
      this.softDrop(false);
      this.lastTickTime = currentTimeMs;
    }
  }

  private updateHUDScores(): void {
    const scoreVal = document.getElementById('tetris-score-val');
    const levelVal = document.getElementById('tetris-level-val');
    const linesVal = document.getElementById('tetris-lines-val');
    const nextVal = document.getElementById('tetris-next-val');

    if (scoreVal) scoreVal.textContent = this.score.toString().padStart(5, '0');
    if (levelVal) levelVal.textContent = this.level.toString();
    if (linesVal) linesVal.textContent = this.linesCleared.toString();
    if (nextVal && this.nextPieceType) {
      nextVal.textContent = this.nextPieceType;
      nextVal.style.color = HEX_COLORS[this.nextPieceType] || '#ffffff';
    }
  }

  private showGameOverHUD(): void {
    const scoreVal = document.getElementById('tetris-score-val');
    if (scoreVal) scoreVal.innerHTML = `<span style="color: #ff0055;">GAME OVER (${this.score})</span>`;
  }

  private renderNextPiecePreview(): void {
    if (!this.nextPiecePreviewGroup) return;

    // Clear old blocks from the preview group (keep the backboard and border)
    while (this.nextPiecePreviewGroup.children.length > 2) {
      this.nextPiecePreviewGroup.remove(this.nextPiecePreviewGroup.children[2]);
    }

    if (!this.isPlaying || this.isGameOver || !this.nextPieceType) return;

    const cellWidth = 0.15;
    const blocks = SHAPES[this.nextPieceType];
    const color = COLORS[this.nextPieceType];

    // Compute bounding box of shape to perfectly center it
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    for (const [bx, by] of blocks) {
      if (bx < minX) minX = bx;
      if (bx > maxX) maxX = bx;
      if (by < minY) minY = by;
      if (by > maxY) maxY = by;
    }

    // Width and height in units
    const shapeWidth = (maxX - minX + 1) * cellWidth;
    const shapeHeight = (maxY - minY + 1) * cellWidth;

    // Offsets to center the shape
    const offsetX = -(minX * cellWidth + shapeWidth / 2) + cellWidth / 2;
    const offsetY = (minY * cellWidth + shapeHeight / 2) - cellWidth / 2;

    for (const [bx, by] of blocks) {
      const cellMesh = new THREE.Mesh(this.blockGeometry, this.getBlockMaterial(color));
      // Position relative to group center, with centering offsets applied
      const px = bx * cellWidth + offsetX;
      const py = -by * cellWidth + offsetY;
      cellMesh.position.set(px, py, 0);

      const outline = new THREE.LineSegments(this.edgesGeometry, this.getLineMaterial(color));
      cellMesh.add(outline);
      this.nextPiecePreviewGroup.add(cellMesh);
    }
  }

  public dispose(): void {
    this.unbindEvents();
    super.dispose();
    if (this.blockGeometry) this.blockGeometry.dispose();
    if (this.edgesGeometry) this.edgesGeometry.dispose();

    // Dispose cached materials
    Object.values(this.blockMatCache).forEach(m => m.dispose());
    Object.values(this.lineMatCache).forEach(m => m.dispose());
  }
}
