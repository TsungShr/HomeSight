# HomeSight Coding Rules

## Java (Backend)

- Package structure: `com.homesight.{controller,service,repository,entity,dto,config}`
- Spring Boot 3.x requires Java 17+ — if Cursor shows "package not found" errors, set `java.configuration.runtimes` to JDK 17 in `C:\Users\Z\AppData\Roaming\Cursor\User\settings.json`
- Use constructor injection or `@RequiredArgsConstructor` for dependencies; avoid field injection
- DTOs go in `com.homesight.dto`, entities in `com.homesight.entity`
- Application config in `application.yml`; use `@ConfigurationProperties` for typed config beans

## Mini Program (Frontend)

- Native WeChat framework only — no npm, no third-party UI libraries
- Page structure: `{page}.js`, `{page}.wxml`, `{page}.wxss`, `{page}.json` (if needed)
- Shared utilities in `utils/`: `config.js` (API base URL), `request.js` (HTTP wrapper), `floorplan.js` (data structures)
- Canvas drawing uses `type="2d"` with `wx.createSelectorQuery().fields({ node: true })`
- 3D rendering: custom WebGL, do NOT import three.js
- Touch events: `catchtouchstart/move/end` for blocking propagation; `bindtouchstart/move/end` for layered handling
- Two-finger pinch on furniture layer: track `_pinch` state with `startDist`, `startW`, `startH`, `cx`, `cy`; calculate `ratio = currentDist / startDist`; clamp to 20–300px

## Git

- Commit message format: `type: short description` (e.g., `feat: add pinch-to-zoom on furniture`)
- Types: `feat`, `fix`, `docs`, `refactor`, `chore`
- Do NOT commit: `.env`, `project.private.config.json`, `backend/target/`, `*.class`, `vector_store/knowledge.json`
- Write meaningful commit messages that explain WHY, not just WHAT

## File Naming

- Use lowercase with hyphens for files: `floor-plan-controller.java`
- Use PascalCase for classes: `FloorPlanController`
- Use camelCase for methods and variables
