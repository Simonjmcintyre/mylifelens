# Digital Life

Digital Life is a mobile visual progress journal for tracking people and projects over time with aligned photos, check-in reminders, and finished timelines.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/diditallifea/app/index.tsx` — project home, creation flow, and reminder settings
- `artifacts/diditallifea/app/project.tsx` — project detail and captured frame history
- `artifacts/diditallifea/app/capture.tsx` — camera/library capture and ghost-image alignment
- `artifacts/diditallifea/app/timeline.tsx` — chronological merged journey view
- `artifacts/diditallifea/context/ProjectContext.tsx` — AsyncStorage-backed project and photo state
- `artifacts/diditallifea/constants/colors.ts` — product theme tokens

## Architecture decisions

- The first build is local-first with AsyncStorage so projects and photo metadata persist on-device without requiring an account or backend.
- The latest saved photo is used as the ghost reference for the next frame; users can tune its opacity before saving.
- The timeline is an in-app stitched presentation of all frames in chronological order, with a then/now comparison for finished stories.

## Product

- Create named projects with a subject and location.
- Capture a photo with the device camera or upload from the photo library.
- Align the new frame against the previous frame using a translucent ghost overlay.
- Set weekly, fortnightly, or monthly check-in reminders.
- Review all frames as a start-to-finish journey and mark projects finished.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
