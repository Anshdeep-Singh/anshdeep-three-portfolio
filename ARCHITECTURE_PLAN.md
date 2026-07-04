# Technical Architecture Plan: Interactive 3D Portfolio

## 1. Overall Application Architecture: The Mediator-Orchestrator Pattern
The application follows a **Mediator-Orchestrator** architecture. This pattern is chosen to maintain strict separation between the three primary layers: the **WebGL Engine** (3D), the **DOM UI** (Interface), and the **State/Logic** (Data/Core).

### Layers
- **Core (Orchestrator):** The "brain" that manages the lifecycle, coordination, and communication between layers.
- **WebGL Layer (The World):** A high-performance Three.js implementation that handles rendering, physics, and 3D spatial logic.
- **DOM Layer (The Interface):** A standard HTML/CSS layer that provides accessibility, text-heavy content, and complex user inputs.

### Why this pattern?
- **Why:** It prevents the "spaghetti" dependency problem where 3D objects directly manipulate DOM elements (or vice-versa), which is hard to debug and scale.
- **Advantages:** 
    - **Decoupling:** You can replace the entire UI layer with a different technology (e.g., moving from vanilla CSS to a specialized UI tool) without touching the 3D logic.
    - **Testability:** Each layer can be tested in isolation.
    - **Maintainability:** Logic is centralized in the Core, making it easy to track how a user action in the UI affects the 3D world.
- **Trade-offs:** Requires more boilerplate code upfront to set up the "Bridge" (Mediators) and communication channels.
- **Alternative approach:** A "Framework-style" approach (like React + React Three Fiber) where everything is reactive. We are avoiding this to ensure maximum performance and zero-framework overhead.

---

## 2. Design Philosophy
- **Immersive Minimalism:** The UI should feel like an integrated "HUD" (Heads-Up Display) within the 3D space, rather than a separate layer floating on top.
- **Motion as Communication:** GSAP-driven animations are not just decorative; they are used to direct user attention and signal state changes.
- **Spatial Information Architecture:** Data (Projects, Resume, Skills) is mapped to 3D spatial positions, allowing the user to "navigate" through information.

---

## 3. Folder Structure
A modular, domain-driven structure designed for local development and small context windows.

```text
src/
├── assets/            # Static assets (3D models, textures, audio, fonts)
├── core/              # The "Engine" - Singletons & Orchestrators
│   ├── Engine.ts      # Main loop, lifecycle management (init, update, render)
│   ├── EventBus.ts    # Centralized Pub/Sub for cross-layer communication
│   ├── State.ts       # Reactive, unidirectional data store
│   ├── CameraSystem.ts # Management of multiple camera modes & transitions
│   └── ResourceManager.ts # Async asset loading, caching, and disposal
├── entities/          # 3D World objects (The "Actors")
│   ├── base/          # Abstract classes and interfaces for 3D objects
│   ├── components/    # Reusable logic (e.g., Clickable, Rotatable, Hoverable)
│   └── actors/        # Concrete implementations (e.g., ProjectModel, UIWidget3D)
├── ui/                # DOM-based UI components
│   ├── components/    # Reusable HTML/CSS fragments (e.g., Modals, Buttons)
│   ├── controllers/   # Logic that binds DOM events to Core events
│   └── view/          # The DOM structure (Template-based orchestration)
├── scene/             # Scene composition & staging
│   ├── scenes/        # Discrete "States" (e.g., HomeScene, ProjectScene)
│   └── stage/         # Environmental elements (Skybox, Lighting, Floor)
├── utils/             # Pure math, helper functions, and constants
├── styles/            # Global CSS, Design Tokens (Variables), and Reset
├── types/             # TypeScript interfaces and global types
└── main.ts            # Application entry point
```

---

## 4. Module Boundaries & Decoupling
To combat limited context windows, we enforce **Strict Unidirectional Dependency**:

1.  **`Core`** $\rightarrow$ No dependencies on `Entities` or `UI`.
2.  **`Entities`** $\rightarrow$ Depends on `Core` (to emit events/read state).
3.  **`UI`** $\rightarrow$ Depends on `Core` (to listen to events/read state).
4.  **`Scene/Controllers`** $\rightarrow$ Orchestrate `Entities` and `UI` using `Core`.

**The Golden Rule:** A 3D `Entity` must **never** contain a reference to a DOM element. Instead, it emits a `PROJECT_SELECTED` event to the `EventBus`. The `UI Controller` hears this event and updates the DOM.

---

## 5. Separation of UI and Three.js
We use a **Bridge Pattern** mediated by the `EventBus` and `State`.

- **Communication Flow (Input):**
  `User clicks Button (DOM)` $\rightarrow$ `UI Controller` $\rightarrow$ `EventBus (EVENT_NAME)` $\rightarrow$ `Engine/CameraSystem` $\rightarrow$ `3D Animation`.
- **Communication Flow (Feedback):**
  `3D Object Clicked (Three.js)` $\rightarrow$ `Entity` $\rightarrow$ `EventBus (ENTITY_SELECTED)` $\rightarrow$ `UI Controller` $\rightarrow$ `DOM Update`.

This ensures the WebGL layer is a "pure" renderer of the state and the DOM is a "pure" representation of the interface.

---

## 6. Rendering Architecture
A single-loop, frame-synchronous architecture managed by the `Engine`.

### The Main Loop Lifecycle (per frame):
1.  **Input Processing:** Capture mouse/touch/keyboard state.
2.  **State Update:** Compute logic, physics, and data changes (Uninterrupted).
3.  **Entity Update:** Update 3D object positions, rotations, and animations.
4.  **Camera Update:** Interpolate camera position/rotation (GSAP/Smoothing).
5.  **Render:** `renderer.render(scene, camera)`.

**Advantages:** Predictable timing, prevents "jitter" caused by mismatched update/render rates, and simplifies synchronization between 3D and UI.

---

## 7. Navigation Architecture: State-Based Scene Management
Navigation is treated as a **State Machine** rather than a "Page Load".

- **States:** `IDLE`, `EXPLORING`, `FOCUSING_PROJECT`, `MINI_GAME_ACTIVE`, `RESUME_VIEW`.
- **Transitions:** When a state changes, the `CameraSystem` triggers a GSAP tween to move the camera from its current position to a predefined "viewpoint" for the new state.
- **Advantages:** Smooth, cinematic transitions without the white flash of page reloads.

---

## 8. Camera Architecture: Multi-Mode Controller
We use a single `PerspectiveCamera` for the main world, managed by a `CameraSystem`.

- **Modes:**
    - **Exploration Mode:** Free-look or constrained orbital camera.
    - **Focus Mode:** Fixed camera looking at a specific `Entity`.
    - **UI Mode:** Orthographic/Static view for reading text.
- **Implementation:** All transitions use **GSAP** to interpolate `position`, `rotation`, and `fov` (Field of View) to create a seamless "fly-through" experience.

---

## 9. Animation Architecture: GSAP Orchestration
Animations are handled in two distinct ways to ensure performance and clarity.

- **3D Animations (Continuous/Complex):** 
    - **GSAP:** For property tweens (position, rotation, scale).
    - **Three.js AnimationMixer:** For skeletal/morph animations on imported 3D models.
- **UI Animations (Discrete/Reactive):**
    - **GSAP:** For entry/exit animations of DOM elements.
    - **CSS Transitions:** For simple hover states and layout shifts.
- **Synchronization:** A `TimelineManager` allows for complex, multi-element sequences (e.g., "Camera moves $\rightarrow$ 3D model spins $\rightarrow$ UI text fades in").

---

## 10. State Management: Reactive Observer Store
A lightweight, custom-built **Unidirectional Data Store**.

- **Mechanics:** A central `Store` holds the application's single source of truth.
- **Reactivity:** Components (both 3D and DOM) `subscribe` to specific slices of the state.
- **Benefits:** Zero dependencies, minimal memory footprint, and predictable data flow.

---

## 11. Event Communication: The Central Event Bus
A typed, lightweight `EventEmitter` for "fire-and-forget" signals.

- **Use Case:** Signals that don't represent "State" but are "Actions" (e.g., `PLAY_SOUND`, `TRIGGER_VIBRATION`, `TRIGGER_SCREEN_SHAKE`).

---

## 12. Asset Organization: Manifest-Driven Loading
A `ResourceManager` ensures the application doesn't attempt to render before assets are ready.

- **Manifest:** A JSON/Object definition of all required assets (GLB, PNG, MP3).
- **Loading Lifecycle:** `Loading Screen (UI)` $\rightarrow$ `ResourceManager.loadAll()` $\rightarrow$ `Engine.start()`.
- **Disposal:** Crucial for performance; the `ResourceManager` tracks all allocated `Geometry`, `Material`, and `Texture` to call `.dispose()` when a scene is destroyed.

---

## 13. CSS Architecture: Design Tokens & Modular Scoping
- **Design Tokens:** Centralized `:root` variables for colors, spacing, typography, and timing.
- **BEM (Block Element Modifier):** Used to keep DOM class names semantic and prevent style leakage.
- **Responsive Design:** Extensive use of `clamp()`, `rem`, and `aspect-ratio` to ensure the UI scales perfectly across devices.

---

## 14. Performance Strategy: The "Zero-Waste" Approach
- **Geometry/Texture Management:** Automated disposal of assets via `ResourceManager`.
- **Draw Call Optimization:** Use `InstancedMesh` for repetitive decorative elements.
- **Culling:** Use Three.js frustum culling + custom visibility logic for complex scenes.
- **Lazy Loading:** Assets for "Mini Games" or "Project Details" are loaded only when the user approaches that state.

---

## 15. Responsive Strategy: Adaptive Scaling
- **UI Layer:** Uses CSS Flexbox/Grid for a fluid, responsive interface.
- **WebGL Layer:** Listens to `window.resize`. Re-calculates `camera.aspect` and `renderer.setPixelRatio` to prevent stretching and maintain sharpness.

---

## 16. Accessibility (A11y) Strategy: Parallel DOM
The website is accessible via a **Parallel DOM approach**.

- **The "Hidden" Content:** All critical text content (Project descriptions, Resume text) exists in the DOM as standard HTML, styled (e.g., visually hidden or placed behind the canvas) to be readable by screen readers.
- **Interaction:** Keyboard navigation is implemented via the `UI Controller` to allow users to "tab" through menu items that might be visually represented in 3D.
- **Aria-Live:** Used for dynamic text updates (e.g., when a user selects a new project).

---

## 17. Build Process: Vite-Powered Pipeline
- **Vite:** For ultra-fast HMR (Hot Module Replacement) and optimized production builds.
- **TypeScript:** Strict mode enabled to prevent runtime errors in the complex 3D/Logic boundary.
- **PostCSS:** For automated vendor prefixing and CSS optimization.

---

## 18. Future Scalability: Plugin-Based Modules
The architecture is designed to be "additive". 
To add a new "Mini Game":
1.  Create a new folder in `src/entities/games/`.
2.  Implement a `GameActor` (3D) and a `GameUIController` (DOM).
3.  Register the new state in the `StateStore`.
4.  The core `Engine` requires **zero changes** to support the new content.

---

## 19. Risks and Mitigation

| Risk | Mitigation |
| :--- | :--- |
| **GPU/Memory Leaks** | Strict `ResourceManager.dispose()` and lifecycle-aware `Entities`. |
| **Complexity/Performance Bloat** | Modular "State-based" asset loading (only load what's visible). |
| **Animation Desync** | Centralized `TimelineManager` and single-loop `Engine`. |
| **Large File Sizes** | Use of `.glb` (Draco compression) and optimized texture formats. |

---

## 20. Recommended Development Phases

- **Phase 1: The Core Engine:** Implement `Engine`, `EventBus`, `State`, and `ResourceManager`. (The Foundation).
- **Phase 2: The Bridge:** Implement the `CameraSystem` and basic `UI-to-3D` event communication. (The Skeleton).
- **Phase 3: The World:** Build the "Overview" scene and basic `Entities`. (The Body).
- **Phase 4: The Detail:** Implement specific "Project" views and GSAP-heavy transitions. (The Muscle).
- **Phase 5: The Polish:** Implement Accessibility, Performance optimizations, and Final Assets. (The Skin).