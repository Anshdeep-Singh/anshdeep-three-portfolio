import * as THREE from 'three';

export class Stage {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private gridMesh?: THREE.Mesh;
  private particles?: THREE.Points;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private lastMouse: THREE.Vector2;
  private mouseSpeed: number = 0;
  private isMouseDown: boolean = false;
  
  // Planes for projecting raycast mouse positions
  private floorPlane: THREE.Plane;
  private centerPlane: THREE.Plane;
  
  // Uniform storage
  private gridUniforms: { [uniform: string]: THREE.IUniform };
  private particleUniforms: { [uniform: string]: THREE.IUniform };

  // Cosmic Sky Whirlpool (Spiral Animation)
  private whirlpoolParticles?: THREE.Points;
  private whirlpoolUniforms?: { [uniform: string]: THREE.IUniform };

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    this.scene = scene;
    this.camera = camera;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(0, 0);
    this.lastMouse = new THREE.Vector2(0, 0);
    
    // Mathematical planes for mouse projection
    this.floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 4); // y = -4
    this.centerPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); // z = 0

    // Initialize uniforms
    this.gridUniforms = {
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uDistortionStrength: { value: 2.5 },
      uDistortionRadius: { value: 8.0 }
    };

    this.particleUniforms = {
      uTime: { value: 0 },
      uMouse3D: { value: new THREE.Vector3(0, 0, 0) },
      uMouseRadius: { value: 5.0 },
      uSwipeInfluence: { value: 0.0 },
      uGravityWellState: { value: 0.0 },      // 0: normal, 1: vortex, 2: supernova, 3: recovery
      uGravityWellProgress: { value: 0.0 },   // 0.0 to 1.0
      uGravityWellCenter: { value: new THREE.Vector3(0, 0, 0) }
    };

    this.setupGrid();
    this.setupParticles();
    this.setupWhirlpool();
    this.setupMouseListener();
  }

  private getRandomPointOnSphere(r: number, v: THREE.Vector3): THREE.Vector3 {
    const angle = Math.random() * Math.PI * 2;
    const u = Math.random() * 2 - 1;

    v.set(
      Math.cos(angle) * Math.sqrt(1 - Math.pow(u, 2)) * r,
      Math.sin(angle) * Math.sqrt(1 - Math.pow(u, 2)) * r,
      u * r
    );

    return v;
  }

  private setupWhirlpool(): void {
    const count = 20000;
    const radius = 50.0;

    const vertices = [];
    const colors = [];
    const timeOffsets = [];

    const vertex = new THREE.Vector3();
    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
      this.getRandomPointOnSphere(radius, vertex);
      vertices.push(vertex.x, vertex.y, vertex.z);

      // Rainbow HSL coloring
      color.setHSL(i / count, 0.8, 0.65);
      colors.push(color.r, color.g, color.b);

      timeOffsets.push(i / count);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(colors), 3));
    geometry.setAttribute('aTimeOffset', new THREE.BufferAttribute(new Float32Array(timeOffsets), 1));

    this.whirlpoolUniforms = {
      uTime: { value: 0.0 }
    };

    const material = new THREE.ShaderMaterial({
      vertexShader: `
        attribute vec3 aColor;
        attribute float aTimeOffset;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uTime;

        void main() {
          // Use natural color values for distinct particles without excessive bloom glow
          vColor = aColor;

          // Compute continuous cycling time for local particle lifecycle
          float localTime = aTimeOffset + uTime * 0.05;
          float modTime = mod(localTime, 1.0);
          float accTime = modTime * modTime;

          // Spiral equation to compute beautiful outwards spiraling arms
          float angle = accTime * 40.0;
          vec2 pulse = vec2(sin(angle) * 15.0, cos(angle) * 15.0);

          // Animate particle position expanding outwards from local core (local Z is vertical when rotated)
          vec3 animated = vec3(
            position.x * accTime + pulse.x,
            position.y * accTime + pulse.y,
            position.z * accTime * 1.75
          );

          vAlpha = (1.0 - modTime) * 1.5;

          vec4 mvPosition = modelViewMatrix * vec4(animated, 1.0);
          gl_Position = projectionMatrix * mvPosition;

          // Scaled to look beautifully sharp, tiny and far away in the background sky
          gl_PointSize = (300.0 / -mvPosition.z) * 1.2;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;

          // Made much sharper with a power of 3.0 so they look like distinct shimmering stars
          float strength = 1.0 - (dist * 2.0);
          strength = pow(max(strength, 0.0), 3.0);

          gl_FragColor = vec4(vColor, strength * vAlpha);
        }
      `,
      uniforms: this.whirlpoolUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.whirlpoolParticles = new THREE.Points(geometry, material);
    // Position super far back and high in the sky (perfectly away from camera at z=7)
    this.whirlpoolParticles.position.set(0, 110, -180);
    // Orient flat horizontally (local Z vertical) and tilted slightly towards camera for optimal view
    this.whirlpoolParticles.rotation.x = Math.PI / 2.3;
    this.scene.add(this.whirlpoolParticles);
  }

  private setupGrid(): void {
    // Large plane with plenty of segments for smooth bending
    const gridGeo = new THREE.PlaneGeometry(200, 200, 120, 120);
    
    const gridMat = new THREE.ShaderMaterial({
      vertexShader: `
        uniform float uTime;
        uniform vec2 uMouse;
        uniform float uDistortionStrength;
        uniform float uDistortionRadius;
        varying vec3 vWorldPosition;
        varying vec2 vUv;

        void main() {
          vUv = uv;
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          
          // Apply bending around the mouse cursor (gravitational distortion)
          float dist = distance(worldPosition.xz, uMouse);
          if (dist < uDistortionRadius) {
            float factor = 1.0 - (dist / uDistortionRadius);
            factor = smoothstep(0.0, 1.0, factor);
            // Bend the floor downward
            worldPosition.y -= factor * uDistortionStrength;
          }
          
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vWorldPosition;
        varying vec2 vUv;
        uniform float uTime;

        float grid(vec2 pos, float size) {
          vec2 r = abs(fract(pos / size - 0.5) - 0.5) / fwidth(pos / size);
          float line = min(r.x, r.y);
          return 1.0 - min(line, 1.0);
        }

        void main() {
          float g1 = grid(vWorldPosition.xz, 1.0);
          float g2 = grid(vWorldPosition.xz, 5.0);
          
          // Neon cyber aesthetic colors
          vec3 neonCyan = vec3(0.0, 0.8, 1.0);
          vec3 neonMagenta = vec3(1.0, 0.0, 0.6);
          
          vec3 color = mix(neonCyan, neonMagenta, g2 * 0.4 + sin(uTime * 0.5) * 0.2);
          float alpha = max(g1 * 0.2, g2 * 0.75);
          
          // Horizon fade to prevent aliasing
          float distToCamera = length(vWorldPosition - cameraPosition);
          float fade = 1.0 - smoothstep(15.0, 60.0, distToCamera);
          
          gl_FragColor = vec4(color * alpha * fade, alpha * fade);
        }
      `,
      uniforms: this.gridUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });

    this.gridMesh = new THREE.Mesh(gridGeo, gridMat);
    this.gridMesh.rotation.x = -Math.PI / 2;
    this.gridMesh.position.y = -4;
    this.scene.add(this.gridMesh);
  }

  private setupParticles(): void {
    const particleCount = 8000;
    const geometry = new THREE.BufferGeometry();
    
    const positions = new Float32Array(particleCount * 3);
    const randoms = new Float32Array(particleCount * 3); // x: speed, y: phase, z: orbit radius

    for (let i = 0; i < particleCount; i++) {
      // Setup initial random distribution around the core
      const radius = 2.0 + Math.random() * 30.0;
      const angle = Math.random() * Math.PI * 2;
      
      positions[i * 3] = Math.sin(angle) * radius;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 8.0;
      positions[i * 3 + 2] = Math.cos(angle) * radius;

      // Random attributes for orbital physics in shader
      randoms[i * 3] = 0.15 + Math.random() * 0.85; // Speed multiplier
      randoms[i * 3 + 1] = Math.random() * Math.PI * 2; // Initial phase/angle
      randoms[i * 3 + 2] = radius; // Base orbit radius
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 3));

    const particleMat = new THREE.ShaderMaterial({
      vertexShader: `
        attribute vec3 aRandom;
        uniform float uTime;
        uniform vec3 uMouse3D;
        uniform float uMouseRadius;
        uniform float uSwipeInfluence;
        uniform float uGravityWellState;      // 0: normal, 1: vortex, 2: supernova, 3: recovery
        uniform float uGravityWellProgress;   // 0.0 to 1.0
        uniform vec3 uGravityWellCenter;
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          float speed = aRandom.x;
          float phase = aRandom.y;
          float baseRadius = aRandom.z;
          
          // Dynamic swirling orbit over time
          float angle = uTime * speed * 0.15 + phase;
          vec3 orbitPos = vec3(
            sin(angle) * baseRadius,
            (phase - 3.1415) * 1.5,
            cos(angle) * baseRadius
          );
          
          vec3 finalPos = orbitPos;

          // Compute gravity well state-specific transitions
          if (uGravityWellState > 0.5 && uGravityWellState < 1.5) {
            // VORTEX / SUCKING STATE (Inward spiral)
            float t = uGravityWellProgress;
            vec3 toCenter = uGravityWellCenter - orbitPos;
            
            float spiralAngle = t * (12.0 + speed * 18.0);
            float cosS = cos(spiralAngle);
            float sinS = sin(spiralAngle);
            
            vec3 offset = -toCenter;
            vec3 rotatedOffset = vec3(
              offset.x * cosS - offset.z * sinS,
              offset.y,
              offset.x * sinS + offset.z * cosS
            );
            
            finalPos = uGravityWellCenter + rotatedOffset * (1.0 - t);
            
            // Shift color towards deep gravity magenta-purple
            vColor = mix(vec3(0.0, 0.9, 1.0), vec3(0.7, 0.0, 1.0), t);
          } 
          else if (uGravityWellState > 1.5 && uGravityWellState < 2.5) {
            // SUPERNOVA EXPLOSION STATE
            float t = uGravityWellProgress;
            vec3 expDir = normalize(orbitPos + vec3(0.01, 0.02, 0.03));
            
            // Violent outward force
            float blastForce = (35.0 + speed * 60.0) * sin(t * 1.57);
            finalPos = uGravityWellCenter + expDir * blastForce;
            
            vec3 hotColor = mix(vec3(1.0, 1.0, 1.0), vec3(1.0, 0.1, 0.6), speed);
            vColor = mix(vec3(1.0, 0.8, 0.0), hotColor, 1.0 - t);
          } 
          else if (uGravityWellState > 2.5 && uGravityWellState < 3.5) {
            // RECOVERY STATE (Return back to stable orbits)
            float t = uGravityWellProgress;
            vec3 expDir = normalize(orbitPos + vec3(0.01, 0.02, 0.03));
            float blastForce = (35.0 + speed * 60.0);
            vec3 blownPos = uGravityWellCenter + expDir * blastForce;
            
            finalPos = mix(blownPos, orbitPos, t);
            vColor = mix(vec3(0.0, 0.9, 1.0), vec3(1.0, 0.0, 0.6), speed);
          } 
          else {
            // NORMAL OPERATION (with cursor interaction)
            vec3 diff = orbitPos - uMouse3D;
            float dist = length(diff);
            if (dist < uMouseRadius) {
              float force = 1.0 - (dist / uMouseRadius);
              force = smoothstep(0.0, 1.0, force);
              
              vec3 swirlDir = cross(vec3(0.0, 1.0, 0.0), normalize(diff));
              finalPos += swirlDir * force * 5.0 * uSwipeInfluence;
              finalPos += normalize(diff) * force * 2.5 * uSwipeInfluence;
            }
            vColor = mix(vec3(0.0, 0.9, 1.0), vec3(1.0, 0.0, 0.6), speed);
          }

          vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          
          // Depth-based sizing
          gl_PointSize = (12.0 / -mvPosition.z) * (0.8 + speed * 0.6);
          if (uGravityWellState > 1.5 && uGravityWellState < 2.5) {
            gl_PointSize *= (1.0 + (1.0 - uGravityWellProgress) * 4.0);
          }
          
          vAlpha = smoothstep(35.0, 5.0, baseRadius);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          // Circular particle with soft radial fade
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;
          
          float strength = 1.0 - (dist * 2.0);
          strength = pow(strength, 1.5);
          
          gl_FragColor = vec4(vColor, strength * vAlpha);
        }
      `,
      uniforms: this.particleUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.particles = new THREE.Points(geometry, particleMat);
    this.scene.add(this.particles);
  }

  private setupMouseListener(): void {
    window.addEventListener('mousemove', (event) => {
      this.lastMouse.copy(this.mouse);
      
      // Calculate Normalized Device Coordinates (NDC)
      this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      
      // Compute rapid mouse speed for swirl influence
      this.mouseSpeed = Math.min(this.mouse.distanceTo(this.lastMouse) * 15.0, 1.0);
    });

    window.addEventListener('mousedown', () => {
      this.isMouseDown = true;
    });

    window.addEventListener('mouseup', () => {
      this.isMouseDown = false;
    });

    window.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        this.isMouseDown = true;
        this.lastMouse.set(
          (e.touches[0].clientX / window.innerWidth) * 2 - 1,
          -(e.touches[0].clientY / window.innerHeight) * 2 + 1
        );
        this.mouse.copy(this.lastMouse);
      }
    });

    window.addEventListener('touchend', () => {
      this.isMouseDown = false;
    });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        this.lastMouse.copy(this.mouse);
        this.mouse.x = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(e.touches[0].clientY / window.innerHeight) * 2 + 1;
        this.mouseSpeed = Math.min(this.mouse.distanceTo(this.lastMouse) * 15.0, 1.0);
      }
    });
  }

  public update(time: number, isExperienceActive: boolean = false): void {
    // Dynamically toggle grid bending/distortion when in EXPERIENCE mode
    this.gridUniforms.uDistortionStrength.value = isExperienceActive ? 0.0 : 2.5;

    // 1. Update timeline animations
    this.gridUniforms.uTime.value = time;
    this.particleUniforms.uTime.value = time;

    if (this.whirlpoolParticles && this.whirlpoolUniforms) {
      this.whirlpoolUniforms.uTime.value = time;
      // Gently rotate the whirlpool over time for extra dynamic motion
      this.whirlpoolParticles.rotation.z = time * 0.08;
    }
    
    // Decay mouse swipe speed influence smoothly
    this.particleUniforms.uSwipeInfluence.value = THREE.MathUtils.lerp(
      this.particleUniforms.uSwipeInfluence.value,
      0.2 + this.mouseSpeed * 0.8,
      0.08
    );
    this.mouseSpeed = THREE.MathUtils.lerp(this.mouseSpeed, 0, 0.05);

    // Magnify radius and influence if mouse is down (drag and ripple!)
    const targetRadius = this.isMouseDown ? 12.0 : 5.0;
    this.particleUniforms.uMouseRadius.value = THREE.MathUtils.lerp(
      this.particleUniforms.uMouseRadius.value,
      targetRadius,
      0.1
    );

    // 2. Perform projections to translate mouse cursor screen coordinates to 3D positions
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    // Project to floor plane (y = -4) for grid floor distortion
    const floorIntersection = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.floorPlane, floorIntersection)) {
      this.gridUniforms.uMouse.value.set(floorIntersection.x, floorIntersection.z);
    }
    
    // Project to central scene plane (z = 0) for particle nebula swiping
    const centerIntersection = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.centerPlane, centerIntersection)) {
      this.particleUniforms.uMouse3D.value.copy(centerIntersection);
    }
  }

  public dispose(): void {
    if (this.gridMesh) {
      this.scene.remove(this.gridMesh);
      this.gridMesh.geometry.dispose();
      (this.gridMesh.material as THREE.ShaderMaterial).dispose();
    }
    
    if (this.particles) {
      this.scene.remove(this.particles);
      this.particles.geometry.dispose();
      (this.particles.material as THREE.ShaderMaterial).dispose();
    }

    if (this.whirlpoolParticles) {
      this.scene.remove(this.whirlpoolParticles);
      this.whirlpoolParticles.geometry.dispose();
      (this.whirlpoolParticles.material as THREE.ShaderMaterial).dispose();
    }
  }
}
