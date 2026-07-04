import * as THREE from 'three';

export class Navbar3DLogo {
  private container: HTMLElement | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private mesh: THREE.Mesh | null = null;
  private animationFrameId: number | null = null;

  // Rotation speed state
  private currentSpeedX = 0;
  private currentSpeedY = 0;
  private currentSpeedZ = 0;

  private targetSpeedX = 0;
  private targetSpeedY = 0;
  private targetSpeedZ = 0;

  private nextSpeedChangeTime = 0;
  private lastTime = 0;

  constructor(containerId: string = 'navbar-logo') {
    this.container = document.getElementById(containerId);
  }

  public init(): void {
    if (!this.container) {
      console.warn('Navbar3DLogo: Container element not found.');
      return;
    }

    const width = this.container.clientWidth || 50;
    const height = this.container.clientHeight || 50;

    // 1. Initialize Scene, Camera, and Renderer
    this.scene = new THREE.Scene();
    
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10);
    this.camera.position.z = 2.8;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    // 2. Generate Curled Up 3D Spline Points
    const points: THREE.Vector3[] = [];
    const numPoints = 64;
    for (let i = 0; i < numPoints; i++) {
      const t = i / numPoints;
      
      // Use a mathematical knot equation to curl it up elegantly in 3D
      const p = 3;
      const q = 4;
      const phi = t * Math.PI * 2 * p;
      const r = 0.7 + 0.2 * Math.sin(t * Math.PI * 2 * q);
      const x = r * Math.cos(phi);
      const y = r * Math.sin(phi);
      const z = 0.4 * Math.cos(t * Math.PI * 2 * q);
      
      points.push(new THREE.Vector3(x, y, z));
    }

    // 3. Create Spline and Mesh Geometry
    const curve = new THREE.CatmullRomCurve3(points, true);
    // TubeGeometry gives the spline bold volumetric thickness
    const geometry = new THREE.TubeGeometry(curve, 120, 0.07, 8, true);

    // 4. Create Glowing Hologram Material
    const material = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.95
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.mesh);

    // Initialize speeds
    this.randomizeTargetSpeeds();
    this.currentSpeedX = this.targetSpeedX;
    this.currentSpeedY = this.targetSpeedY;
    this.currentSpeedZ = this.targetSpeedZ;

    // 5. Start Animation Loop
    this.lastTime = performance.now();
    this.animate();

    // Listen to resize on logo container if needed
    window.addEventListener('resize', this.handleResize);
  }

  private randomizeTargetSpeeds(): void {
    // Random rotation speeds between -1.8 and 1.8 radians per second
    const maxSpeed = 1.8;
    this.targetSpeedX = (Math.random() - 0.5) * maxSpeed;
    this.targetSpeedY = (Math.random() - 0.5) * maxSpeed;
    this.targetSpeedZ = (Math.random() - 0.5) * maxSpeed;
    
    // Change speed again in 1.5 to 3.5 seconds
    this.nextSpeedChangeTime = performance.now() + 1500 + Math.random() * 2000;
  }

  private animate = (): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);

    const now = performance.now();
    const delta = (now - this.lastTime) / 1000;
    this.lastTime = now;

    if (!this.renderer || !this.scene || !this.camera || !this.mesh) return;

    // Randomize speed when the timer is up
    if (now > this.nextSpeedChangeTime) {
      this.randomizeTargetSpeeds();
    }

    // Smoothly interpolate current speed to target speed (lerp)
    const lerpFactor = 0.05; // smooth rotation rate change
    this.currentSpeedX += (this.targetSpeedX - this.currentSpeedX) * lerpFactor;
    this.currentSpeedY += (this.targetSpeedY - this.currentSpeedY) * lerpFactor;
    this.currentSpeedZ += (this.targetSpeedZ - this.currentSpeedZ) * lerpFactor;

    // Rotate spline mesh
    this.mesh.rotation.x += this.currentSpeedX * delta;
    this.mesh.rotation.y += this.currentSpeedY * delta;
    this.mesh.rotation.z += this.currentSpeedZ * delta;

    this.renderer.render(this.scene, this.camera);
  };

  private handleResize = (): void => {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  public destroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    window.removeEventListener('resize', this.handleResize);

    if (this.mesh) {
      this.mesh.geometry.dispose();
      if (Array.isArray(this.mesh.material)) {
        this.mesh.material.forEach(mat => mat.dispose());
      } else {
        this.mesh.material.dispose();
      }
      this.mesh = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
      this.renderer = null;
    }

    this.scene = null;
    this.camera = null;
    this.container = null;
  }
}
