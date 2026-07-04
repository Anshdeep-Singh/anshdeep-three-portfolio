# 🐍 Snake Game Upgrade Specification (`SNAKE_UP.md`)

This document outlines the architecture, features, and implementation details for upgrading the playable Snake Game in the portfolio website to make it buttery smooth, visually interactive, and incredibly fun.

---

## 1. 🌟 Core Enhancements

### A. Smooth Interpolated Movement
- **Problem:** Currently, the snake teleports from grid cell to grid cell every 180ms, creating a choppy experience.
- **Solution:** Implement linear interpolation (LERP) in the rendering loop.
  - Track each segment's `prevCoords` (previous grid position) and `targetCoords` (current grid position).
  - Calculate progress fraction $t = \min\left(\frac{\text{now} - \text{lastTickTime}}{\text{tickInterval}}, 1\right)$.
  - Position each visual segment mesh at:
    $$\text{pos} = \text{prevCoords} + (\text{targetCoords} - \text{prevCoords}) \times t$$
  - Grow new segments smoothly from scale `0` to `1`.
  - Shrink the departing tail segment smoothly from scale `1` to `0` or interpolate its position smoothly.

### B. High-Performance Particle System (Explosions)
- Create a lightweight particle manager inside `SnakeGameActor` to spawn, animate, and clean up physical 3D particle bursts.
- **Food Consumption Splash:** Spawns a radial burst of $15-20$ neon magenta particles that spin, fade, and scale down.
- **Game Over Shatter:** The entire snake body disintegrates! Every segment bursts into multiple particles matching its specific color, scattering across the board with physics simulation (gravity, deceleration).

### C. Glowing Snake Eyes
- Add two glowing neon-colored spheres to the head mesh representing snake eyes.
- Rotate the eyes to face the snake's current movement direction, giving it personality and visual direction.

---

## 2. 🚀 Premium Mechanics (Purely Visual & Gameplay)

### A. Power-Up Foods with Neon Auras
To make gameplay dynamic and highly replayable, introduce special power-ups that spawn occasionally:
1. ⚡ **Turbo Speed Boost (Yellow Aura):** Spreads a yellow neon glow. Accelerates game speed by 1.5x but doubles all points scored.
2. 🐢 **Slow Motion (Cyan Aura):** Spreads a cyan neon glow. Slows the ticks down, making tight spaces easier to navigate.
3. 🛡️ **Ghost / Shield Mode (Purple Aura):** Snake gains a translucent purple neon shield. Allows the player to pass through their own body segments without dying for a limited duration.

### B. Local Storage High Scores
- Fetch and persist the player's personal high score using browser `localStorage`.
- Update the HTML HUD overlay to display `HIGH SCORE: XXXXX` alongside the current score.

---

## 3. 🛠️ Implementation Details

### Files to Modify
- `src/entities/actors/SnakeGameActor.ts` (Core logic, interpolations, particle pool, power-up systems, board shake)
- `src/scene/scenes/PortfolioScene.ts` (Event subscriptions, HUD updating, camera sync)

### Success Criteria
- [ ] No more choppy step-by-step movement; the snake glides continuously.
- [ ] Food eating triggers a particle burst.
- [ ] Game over shatters the entire snake into multi-colored physical chunks.
- [ ] Special power-ups spawn, have visual distinct effects, and function correctly.
- [ ] Camera/Board physical feedback is noticeable and satisfying.
- [ ] High scores persist between page reloads.
