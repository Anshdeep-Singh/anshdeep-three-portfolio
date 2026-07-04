import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EventBus } from './EventBus';
import { AssetManifest, AssetLoadProgress } from '../types/assets';

/**
 * Centralized resource loader and memory manager.
 * Ensures assets are loaded before the engine starts and provides a mechanism for disposal.
 */
export class ResourceManager {
  private cache: Map<string, any> = new Map();
  private eventBus: EventBus;
  private totalAssets: number = 0;
  private loadedAssets: number = 0;

  // Event names from specification
  private readonly CORE_ASSET_LOADED = 'CORE:ASSET_LOADED';
  private readonly CORE_LOADING_PROGRESS = 'CORE:LOADING_PROGRESS';

  // Event names from types/events.ts (Domain.CORE:Action.LOADED / PROGRESS)
  private readonly CORE_LOADED = 'CORE:LOADED';
  private readonly CORE_PROGRESS = 'CORE:PROGRESS';

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /**
   * Loads all assets defined in a manifest.
   * @param manifest - The asset manifest defining what to load.
   */
  public async loadAll(manifest: AssetManifest): Promise<void> {
    const assetsToLoad = manifest.assets || [];
    this.totalAssets = assetsToLoad.length;
    this.loadedAssets = 0;

    // Handle empty manifest edge case
    if (this.totalAssets === 0) {
      this.emitProgress();
      this.eventBus.emit(this.CORE_ASSET_LOADED);
      this.eventBus.emit(this.CORE_LOADED, { type: this.CORE_LOADED });
      return;
    }

    const loadPromises = assetsToLoad.map(async (assetEntry) => {
      try {
        const asset = await this.loadAsset(assetEntry);
        this.cache.set(assetEntry.key, asset);
        this.loadedAssets++;
        this.emitProgress();
      } catch (error) {
        console.error(`ResourceManager: Failed to load asset "${assetEntry.key}" from ${assetEntry.url}:`, error);
        throw error; // Propagate error so that engine initialization is aware of failure
      }
    });

    await Promise.all(loadPromises);
    
    // Emit loaded events (both specification and types/events.ts formats)
    this.eventBus.emit(this.CORE_ASSET_LOADED);
    this.eventBus.emit(this.CORE_LOADED, { type: this.CORE_LOADED });
  }

  /**
   * Loads a single asset based on its type.
   */
  private async loadAsset(entry: any): Promise<any> {
    const { url, type } = entry;

    switch (type) {
      case 'glb':
      case 'gltf':
        return this.loadGLTF(url);
      case 'png':
      case 'jpg':
      case 'webp':
        return this.loadTexture(url);
      case 'mp3':
      case 'wav':
        return this.loadAudio(url);
      default:
        throw new Error(`Unsupported asset type: ${type}`);
    }
  }

  private loadGLTF(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.load(
        url,
        (gltf) => resolve(gltf),
        undefined,
        (error) => {
          console.error(`GLTFLoader error for ${url}:`, error);
          reject(error);
        }
      );
    });
  }

  private loadTexture(url: string): Promise<THREE.Texture> {
    return new Promise((resolve, reject) => {
      const loader = new THREE.TextureLoader();
      loader.load(
        url,
        (texture) => resolve(texture),
        undefined,
        (error) => {
          console.error(`TextureLoader error for ${url}:`, error);
          reject(error);
        }
      );
    });
  }

  private loadAudio(url: string): Promise<HTMLAudioElement> {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      
      const onCanPlay = () => {
        cleanup();
        resolve(audio);
      };

      const onError = (error: any) => {
        cleanup();
        reject(error);
      };

      const cleanup = () => {
        audio.removeEventListener('canplaythrough', onCanPlay);
        audio.removeEventListener('error', onError);
      };

      audio.addEventListener('canplaythrough', onCanPlay);
      audio.addEventListener('error', onError);
      
      // Trigger load
      audio.src = url;
      audio.load();
    });
  }

  /**
   * Retrieves a loaded asset from the cache.
   */
  public get(key: string): any {
    const asset = this.cache.get(key);
    if (!asset) {
      throw new Error(`Asset with key "${key}" not found in cache.`);
    }
    return asset;
  }

  /**
   * Emits current loading progress.
   */
  private emitProgress(): void {
    const progress: AssetLoadProgress = {
      loaded: this.loadedAssets,
      total: this.totalAssets,
      percentage: this.totalAssets > 0 ? (this.loadedAssets / this.totalAssets) * 100 : 100,
    };

    // Emit specification event format
    this.eventBus.emit(this.CORE_LOADING_PROGRESS, progress);

    // Emit types/events.ts event format
    this.eventBus.emit(this.CORE_PROGRESS, {
      type: this.CORE_PROGRESS,
      progress: { ...progress }
    });
  }

  /**
   * Disposes all cached assets recursively to prevent WebGL GPU memory leaks.
   */
  public dispose(): void {
    this.cache.forEach((asset, key) => {
      try {
        if (asset && asset.scene && (asset.scene instanceof THREE.Group || asset.scene instanceof THREE.Scene)) {
          // It's a GLTF/GLB object
          this.disposeGLTF(asset);
        } else if (asset instanceof THREE.Texture) {
          // Standard texture
          asset.dispose();
        } else if (asset instanceof HTMLAudioElement) {
          // Audio elements
          asset.pause();
          asset.src = '';
          asset.load();
        } else if (asset && typeof asset.dispose === 'function') {
          // Fallback for any other objects with dispose
          asset.dispose();
        }
      } catch (error) {
        console.warn(`ResourceManager: Error disposing asset with key "${key}":`, error);
      }
    });
    this.cache.clear();
    this.loadedAssets = 0;
    this.totalAssets = 0;
  }

  /**
   * Helper to recursively dispose of GLTF/GLB scene objects.
   */
  private disposeGLTF(gltf: any): void {
    if (!gltf || !gltf.scene) return;

    gltf.scene.traverse((object: any) => {
      if (object.geometry) {
        object.geometry.dispose();
      }

      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach((mat: THREE.Material) => this.disposeMaterial(mat));
        } else {
          this.disposeMaterial(object.material);
        }
      }
    });
  }

  /**
   * Helper to dispose of a material and its associated maps/textures.
   */
  private disposeMaterial(material: THREE.Material): void {
    if (!material) return;

    // Dispose of the material itself
    material.dispose();

    // Traverse all material properties to find and dispose of textures
    for (const key of Object.keys(material)) {
      const value = (material as any)[key];
      if (value && value instanceof THREE.Texture) {
        value.dispose();
      }
    }
  }
}
