export type AssetType = 'glb' | 'gltf' | 'png' | 'jpg' | 'webp' | 'mp3' | 'wav';

export interface AssetManifestEntry {
  key: string;
  url: string;
  type: AssetType;
}

export interface AssetManifest {
  assets: AssetManifestEntry[];
}

export interface AssetLoadProgress {
  loaded: number;
  total: number;
  percentage: number;
}