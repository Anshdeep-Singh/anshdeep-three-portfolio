import * as THREE from 'three';
import { gsap } from 'gsap';
import { BaseActor } from '../base/BaseActor';

export interface RubiksMove {
  axis: 'x' | 'y' | 'z';
  layer: -1 | 0 | 1;
  dir: 1 | -1;
}

export class RubiksCubeActor extends BaseActor {
  private cubies: THREE.Mesh[] = [];
  public moveHistory: RubiksMove[] = [];
  public isAnimating = false;
  public isInteractionBlocked = false;
  public onSolvedCallback: (() => void) | null = null;

  // Cybernetic Core & Pile States
  private coreGroup: THREE.Group | null = null;
  private scatteredPositions: THREE.Vector3[] = [];
  private scatteredRotations: THREE.Euler[] = [];
  private coreScatteredPos = new THREE.Vector3(0, 0.4, 0);
  private coreScatteredRot = new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, 0);

  // Interaction State
  private camera: THREE.Camera | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private raycaster = new THREE.Raycaster();
  
  private isCtrlDragging = false;
  private isLayerDragging = false;
  private dragStartCoords = { x: 0, y: 0 };
  
  private clickedCubie: THREE.Mesh | null = null;
  private clickedWorldNormal = new THREE.Vector3();
  private clickedIntersectionPoint = new THREE.Vector3();

  public isCubeRotationMode = false;
  private swipeArrowHelpers: THREE.ArrowHelper[] = [];

  constructor() {
    super('rubiks-cube');
  }

  public setup(): void {
    // Scale the entire actor by 40% (20% reduction from 50%)
    this.mesh.scale.set(0.4, 0.4, 0.4);

    const spacing = 1.06; // Spacing factor to leave a tiny gap
    const cubieSize = 0.98; // Reduce slightly to make black lines thicker
    const geometry = new THREE.BoxGeometry(cubieSize, cubieSize, cubieSize);

    // Standard Rubik's Cube Colors (Balanced to prevent White/Yellow glare and make others vibrant)
    const COLORS = {
      R: 0xcc2222, // Right (+X) - Red
      L: 0xcc5500, // Left (-X) - Orange (Reduced slightly)
      U: 0x888888, // Up (+Y) - White (Reduced slightly)
      D: 0x998800, // Down (-Y) - Yellow (Reduced slightly)
      F: 0x0a7c14, // Front (+Z) - Green (Reduced slightly to prevent bloom blowout)
      B: 0x2266dd, // Back (-Z) - Blue
      internal: 0x111115 // Internal/Shared Faces - Dark Grey
    };

    // Create 27 cubies
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          // Define standard colors for the stickers or internal faces
          const materials = [
            // Right (+X)
            new THREE.MeshBasicMaterial({ color: x === 1 ? COLORS.R : COLORS.internal }),
            // Left (-X)
            new THREE.MeshBasicMaterial({ color: x === -1 ? COLORS.L : COLORS.internal }),
            // Up (+Y)
            new THREE.MeshBasicMaterial({ color: y === 1 ? COLORS.U : COLORS.internal }),
            // Down (-Y)
            new THREE.MeshBasicMaterial({ color: y === -1 ? COLORS.D : COLORS.internal }),
            // Front (+Z)
            new THREE.MeshBasicMaterial({ color: z === 1 ? COLORS.F : COLORS.internal }),
            // Back (-Z)
            new THREE.MeshBasicMaterial({ color: z === -1 ? COLORS.B : COLORS.internal })
          ];

          const cubie = new THREE.Mesh(geometry, materials);
          cubie.position.set(x * spacing, y * spacing, z * spacing);
          
          // Add custom property to easily find local grid positions later
          (cubie as any).gridPos = { x, y, z };

          // Add crisp black edges to define the cubie outline and prevent bloom overflow
          const edgesGeo = new THREE.EdgesGeometry(geometry);
          const edgesMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
          const edges = new THREE.LineSegments(edgesGeo, edgesMat);
          edges.raycast = () => {}; // Disable raycasting on edge lines so they don't block cubie face raycasting
          cubie.add(edges);

          this.mesh.add(cubie);
          this.cubies.push(cubie);
        }
      }
    }

    // Cybernetic Core - glowing sphere with 6 cylinder stems
    this.coreGroup = new THREE.Group();
    
    // Glowing sphere (Dialed down brightness and opacity)
    const sphereGeo = new THREE.SphereGeometry(0.35, 32, 32);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0x00a8b5,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending
    });
    const coreSphere = new THREE.Mesh(sphereGeo, sphereMat);
    this.coreGroup.add(coreSphere);

    // 6 stems (Dialed down opacity)
    const stemGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.3, 16);
    const stemMat = new THREE.MeshBasicMaterial({
      color: 0x00a8b5,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending
    });

    // Stem 1 (X axis)
    const stemX = new THREE.Mesh(stemGeo, stemMat);
    stemX.rotation.z = Math.PI / 2;
    this.coreGroup.add(stemX);

    // Stem 2 (Y axis)
    const stemY = new THREE.Mesh(stemGeo, stemMat);
    this.coreGroup.add(stemY);

    // Stem 3 (Z axis)
    const stemZ = new THREE.Mesh(stemGeo, stemMat);
    stemZ.rotation.x = Math.PI / 2;
    this.coreGroup.add(stemZ);

    this.mesh.add(this.coreGroup);

    // Compute deterministic scattered positions for each cubie
    this.cubies.forEach((_cubie, index) => {
      const angle = (index / 27) * Math.PI * 2 + (index % 3) * 0.2;
      const radius = 2.0 + (index % 4) * 0.5; // scattered radius
      const posX = Math.cos(angle) * radius;
      const posZ = Math.sin(angle) * radius;
      const posY = 0.5 + (index % 3) * 0.15; // slight stacking
      
      this.scatteredPositions.push(new THREE.Vector3(posX, posY, posZ));
      this.scatteredRotations.push(new THREE.Euler(
        (index * 0.1) % Math.PI,
        (index * 0.2) % Math.PI,
        (index * 0.3) % Math.PI
      ));
    });
  }

  public setToPile(): void {
    this.cubies.forEach((cubie, index) => {
      cubie.position.copy(this.scatteredPositions[index]);
      cubie.rotation.copy(this.scatteredRotations[index]);
      cubie.scale.set(1, 1, 1);
    });

    if (this.coreGroup) {
      this.coreGroup.position.copy(this.coreScatteredPos);
      this.coreGroup.rotation.copy(this.coreScatteredRot);
      this.coreGroup.scale.set(1, 1, 1);
    }
  }

  public assembleFromPile(): Promise<void> {
    if (this.isAnimating) return Promise.resolve();
    this.isAnimating = true;

    const spacing = 1.06;
    const promises: Promise<void>[] = [];

    if (this.coreGroup) {
      promises.push(new Promise<void>((resolve) => {
        gsap.to(this.coreGroup!.position, {
          x: 0,
          y: 0,
          z: 0,
          duration: 1.5,
          ease: 'power3.out'
        });
        gsap.to(this.coreGroup!.rotation, {
          x: 0,
          y: 0,
          z: 0,
          duration: 1.5,
          ease: 'power3.out'
        });
        gsap.to(this.coreGroup!.scale, {
          x: 1,
          y: 1,
          z: 1,
          duration: 1.5,
          ease: 'power3.out',
          onComplete: resolve
        });
      }));
    }

    this.cubies.forEach((cubie, index) => {
      const grid = (cubie as any).gridPos;
      const targetPos = new THREE.Vector3(grid.x * spacing, grid.y * spacing, grid.z * spacing);
      const delay = (index / 27) * 0.4;

      promises.push(new Promise<void>((resolve) => {
        gsap.to(cubie.position, {
          x: targetPos.x,
          y: targetPos.y,
          z: targetPos.z,
          duration: 1.2,
          delay: delay,
          ease: 'back.out(1.2)'
        });

        gsap.to(cubie.rotation, {
          x: 0,
          y: 0,
          z: 0,
          duration: 1.2,
          delay: delay,
          ease: 'power2.out'
        });

        cubie.scale.set(0.1, 0.1, 0.1);
        gsap.to(cubie.scale, {
          x: 1,
          y: 1,
          z: 1,
          duration: 1.0,
          delay: delay,
          ease: 'elastic.out(1, 0.75)',
          onComplete: resolve
        });
      }));
    });

    return Promise.all(promises).then(() => {
      this.isAnimating = false;
    });
  }

  public dissolveToPile(): Promise<void> {
    if (this.isAnimating) return Promise.resolve();
    this.isAnimating = true;

    const promises: Promise<void>[] = [];

    if (this.coreGroup) {
      promises.push(new Promise<void>((resolve) => {
        gsap.to(this.coreGroup!.position, {
          x: this.coreScatteredPos.x,
          y: this.coreScatteredPos.y,
          z: this.coreScatteredPos.z,
          duration: 1.2,
          ease: 'power2.inOut'
        });
        gsap.to(this.coreGroup!.rotation, {
          x: this.coreScatteredRot.x,
          y: this.coreScatteredRot.y,
          z: this.coreScatteredRot.z,
          duration: 1.2,
          ease: 'power2.inOut',
          onComplete: resolve
        });
      }));
    }

    this.cubies.forEach((cubie, index) => {
      const targetPos = this.scatteredPositions[index];
      const targetRot = this.scatteredRotations[index];
      const delay = ((27 - index) / 27) * 0.3;

      promises.push(new Promise<void>((resolve) => {
        gsap.to(cubie.position, {
          x: targetPos.x,
          y: targetPos.y,
          z: targetPos.z,
          duration: 1.0,
          delay: delay,
          ease: 'power2.in'
        });

        gsap.to(cubie.rotation, {
          x: targetRot.x,
          y: targetRot.y,
          z: targetRot.z,
          duration: 1.0,
          delay: delay,
          ease: 'power2.in'
        });

        gsap.to(cubie.scale, {
          x: 0.1,
          y: 0.1,
          z: 0.1,
          duration: 0.8,
          delay: delay,
          ease: 'power2.in',
          onComplete: () => {
            cubie.scale.set(1, 1, 1);
            resolve();
          }
        });
      }));
    });

    return Promise.all(promises).then(() => {
      this.isAnimating = false;
    });
  }

  /**
   * Activates mouse/pointer interactions for Rubik's Cube.
   */
  public activate(camera: THREE.Camera, canvas: HTMLCanvasElement): void {
    this.camera = camera;
    this.canvas = canvas;
    this.isInteractionBlocked = false;

    // Register event listeners
    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
  }

  /**
   * Deactivates mouse/pointer interactions.
   */
  public deactivate(): void {
    if (this.canvas) {
      this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    }
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);

    this.camera = null;
    this.canvas = null;
    this.isCtrlDragging = false;
    this.isLayerDragging = false;
    this.clearSwipeIndicators();
  }

  private createSwipeIndicators(localNormal: THREE.Vector3, localPoint: THREE.Vector3): void {
    this.clearSwipeIndicators();

    let dir1 = new THREE.Vector3();
    let dir2 = new THREE.Vector3();
    if (Math.abs(localNormal.x) > 0.9) {
      dir1.set(0, 1, 0);
      dir2.set(0, 0, 1);
    } else if (Math.abs(localNormal.y) > 0.9) {
      dir1.set(1, 0, 0);
      dir2.set(0, 0, 1);
    } else {
      dir1.set(1, 0, 0);
      dir2.set(0, 1, 0);
    }

    const directions = [dir1, dir1.clone().negate(), dir2, dir2.clone().negate()];
    const colors = [0x00f0ff, 0x00f0ff, 0xff007f, 0xff007f]; // Cyan for one axis, Pink for other

    directions.forEach((dir, i) => {
      const arrowOrigin = localPoint.clone().addScaledVector(localNormal, 0.15);
      const arrow = new THREE.ArrowHelper(
        dir,
        arrowOrigin,
        0.5,
        colors[i],
        0.18,
        0.14
      );
      // Disable raycasting on arrows so they don't interfere
      arrow.traverse((child) => {
        child.raycast = () => {};
      });
      this.mesh.add(arrow);
      this.swipeArrowHelpers.push(arrow);
    });
  }

  private clearSwipeIndicators(): void {
    this.swipeArrowHelpers.forEach((arrow) => {
      this.mesh.remove(arrow);
      arrow.dispose();
    });
    this.swipeArrowHelpers = [];
  }

  public rotateProgrammatic(face: string, layer: number, angle: number): Promise<void> {
    let axis: 'x' | 'y' | 'z' = 'y';
    if (face === 'U' || face === 'D') {
      axis = 'y';
    } else if (face === 'L' || face === 'R') {
      axis = 'x';
    } else if (face === 'F' || face === 'B') {
      axis = 'z';
    }
    
    const layerIndex = layer as -1 | 0 | 1;
    const dir = angle as 1 | -1;
    return this.rotateLayer(axis, layerIndex, dir);
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (!this.camera || !this.canvas || this.isInteractionBlocked) return;

    // Record starting position
    this.dragStartCoords = { x: event.clientX, y: event.clientY };

    // Check Ctrl + Drag or isCubeRotationMode (Cube Rotation)
    if (event.ctrlKey || this.isCubeRotationMode) {
      this.isCtrlDragging = true;
      event.preventDefault();
      return;
    }

    // Normal drag (Layer Rotation) - Perform raycasting
    const rect = this.canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);
    const intersects = this.raycaster.intersectObjects(this.cubies, true);

    if (intersects.length > 0) {
      const hit = intersects[0];
      this.isLayerDragging = true;
      
      // Defensively resolve clicked cubie to parent if the child line segments/edges were intersected
      let clickedObj = hit.object;
      if (clickedObj.parent && this.cubies.includes(clickedObj.parent as THREE.Mesh)) {
        clickedObj = clickedObj.parent;
      }
      
      this.clickedCubie = clickedObj as THREE.Mesh;
      if (hit.face) {
        const localNormal = hit.face.normal.clone();
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
        this.clickedWorldNormal.copy(localNormal).applyMatrix3(normalMatrix).normalize();
      } else if (hit.normal) {
        this.clickedWorldNormal.copy(hit.normal);
      }
      this.clickedIntersectionPoint.copy(hit.point);

      // Create visual swipe arrows/indicators when we start dragging a layer!
      const localNormal = this.clickedWorldNormal.clone().applyQuaternion(this.mesh.quaternion.clone().invert()).normalize();
      const localPoint = this.clickedIntersectionPoint.clone().applyMatrix4(this.mesh.matrixWorld.clone().invert());
      this.createSwipeIndicators(localNormal, localPoint);
    }
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.camera || !this.canvas || this.isInteractionBlocked) return;

    const deltaX = event.clientX - this.dragStartCoords.x;
    const deltaY = event.clientY - this.dragStartCoords.y;

    if (this.isCtrlDragging) {
      // Rotate the entire cube
      const sensitivity = 0.005;
      this.mesh.rotation.y += deltaX * sensitivity;
      this.mesh.rotation.x += deltaY * sensitivity;

      this.dragStartCoords = { x: event.clientX, y: event.clientY };
      return;
    }

    if (this.isLayerDragging && !this.isAnimating && this.clickedCubie) {
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const dragThreshold = 15; // pixels

      if (distance > dragThreshold) {
        // Compute camera direction basis vectors in world space
        const cameraRight = new THREE.Vector3();
        const cameraUp = new THREE.Vector3();
        this.camera.matrixWorld.extractBasis(cameraRight, cameraUp, new THREE.Vector3());

        // Construct world drag direction vector
        const worldDragDir = new THREE.Vector3()
          .addScaledVector(cameraRight, deltaX)
          .addScaledVector(cameraUp, -deltaY) // Invert Y for 3D coordinates
          .normalize();

        // Convert world directions to Cube local space
        const localDragDir = worldDragDir.clone().applyQuaternion(this.mesh.quaternion.clone().invert()).normalize();
        const localNormal = this.clickedWorldNormal.clone().applyQuaternion(this.mesh.quaternion.clone().invert()).normalize();

        // Snap local normal to primary axis to get exact clicked face normal N
        const N = new THREE.Vector3();
        const absX = Math.abs(localNormal.x);
        const absY = Math.abs(localNormal.y);
        const absZ = Math.abs(localNormal.z);

        if (absX > absY && absX > absZ) {
          N.set(Math.sign(localNormal.x), 0, 0);
        } else if (absY > absX && absY > absZ) {
          N.set(0, Math.sign(localNormal.y), 0);
        } else {
          N.set(0, 0, Math.sign(localNormal.z));
        }

        // Project local drag direction to standard in-plane coordinate axis D
        const D = new THREE.Vector3();
        if (N.x !== 0) {
          if (Math.abs(localDragDir.y) > Math.abs(localDragDir.z)) {
            D.set(0, Math.sign(localDragDir.y), 0);
          } else {
            D.set(0, 0, Math.sign(localDragDir.z));
          }
        } else if (N.y !== 0) {
          if (Math.abs(localDragDir.x) > Math.abs(localDragDir.z)) {
            D.set(Math.sign(localDragDir.x), 0, 0);
          } else {
            D.set(0, 0, Math.sign(localDragDir.z));
          }
        } else {
          if (Math.abs(localDragDir.x) > Math.abs(localDragDir.y)) {
            D.set(Math.sign(localDragDir.x), 0, 0);
          } else {
            D.set(0, Math.sign(localDragDir.y), 0);
          }
        }

        // Determine axis of rotation and direction using cross product (A = N x D)
        const A = new THREE.Vector3().crossVectors(N, D);

        let axis: 'x' | 'y' | 'z' = 'x';
        let angleDir: 1 | -1 = 1;

        // Match standard swipe behavior (swiping left rotates left, swiping up rotates up, etc.)
        if (A.x !== 0) {
          axis = 'x';
          angleDir = Math.sign(A.x) as 1 | -1;
        } else if (A.y !== 0) {
          axis = 'y';
          angleDir = Math.sign(A.y) as 1 | -1;
        } else if (A.z !== 0) {
          axis = 'z';
          angleDir = Math.sign(A.z) as 1 | -1;
        }

        const spacing = 1.06;
        const layerIndex = Math.round(this.clickedCubie.position[axis] / spacing) as -1 | 0 | 1;

        // Perform rotation and reset drag state
        this.rotateLayer(axis, layerIndex, angleDir);
        this.isLayerDragging = false;
        this.clickedCubie = null;
        this.clearSwipeIndicators();
      }
    }
  };

  private onPointerUp = (): void => {
    this.isCtrlDragging = false;
    this.isLayerDragging = false;
    this.clickedCubie = null;
    this.clearSwipeIndicators();
  };

  /**
   * Rotates a specific slice of the Rubik's Cube.
   * Selection Logic: Find all 9 cubies where Math.round(cubie.position[axis]) === layerIndex (relative to local space).
   * Pivot Rotation Technique with GSAP.
   */
  /**
   * Shuffles the Rubik's Cube with a sequence of random moves.
   */
  public async shuffle(movesCount: number = 15): Promise<void> {
    if (this.isAnimating || this.isInteractionBlocked) return;
    this.isInteractionBlocked = true;

    // Clear history before shuffling so that we start fresh or keep previous?
    // Rubiks cube starts in solved state, shuffling adds moves.
    this.moveHistory = [];

    let prevAxis: string | null = null;
    let prevLayer: number | null = null;

    for (let i = 0; i < movesCount; i++) {
      let axis: 'x' | 'y' | 'z';
      let layerIndex: -1 | 0 | 1;
      let dir: 1 | -1;

      // Avoid immediate direct reversals
      let attempts = 0;
      do {
        axis = (['x', 'y', 'z'] as const)[Math.floor(Math.random() * 3)];
        layerIndex = ([-1, 0, 1] as const)[Math.floor(Math.random() * 3)];
        dir = (Math.random() < 0.5) ? 1 : -1;
        attempts++;
      } while (
        attempts < 10 &&
        axis === prevAxis &&
        layerIndex === prevLayer
      );

      prevAxis = axis;
      prevLayer = layerIndex;

      // Animate moves quickly (0.15s per move) for a satisfying visual shuffle
      await this.rotateLayer(axis, layerIndex, dir, 0.15, true);
    }

    this.isInteractionBlocked = false;
  }

  /**
   * Solves the Rubik's Cube by popping moves from the history stack and performing their exact inverse.
   */
  public async autoSolve(): Promise<void> {
    if (this.isAnimating || this.isInteractionBlocked) return;
    this.isInteractionBlocked = true;

    while (this.moveHistory.length > 0) {
      const move = this.moveHistory.pop();
      if (move) {
        // Execute inverse move with duration 0.25s, trackHistory = false
        await this.rotateLayer(move.axis, move.layer, -move.dir as 1 | -1, 0.25, false);
      }
    }

    this.isInteractionBlocked = false;
  }

  public rotateLayer(
    axis: 'x' | 'y' | 'z',
    layerIndex: -1 | 0 | 1,
    angleDirection: 1 | -1,
    duration: number = 0.3,
    trackHistory: boolean = true
  ): Promise<void> {
    if (this.isAnimating) {
      return Promise.resolve();
    }
    this.isAnimating = true;

    return new Promise<void>((resolve) => {
      const spacing = 1.06;

      // Find all 9 cubies on the specified slice
      const selectedCubies = this.cubies.filter((cubie) => {
        const val = cubie.position[axis];
        return Math.round(val / spacing) === layerIndex;
      });

      if (selectedCubies.length === 0) {
        this.isAnimating = false;
        resolve();
        return;
      }

      // Create a temporary pivot group at the origin and add to main mesh
      const pivot = new THREE.Group();
      this.mesh.add(pivot);

      // Move the 9 selected cubies into the pivot group
      selectedCubies.forEach((cubie) => {
        pivot.attach(cubie);
      });

      // Target rotation angle around the axis
      const targetAngle = (Math.PI / 2) * angleDirection;

      // Animate the rotation of the pivot group using GSAP
      const animObj = { rotation: 0 };
      gsap.to(animObj, {
        rotation: targetAngle,
        duration: duration,
        ease: 'power2.inOut',
        onUpdate: () => {
          pivot.rotation[axis] = animObj.rotation;
        },
        onComplete: () => {
          // Re-parent the 9 cubies back to the main group
          selectedCubies.forEach((cubie) => {
            this.mesh.attach(cubie);

            // Snap the positions and rotations to the exact grid to prevent drift
            cubie.position.x = Math.round(cubie.position.x / spacing) * spacing;
            cubie.position.y = Math.round(cubie.position.y / spacing) * spacing;
            cubie.position.z = Math.round(cubie.position.z / spacing) * spacing;

            cubie.rotation.x = Math.round(cubie.rotation.x / (Math.PI / 2)) * (Math.PI / 2);
            cubie.rotation.y = Math.round(cubie.rotation.y / (Math.PI / 2)) * (Math.PI / 2);
            cubie.rotation.z = Math.round(cubie.rotation.z / (Math.PI / 2)) * (Math.PI / 2);
          });

          // Clean up the temporary pivot
          this.mesh.remove(pivot);

          // Track move history
          if (trackHistory) {
            this.moveHistory.push({ axis, layer: layerIndex, dir: angleDirection });

            // Check for manual solved victory state
            if (this.onSolvedCallback && this.isSolved()) {
              this.onSolvedCallback();
            }
          }

          this.isAnimating = false;
          resolve();
        }
      });
    });
  }

  public isSolved(): boolean {
    const spacing = 1.06;
    const faces = [
      { axis: 'x' as const, value: spacing, normal: new THREE.Vector3(1, 0, 0) },   // Right (+X)
      { axis: 'x' as const, value: -spacing, normal: new THREE.Vector3(-1, 0, 0) }, // Left (-X)
      { axis: 'y' as const, value: spacing, normal: new THREE.Vector3(0, 1, 0) },   // Up (+Y)
      { axis: 'y' as const, value: -spacing, normal: new THREE.Vector3(0, -1, 0) }, // Down (-Y)
      { axis: 'z' as const, value: spacing, normal: new THREE.Vector3(0, 0, 1) },   // Front (+Z)
      { axis: 'z' as const, value: -spacing, normal: new THREE.Vector3(0, 0, -1) }  // Back (-Z)
    ];

    for (const face of faces) {
      // Find the 9 cubies on this face
      const faceCubies = this.cubies.filter(cubie => Math.round(cubie.position[face.axis] / spacing) === Math.round(face.value / spacing));
      if (faceCubies.length !== 9) return false;

      let faceColor: number | null = null;

      for (const cubie of faceCubies) {
        // Get the direction in the cubie's local coordinate system
        const localNormal = face.normal.clone().applyQuaternion(cubie.quaternion.clone().invert());

        // Find which primary axis localNormal is closest to
        let materialIndex = 0;
        const absX = Math.abs(localNormal.x);
        const absY = Math.abs(localNormal.y);
        const absZ = Math.abs(localNormal.z);

        if (absX > absY && absX > absZ) {
          materialIndex = localNormal.x > 0 ? 0 : 1;
        } else if (absY > absX && absY > absZ) {
          materialIndex = localNormal.y > 0 ? 2 : 3;
        } else {
          materialIndex = localNormal.z > 0 ? 4 : 5;
        }

        const materials = cubie.material as THREE.MeshBasicMaterial[];
        const color = materials[materialIndex].color.getHex();

        // If it's the internal grey color, ignore it/fail
        if (color === 0x111115) {
          return false;
        }

        if (faceColor === null) {
          faceColor = color;
        } else if (faceColor !== color) {
          return false;
        }
      }
    }

    return true;
  }

  public update(_time: number): void {
    // Phase 1 and 2 setup doesn't need custom updates.
  }

  public dispose(): void {
    this.deactivate();
    super.dispose();
    this.cubies = [];
    this.moveHistory = [];
  }
}
