import * as THREE from 'three';
import { BaseActor } from '../base/BaseActor';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

interface ParticlePerson {
  mesh: THREE.Points;
  geometry: THREE.BufferGeometry;
  positions: THREE.BufferAttribute;
  initialPositions: Float32Array;
  direction: number; // -1: falling down/vanishing, 1: rising up/assembling, 0: idle/start delay
  verticesDown: number;
  verticesUp: number;
  speed: number;
  delay: number;
  start: number;
  scale: number;
  color: THREE.Color;
}

export class BackgroundPeopleActor extends BaseActor {
  private people: ParticlePerson[] = [];
  private loader: OBJLoader;
  private geometries: THREE.BufferAttribute[] = [];
  private isLoaded: boolean = false;

  // Neo cyberpunk color schemes matching the portfolio website
  private cyberColors = [
    new THREE.Color(0x00f0ff), // Neon Cyan
    new THREE.Color(0xff007f), // Neon Magenta
    new THREE.Color(0x7000ff), // Neon Purple
    new THREE.Color(0x00ffaa), // Neon Green
    new THREE.Color(0xffaa00)  // Neon Amber/Orange
  ];

  constructor() {
    super('background-people');
    this.loader = new OBJLoader();
  }

  /**
   * Initialize and load the OBJ files, then setup the background figures
   */
  public setup(): void {
    const maleUrl = 'models/obj/male02/male02.obj';
    const femaleUrl = 'models/obj/female02/female02.obj';

    let maleAttr: THREE.BufferAttribute | null = null;
    let femaleAttr: THREE.BufferAttribute | null = null;

    const checkAndInit = () => {
      if (maleAttr && femaleAttr) {
        this.geometries = [maleAttr, femaleAttr];
        this.createBackgroundPeople();
        this.isLoaded = true;
      }
    };

    // Load male model
    this.loader.load(
      maleUrl,
      (object) => {
        maleAttr = this.combineBuffer(object, 'position');
        checkAndInit();
      },
      undefined,
      (error) => console.error('BackgroundPeopleActor: Error loading male model', error)
    );

    // Load female model
    this.loader.load(
      femaleUrl,
      (object) => {
        femaleAttr = this.combineBuffer(object, 'position');
        checkAndInit();
      },
      undefined,
      (error) => console.error('BackgroundPeopleActor: Error loading female model', error)
    );
  }

  /**
   * Extracts vertices array from loaded OBJ meshes and combines them into a BufferAttribute
   */
  private combineBuffer(model: THREE.Object3D, bufferName: string): THREE.BufferAttribute {
    let count = 0;

    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const buffer = child.geometry.attributes[bufferName];
        if (buffer) {
          count += buffer.array.length;
        }
      }
    });

    const combined = new Float32Array(count);
    let offset = 0;

    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const buffer = child.geometry.attributes[bufferName];
        if (buffer) {
          combined.set(buffer.array, offset);
          offset += buffer.array.length;
        }
      }
    });

    return new THREE.BufferAttribute(combined, 3);
  }

  /**
   * Spawns 4 to 6 (we will spawn exactly 5) people scattered randomly in the background
   */
  private createBackgroundPeople(): void {
    const numPeople = 5;

    for (let i = 0; i < numPeople; i++) {
      // Pick random geometry (male/female)
      const baseAttr = this.geometries[Math.floor(Math.random() * this.geometries.length)];
      
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', baseAttr.clone());
      geometry.setAttribute('initialPosition', baseAttr.clone());
      
      const posAttr = geometry.attributes.position as THREE.BufferAttribute;
      if (posAttr && typeof posAttr.setUsage === 'function') {
        posAttr.setUsage(THREE.DynamicDrawUsage);
      }

      // Compute bounding box to align feet with the grid floor dynamically
      geometry.computeBoundingBox();
      const minY = geometry.boundingBox ? geometry.boundingBox.min.y : -95;

      // Random color
      const color = this.cyberColors[Math.floor(Math.random() * this.cyberColors.length)].clone();

      // Cyber aesthetic points material: transparent, sharp, subtle, avoiding bloom blowouts
      const material = new THREE.PointsMaterial({
        color: color,
        size: 0.015, // Extremely small point size to show actual humanoid shape/mesh detail
        transparent: true,
        opacity: 0.28, // Subtle background opacity
        depthWrite: false,
        blending: THREE.NormalBlending // Normal blending to prevent overlapping points from adding up to white-hot glow
      });

      const mesh = new THREE.Points(geometry, material);
      
      // Random scale (the default OBJ models are quite large, so we scale down)
      const scale = 0.008 + Math.random() * 0.007; // Scale down significantly to fit background nicely
      mesh.scale.set(scale, scale, scale);

      // Random position in background bounds (feet touching the grid floor at y = -4)
      const pos = this.getRandomBackgroundPosition(scale, minY);
      mesh.position.copy(pos);

      // Random initial rotation
      mesh.rotation.y = Math.random() * Math.PI * 2;

      // Add to group
      this.mesh.add(mesh);

      // Setup anim state
      const positions = geometry.attributes.position as THREE.BufferAttribute;
      const initialPositions = (geometry.attributes.initialPosition as THREE.BufferAttribute).array as Float32Array;

      this.people.push({
        mesh: mesh,
        geometry: geometry,
        positions: positions,
        initialPositions: new Float32Array(initialPositions),
        direction: 0,
        verticesDown: 0,
        verticesUp: 0,
        speed: 12 + Math.random() * 8, // Randomized transition speed
        delay: Math.floor(100 + 150 * Math.random()), // Delay before starting next phase
        start: Math.floor(10 + 200 * Math.random()), // Staggered initial starts
        scale: scale,
        color: color
      });
    }
  }

  /**
   * Helper to compute a random position in the canvas background bounds with feet aligned to the grid floor
   */
  private getRandomBackgroundPosition(scale: number, minY: number): THREE.Vector3 {
    const meshY = -4.0 - minY * scale;
    return new THREE.Vector3(
      (Math.random() - 0.5) * 60, // x: -30 to 30 (wider coverage)
      meshY,                     // y: aligned perfectly with the grid plane at -4.0
      -40 + Math.random() * 55    // z: -40 to 15 (scattered randomly across front and back)
    );
  }

  /**
   * Update animation loop called per frame
   */
  public update(_time: number): void {
    if (!this.isLoaded) return;

    // Use a fixed delta scaled to our standard timing
    const delta = 0.15; 

    this.people.forEach((person) => {
      // Rotation
      person.mesh.rotation.y += 0.004 * person.speed * delta;

      const positions = person.positions;
      const initialArray = person.initialPositions;
      const count = positions.count;

      if (person.start > 0) {
        person.start -= 1;
        return;
      }

      if (person.direction === 0) {
        person.direction = -1; // Start by dissolving/vanishing
      }

      // Process particles
      if (person.direction < 0) {
        // DISPERSING / VANISHING STATE
        // Smoothly fade out opacity
        const mat = person.mesh.material as THREE.PointsMaterial;
        mat.opacity = Math.max(0, mat.opacity - 0.015 * person.speed * delta);

        for (let i = 0; i < count; i++) {
          positions.setXYZ(
            i,
            positions.getX(i) + (0.5 - Math.random()) * 4.0 * person.speed * delta,
            positions.getY(i) + (0.5 - Math.random()) * 4.0 * person.speed * delta,
            positions.getZ(i) + (0.5 - Math.random()) * 4.0 * person.speed * delta
          );
        }
        person.verticesDown += Math.ceil(count / 50); // Progress timer
      } else if (person.direction > 0) {
        // ASSEMBLING / MATERIALIZING STATE
        // Smoothly fade in opacity
        const mat = person.mesh.material as THREE.PointsMaterial;
        mat.opacity = Math.min(0.28, mat.opacity + 0.015 * person.speed * delta);

        for (let i = 0; i < count; i++) {
          const px = positions.getX(i);
          const py = positions.getY(i);
          const pz = positions.getZ(i);

          const ix = initialArray[i * 3];
          const iy = initialArray[i * 3 + 1];
          const iz = initialArray[i * 3 + 2];

          const dx = Math.abs(px - ix);
          const dy = Math.abs(py - iy);
          const dz = Math.abs(pz - iz);

          const d = dx + dy + dz;

          if (d > 0.05) {
            // Smooth lerp back to original position
            positions.setXYZ(
              i,
              px - (px - ix) * 0.08 * person.speed * delta,
              py - (py - iy) * 0.08 * person.speed * delta,
              pz - (pz - iz) * 0.08 * person.speed * delta
            );
          } else {
            // Lock to original position
            positions.setXYZ(i, ix, iy, iz);
            person.verticesUp += 1;
          }
        }
      }

      positions.needsUpdate = true;

      // Handle transitions
      if (person.direction < 0 && person.verticesDown >= count * 0.65) {
        // Once 65% of vertices are fully dissolved/dispersed below limit, count as fully vanished
        if (person.delay <= 0) {
          // TELEPORT to a new random background coordinate!
          const minY = person.geometry.boundingBox ? person.geometry.boundingBox.min.y : -95;
          const newPos = this.getRandomBackgroundPosition(person.scale, minY);
          person.mesh.position.copy(newPos);
          person.mesh.rotation.y = Math.random() * Math.PI * 2;

          // Change color randomly for the new appearance
          const newColor = this.cyberColors[Math.floor(Math.random() * this.cyberColors.length)].clone();
          const mat = person.mesh.material as THREE.PointsMaterial;
          mat.color.copy(newColor);
          mat.opacity = 0; // Start fully transparent

          // Reset vertices for reassembly
          person.direction = 1; // Materialize
          person.verticesDown = 0;
          person.verticesUp = 0;
          person.delay = Math.floor(150 + 200 * Math.random()); // Materialized idle time
        } else {
          person.delay -= 1;
        }
      } else if (person.direction > 0 && person.verticesUp >= count * 0.95) {
        // Once 95% of vertices are assembled, count as fully materialized
        if (person.delay <= 0) {
          person.direction = -1; // Dissolve again
          person.verticesDown = 0;
          person.verticesUp = 0;
          person.delay = Math.floor(80 + 100 * Math.random()); // Vanished delay
        } else {
          person.delay -= 1;
        }
      }
    });
  }

  /**
   * Cleanup resource allocations
   */
  public dispose(): void {
    this.people.forEach((person) => {
      this.mesh.remove(person.mesh);
      person.geometry.dispose();
      (person.mesh.material as THREE.PointsMaterial).dispose();
    });
    this.people = [];
    this.isLoaded = false;
  }
}
