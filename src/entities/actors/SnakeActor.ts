import * as THREE from 'three';
import { BaseActor } from '../base/BaseActor';

export class SnakeActor extends BaseActor {
  private headMesh!: THREE.Mesh;
  private bodySegments: THREE.Mesh[] = [];
  private numSegments = 6;
  private waveSpeed = 8;
  private waveAmplitude = 0.25;

  constructor() {
    super('snake-actor');
  }

  public setup(): void {
    const headGeo = new THREE.BoxGeometry(0.5, 0.4, 0.6);
    // Matte Standard Material with a subtle 10% emissive glow
    const headMat = new THREE.MeshStandardMaterial({
      color: 0x2ecc71, // Softer Green
      emissive: 0x2ecc71,
      emissiveIntensity: 0.1, // 10% glow
      roughness: 0.9,
      metalness: 0.1,
    });
    
    this.headMesh = new THREE.Mesh(headGeo, headMat);
    this.headMesh.position.set(0, 0.2, 0);
    this.mesh.add(this.headMesh);

    // Glowing eyes - standard/non-glowing
    const eyeGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xff0055,
      roughness: 0.9,
    });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.18, 0.1, -0.22);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.18, 0.1, -0.22);
    this.headMesh.add(leftEye);
    this.headMesh.add(rightEye);

    // Body segments
    const segmentGeo = new THREE.BoxGeometry(0.38, 0.3, 0.38);
    const colorPool = [
      0x3498db, // Blue
      0x9b59b6, // Purple
      0xe74c3c, // Red
      0xf1c40f, // Yellow
      0xe67e22, // Orange
      0x1abc9c, // Turquoise
      0xe91e63, // Pink
      0x2ecc71, // Green
    ];

    for (let i = 0; i < this.numSegments; i++) {
      // Random color for each segment
      const color = colorPool[Math.floor(Math.random() * colorPool.length)];
      const segmentMat = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.1, // 10% glow
        roughness: 0.9,
        metalness: 0.1,
      });
      const segment = new THREE.Mesh(segmentGeo, segmentMat);
      // Position behind head
      segment.position.set(0, 0.15, 0.45 + i * 0.38);
      this.mesh.add(segment);
      this.bodySegments.push(segment);
    }

    // Set default initial coordinates (X=0, Y=-4, Z=0)
    this.mesh.position.set(-5, -4, 5);
  }

  public update(time: number): void {
    // Slithering wave animation for head and segments
    const angle = time * this.waveSpeed;
    
    // Animate head
    this.headMesh.position.x = Math.sin(angle) * this.waveAmplitude;

    // Animate body segments following behind
    for (let i = 0; i < this.bodySegments.length; i++) {
      const segment = this.bodySegments[i];
      // Offset wave timing based on segment index to create slithering effect
      segment.position.x = Math.sin(angle - (i + 1) * 0.6) * this.waveAmplitude;
    }
  }

  public relocateSnake(position: THREE.Vector3): void {
    this.mesh.position.copy(position);
    this.mesh.updateMatrixWorld(true);
  }
}
