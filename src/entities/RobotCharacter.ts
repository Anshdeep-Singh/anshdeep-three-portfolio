import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class RobotCharacter {
  public mesh: THREE.Group;
  
  private mixer?: THREE.AnimationMixer;
  private actions: { [name: string]: THREE.AnimationAction } = {};
  private activeAction?: THREE.AnimationAction;
  private activeActionName: string = '';

  constructor() {
    this.mesh = new THREE.Group();
    this.mesh.name = 'CyberRobotCharacter';
    this.loadModel();
  }

  private currentOpacity: number = 1.0;

  private loadModel(): void {
    const loader = new GLTFLoader();
    loader.load(
      'models/gltf/RobotExpressive/RobotExpressive.glb',
      (gltf) => {
        const model = gltf.scene;
        
        // 1. Scale to 20% (0.2) as requested (double of previous 10%)
        model.scale.set(0.2, 0.2, 0.2);

        // 2. Rotate by 180 degrees (Math.PI) so walking direction is facing forward
        model.rotation.y = Math.PI;

        // Enable shadows and adjust materials glow/brightness/transparency
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            if (child.material) {
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              mats.forEach((mat) => {
                if (mat instanceof THREE.MeshStandardMaterial) {
                  mat.roughness = Math.min(mat.roughness, 0.45);
                  mat.metalness = Math.min(mat.metalness, 0.4);
                  // Soft, reduced emissive glow
                  if (mat.color) {
                    mat.emissive.copy(mat.color).multiplyScalar(0.075);
                  }
                  // Default transparency matched to current opacity setting
                  mat.transparent = this.currentOpacity < 1.0;
                  mat.opacity = this.currentOpacity;
                }
              });
            }
          }
        });

        // Add model to our group
        this.mesh.add(model);

        // 3. Add a dedicated light positioned in front and slightly above (overhead) the robot.
        // Placing it at negative Z (e.g. -0.5) puts it in front of the robot face rather than on its back,
        // avoiding any "flashlight from behind" look.
        const localLight = new THREE.PointLight(0xffffff, 2.0, 4.0);
        localLight.position.set(0, 1.0, -0.5); 
        this.mesh.add(localLight);

        // Setup Mixer
        this.mixer = new THREE.AnimationMixer(model);

        // Setup Actions
        const states = ['Idle', 'Walking', 'Running', 'Dance', 'Death', 'Sitting', 'Standing'];
        const emotes = ['Jump', 'Yes', 'No', 'Wave', 'Punch', 'ThumbsUp'];

        gltf.animations.forEach((clip) => {
          const action = this.mixer!.clipAction(clip);
          this.actions[clip.name] = action;

          if (emotes.includes(clip.name) || states.indexOf(clip.name) >= 4) {
            action.clampWhenFinished = true;
            action.loop = THREE.LoopOnce;
          }
        });

        // Play initial Idle animation
        if (this.actions['Idle']) {
          this.activeAction = this.actions['Idle'];
          this.activeActionName = 'Idle';
          this.activeAction.play();
        }
      },
      undefined,
      (error) => {
        console.error('RobotCharacter: Failed to load RobotExpressive.glb:', error);
      }
    );
  }

  /**
   * Updates animations based on walking/running/jumping states.
   */
  public update(dt: number, state: 'Idle' | 'Walking' | 'Running' | 'Jumping'): void {
    // Map character states to model animation names
    let targetActionName = 'Idle';
    if (state === 'Walking') {
      targetActionName = 'Walking';
    } else if (state === 'Running') {
      targetActionName = 'Running';
    } else if (state === 'Jumping') {
      targetActionName = 'Jump';
    }

    // Handle crossfading
    if (this.mixer && this.actions[targetActionName] && this.activeActionName !== targetActionName) {
      this.fadeToAction(targetActionName, 0.2);
    }

    // Update animation mixer
    if (this.mixer) {
      this.mixer.update(dt);
    }
  }

  private fadeToAction(name: string, duration: number): void {
    const previousAction = this.activeAction;
    const nextAction = this.actions[name];

    if (previousAction !== nextAction) {
      if (previousAction) {
        previousAction.fadeOut(duration);
      }

      this.activeAction = nextAction;
      this.activeActionName = name;

      if (nextAction) {
        nextAction
          .reset()
          .setEffectiveTimeScale(1)
          .setEffectiveWeight(1)
          .fadeIn(duration)
          .play();
      }
    }
  }

  /**
   * Sets the transparency and opacity of the robot model meshes.
   * Useful to prevent the robot from obstructing the view during gameplay.
   */
  public setTransparency(transparent: boolean): void {
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((mat) => {
          if (mat instanceof THREE.MeshStandardMaterial) {
            mat.transparent = transparent;
            mat.opacity = transparent ? 0.05 : 1.0;
          }
        });
      }
    });
  }

  /**
   * Sets the opacity of the robot model.
   * Useful for spawning fades.
   */
  public setOpacity(opacity: number): void {
    this.currentOpacity = opacity;
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((mat) => {
          if (mat instanceof THREE.MeshStandardMaterial) {
            mat.transparent = opacity < 1.0;
            mat.opacity = opacity;
          }
        });
      }
    });
  }

  /**
   * Triggers a specific emote, and smoothly blends back to Idle when completed.
   */
  public playEmote(name: string, duration: number = 0.2): void {
    if (this.actions[name]) {
      this.fadeToAction(name, duration);
      
      // Setup a one-time finished listener on the mixer to transition back to Idle
      if (this.mixer) {
        const onFinished = (e: any) => {
          if (e.action === this.actions[name]) {
            this.fadeToAction('Idle', 0.3);
            this.mixer?.removeEventListener('finished', onFinished);
          }
        };
        this.mixer.addEventListener('finished', onFinished);
      }
    }
  }

  /**
   * Resets and triggers the Jump animation instantly.
   */
  public triggerJump(): void {
    const jumpAction = this.actions['Jump'];
    if (jumpAction) {
      jumpAction.reset();
      jumpAction.play();
      this.activeAction = jumpAction;
      this.activeActionName = 'Jump';
    }
  }
}
