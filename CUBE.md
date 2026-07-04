# Rubik's Cube Implementation Plan

This document outlines the detailed architectural and implementation plan for adding an interactive 3D Rubik's Cube mini-game to the **Experience World**.

---

## 1. Overview

We will implement an interactive **3x3x3 Rubik's Cube** within the `PortfolioScene` (Experience World) that the player's robot character can approach and interact with. 

When nearby:
1. A holographic Proximity Popup will ask the player if they want to **"SHUFFLE AND SOLVE"** the cube.
2. Upon confirmation, the camera will smoothly pan to a fixed, zoomed-in, orthographic-like cinematic perspective (similar to the Tetris arcade game).
3. The Rubik's Cube will float/hover in the air in front of the camera, and an automated shuffling animation will spin layers randomly.
4. After shuffling, the user can solve the cube using mouse interactions:
   - **Clicking and dragging on the cube faces** will rotate the corresponding layer.
   - **Holding `Ctrl` and dragging the mouse** will rotate the entire cube in 3D space to view other sides.
5. An **"Auto Solve"** button will be displayed on the HUD overlay, which will play an animated sequence reversing all moves (including shuffles and user moves) to return the cube to its solved state perfectly.

---

## 2. Key Components

### 1. `RubiksCubeActor.ts` (New Actor Entity)
A custom actor that extends `BaseActor` (or similar base class used in the project) which handles:
- Creating the 27 smaller cubies (meshes with colored stickers/faces).
- Managing local groupings and performing animated layer rotations (U, D, L, R, F, B).
- Raycasting to detect which cubie and face sticker was clicked, and mapping mouse drags to layer moves.
- Tracking move history (a stack of executed moves) to enable the "Auto Solve" feature.

### 2. Proximity Trigger and Camera Panning (`PortfolioScene.ts`)
- Spawning the Rubik's Cube in a designated space (e.g., Northwest or Southwest quadrant) of the arena floor.
- Checking proximity between the player robot and the cube.
- Launching the interactive mode, hiding the robot model or fading it, and panning the camera system using `gsap`.
- Resetting the camera and robot when exiting the game.

### 3. Web UI HUD Overlay (`styles/hud.css` and HTML injection)
- Showing custom overlays with the **"AUTO SOLVE"** and **"EXIT GAME"** buttons.
- Displaying interactive tips (`Ctrl + Mouse` to rotate the cube).

---

## 3. Implementation Phases

```
+-----------------------------------------------------------+
| PHASE 1: Actor & Visual Setup (Mesh & Cubies Creation)    |
+-----------------------------------------------------------+
                              |
                              v
+-----------------------------------------------------------+
| PHASE 2: Layer Rotations & Move Tracking Math             |
+-----------------------------------------------------------+
                              |
                              v
+-----------------------------------------------------------+
| PHASE 3: Mouse Interactions (Ctrl-Rotate & Drag-Turn)     |
+-----------------------------------------------------------+
                              |
                              v
+-----------------------------------------------------------+
| PHASE 4: Shuffle, Solve Stack, and HUD UI Integration     |
+-----------------------------------------------------------+
```

### Phase 1: Actor & Visual Setup
- Create `src/entities/actors/RubiksCubeActor.ts`.
- In `RubiksCubeActor.ts`, create a parent `THREE.Group` that holds 27 cubies.
- Each cubie is a `THREE.Mesh` with `BoxGeometry`. 
- Define standard Rubik's Cube colors for the stickers:
  - **Up (U):** White
  - **Down (D):** Yellow
  - **Left (L):** Orange
  - **Right (R):** Red
  - **Front (F):** Green
  - **Back (B):** Blue
  - **Internal/Shared Faces:** Dark Grey (`0x111115`).
- Position the 27 cubies in a grid spacing of `(x, y, z)` where each coordinate is `-1`, `0`, or `1` multiplied by the block spacing factor (e.g. `1.1` to leave a tiny gap for high visual definition).

### Phase 2: Layer Rotations & Move Tracking Math
- Implement a method `rotateLayer(axis: 'x' | 'y' | 'z', layerIndex: -1 | 0 | 1, angleDirection: 1 | -1, duration: number)` to rotate a specific slice.
- Selection Logic: Find all 9 cubies where `Math.round(cubie.position[axis]) === layerIndex` (relative to the cube's local space).
- Pivot Rotation Technique:
  1. Create a temporary `THREE.Group` pivot at the origin of the Rubik's cube.
  2. Move the 9 selected cubies into this pivot group (using `pivot.attach()`).
  3. Animate the rotation of the pivot group around the target axis by `+/-(Math.PI / 2)` using `gsap` or a frame-rate independent tween.
  4. Once completed, re-parent the 9 cubies back to the main cube group (using `cubeGroup.attach()`) to lock their new positions and orientations in world/local space, then destroy the temporary pivot.
- Track all moves in an array/stack: `moveHistory: { axis: string, layer: number, dir: number }[]`. When user makes a move, push it. When shuffling, push it.

### Phase 3: Mouse Interactions (Ctrl-Rotate & Drag-Turn)
- Register pointer event listeners (`pointerdown`, `pointermove`, `pointerup`) on the canvas while active.
- **Ctrl + Drag (Cube Rotation):**
  - If `Ctrl` is held down, apply rotation to the main `RubiksCubeActor.mesh` based on screen `deltaX` and `deltaY`. This rotates the entire cube.
- **Normal Drag (Layer Rotation):**
  - Raycast to locate the clicked cubie and face normal.
  - On drag start, record the start screen coordinate and the intersection face.
  - On drag move/end, if the drag distance exceeds a threshold:
    - Compute the drag direction vector in screen coordinates.
    - project/map this drag vector to determine which layer rotation is intended based on the clicked face.
    - Trigger the appropriate `rotateLayer` animation and push the inverse action to the solve stack.

### Phase 4: Shuffling & Solving Algorithms
- **Shuffling:**
  - When the game starts, perform an automated shuffle.
  - Select 15-20 random valid slice rotations (e.g. random axis, random layer, random direction).
  - Play them in quick succession or animate them with a brief duration (e.g. 0.15s per move) to make it visually satisfying.
  - Push each shuffle move to the `moveHistory` stack.
- **Auto-Solve Animation:**
  - Read the `moveHistory` stack.
  - Pop moves one-by-one from the history and execute their exact inverse moves in reverse order.
  - Animate them sequentially (e.g. 0.3s per move) until the history stack is empty and the cube is perfectly solved!
  - Block mouse interactions while shuffling or auto-solving is active.

### Phase 5: Experience World Proximity & Camera Flow
- Add `RubiksCubeActor` to `PortfolioScene.ts`.
- Set its physical placement on the arena floor (e.g., coordinate `x: 0, y: -4, z: -10`).
- Implement the proximity check in the scene update loop (distance between player and cube < 2.0).
- Create a UI proximity popup in `PortfolioScene.ts` with **"SHUFFLE AND SOLVE"** button.
- When clicked:
  - Transition camera to fixed coordinate looking down/at the cube (`gsap` transition of camera position, rotation, and fov).
  - Hover/float the Rubik's cube up in the air smoothly (`gsap` translation).
  - Lock character input and enable custom HUD controls.
  - Trigger shuffle and enable mouse interaction.
- Add an "AUTO SOLVE" button to the HUD overlay. Clicking it blocks input and triggers the Phase 4 solve sequence.
- Add an "EXIT" button to the HUD, which transitions the camera back behind the robot and lands the cube back on its pedestal.

---

## 4. Technical Considerations & Edge Cases

1. **Floating Point Precision in Rotations:**
   After rotating a layer by `90` degrees (e.g. `Math.PI / 2`), positions and rotations may have tiny floating-point inaccuracies. Re-parenting using `cubeGroup.attach()` is generally resilient, but snapping the positions and rotations of each cubie to their exact mathematical grids (multiples of `Math.PI / 2` and integer coordinate indices) upon rotation completion guarantees long-term stability without drift.
2. **Double Rotations / Interaction Locking:**
   Inputs must be locked while a layer rotation, a shuffle, or an auto-solve is in progress. Set a boolean flag `isAnimating: boolean` and reject any new clicks or drags until the animation completes.
3. **Responsive Drag Vector Mapping:**
   Mapping a 2D screen drag vector to a 3D layer turn can be complex depending on camera orientation. A robust, simpler alternative or fallback is offering a beautifully-styled on-screen keyboard/HUD overlay helper with layer rotation buttons (U, D, L, R, F, B) for ultimate ease-of-use alongside direct mouse layer dragging.

---

## 5. Success Criteria

- [ ] Rubik's Cube actor is successfully instantiated and rendered on the ground with 27 distinct cubies and stickers.
- [ ] Proximity trigger successfully activates a "Shuffle & Solve" prompt when the robot is near.
- [ ] Camera smoothly pans to a locked perspective looking at the hovering cube.
- [ ] Layer rotation math correctly rotates any 3x3 slice by 90 degrees without visual misalignment or mesh detachment.
- [ ] Whole-cube rotation with `Ctrl + Drag` works flawlessly.
- [ ] Random shuffling executes a satisfying sequence of random turns.
- [ ] Direct mouse dragging on faces translates to correct layer moves.
- [ ] "Auto Solve" button animates and completely solves the cube back to original state.
- [ ] "Exit" returns camera and robot to normal mode.
