# Immersive 3D Neon Tetris System Upgrade Specification

This document details the multi-phase implementation plan and upgrades for adding a fully interactive 3D Tetris Game with "giggle physics", neon outline visuals, and advanced arcade gameplay to the Portfolio Experience World.

---

## Architecture Overview

```
                      +-----------------------------+
                      |       PortfolioScene        |
                      +--------------+--------------+
                                     |
             +-----------------------+-----------------------+
             |                                               |
             v                                               v
+------------+------------+                    +------------+------------+
|    CameraSystem (Freezable) |                |     TetrisPileActor     |
+------------+------------+                    +------------+------------+
             |                                               |
             | Proximity Checked                             | - Scattered Pieces Mesh
             +------------------- (Distance < 1.8) --------->| - Dissolve Particles System
                                                             | - Active 3D Board (10x20)
                                                             | - Tetris Engine & Controller
```

The system is integrated into the Three.js and Vite framework utilizing the existing global state store and event bus to freeze character controls and transition seamlessly from a 3D physical coordinate field to an orthogonal, gameplay viewport.

---

## Bug Fixes

### 1. Play Now Popup Persistence Fix
- **Issue:** The "Play Now" prompt remained visible after clicking play now and would reappear due to proximity checks during active gameplay.
- **Fix:** Added real-time suppression checks in `PortfolioScene.ts`. If `isTetrisActive` is true, the popup is immediately hidden and further proximity trigger triggers are blocked. The popup is also programmatically hidden as soon as the button is clicked.

### 2. Camera Viewport Perspective Alignment
- **Issue:** The game camera was positioned behind the board at `[3, -2.5, 1.2]` looking towards `-Z` (away from the screen/board). This created a confusing order: Character -> Game Screen -> User.
- **Fix:** Repositioned the locked camera to `[3, -2.5, 6.0]`. Looking down the `-Z` axis, this establishes a perfectly aligned third-person viewpoint where the camera is in front, the character stands in the middle, and the gameplay board towers in the back: **User -> Character -> Game Screen**.

### 3. Grid Visibility Toggle (Clean Window)
- **Issue:** The retro cyber gridlines inside the board interfered with the neon tetromino outlines and made the viewport look cluttered.
- **Fix:** Disabled visual rendering of the internal grid gridlines. The outer borders remain intact, but the cell gridlines inside the game window have been hidden (`gridlinesGroup.visible = false`) to provide a sleek, minimalist aesthetic.

### 4. Upcoming Next Piece Preview
- **Issue:** Players had no advance visibility into upcoming pieces, making high-level tactical setups impossible.
- **Fix:** Implemented an upcoming next piece lookahead buffer.
  - Pre-rolls a secondary random piece inside `TetrisBoardActor.ts` on start.
  - Added a dedicated lookahead preview inside the System HUD (`#tetris-next-val`).
  - Automatically updates and colors the HTML text preview to match the exact neon brand hex color of the next tetromino shape (e.g., Cyan for `I`, Yellow for `O`, etc.).

### 5. GSAP Floating Score Popups
- **Issue:** Scoring points lacked physical impact and visual feedback.
- **Fix:** Designed a dynamic, absolute-positioned overlay popping element that spawns above the game grid.
  - Triggered during soft drops, hard drops, and line clears.
  - Spawns a glowing neon cyber-text div (e.g., `+100` or `+800`) at the screen's center.
  - GSAP handles animating the text upwards (`y: -100`) while fading the opacity to `0` over 1.5 seconds, then safely disposes of the element.

---
