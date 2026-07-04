import * as THREE from 'three';
import { EventBus } from '../EventBus';
import { AppEventName, Domain, Action } from '../../types/events';
import { PhysicsEngine, PhysicsBody } from '../physics/PhysicsEngine';

/**
 * Bridging mouse/touch to 3D space.
 * Handles raycasting to detect intersections with 3D Entities.
 * Upgraded to support 3D Drag-and-Throw physics.
 */
export class InteractionManager {
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private eventBus: EventBus;
  private physicsEngine: PhysicsEngine;
  private hoveredEntityId: string | null = null;
  private clickPending: boolean = false;

  // Drag-and-Throw properties
  private draggedBody: PhysicsBody | null = null;
  private isDragging: boolean = false;
  private hasDragged: boolean = false;
  private dragPlane: THREE.Plane;
  private mouseDownPos: THREE.Vector2;
  private lastDragTime: number = 0;
  private lastDragPos: THREE.Vector3;

  constructor(eventBus: EventBus, physicsEngine: PhysicsEngine) {
    this.eventBus = eventBus;
    this.physicsEngine = physicsEngine;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.dragPlane = new THREE.Plane();
    this.mouseDownPos = new THREE.Vector2();
    this.lastDragPos = new THREE.Vector3();

    this.setupListeners();
  }

  /**
   * Returns current mouse coordinates.
   */
  public getMouseCoords(): THREE.Vector2 {
    return this.mouse;
  }

  private setupListeners(): void {
    window.addEventListener('mousemove', this.onMouseMove.bind(this));
    window.addEventListener('mousedown', this.onMouseDown.bind(this));
    window.addEventListener('mouseup', this.onMouseUp.bind(this));
    window.addEventListener('click', this.onClick.bind(this));

    // Touch support for mobile
    window.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
    window.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    window.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
  }

  private onMouseMove(event: MouseEvent): void {
    this.updateMouseCoords(event.clientX, event.clientY);
  }

  private updateMouseCoords(clientX: number, clientY: number): void {
    // Normalize mouse position to [-1, 1] for Three.js raycaster
    this.mouse.x = (clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(clientY / window.innerHeight) * 2 + 1;
  }

  private onMouseDown(event: MouseEvent): void {
    this.updateMouseCoords(event.clientX, event.clientY);
    this.mouseDownPos.set(event.clientX, event.clientY);
    this.hasDragged = false; // Reset on new pointer down to avoid carry-over
    this.startDrag();
  }

  private onMouseUp(_event: MouseEvent): void {
    this.endDrag();
  }

  private onTouchStart(event: TouchEvent): void {
    if (event.touches.length > 0) {
      const touch = event.touches[0];
      this.updateMouseCoords(touch.clientX, touch.clientY);
      this.mouseDownPos.set(touch.clientX, touch.clientY);
      this.hasDragged = false; // Reset on new pointer down to avoid carry-over
      this.startDrag();
    }
  }

  private onTouchMove(event: TouchEvent): void {
    if (event.touches.length > 0) {
      const touch = event.touches[0];
      this.updateMouseCoords(touch.clientX, touch.clientY);
      if (this.isDragging) {
        event.preventDefault(); // Prevent scrolling while dragging inside WebGL
      }
    }
  }

  private onTouchEnd(_event: TouchEvent): void {
    this.endDrag();
  }

  private startDrag(): void {
    const modal = document.getElementById('modal-container');
    if (modal && !modal.classList.contains('hidden')) {
      return;
    }

    // Get camera from active scene through EventBus or standard camera reference
    // We'll use raycasting to find physics bodies
    const body = this.physicsEngine.getIntersection(this.raycaster);
    if (body) {
      this.draggedBody = body;
      body.isDragged = true;
      body.velocity.set(0, 0, 0);
      this.isDragging = true;
      this.hasDragged = false;
      this.lastDragTime = performance.now();
      this.lastDragPos.copy(body.position);

      // Create a drag plane facing the camera coplanar with the object's current position
      const normal = new THREE.Vector3(0, 0, 1); // standard camera view plane
      this.dragPlane.setFromNormalAndCoplanarPoint(normal, body.position);
    }
  }

  private endDrag(): void {
    if (this.isDragging && this.draggedBody) {
      this.draggedBody.isDragged = false;

      // Apply slingshot throw velocity
      const time = performance.now();
      const dt = (time - this.lastDragTime) / 1000.0;
      if (dt > 0.001) {
        const vel = new THREE.Vector3()
          .subVectors(this.draggedBody.position, this.lastDragPos)
          .divideScalar(dt);
        
        // Cap maximum throw velocity to keep it satisfying and prevent objects flying out of bounds
        const maxThrowSpeed = 35.0;
        if (vel.length() > maxThrowSpeed) {
          vel.setLength(maxThrowSpeed);
        }
        this.draggedBody.velocity.copy(vel);
      }

      this.draggedBody = null;
    }
    this.isDragging = false;
  }

  private onClick(event: MouseEvent): void {
    const modal = document.getElementById('modal-container');
    if (modal && !modal.classList.contains('hidden')) {
      return;
    }

    // If the user actually dragged a 3D component instead of simply clicking it,
    // we bypass normal navigation click events.
    const dist = Math.hypot(event.clientX - this.mouseDownPos.x, event.clientY - this.mouseDownPos.y);
    console.log(`InteractionManager: onClick triggered. Drag distance: ${dist.toFixed(1)}px (threshold: 15px), hasDragged currently: ${this.hasDragged}`);
    
    if (dist > 15) {
      this.hasDragged = true;
    }

    if (this.hasDragged) {
      console.log('InteractionManager: Click ignored because drag was detected.');
      this.hasDragged = false;
      this.clickPending = false;
      return;
    }

    this.eventBus.emit(
      `${Domain.UI}:${Action.CLICK}` as AppEventName,
      { elementId: 'canvas' }
    );
    this.clickPending = true;
    console.log('InteractionManager: Canvas click pending set to true.');
  }

  /**
   * Performs raycasting to detect intersections and handles hover, click, and dragging updates.
   * @param camera - The active camera.
   * @param scene - The active scene.
   */
  public checkIntersections(camera: THREE.Camera, scene: THREE.Scene): void {
    const modal = document.getElementById('modal-container');
    if (modal && !modal.classList.contains('hidden')) {
      if (this.hoveredEntityId !== null) {
        this.hoveredEntityId = null;
        this.eventBus.emit(`${Domain.ENTITY}:${Action.HOVER}` as AppEventName, { entityId: '' });
      }
      this.clickPending = false;
      return;
    }

    this.raycaster.setFromCamera(this.mouse, camera);

    // 1. Handle dragging update if active
    if (this.isDragging && this.draggedBody) {
      const intersection = new THREE.Vector3();
      this.raycaster.ray.intersectPlane(this.dragPlane, intersection);

      const time = performance.now();
      const dt = (time - this.lastDragTime) / 1000.0;

      if (dt > 0.005) {
        // Smoothly update positions to track velocity accurately
        this.lastDragPos.copy(this.draggedBody.position);
        this.draggedBody.position.copy(intersection);
        this.lastDragTime = time;
        this.hasDragged = true; // Confirm drag action occurred
      } else {
        this.draggedBody.position.copy(intersection);
      }

      // Sync local representation for dragging visual feedback immediately
      if (this.draggedBody.object.parent) {
        const localPos = this.draggedBody.object.parent.worldToLocal(this.draggedBody.position.clone());
        this.draggedBody.object.position.copy(localPos);
      } else {
        this.draggedBody.object.position.copy(this.draggedBody.position);
      }
    }

    // 2. Normal Hover & Click Intersections
    const intersects = this.raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
      const object = intersects[0].object;
      
      // Traverse up the parent tree to find the nearest defined entityId
      let entityId: string | null = null;
      let current: THREE.Object3D | null = object;
      while (current) {
        if ((current as any).entityId) {
          entityId = (current as any).entityId;
          break;
        }
        current = current.parent;
      }
      
      // Fallback if no parent has entityId
      if (!entityId) {
        entityId = object.name || String(object.id);
      }

      if (this.hoveredEntityId !== entityId) {
        this.hoveredEntityId = entityId;
        this.eventBus.emit(`${Domain.ENTITY}:${Action.HOVER}` as AppEventName, { entityId: entityId });
      }

      // Handle click if one is pending and we didn't just drag
      if (this.clickPending && !this.hasDragged) {
        console.log(`InteractionManager: Dispatching click event for entityId: "${entityId}"`);
        this.eventBus.emit(`${Domain.ENTITY}:${Action.CLICK}` as AppEventName, { entityId: entityId });
        this.clickPending = false;
      }
    } else {
      if (this.hoveredEntityId !== null) {
        this.hoveredEntityId = null;
        this.eventBus.emit(`${Domain.ENTITY}:${Action.HOVER}` as AppEventName, { entityId: '' });
      }
      
      // Clear click state even if no entity was hit
      if (this.clickPending) {
        console.log('InteractionManager: Click pending cleared because raycast missed all objects.');
        this.clickPending = false;
      }
    }
  }

  /**
   * For backwards compatibility or scene manager updates.
   */
  public update(camera: THREE.Camera, scene: THREE.Scene): void {
    this.checkIntersections(camera, scene);
  }

  public dispose(): void {
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('click', this.onClick);

    window.removeEventListener('touchstart', this.onTouchStart);
    window.removeEventListener('touchmove', this.onTouchMove);
    window.removeEventListener('touchend', this.onTouchEnd);
  }
}
