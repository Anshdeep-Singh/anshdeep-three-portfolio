import * as THREE from 'three';

export interface PhysicsBody {
  object: THREE.Object3D;
  entityId: string;
  position: THREE.Vector3;       // Current world position of simulation
  velocity: THREE.Vector3;       // Current world velocity
  localOffset: THREE.Vector3;    // Local position within parent when at rest
  mass: number;
  radius: number;
  isDragged: boolean;
  isDisplaced?: boolean;
  springK: number;               // Spring stiffness pulling back to home
  damping: number;               // Velocity damping (friction/air resistance)
  restitution: number;           // Bounciness (0 to 1)
}

export class PhysicsEngine {
  // Pre-allocated static scratch variables for zero-allocation simulation frames
  private static readonly scratchV1 = new THREE.Vector3();
  private static readonly scratchV2 = new THREE.Vector3();
  private static readonly scratchV3 = new THREE.Vector3();
  private static readonly scratchV4 = new THREE.Vector3();

  private bodies: PhysicsBody[] = [];
  private isGravityWellActive: boolean = false;
  private gravityWellPoint: THREE.Vector3 = new THREE.Vector3();
  private dragPlane: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private raycaster: THREE.Raycaster = new THREE.Raycaster();

  constructor() {}

  /**
   * Register a Three.js Object3D as a physics body.
   */
  public registerBody(
    object: THREE.Object3D,
    entityId: string,
    options: {
      mass?: number;
      radius?: number;
      springK?: number;
      damping?: number;
      restitution?: number;
    } = {}
  ): void {
    // Determine the current local position as the rest position
    const localOffset = object.position.clone();
    
    // Get initial world position
    const worldPos = new THREE.Vector3();
    object.getWorldPosition(worldPos);

    this.bodies.push({
      object,
      entityId,
      position: worldPos,
      velocity: new THREE.Vector3(0, 0, 0),
      localOffset,
      mass: options.mass ?? 1.0,
      radius: options.radius ?? 0.4,
      springK: options.springK ?? 8.0,      // Elastic spring force constant
      damping: options.damping ?? 3.0,      // Damping coefficient to prevent infinite oscillation
      restitution: options.restitution ?? 0.7, // Bounciness of elastic collisions
      isDragged: false,
      isDisplaced: false
    });

    console.log(`PhysicsEngine: Registered physics body for entity '${entityId}'`, { worldPos, localOffset });
  }

  /**
   * Set gravity well active state.
   */
  public setGravityWell(active: boolean): void {
    this.isGravityWellActive = active;
  }

  /**
   * Update the 3D position of the gravity well.
   */
  public updateGravityWellPoint(mouse: THREE.Vector2, camera: THREE.Camera): void {
    this.raycaster.setFromCamera(mouse, camera);
    
    // Position the projection plane at a reasonable depth (e.g. skills showcase z depth around -2)
    this.dragPlane.normal.set(0, 0, 1);
    this.dragPlane.constant = 2.0; // aligns with the skills group z = -2 depth in world space

    const intersection = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.dragPlane, intersection);
    this.gravityWellPoint.copy(intersection);
  }

  /**
   * Check if a ray intersects with any registered physics bodies.
   */
  public getIntersection(raycaster: THREE.Raycaster): PhysicsBody | null {
    let closestBody: PhysicsBody | null = null;
    let minDistance = Infinity;

    for (const body of this.bodies) {
      // Find intersections with the object itself or its children
      const intersects = raycaster.intersectObject(body.object, true);
      if (intersects.length > 0) {
        if (intersects[0].distance < minDistance) {
          minDistance = intersects[0].distance;
          closestBody = body;
        }
      }
    }

    return closestBody;
  }

  /**
   * Returns all registered bodies.
   */
  public getBodies(): PhysicsBody[] {
    return this.bodies;
  }

  /**
   * Run the physics simulation frame.
   * @param dt - Delta time in seconds.
   */
  public update(dt: number, camera: THREE.Camera, mouse?: THREE.Vector2): void {
    if (dt <= 0) return;
    // Limit maximum timestep to prevent simulation exploding on low FPS
    dt = Math.min(dt, 0.05);

    // If gravity well is active and mouse is provided, update gravity well target position
    if (this.isGravityWellActive && mouse && camera) {
      this.updateGravityWellPoint(mouse, camera);
    }

    // 1. Apply Forces and Integrate Positions
    for (const body of this.bodies) {
      if (body.isDragged) {
        // Let the drag/interaction controller update position and velocity of dragged objects directly
        continue;
      }

      // Compute current world home position (since parent might have moved or rotated)
      const homeWorldPos = PhysicsEngine.scratchV1;
      if (body.object.parent) {
        // Translate local resting offset back to world coordinates
        body.object.parent.localToWorld(homeWorldPos.copy(body.localOffset));
      } else {
        homeWorldPos.copy(body.localOffset);
      }

      // Spring force (Hooke's Law: F = -k * x)
      const springForce = PhysicsEngine.scratchV2.set(0, 0, 0);
      if (!body.isDisplaced) {
        springForce.subVectors(homeWorldPos, body.position).multiplyScalar(body.springK);
      }

      // Damping force (F = -c * v) and Spring force combined into Total force
      const totalForce = PhysicsEngine.scratchV3.copy(body.velocity).multiplyScalar(-body.damping).add(springForce);

      // Gravity Well Force (satisfying magnetic pull)
      if (this.isGravityWellActive) {
        const wellDir = PhysicsEngine.scratchV4.subVectors(this.gravityWellPoint, body.position);
        const distance = wellDir.length();
        if (distance > 0.01) {
          // Attract with strength inversely proportional to distance, but capped
          const forceStrength = Math.min(15.0 / (distance + 0.5), 25.0);
          const attractionForce = wellDir.normalize().multiplyScalar(forceStrength * body.mass);
          totalForce.add(attractionForce);
        }
      }

      // Euler Integration
      // Acceleration a = F / m
      const acceleration = totalForce.divideScalar(body.mass);
      body.velocity.addScaledVector(acceleration, dt);
      body.position.addScaledVector(body.velocity, dt);
    }

    // 2. Handle Elastic Collisions and Interpenetration Resolution (N^2 check is fine for 5-10 bodies)
    for (let i = 0; i < this.bodies.length; i++) {
      const b1 = this.bodies[i];
      for (let j = i + 1; j < this.bodies.length; j++) {
        const b2 = this.bodies[j];

        const distVec = PhysicsEngine.scratchV1.subVectors(b1.position, b2.position);
        const dist = distVec.length();
        const minDist = b1.radius + b2.radius;

        if (dist < minDist) {
          // Overlap detected!
          const overlap = minDist - dist;
          const collisionNormal = PhysicsEngine.scratchV2;
          if (dist > 0.001) {
            collisionNormal.copy(distVec).normalize();
          } else {
            collisionNormal.set(1, 0, 0);
          }

          // Push them apart (penetration resolution) proportional to inverse masses
          const totalMass = b1.mass + b2.mass;
          const push1 = overlap * (b2.mass / totalMass);
          const push2 = overlap * (b1.mass / totalMass);

          if (!b1.isDragged) b1.position.addScaledVector(collisionNormal, push1);
          if (!b2.isDragged) b2.position.addScaledVector(collisionNormal, -push2);

          // Calculate relative velocity along collision normal
          const relVel = PhysicsEngine.scratchV3.subVectors(b1.velocity, b2.velocity);
          const velAlongNormal = relVel.dot(collisionNormal);

          // Only resolve if moving towards each other
          if (velAlongNormal < 0) {
            // Restitution (bounciness coefficient)
            const e = Math.min(b1.restitution, b2.restitution);
            
            // Calculate impulse scalar
            const impulseScalar = -(1 + e) * velAlongNormal / (1/b1.mass + 1/b2.mass);

            // Apply impulse to each body
            if (!b1.isDragged) b1.velocity.addScaledVector(collisionNormal, impulseScalar / b1.mass);
            if (!b2.isDragged) b2.velocity.addScaledVector(collisionNormal, -impulseScalar / b2.mass);
          }
        }
      }
    }

    // 3. Sync positions back to Three.js objects (converting world back to parent's local space)
    for (const body of this.bodies) {
      if (body.object.parent) {
        // reuse scratchV1 for cloning position and local conversion
        const tempWorldPos = PhysicsEngine.scratchV1.copy(body.position);
        const localPos = body.object.parent.worldToLocal(tempWorldPos);
        body.object.position.copy(localPos);
      } else {
        body.object.position.copy(body.position);
      }
    }
  }

  /**
   * Reset all bodies to their home positions immediately.
   */
  public resetAll(): void {
    for (const body of this.bodies) {
      body.velocity.set(0, 0, 0);
      if (body.object.parent) {
        const homeWorldPos = new THREE.Vector3();
        body.object.parent.localToWorld(homeWorldPos.copy(body.localOffset));
        body.position.copy(homeWorldPos);
        body.object.position.copy(body.localOffset);
      } else {
        body.position.copy(body.localOffset);
        body.object.position.copy(body.localOffset);
      }
    }
  }

  /**
   * Clear all physics bodies.
   */
  public clear(): void {
    this.bodies = [];
  }
}
