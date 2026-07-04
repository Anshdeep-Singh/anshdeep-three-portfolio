import * as THREE from 'three';
import { BaseActor } from '../base/BaseActor';
import { gsap } from 'gsap';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class AboutActor extends BaseActor {
  private model: THREE.Object3D | null = null;
  private particleGroup!: THREE.Group;
  private mixer: THREE.AnimationMixer | null = null;
  private lastTime: number = 0;

  constructor() {
    super('about-showcase');
  }

  public setup(): void {
    // 1. Orbiting particles/dots group
    this.particleGroup = new THREE.Group();
    this.mesh.add(this.particleGroup);

    const dotGeo = new THREE.SphereGeometry(0.05, 8, 8);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xffdd88 });

    for (let i = 0; i < 15; i++) {
      const dot = new THREE.Mesh(dotGeo, dotMat);
      // Position dots in a sphere cluster
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 0.8 + Math.random() * 0.5;

      dot.position.x = r * Math.sin(phi) * Math.cos(theta);
      dot.position.y = r * Math.sin(phi) * Math.sin(theta);
      dot.position.z = r * Math.cos(phi);

      this.particleGroup.add(dot);
    }

    // 2. Load GLTF model
    const loader = new GLTFLoader();
    loader.load(
      'models/gltf/PrimaryIonDrive.glb',
      (gltf) => {
        console.log('AboutActor: PrimaryIonDrive.glb loaded successfully!');
        this.model = gltf.scene;

        // Scale and position the model inside our actor's group
        this.model.scale.set(0.35, 0.35, 0.35);
        this.model.position.set(0, 0, 0);

        // Add name and entityId so Raycaster works
        this.model.name = 'Creative Core';
        (this.model as any).entityId = 'about-core';

        // Traverse to add entityId to children for Raycaster/interaction
        this.model.traverse((child) => {
          (child as any).entityId = 'about-core';
        });

        this.mesh.add(this.model);

        // Setup animations if present
        if (gltf.animations && gltf.animations.length > 0) {
          this.mixer = new THREE.AnimationMixer(this.model);
          const clip = gltf.animations[0];
          this.mixer.clipAction(clip.optimize()).play();
        }
      },
      undefined,
      (error) => {
        console.error('AboutActor: Error loading gltf model', error);
      }
    );
  }

  public update(time: number): void {
    const dt = this.lastTime === 0 ? 0 : time - this.lastTime;
    this.lastTime = time;

    // Spin core if model loaded
    if (this.model) {
      this.model.rotation.y = time * 0.3;
      this.model.position.y = Math.sin(time * 2.0) * 0.05;
    }

    if (this.mixer) {
      this.mixer.update(dt);
    }

    // Spin particle cluster
    if (this.particleGroup) {
      this.particleGroup.rotation.y = -time * 0.2;
      this.particleGroup.rotation.x = time * 0.1;
    }
  }

  /**
   * Temporally deconstructs/reconstructs the About actor based on the active year slider.
   */
  public reconstruct(_year: number): void {
    const modelTargetScale = 0.35;
    const particlesTargetScale = 1.0;

    if (this.model) {
      gsap.to(this.model.scale, {
        x: modelTargetScale,
        y: modelTargetScale,
        z: modelTargetScale,
        duration: 1.5,
        ease: 'power2.out',
        overwrite: 'auto'
      });
    }

    if (this.particleGroup) {
      gsap.to(this.particleGroup.scale, {
        x: particlesTargetScale,
        y: particlesTargetScale,
        z: particlesTargetScale,
        duration: 1.5,
        ease: 'power2.out',
        overwrite: 'auto'
      });
    }
  }
}
