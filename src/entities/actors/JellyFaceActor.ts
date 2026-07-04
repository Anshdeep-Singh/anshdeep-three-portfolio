import * as THREE from 'three';
import { BaseActor } from '../base/BaseActor';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class JellyFaceActor extends BaseActor {
  private headMesh: THREE.Mesh | null = null;
  private particles: THREE.Points | null = null;
  private particleUniforms: { [uniform: string]: THREE.IUniform } = {};
  private textColliderMesh: THREE.Mesh | null = null;

  // Animation state machine
  private animationState: 'normal' | 'exploding' | 'merging' | 'text' | 'resetting' = 'normal';
  private animationStartTime: number = 0;

  // Auto-transition timing control
  private isHomeActive: boolean = true;
  private lastStateChangeTime: number = 0;
  private nextNormalStateDuration: number = 5.0;

  constructor() {
    super('jelly-face');
  }

  public setup(): void {
    const loader = new GLTFLoader();
    loader.load(
      'models/gltf/LeePerrySmith/LeePerrySmith.glb',
      (gltf) => {
        console.log('JellyFaceActor: LeePerrySmith glb loaded successfully!');

        let loadedMesh: THREE.Mesh | null = null;
        
        // Traverse all scenes in the GLTF file to find the first Mesh
        if (gltf.scenes) {
          gltf.scenes.forEach((s) => {
            s.traverse((child) => {
              if (!loadedMesh && child instanceof THREE.Mesh) {
                loadedMesh = child;
              }
            });
          });
        }
        
        // Fallback to default scene
        if (!loadedMesh && gltf.scene) {
          gltf.scene.traverse((child) => {
            if (!loadedMesh && child instanceof THREE.Mesh) {
              loadedMesh = child;
            }
          });
        }

        if (!loadedMesh) {
          console.error('JellyFaceActor: No mesh found in gltf.');
          return;
        }

        // 1. Create standard head mesh
        const geometry = (loadedMesh as THREE.Mesh).geometry.clone();
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();

        const material = new THREE.ShaderMaterial({
          uniforms: {
            colorCyan: { value: new THREE.Color(0x00f0ff).multiplyScalar(0.45) },
            colorMagenta: { value: new THREE.Color(0xff007f).multiplyScalar(0.45) },
            colorPurple: { value: new THREE.Color(0x7000ff).multiplyScalar(0.45) },
            ambientLightColor: { value: new THREE.Color(0x0a0c1a) }
          },
          vertexShader: `
            varying vec3 vNormal;
            varying vec3 vViewPosition;
            varying vec3 vWorldNormal;
            void main() {
              vNormal = normalize(normalMatrix * normal);
              vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
              vViewPosition = -mvPosition.xyz;
              vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
              gl_Position = projectionMatrix * mvPosition;
            }
          `,
          fragmentShader: `
            uniform vec3 colorCyan;
            uniform vec3 colorMagenta;
            uniform vec3 colorPurple;
            uniform vec3 ambientLightColor;
            varying vec3 vNormal;
            varying vec3 vViewPosition;
            varying vec3 vWorldNormal;
            void main() {
              vec3 normal = normalize(vNormal);
              vec3 viewDir = normalize(vViewPosition);
              vec3 worldNormal = normalize(vWorldNormal);

              float factorX = worldNormal.x * 0.5 + 0.5;
              float factorY = worldNormal.y * 0.5 + 0.5;
              float factorZ = worldNormal.z * 0.5 + 0.5;

              vec3 baseColor = mix(colorPurple, colorCyan, factorZ);
              baseColor = mix(baseColor, colorMagenta, factorX * 0.6 + factorY * 0.4);

              vec3 lightDir = normalize(vec3(0.5, 1.0, 1.0));
              float diffuse = max(dot(normal, lightDir), 0.0);
              float ambient = 0.35;
              float shading = diffuse * 0.65 + ambient;

              float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 5.0);
              vec3 glow = colorCyan * fresnel * 0.08;

              vec3 halfDir = normalize(viewDir + vec3(0.3, 0.5, 0.2));
              float spec = pow(max(dot(normal, halfDir), 0.0), 32.0);
              vec3 specular = vec3(1.0) * spec * 0.10;

              vec3 finalColor = baseColor * shading + glow + specular + ambientLightColor * 0.05;
              gl_FragColor = vec4(finalColor, 1.0);
            }
          `
        });

        this.headMesh = new THREE.Mesh(geometry, material);
        this.headMesh.scale.setScalar(0.35);
        (this.headMesh as any).entityId = 'jelly-face';
        this.mesh.add(this.headMesh);

        // 2. Setup the Particle System from the same geometry
        const count = geometry.attributes.position.count;
        const particleGeometry = geometry.clone();
        particleGeometry.computeBoundingBox();
        particleGeometry.computeBoundingSphere();

        const aTargetPosition = new Float32Array(count * 3);
        const aRandomDir = new Float32Array(count * 3);
        const aSpeed = new Float32Array(count);

        // Sample text target positions
        const textPoints = this.generateTextPoints('ANSHDEEP SINGH', count);

        for (let i = 0; i < count; i++) {
          const target = textPoints[i];
          // Scale to fit screen perfectly
          aTargetPosition[i * 3] = target.x;
          aTargetPosition[i * 3 + 1] = target.y;
          aTargetPosition[i * 3 + 2] = target.z;

          // Spherical random distribution for explosion
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos((Math.random() * 2) - 1);
          aRandomDir[i * 3] = Math.sin(phi) * Math.cos(theta);
          aRandomDir[i * 3 + 1] = Math.sin(phi) * Math.sin(theta);
          aRandomDir[i * 3 + 2] = Math.cos(phi);

          aSpeed[i] = 0.5 + Math.random() * 0.5;
        }

        particleGeometry.setAttribute('aTargetPosition', new THREE.BufferAttribute(aTargetPosition, 3));
        particleGeometry.setAttribute('aRandomDir', new THREE.BufferAttribute(aRandomDir, 3));
        particleGeometry.setAttribute('aSpeed', new THREE.BufferAttribute(aSpeed, 1));

        this.particleUniforms = {
          uProgress: { value: 0.0 },
          uExplodeTime: { value: 0.0 },
          uTime: { value: 0.0 },
          colorCyan: { value: new THREE.Color(0x00f0ff) },
          colorMagenta: { value: new THREE.Color(0xff007f) },
          colorPurple: { value: new THREE.Color(0x7000ff) }
        };

        const particleMaterial = new THREE.ShaderMaterial({
          uniforms: this.particleUniforms,
          vertexShader: `
            uniform float uProgress;
            uniform float uExplodeTime;
            uniform float uTime;
            attribute vec3 aTargetPosition;
            attribute vec3 aRandomDir;
            attribute float aSpeed;

            varying vec3 vNormal;
            varying float vProgress;
            varying vec3 vPosition;

            void main() {
              vNormal = normal;
              vProgress = uProgress;

              // Phase 1: Burst outward from the normal/random direction
              vec3 explodeOffset = (normal * 2.5 + aRandomDir * 1.5) * uExplodeTime;
              vec3 explodedPos = position + explodeOffset;

              // Phase 2: Morph to target text position
              vec3 finalPos = mix(explodedPos, aTargetPosition, uProgress);

              // Gentle cyber float/noise
              if (uProgress > 0.0) {
                float wave = sin(uTime * 2.0 + aSpeed * 20.0) * 0.03;
                finalPos.y += wave;
                finalPos.x += cos(uTime * 1.5 + aSpeed * 20.0) * 0.015;
              }

              vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
              gl_Position = projectionMatrix * mvPosition;

              // Point size depends on depth and text progress
              // We make points smaller when forming text to keep the lettering sharp and highly readable
              float sizeMultiplier = mix(1.0, 0.45, uProgress);
              gl_PointSize = (12.0 / -mvPosition.z) * sizeMultiplier;

              vPosition = finalPos;
            }
          `,
          fragmentShader: `
            uniform vec3 colorCyan;
            uniform vec3 colorMagenta;
            uniform vec3 colorPurple;
            varying vec3 vNormal;
            varying float vProgress;
            varying vec3 vPosition;

            void main() {
              // Circular glow
              float dist = length(gl_PointCoord - vec2(0.5));
              if (dist > 0.5) discard;
              float intensity = 1.0 - (dist * 2.0);
              intensity = pow(intensity, 1.5);

              // Dynamic cyberpunk coloring
              vec3 baseColor = mix(colorPurple, colorCyan, normalize(vNormal).z * 0.5 + 0.5);
              // Normalize the text gradient strictly within the text width (-6.0 to +6.0)
              vec3 textGradient = mix(colorMagenta, colorCyan, clamp((vPosition.x + 6.0) / 12.0, 0.0, 1.0));
              vec3 finalColor = mix(baseColor, textGradient, vProgress);

              // Scale down opacity when morphing into text to avoid additive blending blowout
              float alpha = mix(0.95, 0.45, vProgress);
              gl_FragColor = vec4(finalColor, intensity * alpha);
            }
          `,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        });

        this.particles = new THREE.Points(particleGeometry, particleMaterial);
        this.particles.scale.setScalar(0.35); // Keep same scale as face for standard transformation
        this.particles.visible = false;
        (this.particles as any).entityId = 'jelly-face';
        this.mesh.add(this.particles);

        // 3. Setup invisible text collider mesh for reliable raycasting during text state
        const colliderGeo = new THREE.BoxGeometry(12, 3, 1);
        const colliderMat = new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0.0,
          depthWrite: false
        });
        this.textColliderMesh = new THREE.Mesh(colliderGeo, colliderMat);
        this.textColliderMesh.scale.setScalar(0.0); // Initially scaled to 0 to prevent interference with headMesh raycasting
        (this.textColliderMesh as any).entityId = 'jelly-face';
        this.mesh.add(this.textColliderMesh);
      },
      undefined,
      (error) => {
        console.error('JellyFaceActor: Error loading glb file', error);
      }
    );
  }

  /**
   * Samples a 2D text template and maps it to a dense set of 3D targets.
   */
  private generateTextPoints(text: string, count: number): THREE.Vector3[] {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const result: THREE.Vector3[] = [];

    if (!ctx) {
      for (let i = 0; i < count; i++) {
        result.push(new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 2, 0));
      }
      return result;
    }

    canvas.width = 1200;
    canvas.height = 300;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ffffff';
    // Use heavy font with a larger size (130px instead of 84px) to distribute the 5,000 points
    // across a wider canvas area. This dramatically reduces density and makes the text beautifully legible.
    ctx.font = '900 130px "Montserrat", "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    const points: { x: number; y: number }[] = [];
    for (let y = 0; y < canvas.height; y += 2) {
      for (let x = 0; x < canvas.width; x += 2) {
        const idx = (y * canvas.width + x) * 4;
        if (data[idx] > 128) {
          points.push({ x, y });
        }
      }
    }

    if (points.length === 0) {
      for (let i = 0; i < count; i++) {
        result.push(new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 2, 0));
      }
      return result;
    }

    for (let i = 0; i < count; i++) {
      // Sample evenly
      const ptIdx = Math.floor((i / count) * points.length);
      const pt = points[ptIdx % points.length];

      // Convert 2D pixel coordinates to 3D coords
      // Horizontal scale is larger, Z is close to 0 with tiny jitter
      const x3d = ((pt.x / canvas.width) - 0.5) * 12.0;
      const y3d = -((pt.y / canvas.height) - 0.5) * 3.0;
      const z3d = (Math.random() - 0.5) * 0.15;

      result.push(new THREE.Vector3(x3d, y3d, z3d));
    }

    return result;
  }

  /**
   * Controls whether auto-transitions are enabled (active only on home tab).
   */
  public setHomeActive(active: boolean): void {
    this.isHomeActive = active;
    if (active) {
      // Reset the wait timer when entering the home tab so that it always
      // explodes automatically exactly 5 seconds after arrival.
      this.nextNormalStateDuration = 5.0;
      this.lastStateChangeTime = 0; // Will be initialized in next update()
    }
  }

  /**
   * Action trigger when clicked. Handles state transitions.
   */
  public click(time: number): void {
    if (this.animationState === 'normal') {
      console.log('JellyFaceActor: Exploding face!');
      this.animationState = 'exploding';
      this.animationStartTime = time;
      this.lastStateChangeTime = time;
      if (this.headMesh) this.headMesh.visible = false;
      if (this.particles) this.particles.visible = true;
      if (this.textColliderMesh) this.textColliderMesh.scale.setScalar(0.35); // Enable text collider
    } else if (this.animationState === 'text') {
      console.log('JellyFaceActor: Merging back to face!');
      this.animationState = 'resetting';
      this.animationStartTime = time;
      this.lastStateChangeTime = time;
    }
  }

  /**
   * Standard reset called when navigating away or combining back to ensure state starts clean.
   */
  public reset(time: number = 0): void {
    this.animationState = 'normal';
    if (this.headMesh) this.headMesh.visible = true;
    if (this.particles) this.particles.visible = false;
    if (this.textColliderMesh) this.textColliderMesh.scale.setScalar(0.0); // Disable text collider
    if (this.particleUniforms.uProgress) this.particleUniforms.uProgress.value = 0.0;
    if (this.particleUniforms.uExplodeTime) this.particleUniforms.uExplodeTime.value = 0.0;
    this.nextNormalStateDuration = 15.0; // Subsequent wait after combining back is 15 seconds
    this.lastStateChangeTime = time;
  }

  public update(time: number): void {
    // Initialize timing reference on the first update frame
    if (this.lastStateChangeTime === 0) {
      this.lastStateChangeTime = time;
    }

    // 1. Organic float motion for normal face floating
    if (this.animationState === 'normal') {
      if (this.headMesh) {
        this.mesh.position.y = Math.sin(time * 1.2) * 0.15;
        this.mesh.position.x = Math.cos(time * 0.7) * 0.08;
        
        this.headMesh.rotation.y = Math.sin(time * 0.4) * 0.08;
        this.headMesh.rotation.x = Math.cos(time * 0.5) * 0.05;
        this.headMesh.rotation.z = Math.sin(time * 0.3) * 0.03;
      }

      // Auto-trigger explode if on home tab and the wait duration has passed
      if (this.isHomeActive && (time - this.lastStateChangeTime >= this.nextNormalStateDuration)) {
        console.log(`JellyFaceActor: Auto-triggering explosion after ${this.nextNormalStateDuration}s in normal state.`);
        this.click(time);
      }
    } else {
      // Organic float motion for text/particles
      this.mesh.position.y = Math.sin(time * 0.8) * 0.08;
      this.mesh.position.x = Math.cos(time * 0.5) * 0.04;
      if (this.particles) {
        this.particles.rotation.y = Math.sin(time * 0.2) * 0.04;
      }

      // Auto-trigger merge back to face if in text state and 15 seconds have passed
      if (this.animationState === 'text' && this.isHomeActive && (time - this.lastStateChangeTime >= 15.0)) {
        console.log('JellyFaceActor: Auto-triggering merge back to face after 15s in text state.');
        this.click(time);
      }
    }

    // 2. Uniform updates
    if (this.particles && this.particleUniforms.uTime) {
      this.particleUniforms.uTime.value = time;

      const EXPLODE_DURATION = 0.8;
      const MERGE_DURATION = 1.2;
      const RESET_DURATION = 1.5;

      if (this.animationState === 'exploding') {
        const elapsed = time - this.animationStartTime;
        const progress = Math.min(elapsed / EXPLODE_DURATION, 1.0);
        this.particleUniforms.uExplodeTime.value = progress;
        this.particleUniforms.uProgress.value = 0.0;

        if (progress >= 1.0) {
          this.animationState = 'merging';
          this.animationStartTime = time;
        }
      } else if (this.animationState === 'merging') {
        const elapsed = time - this.animationStartTime;
        const progress = Math.min(elapsed / MERGE_DURATION, 1.0);
        this.particleUniforms.uExplodeTime.value = 1.0;
        this.particleUniforms.uProgress.value = progress;

        if (progress >= 1.0) {
          this.animationState = 'text';
          this.lastStateChangeTime = time; // Start the 15 seconds timer for the text state
        }
      } else if (this.animationState === 'text') {
        this.particleUniforms.uExplodeTime.value = 1.0;
        this.particleUniforms.uProgress.value = 1.0;
      } else if (this.animationState === 'resetting') {
        const elapsed = time - this.animationStartTime;
        const progress = Math.max(1.0 - (elapsed / RESET_DURATION), 0.0);
        this.particleUniforms.uExplodeTime.value = progress;
        this.particleUniforms.uProgress.value = progress;

        if (progress <= 0.0) {
          this.reset(time);
        }
      }
    }
  }

  public dispose(): void {
    super.dispose();
  }
}
