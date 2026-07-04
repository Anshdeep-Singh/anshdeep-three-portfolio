import * as THREE from 'three';
import { gsap } from 'gsap';

interface ParticleData {
  velocity: THREE.Vector3;
  numConnections: number;
}

export class LoadingScreenController {
  private overlayEl!: HTMLDivElement;
  private canvasEl!: HTMLCanvasElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private group!: THREE.Group;

  // Particle network variables
  private particlesData: ParticleData[] = [];
  private positions!: Float32Array;
  private colors!: Float32Array;
  private particlesGeometry!: THREE.BufferGeometry;
  private linesGeometry!: THREE.BufferGeometry;
  private pointCloud!: THREE.Points;
  private linesMesh!: THREE.LineSegments;
  private particlePositions!: Float32Array;

  // Configuration constants
  private readonly maxParticleCount = 600;
  private particleCount = 250;
  private readonly r = 800;
  private readonly rHalf = 400;
  private readonly minDistance = 120;

  // Animation and lifecycle flags
  private animationFrameId: number | null = null;
  private isDismissed = false;
  private resizeHandler = this.onWindowResize.bind(this);

  constructor() {
    this.createDOM();
    this.initThree();
    this.initParticles();
    this.startAnimation();
  }

  /**
   * Dynamically build or hook into existing loading screen DOM elements.
   */
  private createDOM(): void {
    const existingOverlay = document.getElementById('loading-screen') as HTMLDivElement;
    const existingCanvas = document.getElementById('loading-canvas') as HTMLCanvasElement;

    if (existingOverlay && existingCanvas) {
      this.overlayEl = existingOverlay;
      this.canvasEl = existingCanvas;
    } else {
      this.overlayEl = document.createElement('div');
      this.overlayEl.id = 'loading-screen';
      this.overlayEl.className = 'loading-screen';

      this.canvasEl = document.createElement('canvas');
      this.canvasEl.id = 'loading-canvas';
      this.canvasEl.className = 'loading-canvas';
      this.overlayEl.appendChild(this.canvasEl);

      const contentEl = document.createElement('div');
      contentEl.className = 'loading-content';

      const titleEl = document.createElement('div');
      titleEl.className = 'loading-title';
      titleEl.textContent = 'LOADING PORTFOLIO';

      const subEl = document.createElement('div');
      subEl.className = 'loading-sub';
      subEl.textContent = 'Please wait while we prepare your experience.';

      contentEl.appendChild(titleEl);
      contentEl.appendChild(subEl);
      this.overlayEl.appendChild(contentEl);

      document.body.appendChild(this.overlayEl);
    }
  }

  /**
   * Setup isolated Three.js rendering context for loading screen.
   */
  private initThree(): void {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvasEl,
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      1,
      4000
    );
    this.camera.position.z = 1200;

    this.group = new THREE.Group();
    this.scene.add(this.group);

    window.addEventListener('resize', this.resizeHandler);
  }

  /**
   * Build the BufferGeometry point cloud and connecting line meshes.
   */
  private initParticles(): void {
    const segments = this.maxParticleCount * this.maxParticleCount;

    this.positions = new Float32Array(segments * 3);
    this.colors = new Float32Array(segments * 3);

    const pMaterial = new THREE.PointsMaterial({
      color: 0x00f0ff, // Match cyan primary theme
      size: 4,
      blending: THREE.AdditiveBlending,
      transparent: true,
      sizeAttenuation: false,
      opacity: 0.8,
    });

    this.particlesGeometry = new THREE.BufferGeometry();
    this.particlePositions = new Float32Array(this.maxParticleCount * 3);

    for (let i = 0; i < this.maxParticleCount; i++) {
      const x = Math.random() * this.r - this.rHalf;
      const y = Math.random() * this.r - this.rHalf;
      const z = Math.random() * this.r - this.rHalf;

      this.particlePositions[i * 3] = x;
      this.particlePositions[i * 3 + 1] = y;
      this.particlePositions[i * 3 + 2] = z;

      this.particlesData.push({
        velocity: new THREE.Vector3(
          -1 + Math.random() * 2,
          -1 + Math.random() * 2,
          -1 + Math.random() * 2
        ).multiplyScalar(1.2), // slightly speed up for better aesthetic on loading screen
        numConnections: 0,
      });
    }

    this.particlesGeometry.setDrawRange(0, this.particleCount);
    this.particlesGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.particlePositions, 3).setUsage(
        THREE.DynamicDrawUsage
      )
    );

    this.pointCloud = new THREE.Points(this.particlesGeometry, pMaterial);
    this.group.add(this.pointCloud);

    this.linesGeometry = new THREE.BufferGeometry();
    this.linesGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.positions, 3).setUsage(
        THREE.DynamicDrawUsage
      )
    );
    this.linesGeometry.setAttribute(
      'color',
      new THREE.BufferAttribute(this.colors, 3).setUsage(
        THREE.DynamicDrawUsage
      )
    );

    this.linesGeometry.computeBoundingSphere();
    this.linesGeometry.setDrawRange(0, 0);

    const lineMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.6,
    });

    this.linesMesh = new THREE.LineSegments(this.linesGeometry, lineMaterial);
    this.group.add(this.linesMesh);
  }

  /**
   * Handle resize event to update viewport mapping.
   */
  private onWindowResize(): void {
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /**
   * Start the render and particle update loop.
   */
  private startAnimation(): void {
    const animateLoop = () => {
      this.animationFrameId = requestAnimationFrame(animateLoop);
      this.updateParticles();
      this.render();
    };
    animateLoop();
  }

  /**
   * Core lines-drawing connections and physics algorithm.
   */
  private updateParticles(): void {
    let vertexpos = 0;
    let colorpos = 0;
    let numConnected = 0;

    for (let i = 0; i < this.particleCount; i++) {
      this.particlesData[i].numConnections = 0;
    }

    // Adjust parameters slightly if dismissed to disperse particles
    const expansionMult = this.isDismissed ? 2.5 : 1.0;

    for (let i = 0; i < this.particleCount; i++) {
      const data = this.particlesData[i];

      // Update particle positions
      this.particlePositions[i * 3] += data.velocity.x * expansionMult;
      this.particlePositions[i * 3 + 1] += data.velocity.y * expansionMult;
      this.particlePositions[i * 3 + 2] += data.velocity.z * expansionMult;

      // Bounce boundaries
      if (
        this.particlePositions[i * 3 + 1] < -this.rHalf ||
        this.particlePositions[i * 3 + 1] > this.rHalf
      ) {
        data.velocity.y = -data.velocity.y;
      }
      if (
        this.particlePositions[i * 3] < -this.rHalf ||
        this.particlePositions[i * 3] > this.rHalf
      ) {
        data.velocity.x = -data.velocity.x;
      }
      if (
        this.particlePositions[i * 3 + 2] < -this.rHalf ||
        this.particlePositions[i * 3 + 2] > this.rHalf
      ) {
        data.velocity.z = -data.velocity.z;
      }

      // Check collision / distance
      for (let j = i + 1; j < this.particleCount; j++) {
        const dataB = this.particlesData[j];

        const dx = this.particlePositions[i * 3] - this.particlePositions[j * 3];
        const dy = this.particlePositions[i * 3 + 1] - this.particlePositions[j * 3 + 1];
        const dz = this.particlePositions[i * 3 + 2] - this.particlePositions[j * 3 + 2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < this.minDistance) {
          data.numConnections++;
          dataB.numConnections++;

          const alpha = 1.0 - dist / this.minDistance;

          this.positions[vertexpos++] = this.particlePositions[i * 3];
          this.positions[vertexpos++] = this.particlePositions[i * 3 + 1];
          this.positions[vertexpos++] = this.particlePositions[i * 3 + 2];

          this.positions[vertexpos++] = this.particlePositions[j * 3];
          this.positions[vertexpos++] = this.particlePositions[j * 3 + 1];
          this.positions[vertexpos++] = this.particlePositions[j * 3 + 2];

          // Set connection colors (cyan-neon to magenta-neon style blending depending on connections)
          const rColor = 0.0;
          const gColor = alpha * 0.94;
          const bColor = alpha;

          this.colors[colorpos++] = rColor;
          this.colors[colorpos++] = gColor;
          this.colors[colorpos++] = bColor;

          this.colors[colorpos++] = rColor;
          this.colors[colorpos++] = gColor;
          this.colors[colorpos++] = bColor;

          numConnected++;
        }
      }
    }

    this.linesMesh.geometry.setDrawRange(0, numConnected * 2);
    this.linesMesh.geometry.attributes.position.needsUpdate = true;
    this.linesMesh.geometry.attributes.color.needsUpdate = true;

    this.pointCloud.geometry.attributes.position.needsUpdate = true;
  }

  /**
   * Render frame.
   */
  private render(): void {
    const time = Date.now() * 0.001;
    // Standard slow rotation
    if (!this.isDismissed) {
      this.group.rotation.y = time * 0.15;
      this.group.rotation.x = time * 0.05;
    } else {
      // Accelerate rotation slightly on dissolve
      this.group.rotation.y += 0.01;
    }
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Dismiss the loading screen by expanding particles outwards and fading.
   */
  public dismiss(): Promise<void> {
    if (this.isDismissed) return Promise.resolve();
    this.isDismissed = true;

    return new Promise((resolve) => {
      // Rapid expand away animation
      gsap.to(this.group.scale, {
        x: 10,
        y: 10,
        z: 10,
        duration: 1.2,
        ease: 'power3.inOut',
      });

      // Animate line fading simultaneously
      const lineMaterial = this.linesMesh.material as THREE.LineBasicMaterial;
      const pointMaterial = this.pointCloud.material as THREE.PointsMaterial;
      gsap.to([lineMaterial, pointMaterial], {
        opacity: 0,
        duration: 0.8,
        ease: 'power2.out',
      });

      // CSS Overlay fadeout
      this.overlayEl.classList.add('loading-screen--hidden');

      // Resolve and dispose after animation finishes
      setTimeout(() => {
        this.dispose();
        resolve();
      }, 1200);
    });
  }

  /**
   * Free system memory and WebGL context.
   */
  public dispose(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.resizeHandler);

    // Dispose objects
    this.group.remove(this.pointCloud);
    this.group.remove(this.linesMesh);
    this.scene.remove(this.group);

    this.particlesGeometry.dispose();
    this.linesGeometry.dispose();

    if (Array.isArray(this.pointCloud.material)) {
      this.pointCloud.material.forEach((mat) => mat.dispose());
    } else {
      this.pointCloud.material.dispose();
    }

    if (Array.isArray(this.linesMesh.material)) {
      this.linesMesh.material.forEach((mat) => mat.dispose());
    } else {
      this.linesMesh.material.dispose();
    }

    this.renderer.dispose();

    // Clean DOM
    if (this.overlayEl && this.overlayEl.parentNode) {
      this.overlayEl.parentNode.removeChild(this.overlayEl);
    }
  }
}
