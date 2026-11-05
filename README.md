# FlyingFree · VUELO

Experience a procedural coastal island, twelve selectable bird species, wildlife, physical sun cycle, dynamic weather, and original algorithmic ambient music.

## Run locally
```bash
npm install
npm run dev
npm test
npm run build
```

**Public website:** https://akumanomi1988.github.io/FlyingFree/

## Features in v0.2
- Twelve selectable bird species, each with an individual flight profile and articulated 3D silhouette.
- Deer, foxes, rabbits, butterflies, gulls, and dolphins with habitat-aware motion and simple activity/rest cycles.
- Procedural 3D island with trees, rocks, meadows, ocean shader, cloud layers, stars and sun.
- Solar position based on UTC, latitude 37° N, longitude -5° and presentation in Europe/Madrid.
- Seven types of weather, smooth transitions, particle rain, camera direction and synthetic soundtrack.
- Five bird camera shots, wildlife documentary framing and panoramic sequences.
- Adaptive render resolution for slow GPUs; limited geometry on narrow screens.
- Browser-based checks: `?selftest=1`, GitHub Actions screenshots and console/error monitoring.

## Controls
| Key | Action |
|---|---|
| B | Open/close bird selector |
| 1, 2, 3, 4 | Dawn, noon, sunset, night |
| 5 | Change weather |
| 6, 7, 8 | Time speed ×1, ×60, ×600 |
| Space | Wing beat |
| M | Start or mute audio |
| H | Hide/show interface |
| P | Capture PNG |
| F | Fullscreen |
| Esc | Close panels |

URLs: `?h=6.4`, `?bird=owl`, `?weather=storm`, `?broadcast=1`, `?selftest=1`.

## Testing
`npm test` exercises the deterministic math, solar clock and bird paths.
`npm run test:browser` runs Playwright against the built website, checking WebGL scenes, fauna, species selection, keyboard controls and major day/weather scenarios. Evidence is written to `artifacts/visual`. Install Chromium once using `npx playwright install chromium`.
Every PR and feature-branch push runs this in GitHub Actions. The `main` workflow deploys GitHub Pages.

## Engineering limitations
This is a stylized, procedural ecosystem, not photorealistic animal footage or an ecological simulator. Animal shape/behaviour is representative rather than anatomically and biomechanically exhaustive. It does **not** contain an OBS/RTMP supervisor, nor has 72-hour continuous-operation testing been completed. GitHub Pages hosts the WebGL app; live video emission is a separate Windows/OBS undertaking.

No external image, video, or recorded music assets are required.
