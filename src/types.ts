// File format used by dungeonblocksbuilder.com map download/upload.
export interface DbbTile {
  x: number;
  y: number;
  element: string;
  orientation: number;
}

export interface DbbLevel {
  index: number;
  tiles: DbbTile[];
}

export interface DbbDesign {
  id?: string;
  title?: string;
  description?: string;
  creationDate?: string;
  modificationDate?: string;
  ownerId?: string;
  levels: DbbLevel[];
}

// Entry of https://dungeonblocksbuilder.com/catalogue/elements-v1.json
export interface CatalogElement {
  id: string;
  code: string;
  name: string;
  type: string;
  layout: string;
  footprint: [number, number];
  height: number;
  top: string;
  bottom: string;
  tags?: string[];
  orientable: boolean;
  free?: boolean;
  renderOffsetX?: number;
  renderOffsetY?: number;
}

export type Projection = 'isometric' | 'top';
export type SpriteSet = 'isometric' | 'classic';
