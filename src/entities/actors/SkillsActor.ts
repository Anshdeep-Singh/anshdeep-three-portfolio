import * as THREE from 'three';
import { BaseActor } from '../base/BaseActor';
import { gsap } from 'gsap';

// Import WebGL Fat Line / Wireframe extensions
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

interface WordOrbitData {
  axis: THREE.Vector3;
  u: THREE.Vector3;
  v: THREE.Vector3;
  radius: number;
  speed: number;
  phase: number;
}

interface LetterData {
  mesh: THREE.Mesh;
  char: string;
  wordIndex: number;
  color: number;
  
  // Assembled State (when forming the word)
  charOffsetAngle: number;
  unmergedScale: number;
  assembledScale: number;
  letterCenterX: number; // For centering highlighted words on screen
  
  // Orbit State (when revolving randomly)
  orbitRadius: number;
  orbitSpeed: number;
  orbitAxis: THREE.Vector3;
  orbitPhase: number; // current angle
}

export class SkillsActor extends BaseActor {
  private nodes: THREE.Object3D[] = []; // Nucleus is index 0
  
  // Word Satellite Orbits
  private wordOrbits: WordOrbitData[] = [];
  
  // Letters
  private letters: LetterData[] = [];
  private fontLoaded: boolean = false;
  private fontLoader = new FontLoader();

  // Reconstruction and scale animation states
  private radiusMultiplier: { value: number } = { value: 1.0 };
  private orbitRadiusContract: { value: number } = { value: 1.0 };

  // Materials list to update resolution dynamically
  private lineMaterials: LineMaterial[] = [];

  // Animation State Machine for Skills Tab
  private animationState: 'inactive' | 'revolving_normal' | 'showcasing' | 'spinning_violently' | 'assembled' | 'exploding' = 'inactive';
  private nucleusScaleMultiplier: { value: number } = { value: 0.0 };
  private speedMultiplier: { value: number } = { value: 1.0 };
  private wordProgresses: number[] = [0, 0, 0, 0, 0]; // 0 = orbit, 1 = showcased, 2 = sphere orbit
  private lastTime: number = 0;
  private isSkillsActive: boolean = false;

  // Particle explosion effects
  private explosionParticles!: THREE.Points;
  private particleVelocities!: Float32Array;
  private particleColors!: Float32Array; 
  private explosionProgress: { value: number } = { value: 0.0 };

  constructor() {
    super('skills-showcase');
  }

  public setup(): void {
    // ----------------------------------------------------
    // 1. Create the Central Nucleus (Sphere)
    // ----------------------------------------------------
    const nucleusGeometry = new THREE.SphereGeometry(1, 32, 32);
    
    // Create a dynamic-looking material for the sphere
    const nucleusMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      transparent: true,
      opacity: 0.2
    });

    const nucleus = new THREE.Mesh(nucleusGeometry, nucleusMaterial);
    nucleus.scale.set(0.05, 0.05, 0.05); // Will be animated
    nucleus.name = 'Nucleus Core';
    (nucleus as any).entityId = 'skills-core';

    this.mesh.add(nucleus);
    this.nodes.push(nucleus);

    // ----------------------------------------------------
    // 2. Load Font & Setup 3D Letters
    // ----------------------------------------------------
    this.fontLoader.load('./fonts/helvetiker_bold.typeface.json', (font) => {
      this.fontLoaded = true;
      this.setupLetters(font);
    });

    // ----------------------------------------------------
    // 3. Setup Explosion Particles
    // ----------------------------------------------------
    const particleCount = 800;
    const pPositions = new Float32Array(particleCount * 3);
    const pColors = new Float32Array(particleCount * 3);
    this.particleVelocities = new Float32Array(particleCount * 3);
    this.particleColors = new Float32Array(particleCount * 3);

    const palette = [
      new THREE.Color(0x00ffcc),
      new THREE.Color(0xffcc00),
      new THREE.Color(0xff3366),
      new THREE.Color(0x3399ff),
      new THREE.Color(0x9933ff)
    ];

    for (let i = 0; i < particleCount; i++) {
      pPositions[i * 3] = 0;
      pPositions[i * 3 + 1] = 0;
      pPositions[i * 3 + 2] = 0;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      const speed = 1.5 + Math.random() * 6.5;

      this.particleVelocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
      this.particleVelocities[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * speed;
      this.particleVelocities[i * 3 + 2] = Math.cos(phi) * speed;

      const color = palette[Math.floor(Math.random() * palette.length)];
      pColors[i * 3] = color.r;
      pColors[i * 3 + 1] = color.g;
      pColors[i * 3 + 2] = color.b;

      this.particleColors[i * 3] = color.r;
      this.particleColors[i * 3 + 1] = color.g;
      this.particleColors[i * 3 + 2] = color.b;
    }

    const pGeometry = new THREE.BufferGeometry();
    pGeometry.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    pGeometry.setAttribute('color', new THREE.BufferAttribute(pColors, 3));

    const pMaterial = new THREE.PointsMaterial({
      size: 0.18,
      vertexColors: true,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    });

    this.explosionParticles = new THREE.Points(pGeometry, pMaterial);
    this.mesh.add(this.explosionParticles);

    this.updateResolution();
    window.addEventListener('resize', this.onResize);
  }

  private setupLetters(font: any) {
    const skillNames = [
      'DESIGN',
      'DEVELOPMENT',
      'INNOVATION',
      'CREATION',
    ];
    const colors = [0x00cca3, 0xcca300, 0xcc2954, 0x298acc, 0x8029cc];

    // Calculate base radius depending on window size for responsiveness
    const isMobile = window.innerWidth <= 768;
    const letterScale = isMobile ? 0.12 : 0.2; // scale of letters
    
    // Scale entire container slightly to fit better on mobile
    if (isMobile) {
      this.mesh.scale.set(0.7, 0.7, 0.7);
    } else {
      this.mesh.scale.set(1.0, 1.0, 1.0);
    }

    // Initialize satellite orbit details for each word
    this.wordOrbits = skillNames.map((_, wordIndex) => {
      // Create random unique orbit plane
      let axis = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      ).normalize();
      
      if (axis.lengthSq() === 0) {
        axis.set(0, 1, 0);
      }

      // Generate in-plane vectors u and v
      const u = new THREE.Vector3();
      if (Math.abs(axis.y) < 0.9) {
        u.set(0, 1, 0).cross(axis).normalize();
      } else {
        u.set(1, 0, 0).cross(axis).normalize();
      }
      const v = new THREE.Vector3().copy(axis).cross(u).normalize();

      const orbitRadiusBase = isMobile ? 0.95 : 1.35;
      // Stagger radius slightly so words orbit at different heights
      const radius = orbitRadiusBase + (wordIndex * 0.12) + (Math.random() * 0.08);

      return {
        axis,
        u,
        v,
        radius,
        speed: 0.5 + Math.random() * 0.5, // orbit speed
        phase: Math.random() * Math.PI * 2
      };
    });

    skillNames.forEach((word, wordIndex) => {
      const color = colors[wordIndex];
      // Solid bright material for readability instead of wireframe
      const wordMaterial = new THREE.MeshBasicMaterial({ 
        color: color,
        transparent: true,
        opacity: 1.0,
        side: THREE.DoubleSide
      });

      // Calculate total width of the word for centering
      let totalWidth = 0;
      const letterGeos: THREE.BufferGeometry[] = [];
      const letterWidths: number[] = [];

      for (let i = 0; i < word.length; i++) {
        if (word[i] === ' ') {
          letterGeos.push(new THREE.BufferGeometry());
          letterWidths.push(0.3); // space width
          totalWidth += 0.3;
          continue;
        }

        const geometry = new TextGeometry(word[i], {
          font: font,
          size: 1,
          depth: 0.2,
          curveSegments: 2,
          bevelEnabled: false
        });
        
        geometry.computeBoundingBox();
        const bbox = geometry.boundingBox!;
        const width = bbox.max.x - bbox.min.x;
        
        // Center geometry
        geometry.translate(- (bbox.max.x + bbox.min.x) / 2, - (bbox.max.y + bbox.min.y) / 2, - (bbox.max.z + bbox.min.z) / 2);
        
        letterGeos.push(geometry);
        letterWidths.push(width + 0.1); // add kerning
        totalWidth += width + 0.1;
      }

      // Assemble word
      let currentX = -totalWidth / 2;
      const orbit = this.wordOrbits[wordIndex];
      // Reduce the size of the words in the assembled stage!
      const assembledScale = letterScale * 0.55;

      for (let i = 0; i < word.length; i++) {
        if (word[i] === ' ') {
          currentX += letterWidths[i];
          continue;
        }

        const charMaterial = wordMaterial.clone();
        const mesh = new THREE.Mesh(letterGeos[i], charMaterial);
        mesh.scale.set(letterScale, letterScale, letterScale);

        // Calculate angular offset along the orbital circle of radius `orbit.radius`
        // We use the assembled scale to determine correct letter-to-letter spacing on the curve!
        const letterCenterX = currentX + letterWidths[i] / 2;
        const charOffsetAngle = (letterCenterX * assembledScale) / orbit.radius;

        this.mesh.add(mesh);
        this.nodes.push(mesh);

        // Orbit initialization
        const axis = new THREE.Vector3(
          Math.random() - 0.5,
          Math.random() - 0.5,
          Math.random() - 0.5
        ).normalize();

        this.letters.push({
          mesh,
          char: word[i],
          wordIndex,
          color,
          charOffsetAngle,
          unmergedScale: letterScale,
          assembledScale,
          letterCenterX,
          orbitRadius: 0.5 + Math.random() * 2.5,
          orbitSpeed: 1.5 + Math.random() * 1.5,
          orbitAxis: axis,
          orbitPhase: Math.random() * Math.PI * 2
        });

        currentX += letterWidths[i];
      }
    });

    // Start in proper visual state if already activated
    if (this.isSkillsActive && this.animationState === 'inactive') {
      this.resetToState('revolving_normal');
    }
  }

  private triggerExplosion(): void {
    const positions = this.explosionParticles.geometry.attributes.position.array as Float32Array;
    const colors = this.explosionParticles.geometry.attributes.color.array as Float32Array;
    for (let i = 0; i < positions.length / 3; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;

      colors[i * 3] = this.particleColors[i * 3];
      colors[i * 3 + 1] = this.particleColors[i * 3 + 1];
      colors[i * 3 + 2] = this.particleColors[i * 3 + 2];
    }
    this.explosionParticles.geometry.attributes.position.needsUpdate = true;
    this.explosionParticles.geometry.attributes.color.needsUpdate = true;

    const pMaterial = this.explosionParticles.material as THREE.PointsMaterial;
    pMaterial.opacity = 1.0;
    pMaterial.size = 0.24; 

    this.explosionProgress.value = 0.0;
    gsap.to(this.explosionProgress, {
      value: 1.0,
      duration: 1.8,
      ease: 'power3.out',
      overwrite: 'auto',
      onUpdate: () => {
        const pos = this.explosionParticles.geometry.attributes.position.array as Float32Array;
        const cols = this.explosionParticles.geometry.attributes.color.array as Float32Array;
        const progress = this.explosionProgress.value;

        for (let i = 0; i < pos.length / 3; i++) {
          const drag = Math.pow(0.92, progress * 24);
          pos[i * 3] = this.particleVelocities[i * 3] * progress * drag * 2.5;
          pos[i * 3 + 1] = this.particleVelocities[i * 3 + 1] * progress * drag * 2.5;
          pos[i * 3 + 2] = this.particleVelocities[i * 3 + 2] * progress * drag * 2.5;

          const cIndex = i * 3;
          cols[cIndex] = THREE.MathUtils.lerp(this.particleColors[cIndex], 0.3, progress);
          cols[cIndex + 1] = THREE.MathUtils.lerp(this.particleColors[cIndex + 1], 0.0, progress);
          cols[cIndex + 2] = THREE.MathUtils.lerp(this.particleColors[cIndex + 2], 0.6, progress);
        }
        this.explosionParticles.geometry.attributes.position.needsUpdate = true;
        this.explosionParticles.geometry.attributes.color.needsUpdate = true;
      }
    });

    gsap.to(pMaterial, {
      opacity: 0.0,
      duration: 1.8,
      ease: 'power3.out',
      overwrite: 'auto'
    });
  }

  private onResize = () => {
    this.updateResolution();
  };

  private updateResolution() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.lineMaterials.forEach((mat) => {
      mat.resolution.set(width, height);
    });
  }

  public setSkillsActive(active: boolean): void {
    this.isSkillsActive = active;
    if (active) {
      this.lastTime = 0;
      this.resetToState('revolving_normal');
    } else {
      this.resetToState('inactive');
    }
  }

  private resetToState(state: typeof this.animationState): void {
    this.animationState = state;
    gsap.killTweensOf(this.radiusMultiplier);
    gsap.killTweensOf(this.orbitRadiusContract);
    gsap.killTweensOf(this.nucleusScaleMultiplier);
    gsap.killTweensOf(this.speedMultiplier);
    gsap.killTweensOf(this.explosionProgress);
    for (let i = 0; i < 5; i++) {
      gsap.killTweensOf(this.wordProgresses, `[${i}]`);
    }

    if (state === 'inactive') {
      this.nucleusScaleMultiplier.value = 0.0;
      this.radiusMultiplier.value = 1.0;
      this.orbitRadiusContract.value = 1.0;
      this.speedMultiplier.value = 1.0;
      this.wordProgresses = [0, 0, 0, 0, 0];
      
      this.letters.forEach(l => {
        l.mesh.visible = true; // Stay visible and orbit in background
      });
    } else if (state === 'revolving_normal') {
      this.nucleusScaleMultiplier.value = 0.0;
      this.radiusMultiplier.value = 1.0;
      this.orbitRadiusContract.value = 1.0;
      this.speedMultiplier.value = 1.0;
      this.wordProgresses = [0, 0, 0, 0, 0];

      this.letters.forEach(l => {
        l.mesh.visible = true;
      });
      
      // Wait before triggering showcase sequence
      gsap.delayedCall(4.0, () => {
        if (this.isSkillsActive && this.animationState === 'revolving_normal') {
          this.transitionTo('showcasing');
        }
      });
    }
  }

  private transitionTo(nextState: typeof this.animationState): void {
    if (!this.isSkillsActive && nextState !== 'inactive') return;
    
    this.animationState = nextState;

    if (nextState === 'showcasing') {
      // Nucleus slightly forms as gravity effect starts
      gsap.to(this.nucleusScaleMultiplier, {
        value: 1.5,
        duration: 3.0,
        ease: 'power2.out'
      });

      // Reset word progresses
      this.wordProgresses = [0, 0, 0, 0, 0];

      // Start sequential showcase from index 0
      this.showcaseWord(0);

    } else if (nextState === 'spinning_violently') {
      // Spin extremely fast and compress the orbits into a tight vortex
      gsap.to(this.speedMultiplier, {
        value: 12.0,
        duration: 2.8,
        ease: 'power2.in'
      });

      gsap.to(this.orbitRadiusContract, {
        value: 0.65,
        duration: 2.8,
        ease: 'power2.inOut'
      });

      gsap.to(this.nucleusScaleMultiplier, {
        value: 2.8,
        duration: 2.8,
        ease: 'power2.in'
      });

      gsap.delayedCall(2.8, () => {
        if (this.isSkillsActive && this.animationState === 'spinning_violently') {
          this.transitionTo('exploding');
        }
      });

    } else if (nextState === 'assembled') {
      // Fallback assembled state (if needed, but spinning_violently replaces its primary delayed progression)
      gsap.to(this.nucleusScaleMultiplier, {
        value: 2.0,
        duration: 1.0,
        ease: 'elastic.out(1, 0.5)'
      });

      gsap.delayedCall(5.0, () => {
        if (this.isSkillsActive && this.animationState === 'assembled') {
          this.transitionTo('exploding');
        }
      });
    } else if (nextState === 'exploding') {
      // Explode nucleus and words back to random orbits
      this.triggerExplosion();

      gsap.to(this.nucleusScaleMultiplier, {
        value: 0.0,
        duration: 0.5,
        ease: 'power3.in'
      });

      gsap.to(this.orbitRadiusContract, {
        value: 1.0,
        duration: 1.0,
        ease: 'power3.out'
      });

      this.speedMultiplier.value = 10.0;
      gsap.to(this.speedMultiplier, {
        value: 1.0,
        duration: 3.0,
        ease: 'power2.out'
      });

      for (let i = 0; i < 5; i++) {
        gsap.to(this.wordProgresses, {
          [i]: 0.0,
          duration: 2.0,
          ease: 'power3.out'
        });
      }

      gsap.delayedCall(2.0, () => {
        if (this.isSkillsActive) {
          // Re-assign random phases so they keep shifting
          this.letters.forEach(l => l.orbitPhase = Math.random() * Math.PI * 2);
          this.resetToState('revolving_normal');
        }
      });
    }
  }

  private showcaseWord(idx: number): void {
    if (!this.isSkillsActive || this.animationState !== 'showcasing') return;

    if (idx >= 4) {
      this.transitionTo('spinning_violently');
      return;
    }

    // 1. Animate word to screen showcase position (merge to flat readable state)
    gsap.to(this.wordProgresses, {
      [idx]: 1.0,
      duration: 1.2,
      ease: 'power2.out',
      onComplete: () => {
        if (!this.isSkillsActive || this.animationState !== 'showcasing') return;

        // 2. Stay on screen so user can read it
        gsap.delayedCall(2.0, () => {
          if (!this.isSkillsActive || this.animationState !== 'showcasing') return;

          // 3. Move from screen showcase to sphere orbit
          gsap.to(this.wordProgresses, {
            [idx]: 2.0,
            duration: 1.2,
            ease: 'power2.inOut'
          });

          // Stagger the next word start slightly before current finishes going away
          gsap.delayedCall(0.5, () => {
            this.showcaseWord(idx + 1);
          });
        });
      }
    });
  }

  public update(time: number): void {
    if (this.lastTime === 0) {
      this.lastTime = time;
    }
    const dt = time - this.lastTime;
    this.lastTime = time;

    if (!this.isSkillsActive && this.animationState !== 'inactive') {
      this.resetToState('inactive');
      return;
    }
    
    if (!this.fontLoaded) {
      return;
    }

    // Slow elegant rotation of the entire actor on the Y-axis when active
    if (this.isSkillsActive) {
      this.mesh.rotation.y = time * 0.35;
    } else {
      this.mesh.rotation.y = 0;
    }

    // 1. Update Nucleus
    if (this.nodes[0]) {
      this.nodes[0].rotation.y = time * 0.4;
      this.nodes[0].rotation.x = time * 0.2;
      const coreScale = this.nucleusScaleMultiplier.value;
      this.nodes[0].scale.set(0.5 * coreScale, 0.5 * coreScale, 0.5 * coreScale);
    }

    // Advance word-level satellite orbits
    this.wordOrbits.forEach((orbit) => {
      orbit.phase += dt * orbit.speed * this.speedMultiplier.value;
    });

    // 2. Update Letters
    this.letters.forEach((letter) => {
      // Advance random orbit phase
      letter.orbitPhase += dt * letter.orbitSpeed * this.speedMultiplier.value;

      // Calculate pure orbit position
      const orbitPos = new THREE.Vector3(letter.orbitRadius, 0, 0);
      orbitPos.applyAxisAngle(letter.orbitAxis, letter.orbitPhase);
      
      // Calculate pure orbit rotation (wild spinning)
      const orbitRot = new THREE.Euler(
        time * letter.orbitSpeed * 2, 
        time * letter.orbitSpeed * 3, 
        time * letter.orbitSpeed
      );

      // Get corresponding word orbit and calculate satellite curved position/orientation
      const orbit = this.wordOrbits[letter.wordIndex];
      const angle = orbit.phase + letter.charOffsetAngle;

      const dynamicRadius = orbit.radius * this.orbitRadiusContract.value;
      const assembledPos = new THREE.Vector3()
        .copy(orbit.u).multiplyScalar(dynamicRadius * Math.cos(angle))
        .addScaledVector(orbit.v, dynamicRadius * Math.sin(angle));

      // Construct orientation: local Z faces radially outward, local X aligns with orbit tangent, local Y matches orbit normal
      const normal = assembledPos.clone().normalize();
      const tangent = new THREE.Vector3()
        .copy(orbit.u).multiplyScalar(-Math.sin(angle))
        .addScaledVector(orbit.v, Math.cos(angle))
        .normalize();
      const up = new THREE.Vector3().crossVectors(tangent, normal).normalize();

      const m = new THREE.Matrix4().makeBasis(tangent, up, normal);
      const assembledRot = new THREE.Quaternion().setFromRotationMatrix(m);

      // Interpolation logic for sequential showcase
      const progress = this.wordProgresses[letter.wordIndex];
      const currentPos = new THREE.Vector3();
      const currentRot = new THREE.Quaternion();
      let currentScale = letter.unmergedScale;

      const showcaseScale = letter.unmergedScale * 1.35;
      
      const isMobile = window.innerWidth <= 768;
      // On mobile, keep it closer to the sphere (further from camera) to fit portrait screens perfectly
      const distFromSphere = isMobile ? 1.7 : 3.1;
      
      // Calculate showcase position in front of the camera, accounting for camera's 0.3 rad Y-rotation offset
      const showcasePos = new THREE.Vector3(letter.letterCenterX * showcaseScale, 0.0, distFromSphere);
      // Rotate by 0.3 rad to align with camera's diagonal angle, then counteract parent rotation
      showcasePos.applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.3);
      showcasePos.applyAxisAngle(new THREE.Vector3(0, 1, 0), -this.mesh.rotation.y);
      
      // Rotate text by 0.3 rad to face camera perfectly, then counteract parent rotation
      const showcaseRot = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.3 - this.mesh.rotation.y, 0));

      if (progress === 0) {
        currentPos.copy(orbitPos);
        currentRot.setFromEuler(orbitRot);
        currentScale = letter.unmergedScale;
      } else if (progress <= 1) {
        // Orbit to Showcase position
        const t = progress;
        currentPos.lerpVectors(orbitPos, showcasePos, t);

        const qOrbit = new THREE.Quaternion().setFromEuler(orbitRot);
        currentRot.copy(qOrbit).slerp(showcaseRot, t);

        currentScale = THREE.MathUtils.lerp(letter.unmergedScale, showcaseScale, t);
      } else if (progress <= 2) {
        // Showcase to Assembled position
        const t = progress - 1;
        currentPos.lerpVectors(showcasePos, assembledPos, t);

        currentRot.copy(showcaseRot).slerp(assembledRot, t);

        currentScale = THREE.MathUtils.lerp(showcaseScale, letter.assembledScale, t);
      } else {
        // Fully assembled and orbiting
        currentPos.copy(assembledPos);
        currentRot.copy(assembledRot);
        currentScale = letter.assembledScale;
      }

      letter.mesh.position.copy(currentPos);
      letter.mesh.quaternion.copy(currentRot);
      letter.mesh.scale.set(currentScale, currentScale, currentScale);

      // Calculate world position to determine depth relative to cylinder center
      const worldPos = new THREE.Vector3();
      letter.mesh.getWorldPosition(worldPos);

      // relativeZ is the distance in front of (positive) or behind (negative) the cylinder center
      const relativeZ = worldPos.z - this.mesh.position.z;

      // Map relativeZ to opacity: fade out completely on the back side of the cylinder
      // But if showcased, force full opacity so it's perfectly visible
      let opacity = 1.0;
      if (progress < 0.1 || progress > 1.9) {
        const fadeStart = -1.0;
        const fadeEnd = 1.5;
        opacity = (relativeZ - fadeStart) / (fadeEnd - fadeStart);
        opacity = Math.max(0.0, Math.min(1.0, opacity));
      }

      if (letter.mesh.material) {
        (letter.mesh.material as THREE.Material).opacity = opacity;
        (letter.mesh.material as THREE.Material).transparent = true;
      }
    });
  }

  public reconstruct(_year: number): void {
    // Left for interface compatibility
  }

  public getNodes(): THREE.Object3D[] {
    return this.nodes;
  }

  public dispose(): void {
    window.removeEventListener('resize', this.onResize);
    super.dispose();
  }
}
