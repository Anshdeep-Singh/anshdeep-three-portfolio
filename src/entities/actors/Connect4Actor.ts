import * as THREE from 'three';
import { BaseActor } from '../base/BaseActor';
import { gsap } from 'gsap';

export class Connect4Actor extends BaseActor {
  public boardGroup!: THREE.Group;
  public pileGroup!: THREE.Group;

  // Track the 42 physical disc meshes
  public discs: THREE.Mesh[] = [];
  public columnHitBoxes: THREE.Mesh[] = [];

  // Particle System Properties
  private particles!: THREE.Points;
  private particlesUniforms!: { [uniform: string]: THREE.IUniform };
  private originalOpacityMap: Map<THREE.Material, number> = new Map();

  // Deterministic scattered positions and rotations for the pile state
  private scatteredPositions: THREE.Vector3[] = [];
  private scatteredRotations: THREE.Euler[] = [];

  // Game state
  private grid: (string | null)[][] = []; // 6 rows x 7 columns
  private readonly ROWS = 6;
  private readonly COLS = 7;

  constructor() {
    super('connect-4');
  }

  public setup(): void {
    // 1. Initialize main groups
    this.boardGroup = new THREE.Group();
    this.boardGroup.visible = false; // Hidden initially
    this.pileGroup = new THREE.Group();

    this.mesh.add(this.boardGroup);
    this.mesh.add(this.pileGroup);

    // Scale the entire actor to be nicely proportioned in the room
    this.mesh.scale.set(1.2, 1.2, 1.2);

    // 2. Build the Connect 4 Board Geometry
    this.buildBoard();

    // 3. Build the 3D Discs and Compute Scattered Pile Positions
    this.buildDiscs();

    // 4. Setup Particle system
    this.setupParticles();

    // 5. Initialize the 2D logic grid and put discs in pile
    this.resetGrid();

    // 6. Build invisible hitboxes for direct pointer selection
    this.buildHitBoxes();
  }

  private buildHitBoxes(): void {
    const colSpacing = 0.5;
    const cols = 7;
    const boxGeo = new THREE.BoxGeometry(0.48, 3.5, 0.6);
    // Use opacity = 0 & transparent = true so it is 100% invisible but raycastable (visible = true)
    const boxMat = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0
    });

    for (let col = 0; col < cols; col++) {
      const cx = (col - 3) * colSpacing;
      const mesh = new THREE.Mesh(boxGeo, boxMat);
      mesh.position.set(cx, 0, 0);
      (mesh as any).colIndex = col;
      this.boardGroup.add(mesh);
      this.columnHitBoxes.push(mesh);
    }
  }

  /**
   * Constructs the physical 3D Connect 4 board, including the front/back plates with circular cutouts
   * and side support structures.
   */
  private buildBoard(): void {
    const colSpacing = 0.5;
    const rowSpacing = 0.5;
    const cols = 7;
    const rows = 6;

    // Define outer dimensions based on grid spacing
    const width = cols * colSpacing + 0.1;
    const height = rows * rowSpacing + 0.1;
    const hW = width / 2;
    const hH = height / 2;

    // A. Create the Shape with circular cutouts for front/back plates
    const plateShape = new THREE.Shape();
    plateShape.moveTo(-hW, -hH);
    plateShape.lineTo(hW, -hH);
    plateShape.lineTo(hW, hH);
    plateShape.lineTo(-hW, hH);
    plateShape.closePath();

    // Create holes for the discs in the plate
    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        const cx = (col - 3) * colSpacing;
        const cy = (row - 2.5) * rowSpacing;
        const holeRadius = 0.19; // Slightly larger than disc radius (0.16)

        const holePath = new THREE.Path();
        holePath.absarc(cx, cy, holeRadius, 0, Math.PI * 2, true);
        plateShape.holes.push(holePath);
      }
    }

    // B. Extrude Settings for 3D depth
    const extrudeSettings = {
      depth: 0.04,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.01,
      bevelSegments: 3,
      steps: 1
    };

    const plateGeometry = new THREE.ExtrudeGeometry(plateShape, extrudeSettings);
    plateGeometry.center();

    // C. Neon cyan translucent materials (Reduced opacity & brightness to lessen bloom glow)
    const plateMaterial = new THREE.MeshBasicMaterial({
      color: 0x00a0cc,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide
    });

    // Add wireframe outlines for that gorgeous cyber grid look
    const edgesGeo = new THREE.EdgesGeometry(plateGeometry);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x00c0f0,
      linewidth: 1.5,
      transparent: true,
      opacity: 0.35
    });

    // Create Front and Back plates
    const frontPlate = new THREE.Mesh(plateGeometry, plateMaterial);
    frontPlate.position.set(0, 0, 0.1);
    const frontOutline = new THREE.LineSegments(edgesGeo, lineMaterial);
    frontPlate.add(frontOutline);

    const backPlate = new THREE.Mesh(plateGeometry, plateMaterial);
    backPlate.position.set(0, 0, -0.1);
    const backOutline = new THREE.LineSegments(edgesGeo, lineMaterial);
    backPlate.add(backOutline);

    this.boardGroup.add(frontPlate);
    this.boardGroup.add(backPlate);

    // D. Build Support Structure/Legs
    const supportMaterial = new THREE.MeshBasicMaterial({
      color: 0x5000cc,
      transparent: true,
      opacity: 0.15
    });
    const supportLineMaterial = new THREE.LineBasicMaterial({
      color: 0x5000cc,
      linewidth: 1.5,
      transparent: true,
      opacity: 0.3
    });

    const legGeo = new THREE.BoxGeometry(0.15, height + 0.4, 0.3);
    const legEdgesGeo = new THREE.EdgesGeometry(legGeo);

    // Left Leg
    const leftLeg = new THREE.Mesh(legGeo, supportMaterial);
    leftLeg.position.set(-hW - 0.1, -0.1, 0);
    const leftLegOutline = new THREE.LineSegments(legEdgesGeo, supportLineMaterial);
    leftLeg.add(leftLegOutline);

    // Right Leg
    const rightLeg = new THREE.Mesh(legGeo, supportMaterial);
    rightLeg.position.set(hW + 0.1, -0.1, 0);
    const rightLegOutline = new THREE.LineSegments(legEdgesGeo, supportLineMaterial);
    rightLeg.add(rightLegOutline);

    // Bottom Base Bar
    const baseGeo = new THREE.BoxGeometry(width + 0.6, 0.1, 0.5);
    const baseEdgesGeo = new THREE.EdgesGeometry(baseGeo);
    const baseMesh = new THREE.Mesh(baseGeo, supportMaterial);
    baseMesh.position.set(0, -hH - 0.2, 0);
    const baseOutline = new THREE.LineSegments(baseEdgesGeo, supportLineMaterial);
    baseMesh.add(baseOutline);

    this.boardGroup.add(leftLeg);
    this.boardGroup.add(rightLeg);
    this.boardGroup.add(baseMesh);
  }

  /**
   * Constructs the 3D beveled cylinder discs and generates the deterministic pile positions on the floor.
   */
  private buildDiscs(): void {
    // A. Disc Geometry using Extrude of a circle to get beautiful beveled edges
    const discShape = new THREE.Shape();
    discShape.absarc(0, 0, 0.16, 0, Math.PI * 2, false);

    const discExtrudeSettings = {
      depth: 0.08,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 3,
      steps: 1
    };

    const discGeo = new THREE.ExtrudeGeometry(discShape, discExtrudeSettings);
    discGeo.center();

    const discOutlineGeo = new THREE.EdgesGeometry(discGeo);

    // B. Player Colors (Calmer Neon Red and Yellow to prevent bloom blowout and white look)
    const redMat = new THREE.MeshBasicMaterial({
      color: 0xdd2222,
      transparent: true,
      opacity: 0.6
    });
    const redOutlineMat = new THREE.LineBasicMaterial({
      color: 0xdd2222,
      linewidth: 1.0,
      transparent: true,
      opacity: 0.6
    });

    const yellowMat = new THREE.MeshBasicMaterial({
      color: 0xccaa00,
      transparent: true,
      opacity: 0.6
    });
    const yellowOutlineMat = new THREE.LineBasicMaterial({
      color: 0xccaa00,
      linewidth: 1.0,
      transparent: true,
      opacity: 0.6
    });

    // Create 42 discs (21 Red, 21 Yellow) with cloned materials to fix shared opacity bug
    for (let i = 0; i < 42; i++) {
      const isRed = i < 21;
      const clonedMat = isRed ? redMat.clone() : yellowMat.clone();
      const clonedOutlineMat = isRed ? redOutlineMat.clone() : yellowOutlineMat.clone();

      // Track original opacities of these unique cloned instances
      this.originalOpacityMap.set(clonedMat, 0.6);
      this.originalOpacityMap.set(clonedOutlineMat, 0.6);

      const disc = new THREE.Mesh(discGeo, clonedMat);
      const outline = new THREE.LineSegments(discOutlineGeo, clonedOutlineMat);
      disc.add(outline);

      // Disable raycasting on edge outlines
      outline.raycast = () => {};

      // Custom attributes to track disc properties
      (disc as any).color = isRed ? 'R' : 'Y';
      (disc as any).row = -1;
      (disc as any).col = -1;

      this.pileGroup.add(disc);
      this.discs.push(disc);

      // C. Precompute deterministic scattered pile coordinates
      const angle = (i / 42) * Math.PI * 2 + Math.sin(i * 12.345) * 0.5;
      const radius = 0.35 + Math.abs(Math.cos(i * 54.321)) * 0.75;
      const posX = Math.cos(angle) * radius;
      const posZ = Math.sin(angle) * radius;
      // Flat piling on floor with slight stack overlaps
      const posY = 0.04 + (i % 6) * 0.035 + Math.sin(i * 98.76) * 0.015;

      const rotX = Math.PI / 2 + Math.cos(i * 12.3) * 0.25;
      const rotY = Math.sin(i * 45.6) * Math.PI;
      const rotZ = Math.cos(i * 78.9) * 0.25;

      this.scatteredPositions.push(new THREE.Vector3(posX, posY, posZ));
      this.scatteredRotations.push(new THREE.Euler(rotX, rotY, rotZ));
    }
  }

  /**
   * Positions all discs into their scattered, deterministic pile on the floor.
   */
  public setToPile(): void {
    this.discs.forEach((disc, index) => {
      disc.position.copy(this.scatteredPositions[index]);
      disc.rotation.copy(this.scatteredRotations[index]);
      disc.scale.set(1, 1, 1);
      (disc as any).row = -1;
      (disc as any).col = -1;
      
      // Ensure the discs are inside the pileGroup
      if (disc.parent !== this.pileGroup) {
        this.pileGroup.attach(disc);
      }
    });

    // Reset board group position (lower/standing height)
    this.boardGroup.position.set(0, 0, 0);
    this.boardGroup.rotation.set(0, 0, 0);
  }

  /**
   * Pre-calculates particle starting positions from the pile and trajectories.
   */
  private setupParticles(): void {
    const particlePositions: number[] = [];
    const particleTargets: number[] = [];
    const particleColors: number[] = [];
    const particleRandomDirs: number[] = [];
    const particleSpeeds: number[] = [];

    const pointsPerDisc = 100;
    const colSpacing = 0.5;
    const rowSpacing = 0.5;

    this.discs.forEach((disc, i) => {
      const isRed = (disc as any).color === 'R';
      const color = isRed ? new THREE.Color(0xff3333) : new THREE.Color(0xffdd00);

      // Precompute parent-space transformation matrix for the disc in the pile
      const pileMatrix = new THREE.Matrix4().compose(
        this.scatteredPositions[i],
        new THREE.Quaternion().setFromEuler(this.scatteredRotations[i]),
        new THREE.Vector3(1, 1, 1)
      );

      // Precompute parent-space transformation matrix for the disc target position in the board
      const col = i % 7;
      const row = Math.floor(i / 7);
      const targetX = (col - 3) * colSpacing;
      const targetY = (row - 2.5) * rowSpacing;
      const targetZ = 0;

      const targetPos = new THREE.Vector3(targetX, targetY, targetZ);
      const targetRot = new THREE.Euler(0, 0, 0); // Aligned to face forward (standing vertically)
      const targetMatrix = new THREE.Matrix4().compose(
        targetPos,
        new THREE.Quaternion().setFromEuler(targetRot),
        new THREE.Vector3(1, 1, 1)
      );

      // Sample points inside the 3D disc volume
      for (let p = 0; p < pointsPerDisc; p++) {
        // Sample random point inside cylinder of radius 0.16 and depth 0.08
        const r = Math.random() * 0.16;
        const theta = Math.random() * Math.PI * 2;
        const h = (Math.random() - 0.5) * 0.08;

        const px = Math.cos(theta) * r;
        const py = Math.sin(theta) * r;
        const pz = h;

        // Transform to pile position (start)
        const startPos = new THREE.Vector3(px, py, pz).applyMatrix4(pileMatrix);

        // Transform to target board position (end)
        const endPos = new THREE.Vector3(px, py, pz).applyMatrix4(targetMatrix);

        // Spherical random explosion direction
        const randTheta = Math.random() * Math.PI * 2;
        const randPhi = Math.acos((Math.random() * 2) - 1);
        const rx = Math.sin(randPhi) * Math.cos(randTheta);
        const ry = Math.sin(randPhi) * Math.sin(randTheta);
        const rz = Math.cos(randPhi);

        particlePositions.push(startPos.x, startPos.y, startPos.z);
        particleTargets.push(endPos.x, endPos.y, endPos.z);
        particleColors.push(color.r, color.g, color.b);
        particleRandomDirs.push(rx, ry, rz);
        particleSpeeds.push(0.5 + Math.random() * 1.5);
      }
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(particlePositions, 3));
    geometry.setAttribute('aTarget', new THREE.Float32BufferAttribute(particleTargets, 3));
    geometry.setAttribute('aColor', new THREE.Float32BufferAttribute(particleColors, 3));
    geometry.setAttribute('aRandomDir', new THREE.Float32BufferAttribute(particleRandomDirs, 3));
    geometry.setAttribute('aSpeed', new THREE.Float32BufferAttribute(particleSpeeds, 1));

    this.particlesUniforms = {
      uProgress: { value: 0.0 },
      uTime: { value: 0.0 }
    };

    const particleMaterial = new THREE.ShaderMaterial({
      uniforms: this.particlesUniforms,
      vertexShader: `
        uniform float uProgress;
        uniform float uTime;
        attribute vec3 aTarget;
        attribute vec3 aColor;
        attribute vec3 aRandomDir;
        attribute float aSpeed;

        varying vec3 vColor;
        varying float vProgress;
        varying vec3 vPosition;

        void main() {
          vColor = aColor;
          vProgress = uProgress;

          float t = uProgress;
          vec3 currentPos = mix(position, aTarget, t);

          // Beautiful arc / explosion path
          float arc = sin(t * 3.14159265);
          currentPos.y += arc * 1.5; // fly upwards in arc
          currentPos += aRandomDir * arc * 0.4; // burst expansion

          // Cyber floating noise
          float wave = sin(uTime * 3.0 + aSpeed * 20.0) * 0.05 * arc;
          currentPos.x += wave;
          currentPos.z += cos(uTime * 2.5 + aSpeed * 15.0) * 0.05 * arc;

          vec4 mvPosition = modelViewMatrix * vec4(currentPos, 1.0);
          gl_Position = projectionMatrix * mvPosition;

          float sizeMultiplier = 1.0 + sin(uTime * 2.0 + aSpeed * 10.0) * 0.2;
          float sizePhase = 1.0 - abs(uProgress - 0.5) * 0.4;
          gl_PointSize = (12.0 / -mvPosition.z) * sizeMultiplier * sizePhase;

          vPosition = currentPos;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vProgress;
        varying vec3 vPosition;

        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;
          float intensity = 1.0 - (dist * 2.0);
          intensity = pow(intensity, 1.5);

          // Fade in at the start, fade out at the end
          float alpha = smoothstep(0.0, 0.15, vProgress) * smoothstep(1.0, 0.8, vProgress) * 0.95;

          gl_FragColor = vec4(vColor, intensity * alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.particles = new THREE.Points(geometry, particleMaterial);
    this.particles.visible = false;
    this.mesh.add(this.particles);
  }

  /**
   * Triggers the beautiful assembly animation of the board from the scattered pile.
   */
  public assembleFromPile(onCompleteCallback?: () => void): void {
    if (this.particlesUniforms) {
      this.particlesUniforms.uProgress.value = 0.0;
    }
    this.particles.visible = true;

    const timeline = gsap.timeline({
      onComplete: () => {
        this.pileGroup.visible = false;
        this.particles.visible = false;
        if (onCompleteCallback) {
          onCompleteCallback();
        }
      }
    });

    // 1. Animate the progress uniform from 0 to 1
    timeline.to(this.particlesUniforms.uProgress, {
      value: 1.0,
      duration: 2.0,
      ease: 'power2.inOut'
    }, 0);

    // 2. Smoothly fade out the original solid discs in the pile group
    this.pileGroup.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((mat) => {
          timeline.to(mat, {
            opacity: 0.0,
            duration: 0.8,
            ease: 'power2.out'
          }, 0);
        });
      }
      if (child instanceof THREE.LineSegments && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((mat) => {
          timeline.to(mat, {
            opacity: 0.0,
            duration: 0.8,
            ease: 'power2.out'
          }, 0);
        });
      }
    });
  }

  /**
   * Triggers the reverse dissolve animation from the active board back into the pile.
   */
  public dissolveToPile(onCompleteCallback?: () => void): void {
    if (this.particlesUniforms) {
      this.particlesUniforms.uProgress.value = 1.0;
    }
    this.particles.visible = true;
    this.pileGroup.visible = true;

    const timeline = gsap.timeline({
      onComplete: () => {
        this.particles.visible = false;
        if (onCompleteCallback) {
          onCompleteCallback();
        }
      }
    });

    // 1. Animate the progress uniform from 1 back to 0
    timeline.to(this.particlesUniforms.uProgress, {
      value: 0.0,
      duration: 2.0,
      ease: 'power2.inOut'
    }, 0);

    // 2. Smoothly fade the solid discs in the pile back to their original opacities
    this.pileGroup.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((mat) => {
          const origOpacity = this.originalOpacityMap.get(mat) ?? 0.7;
          timeline.to(mat, {
            opacity: origOpacity,
            duration: 1.2,
            ease: 'power2.in',
            delay: 0.8
          }, 0);
        });
      }
      if (child instanceof THREE.LineSegments && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((mat) => {
          const origOpacity = this.originalOpacityMap.get(mat) ?? 0.9;
          timeline.to(mat, {
            opacity: origOpacity,
            duration: 1.2,
            ease: 'power2.in',
            delay: 0.8
          }, 0);
        });
      }
    });
  }

  /**
   * Resets the game grid to empty and moves all physical discs back to their pile positions.
   */
  public resetGrid(): void {
    this.grid = [];
    for (let r = 0; r < this.ROWS; r++) {
      const row: (string | null)[] = [];
      for (let c = 0; c < this.COLS; c++) {
        row.push(null);
      }
      this.grid.push(row);
    }

    // Ensure all discs are visible and have correct opacity restored
    this.discs.forEach((disc) => {
      disc.visible = true;
      disc.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((mat) => {
            mat.opacity = this.originalOpacityMap.get(mat) ?? 0.7;
          });
        }
        if (child instanceof THREE.LineSegments && child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((mat) => {
            mat.opacity = this.originalOpacityMap.get(mat) ?? 0.9;
          });
        }
      });
    });

    this.pileGroup.visible = true;
    this.setToPile();
  }

  /**
   * Helper to find the lowest empty row in a column. Returns -1 if column is full.
   */
  public getLowestEmptyRow(col: number, customGrid?: (string | null)[][]): number {
    const targetGrid = customGrid || this.grid;
    for (let r = 0; r < this.ROWS; r++) {
      if (targetGrid[r][col] === null) {
        return r;
      }
    }
    return -1;
  }

  /**
   * Check for a victory on the board.
   * Returns information about the winner and winning cells, or null.
   */
  public checkVictory(gridState?: (string | null)[][]): { winner: string, cells: [number, number][] } | null {
    const targetGrid = gridState || this.grid;

    // 1. Horizontal
    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c <= this.COLS - 4; c++) {
        const val = targetGrid[r][c];
        if (val &&
            val === targetGrid[r][c + 1] &&
            val === targetGrid[r][c + 2] &&
            val === targetGrid[r][c + 3]) {
          return {
            winner: val,
            cells: [[r, c], [r, c + 1], [r, c + 2], [r, c + 3]]
          };
        }
      }
    }

    // 2. Vertical
    for (let c = 0; c < this.COLS; c++) {
      for (let r = 0; r <= this.ROWS - 4; r++) {
        const val = targetGrid[r][c];
        if (val &&
            val === targetGrid[r + 1][c] &&
            val === targetGrid[r + 2][c] &&
            val === targetGrid[r + 3][c]) {
          return {
            winner: val,
            cells: [[r, c], [r + 1, c], [r + 2, c], [r + 3, c]]
          };
        }
      }
    }

    // 3. Diagonal Up-Right
    for (let r = 0; r <= this.ROWS - 4; r++) {
      for (let c = 0; c <= this.COLS - 4; c++) {
        const val = targetGrid[r][c];
        if (val &&
            val === targetGrid[r + 1][c + 1] &&
            val === targetGrid[r + 2][c + 2] &&
            val === targetGrid[r + 3][c + 3]) {
          return {
            winner: val,
            cells: [[r, c], [r + 1, c + 1], [r + 2, c + 2], [r + 3, c + 3]]
          };
        }
      }
    }

    // 4. Diagonal Down-Right
    for (let r = 3; r < this.ROWS; r++) {
      for (let c = 0; c <= this.COLS - 4; c++) {
        const val = targetGrid[r][c];
        if (val &&
            val === targetGrid[r - 1][c + 1] &&
            val === targetGrid[r - 2][c + 2] &&
            val === targetGrid[r - 3][c + 3]) {
          return {
            winner: val,
            cells: [[r, c], [r - 1, c + 1], [r - 2, c + 2], [r - 3, c + 3]]
          };
        }
      }
    }

    return null;
  }

  /**
   * Checks if the grid is full (i.e. no moves left).
   */
  public isGridFull(gridState?: (string | null)[][]): boolean {
    const targetGrid = gridState || this.grid;
    for (let c = 0; c < this.COLS; c++) {
      if (targetGrid[this.ROWS - 1][c] === null) {
        return false;
      }
    }
    return true;
  }

  /**
   * Drops a disc of a specific color ('R' or 'Y') into the specified column (0-6).
   * Animates the disc falling down the column and landing in the correct row.
   */
  public dropDisc(col: number, color: 'R' | 'Y', onComplete?: () => void): THREE.Mesh | null {
    const row = this.getLowestEmptyRow(col);
    if (row === -1) return null;

    // 1. Update internal board logic matrix
    this.grid[row][col] = color;

    // 2. Find an unused disc of the specified color from our pool
    const disc = this.discs.find(d => (d as any).color === color && (d as any).row === -1);
    if (!disc) {
      console.warn(`No unused discs left of color ${color}!`);
      return null;
    }

    // Set properties
    (disc as any).row = row;
    (disc as any).col = col;

    // 3. Attach disc to boardGroup to position it relative to the board
    this.boardGroup.attach(disc);

    // 4. Calculate starting and ending positions
    const colSpacing = 0.5;
    const rowSpacing = 0.5;

    const targetX = (col - 3) * colSpacing;
    const targetY = (row - 2.5) * rowSpacing;

    // Start position: At the top of the board, slightly above the top row
    const startX = targetX;
    const startY = 2.0; // Above top row (row 5's Y is 1.25)
    const startZ = 0;

    disc.position.set(startX, startY, startZ);
    disc.rotation.set(0, 0, 0); // Aligned to face forward (standing vertically)
    disc.scale.set(1, 1, 1);

    // Make sure the disc itself is visible and opacities are restored
    disc.visible = true;
    disc.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((mat) => {
          mat.opacity = this.originalOpacityMap.get(mat) ?? 0.7;
        });
      }
      if (child instanceof THREE.LineSegments && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((mat) => {
          mat.opacity = this.originalOpacityMap.get(mat) ?? 0.9;
        });
      }
    });

    // 5. Animate the descent using a gravity-like ease (power2.in) and a tiny bounce
    // Duration is proportional to the fall distance
    const fallDistance = startY - targetY;
    const duration = 0.45 + (fallDistance / 3.25) * 0.15; // smooth gravity-based timing

    gsap.to(disc.position, {
      y: targetY,
      duration: duration,
      ease: 'power2.in',
      onComplete: () => {
        // Play a tiny landing bounce effect
        gsap.to(disc.position, {
          y: targetY + 0.08,
          duration: 0.08,
          yoyo: true,
          repeat: 1,
          ease: 'power1.out',
          onComplete: () => {
            // Ensure exact alignment
            disc.position.y = targetY;
            if (onComplete) {
              onComplete();
            }
          }
        });
      }
    });

    return disc;
  }

  /**
   * Uses Minimax with Alpha-Beta pruning to find the best move.
   */
  public getBestMove(depth: number = 6): number {
    const validMoves = this.getValidMoves();
    if (validMoves.length === 0) return -1;

    // Start evaluation with center-outwards priority: [3, 2, 4, 1, 5, 0, 6]
    const order = [3, 2, 4, 1, 5, 0, 6];
    validMoves.sort((a, b) => order.indexOf(a) - order.indexOf(b));

    let bestScore = -Infinity;
    let bestMove = validMoves[0];

    // Create a clone of the current grid state for evaluation
    const gridCopy = this.cloneGrid(this.grid);

    for (const col of validMoves) {
      const row = this.getLowestEmptyRow(col, gridCopy);
      gridCopy[row][col] = 'Y'; // CPU is 'Y'
      
      const score = this.minimax(gridCopy, depth - 1, -Infinity, Infinity, false);
      
      gridCopy[row][col] = null; // undo

      if (score > bestScore) {
        bestScore = score;
        bestMove = col;
      }
    }

    return bestMove;
  }

  private getValidMoves(gridState?: (string | null)[][]): number[] {
    const targetGrid = gridState || this.grid;
    const moves: number[] = [];
    for (let c = 0; c < this.COLS; c++) {
      if (targetGrid[this.ROWS - 1][c] === null) {
        moves.push(c);
      }
    }
    return moves;
  }

  private cloneGrid(gridState: (string | null)[][]): (string | null)[][] {
    return gridState.map(row => [...row]);
  }

  private evaluateWindow(window: (string | null)[]): number {
    let cpuCount = 0;
    let playerCount = 0;
    let emptyCount = 0;

    for (let i = 0; i < 4; i++) {
      if (window[i] === 'Y') cpuCount++;
      else if (window[i] === 'R') playerCount++;
      else emptyCount++;
    }

    // Heuristic Evaluation Rules:
    // 4-in-a-row (Win): +1,000,000 (CPU), -1,000,000 (Player)
    if (cpuCount === 4) return 1000000;
    if (playerCount === 4) return -1000000;

    // 3-in-a-row (Open ends / with empty): +1,000 (CPU), -5,000 (Player)
    if (cpuCount === 3 && emptyCount === 1) return 1000;
    if (playerCount === 3 && emptyCount === 1) return -5000;

    // 2-in-a-row: +50 (CPU), -100 (Player)
    if (cpuCount === 2 && emptyCount === 2) return 50;
    if (playerCount === 2 && emptyCount === 2) return -100;

    return 0;
  }

  private evaluateBoard(gridState: (string | null)[][]): number {
    let score = 0;

    // 1. Center column control bonus (+15 per disc)
    for (let r = 0; r < this.ROWS; r++) {
      if (gridState[r][3] === 'Y') {
        score += 15;
      } else if (gridState[r][3] === 'R') {
        score -= 15;
      }
    }

    // 2. Score Horizontal windows
    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c <= this.COLS - 4; c++) {
        const window = [gridState[r][c], gridState[r][c + 1], gridState[r][c + 2], gridState[r][c + 3]];
        score += this.evaluateWindow(window);
      }
    }

    // 3. Score Vertical windows
    for (let c = 0; c < this.COLS; c++) {
      for (let r = 0; r <= this.ROWS - 4; r++) {
        const window = [gridState[r][c], gridState[r + 1][c], gridState[r + 2][c], gridState[r + 3][c]];
        score += this.evaluateWindow(window);
      }
    }

    // 4. Score Diagonal Up-Right
    for (let r = 0; r <= this.ROWS - 4; r++) {
      for (let c = 0; c <= this.COLS - 4; c++) {
        const window = [gridState[r][c], gridState[r + 1][c + 1], gridState[r + 2][c + 2], gridState[r + 3][c + 3]];
        score += this.evaluateWindow(window);
      }
    }

    // 5. Score Diagonal Down-Right
    for (let r = 3; r < this.ROWS; r++) {
      for (let c = 0; c <= this.COLS - 4; c++) {
        const window = [gridState[r][c], gridState[r - 1][c + 1], gridState[r - 2][c + 2], gridState[r - 3][c + 3]];
        score += this.evaluateWindow(window);
      }
    }

    return score;
  }

  private minimax(
    gridState: (string | null)[][],
    depth: number,
    alpha: number,
    beta: number,
    isMaximizing: boolean
  ): number {
    // 1. Check terminal states
    const victory = this.checkVictory(gridState);
    if (victory) {
      if (victory.winner === 'Y') return 10000000 + depth; // favor faster wins
      if (victory.winner === 'R') return -10000000 - depth; // favor delaying opponent wins
    }
    if (this.isGridFull(gridState)) {
      return 0; // Draw
    }
    if (depth === 0) {
      return this.evaluateBoard(gridState);
    }

    const validMoves = this.getValidMoves(gridState);
    // Order moves for optimal pruning
    const order = [3, 2, 4, 1, 5, 0, 6];
    validMoves.sort((a, b) => order.indexOf(a) - order.indexOf(b));

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const col of validMoves) {
        const row = this.getLowestEmptyRow(col, gridState);
        gridState[row][col] = 'Y';
        const evaluation = this.minimax(gridState, depth - 1, alpha, beta, false);
        gridState[row][col] = null; // undo
        
        maxEval = Math.max(maxEval, evaluation);
        alpha = Math.max(alpha, evaluation);
        if (beta <= alpha) {
          break; // beta prune
        }
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const col of validMoves) {
        const row = this.getLowestEmptyRow(col, gridState);
        gridState[row][col] = 'R';
        const evaluation = this.minimax(gridState, depth - 1, alpha, beta, true);
        gridState[row][col] = null; // undo

        minEval = Math.min(minEval, evaluation);
        beta = Math.min(beta, evaluation);
        if (beta <= alpha) {
          break; // alpha prune
        }
      }
      return minEval;
    }
  }

  public update(time: number): void {
    // Subtle float / hover rotation breathing for the pile group when visible
    if (this.pileGroup && this.pileGroup.visible) {
      this.pileGroup.position.y = Math.sin(time * 1.5) * 0.03;
      this.pileGroup.rotation.y = time * 0.12;
    }

    if (this.particlesUniforms) {
      this.particlesUniforms.uTime.value = time;
    }
  }

  public dispose(): void {
    super.dispose();
    this.discs = [];
    this.scatteredPositions = [];
    this.scatteredRotations = [];

    this.columnHitBoxes.forEach((mesh) => {
      this.boardGroup.remove(mesh);
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else {
        mesh.material.dispose();
      }
    });
    this.columnHitBoxes = [];

    if (this.particles) {
      this.mesh.remove(this.particles);
      this.particles.geometry.dispose();
      if (Array.isArray(this.particles.material)) {
        this.particles.material.forEach((m) => m.dispose());
      } else {
        this.particles.material.dispose();
      }
    }
  }
}
