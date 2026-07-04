import * as THREE from 'three';
import { EventBus } from '../core/EventBus';

export interface Scene {
  name: string;
  setup(scene: THREE.Scene, camera: THREE.Camera, eventBus: EventBus): void;
  dispose(): void;
}
