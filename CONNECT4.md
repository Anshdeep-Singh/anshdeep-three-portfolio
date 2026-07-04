# CONNECT 4 3D GAME - DETAILED IMPLEMENTATION PLAN

This plan outlines the design and integration of a full working **3D Connect 4 game** using Three.js, featuring a hard-difficulty CPU opponent, particle transitions, proximity trigger activations, custom HUD controls, and sound/visual effects.

---

## 1. System Architecture Overview

The Connect 4 game will follow the existing patterns in the project (such as `RubiksCubeActor` and `TetrisPileActor`). It will be placed at the **East-Center** region (`X: +18, Z: 0`), perfectly balancing the room while avoiding any collision with the Voxel Painter (which occupies the SE quadrant at `X: +18, Z: -18`):
- **Northeast (NE):** Tetris
- **Northwest (NW):** Snake
- **Southwest (SW):** Car Sandbox
- **Southeast (SE):** Voxel Painter
- **East-Center (E):** Connect 4

### Core Components

```
+--------------------------------------------------------------------------+
|                            PortfolioScene                                |
+--------------------------------------------------------------------------+
       |                                                            |
       v (Spawns & Updates)                                         v (Sets UI controls)
+------------------------------------+                       +---------------+
|          Connect4Actor             |                       |  HTML UI HUD  |
+------------------------------------+                       +---------------+
| - pileGroup (Scattered Discs)      |                               |
| - boardGroup (Grid & Dropped)      |                               | (Emits clicks &
| - particles (Dissolve shader)      | <-----------------------------+  control keys)
| - Minimax CPU AI (Hard Mode)       |
| - Raycaster (Column picking)       |
+------------------------------------+
```

1. **Connect4Actor (`src/entities/actors/Connect4Actor.ts`)**:
   - Manages the dual states: **Pile/Scattered State** (discs lying on the floor) and **Board/Assembled State** (a vertical 3D Connect 4 grid hovering).
   - Contains a **Shader-based Particle Dissolve system** that triggers when the player initiates gameplay, smoothly dispersing the pile into floating cybernetic particles that coalesce into the playable grid.
   - Houses the **Connect 4 Game Logic** (6 rows x 7 columns grid) and the **Minimax CPU AI (Hard Mode)**.
   - Processes player interactions via mouse/pointer raycasting (hover columns and click to drop) and keyboard controls.

2. **UI HUD Integration**:
   - Proximity prompt popup (`#connect4-proximity-popup`) appears when the player wanders near the pile (distance < 2.5m).
   - Side-panel HUD (`#connect4-panel`) showing game state, whose turn it is, current scores (Player vs. AI), a drop button, and an active FORFEIT / QUIT button.

---

## 2. Connect 4 Actor States & Phase Flow

The gameplay lifecycle goes through 4 distinct phases:

```
  +--------------+     Proximity < 2.5     +------------------+
  |  SCATTERED   | ----------------------> |    ASSEMBLING    |
  |  (Disc Pile) | <---------------------- | (Move Up & Fade) |
  +--------------+     Proximity > 3.0     +------------------+
                                                     |
                                                     | Player Starts Game
                                                     v
  +--------------+      Exit / Reset       +------------------+
  |  DISSOLVING  | <---------------------- |   ACTIVE PLAY    |
  | (To Particles|                         | (Red/Yellow Drop)|
  +--------------+                         +------------------+
```

1. **Scattered Pile State**:
   - Discs of two colors (Neon Red and Cyan/Yellow) are lying in a loose, glowing heap on the floor.
   - Gently rotates and breathes with a subtle sinusoidal offset.

2. **Assembled Hover State**:
   - When the player is within **2.5m** range, the actor smoothly hovers up to eye level (`Y: -2.5`).
   - The empty vertical grid fades in with neon wireframes.
   - The scattered discs on the floor remain visible but slightly dimmed.

3. **Active Gameplay State**:
   - Triggered when the player clicks "Start Simulation".
   - **Disperse Animation**: The pile discs dissolve into tiny glowing particles that explode outwards and fly up to form the active game board.
   - Red or Yellow player is chosen at random to go first.
   - If CPU goes first, it calculates and drops its first disc.
   - Player can hover columns (by moving the mouse or Left/Right keys) and drop a disc (by clicking or pressing Space/Enter).

4. **Dissolve & Reset State**:
   - When the game ends or player forfeits, the active discs and board dissolve back into particles, and the scattered pile is restored on the floor as the board lowers.

---

## 3. High-Difficulty Minimax CPU Opponent

To make "Hard Mode" truly challenging, we will implement an optimized **Minimax algorithm with Alpha-Beta pruning**:

* **State representation**: Simple 6x7 grid of strings (`'R'` for Red player, `'Y'` for Yellow CPU, `null` for empty).
* **Search Depth**: `6` or `7` plies (calculating up to 7 moves ahead in <15ms).
* **Column Search Ordering**: Evaluate columns starting from the center outward `[3, 2, 4, 1, 5, 0, 6]`. This maximizes Alpha-Beta pruning cutoffs.
* **Heuristic Evaluation Function**:
  - **4-in-a-row (Win)**: `+1,000,000` (CPU), `-1,000,000` (Player).
  - **3-in-a-row (Open ends)**: `+1,000` (CPU), `-5,000` (Player - heavily penalize and prioritize blocking player wins).
  - **2-in-a-row**: `+50` (CPU), `-100` (Player).
  - **Center Column Control**: Small positional bonus for discs in column 3 (`+15` per disc) as it's the most valuable strategic column.

---

## 4. Implementation Steps (Phases)

### Phase 1: Define Actor and Core Geometry
- [ ] Create `src/entities/actors/Connect4Actor.ts` extending `BaseActor`.
- [ ] Implement the Connect 4 Board geometry:
  - Backboard/front plate (two transparent neon plates with 6x7 circular cutouts, or a grid of wireframe boxes).
  - Create the 3D Disc geometry (Cylinder with beveled edges or a flat torus).
- [ ] Implement `setToPile()`: scattered positions and rotations for 42 discs on the ground level.

### Phase 2: Add Particle Dissolve Shader & Animations
- [ ] Add `setupParticles()` to pre-calculate particle starting positions from the pile and trajectories.
- [ ] Write vertex and fragment shaders for the additive blending points.
- [ ] Create `assembleFromPile()` and `dissolveToPile()` methods utilizing GSAP to drive the custom shader progress uniforms.

### Phase 3: Implement Game Logic & AI Opponent
- [ ] Build the underlying 2D grid matrix and victory-check helper (horizontal, vertical, diagonal checks).
- [ ] Implement `getBestMove()` using the Alpha-Beta Minimax algorithm with heuristic scoring.
- [ ] Add the physical disc dropping animation: when a column is selected and a disc is dropped, animate it sliding down from the top to the lowest available row using a gravity easing curve.

### Phase 4: Proximity HUD and UI Controllers
- [ ] Add `isConnect4Active` state in `src/core/camera/CameraSystem.ts` to block camera motion during gameplay.
- [ ] Add proximity checking inside `PortfolioScene.ts` in the East-Center region (`X: 18, Z: 0`).
- [ ] Create the HTML template for proximity popups and side HUD in `PortfolioScene.ts`.
- [ ] Add buttons and listeners for starting, column clicking, forfeit/quit, and turn updates.
- [ ] Save game score/record across sessions in a local score keeper variable.

---

## 5. Technical Considerations & Success Criteria

### Performance & Edge Cases
- **Raycasting Efficiency**: Restrict raycasting to the active column hover columns/grid mesh to prevent performance lag.
- **Minimax Search Time**: Keep search depth bounded to 7. Ensure it executes on a single frame to prevent freezing the WebGL render loop (runs well under 16ms).
- **Resolution/Viewport**: The Connect 4 board will be scaled large and viewed from slightly below, ensuring all columns are clear and easy to click even on mobile or small viewports.

### Success Criteria
1. Approaching SE quadrant triggers the prompt to play.
2. Clicking play triggers a gorgeous, smooth particle explosion from the pile to assemble the board.
3. Turn order is randomized, and AI plays automatically with smart, hard moves.
4. Win/loss/draw states are properly detected with visual overlays and score updates.
5. Exit/forfeit cleanly resets the game and returns the player to the third-person walking mode.
