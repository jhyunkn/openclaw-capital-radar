# Kostolany Egg Component

Status: active prototype-to-production bridge.

Purpose: render the macro allocation cycle map as a reusable Capital Radar visual intelligence component.

Decision question: what does the current macro/cycle phase imply for broad allocation, equity rotation, and risk posture?

Production rule:

- The visual source should be edited here, not inside one-off injection scripts.
- Standalone HTML experiments stay in `prototypes/html`.
- This component should consume `outputs/kostolany-egg-state.json` in production and `data/mock/kostolany-egg-state.mock.json` for prototype validation.
- The script in `scripts/inject-kostolany-egg-v3-home.cjs` should remain a thin adapter that loads state and injects this component.

Files:

- `render.cjs` — server-side/static renderer for the Egg section.
- `README.md` — component contract and integration notes.

CSS currently remains at `assets/kostolany-egg-v3.css` because the static site already serves assets from that path. When the app migrates to a component framework, move the stylesheet beside this component or import it through the app bundler.
