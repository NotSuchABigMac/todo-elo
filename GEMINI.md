# Todo-Elo Project Context

## Project Overview
**Todo-Elo** is a smart, self-sorting Todo application that uses pairwise comparisons to establish a hierarchy of tasks. Unlike traditional todo lists, it focuses on identifying the **Next** most important task using an Elo rating system and transitive inference to minimize user input.

### Key Features
- **Focus Mode:** The default view showing only the single highest-priority task.
- **The Arena:** A prioritization mode that presents two tasks for side-by-side comparison.
- **Smart Prioritization:**
  - **Elo Rating:** Standard Elo algorithm (K=32) for scoring tasks.
  - **Transitive Inference:** If A > B and B > C, the app infers A > C and skips the comparison.
  - **Tournament Selection:** Pairs the current "King" (top task) against contenders to quickly lock in the #1 spot.
- **Snooze System:** Business-day aware snoozing (skips weekends).
- **Check-ins:** Automatic prompts to verify tasks that haven't been touched in 3 business days.
- **Persistence:** LocalStorage-based with non-destructive task removal.

## Tech Stack
- **Frontend:** React (TypeScript)
- **Bundler:** Vite
- **Styling:** Vanilla CSS (Apple-style minimalism)
- **Icons:** Lucide-React
- **Deployment:** GitHub Actions to GitHub Pages

## Architecture & Conventions
- **Data Persistence:** Managed via a custom `useLocalStorage` hook (`src/hooks/useLocalStorage.ts`).
- **Core Logic:** Decoupled into `src/utils/elo.ts`, which contains the Elo calculations, transitive inference graph logic, and business-day utilities.
- **Types:** Defined in `src/types.ts`. All tasks are `active: boolean` with optional `removedAt`, `completedAt`, and `snoozedUntil` timestamps.
- **State Management:** React `useState` and `useMemo` for derived task lists (active, snoozed, completed, removed).

## Building and Running
### Development
```bash
npm install
npm run dev
```
Starts the Vite dev server (usually `http://localhost:5173`).

### Production Build
```bash
npm run build
```
Builds the static site into the `dist/` folder.

### Deployment
Automatic deployment via GitHub Actions on every push to the `main` branch.
- Workflow: `.github/workflows/deploy.yml`
- Base Path: `/todo-elo/` (configured in `vite.config.ts`)

## Development Guidelines
- **Surgical Updates:** Maintain the minimalist, high-impact UI (large buttons, clean typography).
- **Transitive Logic:** When modifying the pairing algorithm, ensure `hasPath` logic in `elo.ts` is preserved to avoid redundant comparisons.
- **Non-Destructive:** Prefer `removedAt` over hard deletion to preserve task history for future export features.
