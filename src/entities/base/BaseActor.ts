import * as THREE from 'three';

export abstract class BaseActor {
  public mesh: THREE.Group;
  public entityId: string;

  constructor(entityId: string) {
    this.entityId = entityId;
    this.mesh = new THREE.Group();
    // Assign the entityId on the root group object as well so Raycaster knows it
    (this.mesh as any).entityId = entityId;
  }

  public abstract setup(): void;
  public abstract update(time: number): void;
  
  public dispose(): void {
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => mat.dispose());
        } else if (child.material) {
          child.material.dispose();
        }
      }
    });
  }
}
