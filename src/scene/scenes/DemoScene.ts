import * as THREE from 'three';
import { Scene } from '../../types/scenes';
import { EventBus } from '../../core/EventBus';
import { Domain, Action } from '../../types/events';

/**
 * A simple scene for testing Interaction and Camera transitions.
 * Contains a single clickable box.
 */
export class DemoScene implements Scene {
  public name = 'DemoScene';
  private mesh!: THREE.Mesh;

  constructor() {}

  public setup(scene: THREE.Scene, camera: THREE.Camera, eventBus: EventBus): void {
    // Prevent unused variable error
    console.log('Setting up DemoScene with camera:', camera.name);

    // Create a simple box
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    this.mesh = new THREE.Mesh(geometry, material);
    (this.mesh as any).entityId = 'test-box';
    this.mesh.name = 'Test Box';
    
    scene.add(this.mesh);

    // Setup basic lighting
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(1, 1, 2);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0x404040));

    // Listen for entity clicks to verify interaction
    eventBus.on(`${Domain.ENTITY}:${Action.CLICK}` as any, (payload: any) => {
      if (payload.entityId === (this.mesh as any).entityId) {
        console.log('DemoScene: Test box clicked!');
        // Change color when clicked to provide visual feedback
        (this.mesh.material as THREE.MeshStandardMaterial).color.set(0xff0000);

        // Phase 3 integration: Open the detailed project modal!
        eventBus.emit(`${Domain.MODAL}:${Action.OPEN}`, { contentId: 'projects-space-explorer' });
      }
    });
  }

  public dispose(): void {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      (this.mesh.material as THREE.MeshStandardMaterial).dispose();
    }
  }
}