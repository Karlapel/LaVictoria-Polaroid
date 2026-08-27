# LaVictoria Polaroid

LaVictoria Polaroid turns a photo from the user's device into a downloadable classic Polaroid-style keepsake.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite
- Styling: Tailwind CSS v4
- Icons: lucide-react
- Image processing: browser Canvas API

## Where things live

- `artifacts/lavictoria-polaroid/src/App.tsx` — upload, preview, reset, and download workflow
- `artifacts/lavictoria-polaroid/src/index.css` — visual theme, layout, responsive behavior, and motion
- `artifacts/lavictoria-polaroid/.replit-artifact/artifact.toml` — artifact and preview configuration

## Architecture decisions

- Image processing stays client-side so user photos are never uploaded to a server.
- The downloaded PNG is composed with the browser Canvas API to include the photo and full Polaroid frame.
- The app is intentionally single-route and has no backend dependency.

## Product

- Users can browse for or drag and drop an image.
- Uploaded images are validated and previewed in a classic Polaroid frame.
- Users can reset the current photo or download the finished PNG.

## User preferences

- Keep the experience simple, clean, and focused on the photo.

## Gotchas

- The web workflow supplies `PORT` and `BASE_PATH`; use the managed workflow for local preview.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
