# 🌌 Immersive 3D Interactive Portfolio & Game World

[![Three.js](https://img.shields.io/badge/Three.js-%23000000.svg?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![GSAP](https://img.shields.io/badge/GSAP-green?style=for-the-badge&logo=greensock&logoColor=white)](https://greensock.com/gsap/)

Welcome to an **Immersive 3D Flight-Controlled Portfolio and Arcade Game World** built from the ground up using **Three.js**, **TypeScript**, and **Vite**.

This is not a traditional flat portfolio page. It is a fully rendered 3D virtual environment designed as an interactive simulation. Users can navigate either via standard orbital camera transitions, an autonomous cinematic **Auto-Pilot** system, or manual **Free-Flight Exploration** with real-time HUD telemetry, telemetry radar sweep systems, and keyboard-driven flight physics. 

Alongside spatial showcases for Projects, Skills, Resume, and About, the environment contains custom-engineered **3D Neon Arcade Mini-Games** with custom physics, AI opponents, and advanced particle mechanics.

---

## 🎮 The Interactive Experience

### 🚀 Exploration Modes
*   **Auto-Pilot Mode:** Select any sector from the navigation menu. The application executes a smooth camera fly-through transition, rotating and framing the chosen actor with cinematically calculated bezier camera trajectories (GSAP).
*   **Manual Flight Exploration:** Press **"Experience World"** to release the camera constraints and pilot a virtual drone.
    *   `W` / `A` / `S` / `D` (or Arrows) to fly horizontally.
    *   `Space` to elevate / `Shift` to descend.
    *   **Mouse Click & Drag** to look around and guide the flight path.
*   **Flight Telemetry HUD:** A custom heads-up display showcasing real-time coordinate coordinates ($X, Y, Z$), camera heading vector calculations, nearest object indicators, and an active sweeping sweep radar interface plotting relative target markers.

### 🕹️ 3D Arcade Mini-Games (Proximity Activated)
Walk or fly near any of the physical game systems scattered around the coordinate grid (distance $< 2.5\text{m}$) to trigger interactive prompts, lock controls, and zoom into dedicated retro orthogonal viewports.

1.  **👾 3D Neon Tetris (`TetrisPileActor`)**
    *   Located at the Northeast (NE) sector.
    *   Features glowing neon wireframes, smooth drop tick intervals, and responsive layout scaling.
    *   Enhanced with custom-engineered **"giggle physics"** (physical spring matrices) and dynamic coordinate alignments.
2.  **🔴 3D Connect 4 (`Connect4Actor`)**
    *   Located at the East-Center (E) sector.
    *   Features a custom **Shader-Based Particle Dissolve** system: when initiated, scattered token meshes on the floor dissolve into high-performance cybernetic particles that coalesce into the playable grid.
    *   Built-in **Hard-Difficulty Minimax CPU AI** that calculates future state heuristics up to 4 moves deep.
3.  **🐍 3D Snake Game (`SnakeGameActor` / `SnakeActor`)**
    *   Located at the Northwest (NW) sector.
    *   Uses **Linear Interpolation (LERP)** to achieve buttery-smooth 60fps movement transitions between grid-cells (removing legacy grid stepping).
    *   Includes animated neon snake eyes, active consumption particle explosions, and a dramatic "Shatter Game-Over" where the snake's entire body disintegrates into physics-simulated debris.
4.  **🧩 Rubik's Cube, Car Sandbox & Voxel Painter**
    *   Interactive sandboxes featuring spatial mouse raycasting and physics dynamics.

---

## 📐 System Architecture

The application is structured around a strict **Mediator-Orchestrator Pattern** to completely separate rendering, state management, and the user interface.

```
                         +-----------------------------------+
                         |          Engine (Core)            |
                         +-----------------+-----------------+
                                           |
                                           | Orchestrates
                                           v
                  +-------------------------------------------------+
                  |              Event Bus (Pub/Sub)                |
                  +--------+-------------------------------+--------+
                           |                               |
          Binds Inputs     | Publishes                     | Listens &
          & Events         | Actions                       | Mutates DOM
                           v                               v
         +-----------------+---------------+    +----------+------------------+
         |           3D Entities           |    |           DOM HUD UI        |
         |         (WebGL / Actor)         |    |        (HTML / CSS / JS)    |
         +---------------------------------+    +-----------------------------+
```

### 🧱 Architectural Layers
1.  **Core Orchestrator (`src/core/`):** Central engine logic. Houses the main game loop, resource loadings, lifecycle triggers, camera state controllers, and physics ticks.
2.  **WebGL Layer (`src/entities/` & `src/scene/`):** Pure rendering layer using Three.js. Standard entities implement a common `Actor` interface detailing custom lifecycles (`init`, `update`, `dispose`).
3.  **DOM Interface Layer (`src/ui/`):** Fluid, glassmorphic HUD built entirely in semantic HTML/CSS, responsive across mobile viewports, and integrated with keyboard layouts.
4.  **The State Bridge:** Direct cross-layer dependency is forbidden. If a 3D Entity is clicked via raycasting, it emits an action to the **Event Bus**. The **DOM UI Controller** listens to this action and safely modifies the HUD without coupling the render loop with document states.

---

## ⚡ Performance Optimization

To achieve a consistent 60fps on both desktop and mobile web environments, several technical strategies are implemented:

*   **Manifest-Driven Loading (`ResourceManager`):** Pre-caches high-fidelity `.glb` models, textures, and assets prior to system start, showing a responsive loading bar.
*   **Strict Memory Garbage Collection:** Standardizes a strict `dispose()` interface. Every single actor, geometry, material, texture, shader, and event listener is fully disposed of when transitioning scenes or shutting down mini-games to prevent GPU and Javascript memory leaks.
*   **Low Overhead State Store:** A custom reactive store tracking game states and coordinates with zero third-party dependencies, minimizing bundle sizes and maximizing reactivity.
*   **Post-Processing & Culling:** Leverages custom frustum culling on high-density particles to prevent off-screen draw-calls.

---

## 📂 Project Structure

```text
src/
├── core/                # Core Orchestrator, Singletons & Systems
│   ├── Engine.ts        # Primary loop, lifecycle manager
│   ├── EventBus.ts      # Pub/Sub system for decoupled architecture
│   ├── ResourceManager.ts # Asset loader, pre-cacher, and garbage collector
│   ├── State.ts         # Unidirectional reactive data store
│   ├── camera/          # Cinematic & Flight navigation systems
│   ├── interaction/     # Raycasters and pointer event systems
│   └── physics/         # Lightweight movement and collision vectors
├── entities/            # 3D Objects & Mini-game Actors
│   ├── base/            # Abstract Actor models
│   └── actors/          # Connect4, Tetris, Snake, Projects, Skills, Resume, etc.
├── scene/               # Stage orchestration (skyboxes, lighting, environments)
├── ui/                  # DOM UI HUD Panels and Controllers
│   ├── components/      # Glassmorphic modals, toasts, cards
│   ├── controllers/     # Event handlers bridging DOM elements and State
│   └── MobileControls.ts # Virtual joysticks and responsive buttons
├── styles/              # Design tokens, variables, and responsive HUD grids
├── types/               # Clean TypeScript definitions and events
└── main.ts              # System Entry Point
```

---

## 🛠️ Local Development

### Prerequisites
*   [Node.js](https://nodejs.org/) (v18.x or higher)
*   [npm](https://www.npmjs.com/) (packaged with Node.js)

### Installation
1.  Clone the repository:
    ```bash
    git clone https://github.com/Anshdeep-Singh/anshdeep-three-portfolio.git
    cd anshdeep-three-portfolio
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Run the local development server:
    ```bash
    npm run dev
    ```
    Open `http://localhost:5173` in your browser.

### Building for Production
To bundle the portfolio with full TypeScript checking, asset minification, and static optimization:
```bash
npm run build
```
To run a local server previewing the optimized production bundle:
```bash
npm run preview
```

---

## 📜 License
This project is licensed under the **ISC License**. Created with passion by **Anshdeep Singh**.
