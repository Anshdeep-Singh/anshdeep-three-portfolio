# Implementation Specification: Interactive 3D Portfolio

This document is the complete engineering blueprint for the development of the Interactive 3D Portfolio. It is designed for modular implementation by independent AI agents, ensuring each module is self-contained, testable, and architecturally compliant.

---

## 1. UI System (DOM Layer)

### 1.1 Design Tokens & Global Styles
**Module:** `CSS:DesignSystem`
- **Purpose:** Define the visual language.
- **Responsibilities:** Provide consistent values for colors, typography, spacing, and glassmorphism.
- **Public API (CSS Variables):** `--color-primary`, `--color-bg-glass`, `--blur-strength`, `--font-main`, `--spacing-unit`, etc.
- **Files:** `src/styles/tokens.css`, `src/styles/base.css`, `src/styles/variables.css`.
- **Complexity:** Low.

### 1.2 UI Module: Navigation
- **Purpose:** Handle site-wide navigation state.
- **Responsibilities:** Render the main nav menu; trigger state changes when items are clicked.
- **Dependencies:** `Core:State`, `Core:EventBus`, `UI:Components`.
- **Public API:** `showNav()`, `hideNav()`, `setNavItem(id)`.
- **Inputs:** User click events.
- **Outputs:** `NAV:NAVIGATE` event with `target`.
- **Events:** `NAV:NAVIGATE`, `NAV:MENU_OPEN`, `NAV:MENU_CLOSE`.
- **Lifecycle:** `mount()` (on app init), `destroy()`.
- **Complexity:** Medium.

### 1.3 UI Module: Content Cards
- **Purpose:** Generic container for data presentation.
- **Responsibilities:** Implement glassmorphism; handle hover states; render text/image content.
- **Dependencies:** `CSS:DesignSystem`.
- **Public API:** `render(data: CardData)`.
- **Inputs:** Data objects.
- **Outputs:** DOM insertion.
- **Events:** `UI:CARD_HOVER`, `UI:CARD_CLICK`.
- **Complexity:** Low.

### 1.4 UI Module: Modal System
- **Purpose:** Presenting detailed content without leaving the scene.
- **Responsibilities:** Layering (z-index), background dimming, focus trapping, closing on ESC.
- **Dependencies:** `Core:EventBus`, `GSAP`, `CSS:DesignSystem`.
- **Public API:** `open(contentId)`, `close()`.
- **Inputs:** `MODAL:OPEN` event.
- **Outputs:** `MODAL:CLOSE` event.
- **Complexity:** Medium.

---

## 2. Three.js Engine (WebGL Layer)

### 2.1 Core Module: Renderer
- **Purpose:** Managing the WebGL context.
- **Responsibilities:** Setup `WebGLRenderer`, handle pixel ratio, handle post-processing passes.
- **Dependencies:** `Three.js`, `Scene:Stage`.
- **Public API:** `init()`, `resize(width, height)`, `render(scene, camera)`.
- **Inputs:** `window.resize` events.
- **Outputs:** Rendered frame to canvas.
- **Lifecycle:** `init()`, `onResize()`, `dispose()`.
- **Complexity:** Medium.

### 2.2 Core Module: Scene Manager
- **Purpose:** Handling the 3D world composition.
- **Responsibilities:** Managing `THREE.Scene`, adding/removing `Actors`, managing the `Stage`.
- **Dependencies:** `Three.js`, `Core:ResourceManager`, `Entities:BaseActor`.
- **Public API:** `loadScene(sceneId)`, `clearScene()`.
- **Inputs:** `SCENE:LOAD` event.
- **Outputs:** `SCENE:LOADED` event.
- **Lifecycle:** `loadScene()`, `dispose()`.
- **Complexity:** High.

### 2.3 Core Module: Camera System
- **Purpose:** Controlling the user's perspective.
- **Responsibilities:** Managing `PerspectiveCamera`, handling smooth transitions between viewpoints via GSAP.
- **Dependencies:** `Three.js`, `GSAP`, `Core:State`.
- **Public API:** `moveTo(position, rotation, fov)`, `setMode(mode)`.
- **Inputs:** `CAMERA:MOVE` event, `SCENE:TRANSITION_START`.
- **Outputs:** Updated camera properties per frame.
- **Lifecycle:** `init()`, `update()`, `dispose()`.
- **Complexity:** High.

### 2.4 Core Module: Interaction Manager
- **Purpose:** Bridging mouse/touch to 3D space.
- **Responsibilities:** Raycasting to detect intersections with 3D `Entities`.
- **Dependencies:** `Three.js`, `Core:EventBus`.
- **Public API:** `checkIntersections(camera, scene)`.
- **Inputs:** Mouse/Touch movement/clicks.
- **Outputs:** `ENTITY:HOVER`, `ENTITY:CLICK`.
- **Complexity:** Medium.

---

## 3. Animation System (GSAP Orchestration)

### 3.1 Animation Controller
- **Purpose:** Coordinating complex, multi-layer animation sequences.
- **Responsibilities:** Managing high-level timelines that cross-cut UI and 3D.
- **Dependencies:** `GSAP`, `Core:EventBus`.
- **Public API:** `playSequence(sequenceName, data)`, `stopAll()`.
- **Inputs:** `ANIMATION:TRIGGER` events.
- **Outputs:** Triggers for UI and 3D modules.
- **Lifecycle:** `init()`, `dispose()`.
- **Complexity:** High.

---

## 4. State Management (Unidirectional Data Store)

### 4.1 Global Store
- **Purpose:** The single source of truth.
- **Responsibilities:** Holding current navigation, camera state, asset status, and game scores.
- **Dependencies:** `Core:EventBus`.
- **Public API:** `getState()`, `dispatch(action)`.
- **Inputs:** `dispatch()` actions.
- **Outputs:** Emits state change events to subscribers.
- **Lifecycle:** `init()`, `reset()`.
- **Complexity:** Medium.

---

## 5. Event System (Pub/Sub)

### 5.1 Event Bus
- **Purpose:** Decoupled communication.
- **Responsibilities:** Managing event registration and emission.
- **Public API:** `on(event, callback)`, `off(event, callback)`, `emit(event, payload)`.
- **Naming Convention:** `[DOMAIN]:[ACTION]` (e.g., `UI:OPEN_MODAL`).
- **Complexity:** Low.

---

## 6. Asset Pipeline

### 6.1 Resource Manager
- **Purpose:** Centralized loading and memory management.
- **Responsibilities:** Loading `.glb`, `.webp`, `.mp3`; managing cache; ensuring `.dispose()` is called on all assets.
- **Dependencies:** `Three.js`, `Core:EventBus`.
- **Public API:** `loadAll(manifest)`, `get(key)`.
- **Inputs:** Asset manifest (JSON).
- **Outputs:** `CORE:ASSET_LOADED`, `CORE:LOADING_PROGRESS`.
- **Complexity:** Medium.

---

## 7. Coding Standards & Development Strategy

### 7.1 Implementation Phases (for AI Agents)

| Phase | Focus | Description |
| :--- | :--- | :--- |
| **Phase 1** | **The Engine** | Implement `Core/Engine`, `EventBus`, `State`, and `ResourceManager`. Establish the loop and loading. |
| **Phase 2** | **The Bridge** | Implement `CameraSystem` and `InteractionManager`. Test interaction between `Core` and a dummy 3D object. |
| **Phase 3** | **The Interface** | Implement `CSS:DesignSystem` and the `UI/Navigation` & `UI/Modal` systems. |
| **Phase 4** | **The Content** | Build out `Scene/scenes/` and `Entities/actors/` for all showcase areas (Projects, Resume, etc.). |
| **Phase 5** | **The Polish** | Implement `Animation/Controller` for cinematic transitions and final performance tuning. |

### 7.2 Mandatory Rules
1. **No Circular Dependencies:** If `Module A` needs `Module B`, and `Module B` needs `Module A`, they must communicate via the `EventBus`.
2. **Strict Typing:** Every event payload must have an interface defined in `src/types/events.ts`.
3. **Resource Disposal:** Every `Entity` and `Scene` **must** implement a `dispose()` method to prevent WebGL memory leaks.
4. **Single Source of Truth:** Never store state in a DOM element or a Three.js object's `userData` if it affects other modules. Use the `Store`.