## Killreport — AI coding agent instructions

This file captures the essential, discoverable knowledge an AI coding agent needs to be productive in this repository.

1) Project overview
   - Monorepo with two workspaces: `frontend` (Angular 18 SPA) and `server` (lightweight server). See top-level `package.json` (workspaces).
   - The frontend is built using standalone components and is bootstrapped with `bootstrapApplication(AppComponent, appConfig)` in `frontend/src/main.ts`.

2) Common developer workflows / commands
   - From repo root use workspace scripts in `package.json`:
     - `yarn frontend:start` — runs `cd frontend && yarn start` (dev server).
     - `yarn server:start` — runs `cd server && yarn start`.
   - Inside `frontend`:
     - `yarn serve` (ng serve -o) — dev server on http://localhost:4200
     - `yarn build` — produces `dist/`
     - `yarn watch` — incremental build watch
     - `yarn test` — runs Karma unit tests
     - `yarn lint` and `yarn prettier` — code style checks/formatting
   - Handy commands found in `frontend/package.json`: `kill` (kills process on :4200), `serve:ssr:frontend` (runs SSR server from dist if built).

3) Architecture and code conventions to follow
   - Routing composition: `frontend/src/app/app.routes.ts` gathers page route arrays exported by page folders (e.g. `components/page/home/home.routes.ts`). To add a page, create a `components/page/<name>` folder, export a route array and import it in `app.routes.ts`.
   - Providers & bootstrap: `frontend/src/app/app.config.ts` contains global providers: router, `provideHttpClient(withFetch())`, `provideAnimationsAsync()` and `provideClientHydration()`. Add global providers here.
   - Standalone components: Most UI components are `standalone: true` and list imports directly on the component. Prefer standalone components over NgModules when adding UI.
   - Services: Use `@Injectable({ providedIn: 'root' })` and `inject()` for dependencies when possible (see `frontend/src/app/service/esi/alliance.service.ts` and `rank-filter.service.ts`). Return typed Observables from HTTP methods.

4) Integration points and external deps
   - EVE ESI API: Several services call ESI endpoints directly (e.g. `AllianceService.getAllianceInformation(...)` uses `https://esi.evetech.net/latest/alliances/...`). Keep typed return shapes and observables.
   - Mocks: `frontend/src/app/mocks/mocks.ts` contains mock data used for development; use it to craft offline tests or component previews.

5) Project-specific patterns and pitfalls (examples)
   - State sharing: small state services use `BehaviorSubject` and expose an observable (example: `RankFilterService.filter$`). When adding global state prefer the same minimal pattern.
   - HTTP helpers: `provideHttpClient(withFetch())` is used to configure the HttpClient; follow existing usage rather than altering global HTTP semantics.
   - Templates: There is at least one template with a non-standard `@for(...) { ... }` artifact in `top-characters-card.component.html` — treat this as an accidental leftover and convert to `*ngFor` when fixing templates.
   - File layout: UI components live under `frontend/src/app/components/ui/` and pages under `frontend/src/app/components/page/`. Services are under `frontend/src/app/service/` (ESI-specific services in `service/esi`).

6) When making changes (contract + edge cases)
   - Contract: UI components should be standalone; inputs/outputs typed. Services: inputs as params, return Observable<T>, errors propagated via HTTP client errors.
   - Edge cases: absent HTTP responses (null/404), slow network, CORS, typing mismatches with ESI. Add defensive typing and graceful UI states.

7) Tests and linting
   - Unit tests: `yarn test` uses Karma + Jasmine. Add spec files next to components/services. Keep mocks in `mocks.ts` for test data.
   - Linting/formatting: `yarn lint` and `yarn prettier` are available in `frontend`.

8) Quick file examples to inspect
   - App bootstrap/providers: `frontend/src/main.ts`, `frontend/src/app/app.config.ts`
   - Route composition: `frontend/src/app/app.routes.ts` and `components/page/*/*.routes.ts`
   - ESI integration: `frontend/src/app/service/esi/alliance.service.ts`
   - Simple state service: `frontend/src/app/service/rank-filter.service.ts`
   - Standalone UI example: `frontend/src/app/components/ui/top-characters-card/*`

If anything here is unclear or you'd like more detail (examples of adding a page, a service, or a unit test), tell me which area and I'll expand with concrete code edits or a small PR.