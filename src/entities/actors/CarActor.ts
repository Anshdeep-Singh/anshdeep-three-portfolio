import * as THREE from 'three';
import { BaseActor } from '../base/BaseActor';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

export class CarActor extends BaseActor {
  public isActive: boolean = false;

  // Car mesh components
  private carModel: THREE.Object3D | null = null;
  private fallbackGroup: THREE.Group | null = null;
  private wheels: THREE.Mesh[] = [];

  // Physics state variables
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public speed: number = 0;
  public yaw: number = 0; // Orientation angle around Y axis
  private pitch: number = 0;
  private roll: number = 0;

  // Steering & engine parameters
  private maxSpeed: number = 14.0;      // max units per second (reduced from 22.0)
  private maxReverseSpeed: number = -8.0;
  private acceleration: number = 25.0;  // units/sec^2
  private drag: number = 3.5;           // friction slowing car down
  private brakeForce: number = 45.0;     // extra deceleration when braking
  private steerAngle: number = 0;       // current steering angle
  private maxSteerAngle: number = 0.85;  // steering limit for high speed drifts (increased from 0.55 for sharper turning)
  private steerSpeed: number = 8.0;      // steering lerp speed
  private keyboardSteer: number = 0;    // smoothed steering input

  // Flipping detection
  private flippedTime: number = 0;
  private isFlipped: boolean = false;
  private resetDelay: number = 1.0;      // 1 second wait to reset when flipped

  // Controls input state
  public inputs = {
    forward: 0, // -1 back, 0 idle, 1 forward
    steer: 0,   // -1 left, 0 center, 1 right
    brake: false,
    reset: false
  };

  public isDrifting: boolean = false;
  private driftParticles: { mesh: THREE.Mesh; velocity: THREE.Vector3; age: number; maxAge: number }[] = [];

  constructor() {
    super('driving-car');
  }

  public setup(): void {
    // 1. Instantly create a highly detailed fallback arcade car model
    this.fallbackGroup = new THREE.Group();
    this.fallbackGroup.name = 'fallback-arcade-car';

    // Red chassis body
    const bodyGeo = new THREE.BoxGeometry(1.6, 0.6, 3.2);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xff1111,
      roughness: 0.2,
      metalness: 0.6
    });
    const fallbackBody = new THREE.Mesh(bodyGeo, bodyMat);
    fallbackBody.position.y = 0.5;
    fallbackBody.castShadow = true;
    fallbackBody.receiveShadow = true;
    this.fallbackGroup.add(fallbackBody);

    // Cockpit cabin (cyber glass look)
    const cabinGeo = new THREE.BoxGeometry(1.3, 0.5, 1.6);
    const cabinMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.6
    });
    const fallbackCabin = new THREE.Mesh(cabinGeo, cabinMat);
    fallbackCabin.position.set(0, 1.0, -0.2);
    fallbackCabin.castShadow = true;
    fallbackCabin.receiveShadow = true;
    this.fallbackGroup.add(fallbackCabin);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.4, 16);
    wheelGeo.rotateZ(Math.PI / 2); // Rotate cylinder to align horizontally
    const wheelMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.8
    });

    const fallbackWheelFL = new THREE.Mesh(wheelGeo, wheelMat);
    fallbackWheelFL.name = 'fallback_wheel_fl';
    fallbackWheelFL.position.set(-0.9, 0.4, 1.0);

    const fallbackWheelFR = new THREE.Mesh(wheelGeo, wheelMat);
    fallbackWheelFR.name = 'fallback_wheel_fr';
    fallbackWheelFR.position.set(0.9, 0.4, 1.0);

    const fallbackWheelRL = new THREE.Mesh(wheelGeo, wheelMat);
    fallbackWheelRL.name = 'fallback_wheel_rl';
    fallbackWheelRL.position.set(-0.9, 0.4, -1.0);

    const fallbackWheelRR = new THREE.Mesh(wheelGeo, wheelMat);
    fallbackWheelRR.name = 'fallback_wheel_rr';
    fallbackWheelRR.position.set(0.9, 0.4, -1.0);

    const fallbackWheels = [fallbackWheelFL, fallbackWheelFR, fallbackWheelRL, fallbackWheelRR];
    fallbackWheels.forEach((wheel) => {
      wheel.castShadow = true;
      wheel.receiveShadow = true;
      wheel.userData = {
        isFront: wheel.name.includes('_f'),
        rotationX: 0
      };
      wheel.rotation.order = 'YXZ'; // Prevent tire wiggle/wobble during turns
      this.wheels.push(wheel);
      this.fallbackGroup!.add(wheel);
    });

    // Add fallback visual to actor group
    this.mesh.add(this.fallbackGroup);

    // 2. Setup Ferrari Materials for asynchronous replacement
    const bodyMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xff0000,
      metalness: 1.0,
      roughness: 0.5,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03
    });

    const detailsMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 1.0,
      roughness: 0.5
    });

    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.25,
      roughness: 0,
      transmission: 1.0
    });

    // 3. Load Shadow Texture
    const textureLoader = new THREE.TextureLoader();
    const shadowTexture = textureLoader.load('models/gltf/ferrari_ao.png');

    // 4. Load GLTF Ferrari Model in background with DRACO support
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);

    loader.load(
      'models/gltf/ferrari.glb',
      (gltf) => {
        console.log('CarActor: Ferrari 458 Italia loaded successfully!');
        
        // Use the carModel from gltf.scene.children[ 0 ]
        this.carModel = gltf.scene.children[0];
        // Rotate 180 degrees to align with heading direction
        this.carModel.rotation.y = Math.PI;

        // Apply custom materials to corresponding named components
        const bodyObj = this.carModel.getObjectByName('body');
        if (bodyObj && (bodyObj as THREE.Mesh).material) {
          (bodyObj as THREE.Mesh).material = bodyMaterial;
        }

        const rimFL = this.carModel.getObjectByName('rim_fl');
        if (rimFL) (rimFL as THREE.Mesh).material = detailsMaterial;
        const rimFR = this.carModel.getObjectByName('rim_fr');
        if (rimFR) (rimFR as THREE.Mesh).material = detailsMaterial;
        const rimRR = this.carModel.getObjectByName('rim_rr');
        if (rimRR) (rimRR as THREE.Mesh).material = detailsMaterial;
        const rimRL = this.carModel.getObjectByName('rim_rl');
        if (rimRL) (rimRL as THREE.Mesh).material = detailsMaterial;
        
        const trimObj = this.carModel.getObjectByName('trim');
        if (trimObj) (trimObj as THREE.Mesh).material = detailsMaterial;

        const glassObj = this.carModel.getObjectByName('glass');
        if (glassObj) (glassObj as THREE.Mesh).material = glassMaterial;

        // Fetch wheel mesh references for visual animations
        const wheelFL = this.carModel.getObjectByName('wheel_fl');
        const wheelFR = this.carModel.getObjectByName('wheel_fr');
        const wheelRL = this.carModel.getObjectByName('wheel_rl');
        const wheelRR = this.carModel.getObjectByName('wheel_rr');

        const wheelMeshes = [wheelFL, wheelFR, wheelRL, wheelRR].filter(Boolean) as THREE.Mesh[];

        // If real wheels are loaded, we will transition wheels mapping
        const realWheels: THREE.Mesh[] = [];
        wheelMeshes.forEach((wheel) => {
          const isFront = wheel.name.includes('_f');
          wheel.userData = {
            isFront: isFront,
            rotationX: 0
          };
          wheel.rotation.order = 'YXZ'; // Prevent tire wiggle/wobble during turns
          realWheels.push(wheel);
        });

        // 5. Attach Multiply Shadow plane underneath the chassis
        const shadowMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(0.655 * 4, 1.3 * 4),
          new THREE.MeshBasicMaterial({
            map: shadowTexture,
            blending: THREE.MultiplyBlending,
            toneMapped: false,
            transparent: true,
            premultipliedAlpha: true,
            opacity: 0.85
          })
        );
        shadowMesh.rotation.x = -Math.PI / 2;
        shadowMesh.position.y = 0.01; // Tiny lift above the physical ground
        shadowMesh.renderOrder = 2;
        this.carModel.add(shadowMesh);

        // Ensure everything casts/receives shadows
        this.carModel.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        // 6. Seamlessly replace fallback model with Ferrari model
        if (this.fallbackGroup) {
          this.mesh.remove(this.fallbackGroup);
          this.fallbackGroup = null;
        }
        
        this.wheels = realWheels;
        this.mesh.add(this.carModel);
        console.log('CarActor: Swapped fallback arcade car with high-detail Ferrari.');
      },
      undefined,
      (error) => {
        console.error('CarActor: Error loading Ferrari model:', error);
      }
    );

    // Apply 0.7-size scaling to the whole car group
    this.mesh.scale.set(0.7, 0.7, 0.7);

    // Initial position slightly above ground (ground floor is Y=-4)
    this.mesh.position.set(0, -4.0, 0);

    // Bind event listeners for input
    this.bindInputs();
  }

  private bindInputs(): void {
    window.addEventListener('keydown', (e) => {
      if (!this.isActive) return;
      const key = e.key.toLowerCase();
      if (key === 'w' || e.key === 'ArrowUp') this.inputs.forward = 1;
      if (key === 's' || e.key === 'ArrowDown') this.inputs.forward = -1;
      if (key === 'a' || e.key === 'ArrowLeft') this.inputs.steer = 1; // turn left
      if (key === 'd' || e.key === 'ArrowRight') this.inputs.steer = -1; // turn right
      if (key === ' ') {
        this.inputs.brake = true;
        e.preventDefault();
        (document.activeElement as HTMLElement)?.blur();
      }
      if (key === 'r') this.inputs.reset = true;
    });

    window.addEventListener('keyup', (e) => {
      if (!this.isActive) return;
      const key = e.key.toLowerCase();
      if (key === 'w' || e.key === 'ArrowUp') {
        if (this.inputs.forward === 1) this.inputs.forward = 0;
      }
      if (key === 's' || e.key === 'ArrowDown') {
        if (this.inputs.forward === -1) this.inputs.forward = 0;
      }
      if (key === 'a' || e.key === 'ArrowLeft') {
        if (this.inputs.steer === 1) this.inputs.steer = 0;
      }
      if (key === 'd' || e.key === 'ArrowRight') {
        if (this.inputs.steer === -1) this.inputs.steer = 0;
      }
      if (key === ' ') {
        this.inputs.brake = false;
        e.preventDefault();
      }
      if (key === 'r') this.inputs.reset = false;
    });
  }

  public update(_time: number): void {
    // Driven by updatePhysics(dt)
  }

  /**
   * Run the vehicle simulation frame.
   * @param dt - Delta time in seconds.
   */
  public updatePhysics(dt: number): void {
    // Expose real-time state on the mesh so trailing camera system can read them
    (this.mesh as any).yaw = this.yaw;
    (this.mesh as any).speed = this.speed;
    (this.mesh as any).isDrifting = this.isDrifting;

    // Update drift particles even when inactive (to let existing ones fade out)
    this.updateDriftParticles(dt);

    if (!this.isActive) {
      // Apply passive deceleration when inactive
      this.velocity.lerp(new THREE.Vector3(), 5.0 * dt);
      this.speed = this.velocity.length() * (this.speed >= 0 ? 1 : -1);
      this.updateMeshMovement(dt);
      return;
    }

    // 1. Handle Reset manually triggered
    if (this.inputs.reset) {
      this.resetCar();
      return;
    }

    // 2. Flipped vehicle check
    const localUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.mesh.quaternion);
    const upDot = localUp.dot(new THREE.Vector3(0, 1, 0));

    if (upDot < 0.2) {
      if (!this.isFlipped) {
        this.isFlipped = true;
        this.flippedTime = 0;
      }
      this.flippedTime += dt;
      if (this.flippedTime >= this.resetDelay) {
        this.resetCar();
      }
    } else {
      this.isFlipped = false;
      this.flippedTime = 0;
    }

    // Deconstruct velocity into local directions using forward and right axes
    const forwardDir = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const rightDir = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

    let localForwardSpeed = this.velocity.dot(forwardDir);
    let localLateralSpeed = this.velocity.dot(rightDir);

    // 3. Throttle, Braking & Drift Detection
    // Drift is triggered when steering sharply at a moderate speed and holding space/brake
    const absSpeed = Math.abs(localForwardSpeed);
    const isSteeringSharply = Math.abs(this.inputs.steer) > 0.15;
    this.isDrifting = this.inputs.brake && isSteeringSharply && absSpeed > 3.0;

    let currentAcceleration = 0;
    if (this.inputs.forward > 0) {
      currentAcceleration = this.acceleration;
    } else if (this.inputs.forward < 0) {
      currentAcceleration = -this.acceleration;
    }

    // Apply forward acceleration
    localForwardSpeed += currentAcceleration * dt;

    // Friction and braking drag
    let activeDrag = this.drag;
    if (this.inputs.brake && !this.isDrifting) {
      activeDrag += this.brakeForce;
    }

    // Deccelerate / Drag
    if (this.inputs.forward === 0) {
      if (localForwardSpeed > 0) {
        localForwardSpeed = Math.max(0, localForwardSpeed - activeDrag * dt);
      } else if (localForwardSpeed < 0) {
        localForwardSpeed = Math.min(0, localForwardSpeed + activeDrag * dt);
      }
    } else if (this.inputs.brake && !this.isDrifting) {
      if (localForwardSpeed > 0) {
        localForwardSpeed = Math.max(0, localForwardSpeed - activeDrag * dt);
      } else if (localForwardSpeed < 0) {
        localForwardSpeed = Math.min(0, localForwardSpeed + activeDrag * dt);
      }
    }

    // Dynamic speed caps (drift boost!)
    const currentMaxSpeed = this.isDrifting ? this.maxSpeed * 1.15 : this.maxSpeed;
    localForwardSpeed = THREE.MathUtils.clamp(localForwardSpeed, this.maxReverseSpeed, currentMaxSpeed);

    // Apply lateral grip: high grip under normal driving, very low grip while drifting
    const normalGrip = THREE.MathUtils.lerp(14.0, 9.0, Math.min(absSpeed / this.maxSpeed, 1.0)); // slightly loosen at super high speed
    const gripValue = this.isDrifting ? 1.9 : normalGrip;
    // Frame-rate independent exponential decay for grip
    localLateralSpeed *= Math.exp(-gripValue * dt);

    // Reconstruct velocity vector
    this.velocity.copy(forwardDir).multiplyScalar(localForwardSpeed).addScaledVector(rightDir, localLateralSpeed);
    this.speed = localForwardSpeed; // Keep speed as the logical forward indicator

    // 4. Steering Calculations (Sharper and faster when drifting)
    const steerLimit = this.isDrifting ? this.maxSteerAngle * 1.4 : this.maxSteerAngle;
    const steerRate = this.isDrifting ? this.steerSpeed * 1.5 : this.steerSpeed;
    
    // Smooth the raw keyboard input first to simulate realistic steering wheel movement
    const inputSmoothingRate = 12.0; // higher is faster reaction, 12 is perfect for responsive arcade feel
    this.keyboardSteer = this.inputs.steer + (this.keyboardSteer - this.inputs.steer) * Math.exp(-inputSmoothingRate * dt);
    
    const targetSteer = this.keyboardSteer * steerLimit;
    // Frame-rate independent exponential decay for steering transition
    this.steerAngle = targetSteer + (this.steerAngle - targetSteer) * Math.exp(-steerRate * dt);

    // 5. Yaw Turn Rate
    if (absSpeed > 0.05) {
      const speedSign = localForwardSpeed >= 0 ? 1 : -1;
      
      // Dynamic sensitivity curve: comfortable baseline turning at low speed, maximum turning at medium speed, taper down at high speed
      let turnScale = 0;
      if (absSpeed < 4.0) {
        // Linearly scale from 1.2 up to 2.4 as speed rises from 0.05 to 4.0 (sharper turning for tighter turn radius)
        turnScale = THREE.MathUtils.mapLinear(absSpeed, 0.05, 4.0, 1.2, 2.4);
      } else {
        // Scale down from 2.4 down to 1.4 at maximum speed to prevent erratic jitter/twitchiness (tightened turn radius)
        turnScale = THREE.MathUtils.mapLinear(Math.min(absSpeed, this.maxSpeed), 4.0, this.maxSpeed, 2.4, 1.4);
      }
      
      const driftTurnMultiplier = this.isDrifting ? 1.4 : 1.0;
      this.yaw += this.steerAngle * turnScale * speedSign * dt * driftTurnMultiplier;
    }

    // 6. Integrate Position and Rotation
    this.updateMeshMovement(dt);

    // 7. Update wheels visuals
    this.updateWheelsVisuals(dt);

    // 8. Spawn drift visual smoke particles
    if (this.isDrifting) {
      this.spawnDriftSmoke(dt);
    }
  }

  private updateMeshMovement(dt: number): void {
    // Position integration using our true velocity vector
    this.mesh.position.addScaledVector(this.velocity, dt);

    // Constrain car position inside the bounding circle (radius 48) to align with stage limit
    const horizontalDist = Math.sqrt(this.mesh.position.x * this.mesh.position.x + this.mesh.position.z * this.mesh.position.z);
    if (horizontalDist > 48.0) {
      const angle = Math.atan2(this.mesh.position.z, this.mesh.position.x);
      this.mesh.position.x = Math.cos(angle) * 48.0;
      this.mesh.position.z = Math.sin(angle) * 48.0;
      
      // Zero out normal velocity components that point outward to make wall slides smoother
      const normalX = Math.cos(angle);
      const normalZ = Math.sin(angle);
      const dotProd = this.velocity.x * normalX + this.velocity.z * normalZ;
      if (dotProd > 0) {
        this.velocity.x -= normalX * dotProd;
        this.velocity.z -= normalZ * dotProd;
        this.speed = this.velocity.dot(new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw));
      }
    }

    // Standard ground locking (keep car wheels touching ground Y=-4.0)
    if (!this.isFlipped) {
      this.pitch = this.pitch * Math.exp(-8.0 * dt);
      this.roll = this.roll * Math.exp(-8.0 * dt);

      // Lock height to -4.0 (Y=-4 is ground level for Ferrari wheels)
      this.mesh.position.y = -4.0 + (this.mesh.position.y - (-4.0)) * Math.exp(-10.0 * dt);
    } else {
      // Simulate gravity fall and tilt when flipped
      if (this.mesh.position.y > -4.0) {
        this.mesh.position.y -= 9.8 * dt;
      } else {
        this.mesh.position.y = -4.0;
      }
    }

    // Dynamic Chassis Pitch and Roll for high-fidelity weight transfers
    let targetChassisPitch = 0;
    let targetChassisRoll = 0;

    if (this.carModel && !this.isFlipped && Math.abs(this.speed) > 0.05) {
      const forwardInput = this.inputs.forward;
      const speedPct = Math.abs(this.speed) / this.maxSpeed;

      if (this.inputs.brake && !this.isDrifting) {
        targetChassisPitch = -0.15 * speedPct;
      } else if (forwardInput > 0) {
        targetChassisPitch = 0.08 * (1.0 - speedPct);
      } else if (forwardInput < 0) {
        targetChassisPitch = -0.06 * (1.0 - speedPct);
      } else {
        targetChassisPitch = -0.02 * (this.speed > 0 ? 1 : -1) * speedPct;
      }

      // Roll: lean into the drift/turn!
      const rollAmount = this.isDrifting ? 0.6 : 0.35;
      targetChassisRoll = this.steerAngle * rollAmount * speedPct;
    }

    if (this.carModel) {
      this.carModel.rotation.x = targetChassisPitch + (this.carModel.rotation.x - targetChassisPitch) * Math.exp(-12.0 * dt);
      this.carModel.rotation.z = targetChassisRoll + (this.carModel.rotation.z - targetChassisRoll) * Math.exp(-12.0 * dt);
    }

    // Reconstruct quaternion rotation
    const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.pitch);
    const qRoll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), this.roll);

    this.mesh.quaternion.copy(qYaw).multiply(qPitch).multiply(qRoll);
  }

  /**
   * Spawns smoky tire particles from the rear wheels when drifting
   */
  private spawnDriftSmoke(dt: number): void {
    const parentScene = this.mesh.parent;
    if (!parentScene) return;

    // Spawn 1-2 smoke particles per rear wheel per frame depending on delta time
    const spawnChance = Math.min(dt * 150.0, 3);
    for (let count = 0; count < spawnChance; count++) {
      this.wheels.forEach((wheel) => {
        // Rear wheels spawn most smoke, front wheels spawn some during heavy drift
        const isRear = !wheel.userData.isFront;
        const probability = isRear ? 0.8 : 0.2;

        if (Math.random() < probability) {
          // Get world position of the wheel
          const wheelWorldPos = new THREE.Vector3();
          wheel.getWorldPosition(wheelWorldPos);

          // Create a simple, fast procedural smoke sphere mesh
          const size = 0.08 + Math.random() * 0.12;
          const geo = new THREE.BoxGeometry(size, size, size);
          const mat = new THREE.MeshBasicMaterial({
            color: 0xcccccc,
            transparent: true,
            opacity: 0.5 + Math.random() * 0.2,
            depthWrite: false
          });
          const smokeMesh = new THREE.Mesh(geo, mat);
          
          // Place slightly offset near ground level
          smokeMesh.position.copy(wheelWorldPos);
          smokeMesh.position.y = -4.0 + (Math.random() * 0.1);

          // Add to scene parent so it lingers in world space
          parentScene.add(smokeMesh);

          // Smoke drift velocity (slightly rising up and dispersing outward)
          const disperse = 1.2;
          const smokeVelocity = new THREE.Vector3(
            (Math.random() - 0.5) * disperse,
            0.5 + Math.random() * 0.8,
            (Math.random() - 0.5) * disperse
          );

          this.driftParticles.push({
            mesh: smokeMesh,
            velocity: smokeVelocity,
            age: 0,
            maxAge: 0.5 + Math.random() * 0.5 // survives 0.5 to 1 second
          });
        }
      });
    }
  }

  /**
   * Updates existing drift smoke particles: fades, scales down, and disposes them.
   */
  private updateDriftParticles(dt: number): void {
    const parentScene = this.mesh.parent;

    for (let i = this.driftParticles.length - 1; i >= 0; i--) {
      const p = this.driftParticles[i];
      p.age += dt;

      if (p.age >= p.maxAge) {
        // Dispose mesh
        if (parentScene) {
          parentScene.remove(p.mesh);
        }
        p.mesh.geometry.dispose();
        if (Array.isArray(p.mesh.material)) {
          p.mesh.material.forEach((m) => m.dispose());
        } else {
          p.mesh.material.dispose();
        }
        this.driftParticles.splice(i, 1);
      } else {
        // Animate movement, scaling, and fading
        p.mesh.position.addScaledVector(p.velocity, dt);
        
        // Disperse and decelerate smoke
        p.velocity.multiplyScalar(0.95);

        const ratio = p.age / p.maxAge;
        p.mesh.scale.setScalar(1.0 + ratio * 3.0); // smoke expands

        if (p.mesh.material && !(Array.isArray(p.mesh.material))) {
          p.mesh.material.opacity = (1.0 - ratio) * 0.6;
        }
      }
    }
  }

  private updateWheelsVisuals(dt: number): void {
    const wheelRadius = 0.35;
    const spinFactor = (this.speed / wheelRadius) * dt;

    this.wheels.forEach((wheel) => {
      // 1. Steering (Front wheels only)
      if (wheel.userData.isFront) {
        wheel.rotation.y = this.steerAngle;
      }

      // 2. Spin rotation around local X-axis
      wheel.userData.rotationX += spinFactor;
      wheel.rotation.x = wheel.userData.rotationX;
    });
  }

  /**
   * Immediately uprights the car, stops it, and places it on the ground.
   */
  public resetCar(): void {
    this.speed = 0;
    this.isFlipped = false;
    this.flippedTime = 0;
    this.pitch = 0;
    this.roll = 0;
    
    // Upright the orientation
    this.mesh.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    
    // Set slightly above floor to prevent clipping
    this.mesh.position.y = -3.95;

    // Reset wheel visual rotations
    this.wheels.forEach((wheel) => {
      wheel.userData.rotationX = 0;
      wheel.rotation.x = 0;
      if (wheel.userData.isFront) {
        wheel.rotation.y = 0;
      }
    });

    console.log('CarActor: Vehicle reset to upright state.');
  }

  /**
   * Resets position entirely.
   */
  public relocateCar(pos: THREE.Vector3): void {
    this.mesh.position.copy(pos);
    this.yaw = Math.random() * Math.PI * 2;
    this.resetCar();
  }

  /**
   * Clean up assets
   */
  public dispose(): void {
    // Clean up remaining drift particles from the scene
    const parentScene = this.mesh.parent;
    this.driftParticles.forEach((p) => {
      if (parentScene) {
        parentScene.remove(p.mesh);
      }
      p.mesh.geometry.dispose();
      if (Array.isArray(p.mesh.material)) {
        p.mesh.material.forEach((m) => m.dispose());
      } else {
        p.mesh.material.dispose();
      }
    });
    this.driftParticles = [];

    if (this.carModel) {
      this.carModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat) => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
    }
  }
}
