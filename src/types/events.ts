/**
 * Standardized Event Names for the entire application.
 * Format: [DOMAIN]:[ACTION]
 */
export enum Domain {
  CORE = 'CORE',
  UI = 'UI',
  NAV = 'NAV',
  SCENE = 'SCENE',
  CAMERA = 'CAMERA',
  ENTITY = 'ENTITY',
  ANIMATION = 'ANIMATION',
  STATE = 'STATE',
  ASSET = 'ASSET',
  MODAL = 'MODAL',
  CHRONOMETER = 'CHRONOMETER'
}

export enum Action {
  LOADED = 'LOADED',
  PROGRESS = 'PROGRESS',
  CHANGE = 'CHANGE',
  NAVIGATE = 'NAVIGATE',
  MENU_OPEN = 'MENU_OPEN',
  MENU_CLOSE = 'MENU_CLOSE',
  OPEN = 'OPEN',
  CLOSE = 'CLOSE',
  MOVE = 'MOVE',
  CLICK = 'CLICK',
  HOVER = 'HOVER',
  TRIGGER = 'TRIGGER'
}

/**
 * Typed event payloads to ensure strict typing across the EventBus.
 */
export type AppEventName = 
  | `${Domain.CORE}:${Action.LOADED}`
  | `${Domain.CORE}:${Action.PROGRESS}`
  | `${Domain.STATE}:${Action.CHANGE}`
  | `${Domain.NAV}:${Action.NAVIGATE}`
  | `${Domain.NAV}:${Action.MENU_OPEN}`
  | `${Domain.NAV}:${Action.MENU_CLOSE}`
  | `${Domain.UI}:${Action.CLICK}`
  | `${Domain.UI}:${Action.HOVER}`
  | `${Domain.MODAL}:${Action.OPEN}`
  | `${Domain.MODAL}:${Action.CLOSE}`
  | `${Domain.CAMERA}:${Action.MOVE}`
  | `${Domain.CAMERA}:${Action.CHANGE}`
  | `${Domain.ENTITY}:${Action.CLICK}`
  | `${Domain.ENTITY}:${Action.HOVER}`
  | `${Domain.ANIMATION}:${Action.TRIGGER}`
  | `${Domain.CHRONOMETER}:${Action.CHANGE}`;

export type AppEventPayload =
  | { type: `${Domain.CORE}:${Action.LOADED}` }
  | { type: `${Domain.CORE}:${Action.PROGRESS}`; progress: { loaded: number; total: number; percentage: number } }
  | { type: `${Domain.STATE}:${Action.CHANGE}`; state: any }
  | { type: `${Domain.NAV}:${Action.NAVIGATE}`; target: string }
  | { type: `${Domain.NAV}:${Action.MENU_OPEN}` }
  | { type: `${Domain.NAV}:${Action.MENU_CLOSE}` }
  | { type: `${Domain.UI}:${Action.CLICK}`; elementId: string }
  | { type: `${Domain.UI}:${Action.HOVER}`; elementId: string }
  | { type: `${Domain.MODAL}:${Action.OPEN}`; contentId: string }
  | { type: `${Domain.MODAL}:${Action.CLOSE}` }
  | { type: `${Domain.CAMERA}:${Action.MOVE}`; position: [number, number, number]; rotation: [number, number, number]; fov: number }
  | { type: `${Domain.CAMERA}:${Action.CHANGE}`; mode: string }
  | { type: `${Domain.ENTITY}:${Action.CLICK}`; entityId: string }
  | { type: `${Domain.ENTITY}:${Action.HOVER}`; entityId: string }
  | { type: `${Domain.ANIMATION}:${Action.TRIGGER}`; sequenceName: string; data?: any }
  | { type: `${Domain.CHRONOMETER}:${Action.CHANGE}`; year: number };
