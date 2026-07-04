import * as THREE from 'three';
import { BaseActor } from '../base/BaseActor';
import { gsap } from 'gsap';

export class TetrisPileActor extends BaseActor {
  private pileGroup!: THREE.Group;
  private particles!: THREE.Points;
  private particlesUniforms!: { [uniform: string]: THREE.IUniform };
  private originalOpacityMap: Map<THREE.Material, number> = new Map();

  constructor() {
    super('tetris-pile');
  }

  public setup(): void {
    this.pileGroup = new THREE.Group();
    this.mesh.add(this.pileGroup);

    // Create three scattered Tetrominoes: I-shape, T-shape, and L-shape
    const iShape = this.createTetromino('I', 0x00f0ff);
    const tShape = this.createTetromino('T', 0xaa00ff);
    const lShape = this.createTetromino('L', 0xffaa00);

    // Position and rotate them on the floor of the heap to make a beautiful pile
    // I-shape: lying down flat
    iShape.position.set(-0.2, 0.15, -0.1);
    iShape.rotation.set(0.1, 0.5, 0.2);

    // T-shape: leaning
    tShape.position.set(0.2, 0.2, 0.1);
    tShape.rotation.set(0.8, -0.4, 0.3);

    // L-shape: standing up slightly
    lShape.position.set(0.0, 0.25, 0.3);
    lShape.rotation.set(-0.5, 0.2, -0.6);

    this.pileGroup.add(iShape);
    this.pileGroup.add(tShape);
    this.pileGroup.add(lShape);

    // Scale the entire pile actor to look good in the scene
    this.mesh.scale.set(1.5, 1.5, 1.5);

    // Setup the Dissolve Particle System
    this.setupParticles([
      { shape: iShape, color: new THREE.Color(0x00f0ff) },
      { shape: tShape, color: new THREE.Color(0xaa00ff) },
      { shape: lShape, color: new THREE.Color(0xffaa00) }
    ]);
  }

  public update(time: number): void {
    // Add a very subtle neon breathing / hovering effect to the scattered pile
    if (this.pileGroup && this.pileGroup.visible) {
      this.pileGroup.position.y = Math.sin(time * 1.5) * 0.05;
      this.pileGroup.rotation.y = time * 0.15;
    }

    if (this.particlesUniforms) {
      this.particlesUniforms.uTime.value = time;
    }
  }

  /**
   * Triggers the dissolve transition of the scattered pile.
   */
  public dissolve(onCompleteCallback?: () => void): void {
    // 1. Reset particles progress
    if (this.particlesUniforms) {
      this.particlesUniforms.uProgress.value = 0.0;
    }
    this.particles.visible = true;

    const timeline = gsap.timeline({
      onComplete: () => {
        this.pileGroup.visible = false;
        if (onCompleteCallback) {
          onCompleteCallback();
        }
      }
    });

    // 2. Animate particle explosion and fade to 0 opacity
    timeline.to(this.particlesUniforms.uProgress, {
      value: 1.0,
      duration: 2.0,
      ease: 'power2.out'
    }, 0);

    // 3. Smoothly fade out original blocks and outlines
    this.pileGroup.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(mat => {
          timeline.to(mat, {
            opacity: 0.0,
            duration: 1.0,
            ease: 'power2.out'
          }, 0);
        });
      }
      if (child instanceof THREE.LineSegments && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(mat => {
          timeline.to(mat, {
            opacity: 0.0,
            duration: 1.0,
            ease: 'power2.out'
          }, 0);
        });
      }
    });
  }

  /**
   * Resets the pile to solid opacity and hides active particles.
   */
  public resetPile(): void {
    gsap.killTweensOf(this.particlesUniforms.uProgress);
    this.particlesUniforms.uProgress.value = 0.0;
    this.particles.visible = false;
    this.pileGroup.visible = true;

    // Restore original opacities
    this.pileGroup.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(mat => {
          gsap.killTweensOf(mat);
          const origOpacity = this.originalOpacityMap.get(mat) ?? 0.15;
          mat.opacity = origOpacity;
        });
      }
      if (child instanceof THREE.LineSegments && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(mat => {
          gsap.killTweensOf(mat);
          const origOpacity = this.originalOpacityMap.get(mat) ?? 0.4;
          mat.opacity = origOpacity;
        });
      }
    });
  }

  private createTetromino(type: string, color: number): THREE.Group {
    const group = new THREE.Group();
    const blockSize = 0.2;
    const blockGeometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
    
    const blockMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    this.originalOpacityMap.set(blockMaterial, 0.15);

    const edgesGeometry = new THREE.EdgesGeometry(blockGeometry);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: color,
      linewidth: 2,
      transparent: true,
      opacity: 0.4
    });
    this.originalOpacityMap.set(lineMaterial, 0.4);

    // Coordinates of blocks relative to shape origin
    let coordinates: [number, number, number][] = [];

    if (type === 'I') {
      coordinates = [
        [-1.5, 0, 0],
        [-0.5, 0, 0],
        [0.5, 0, 0],
        [1.5, 0, 0]
      ];
    } else if (type === 'T') {
      coordinates = [
        [-1, 0, 0],
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0]
      ];
    } else if (type === 'L') {
      coordinates = [
        [-1, 0, 0],
        [0, 0, 0],
        [1, 0, 0],
        [1, 1, 0]
      ];
    }

    coordinates.forEach(([cx, cy, cz]) => {
      const blockMesh = new THREE.Mesh(blockGeometry, blockMaterial);
      blockMesh.position.set(cx * blockSize, cy * blockSize, cz * blockSize);

      const outline = new THREE.LineSegments(edgesGeometry, lineMaterial);
      blockMesh.add(outline);

      group.add(blockMesh);
    });

    return group;
  }

  private setupParticles(shapesWithColors: { shape: THREE.Group, color: THREE.Color }[]): void {
    const particlePositions: number[] = [];
    const particleNormals: number[] = [];
    const particleColors: number[] = [];
    const particleRandomDirs: number[] = [];
    const particleSpeeds: number[] = [];

    const pointsPerBlock = 150;
    const blockSize = 0.2;

    shapesWithColors.forEach(({ shape, color }) => {
      // Force update of parent matrix
      shape.updateMatrix();

      shape.children.forEach((child) => {
        if (child instanceof THREE.Mesh) {
          child.updateMatrix();
          
          // Combine parent and child matrices to get local actor-space transform
          const actorMatrix = new THREE.Matrix4().multiplyMatrices(shape.matrix, child.matrix);
          const normalMatrix = new THREE.Matrix3().getNormalMatrix(actorMatrix);

          // Sample random points inside/on this block
          for (let i = 0; i < pointsPerBlock; i++) {
            // Pick a random position inside local box coordinates [-blockSize/2, blockSize/2]
            const px = (Math.random() - 0.5) * blockSize;
            const py = (Math.random() - 0.5) * blockSize;
            const pz = (Math.random() - 0.5) * blockSize;

            const posVec = new THREE.Vector3(px, py, pz).applyMatrix4(actorMatrix);
            
            // Random direction normal vector
            const normVec = new THREE.Vector3(
              (Math.random() - 0.5),
              (Math.random() - 0.5),
              (Math.random() - 0.5)
            ).normalize().applyMatrix3(normalMatrix).normalize();

            // Spherical random explosion direction
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos((Math.random() * 2) - 1);
            const rx = Math.sin(phi) * Math.cos(theta);
            const ry = Math.sin(phi) * Math.sin(theta);
            const rz = Math.cos(phi);

            particlePositions.push(posVec.x, posVec.y, posVec.z);
            particleNormals.push(normVec.x, normVec.y, normVec.z);
            particleColors.push(color.r, color.g, color.b);
            particleRandomDirs.push(rx, ry, rz);
            particleSpeeds.push(0.5 + Math.random() * 0.5);
          }
        }
      });
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(particlePositions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(particleNormals, 3));
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
        attribute vec3 aColor;
        attribute vec3 aRandomDir;
        attribute float aSpeed;

        varying vec3 vColor;
        varying float vProgress;
        varying vec3 vPosition;

        void main() {
          vColor = aColor;
          vProgress = uProgress;

          // normal vector + random direction determines explosion trajectory
          vec3 explodeOffset = (normal * 2.0 + aRandomDir * 1.5) * uProgress;
          vec3 explodedPos = position + explodeOffset;

          // Cyber float / wind noise
          if (uProgress > 0.0) {
            float wave = sin(uTime * 3.0 + aSpeed * 20.0) * 0.05 * uProgress;
            explodedPos.y += wave;
            explodedPos.x += cos(uTime * 2.5 + aSpeed * 15.0) * 0.02 * uProgress;
          }

          vec4 mvPosition = modelViewMatrix * vec4(explodedPos, 1.0);
          gl_Position = projectionMatrix * mvPosition;

          float sizeMultiplier = 1.0 - uProgress * 0.5;
          gl_PointSize = (15.0 / -mvPosition.z) * sizeMultiplier;

          vPosition = explodedPos;
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

          // Fade out opacity to 0 as uProgress approaches 1.0
          float alpha = (1.0 - vProgress) * 0.95;

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

  public dispose(): void {
    super.dispose();
    if (this.particles) {
      this.mesh.remove(this.particles);
      this.particles.geometry.dispose();
      if (Array.isArray(this.particles.material)) {
        this.particles.material.forEach(m => m.dispose());
      } else {
        this.particles.material.dispose();
      }
    }
  }
}
