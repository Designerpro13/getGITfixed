---
inclusion: always
---

# Tech Stack

## Runtime

- **Node.js 20+** (LTS) — use the `engines` field in `package.json` to enforce this
- **TypeScript 5.x** — strict mode, `noImplicitAny`, `strictNullChecks`, `noUnusedLocals` all enabled
- ESM-first (`"type": "module"` in `package.json`, `"module": "NodeNext"` in `tsconfig.json`)

## Key Dependencies (pinned exact versions)

| Package | Purpose |
| --- | --- |
| `@octokit/rest` | GitHub REST API client — fetch issues, create PRs |
| `tsx` | Run TypeScript files directly in Node without a build step |
| `vitest` | Unit and integration test runner |
| `eslint` + `typescript-eslint` | Linting with flat config (`eslint.config.js`) |

## TypeScript Rules

- No `any` — use `unknown` and narrow with type guards
- All functions must have explicit return types
- Async/await over raw Promises or callbacks
- Prefer `const` over `let`; never `var`
- Use `satisfies` over `as` for type assertions where possible

## Testing

- Framework: **Vitest** (`vitest --run` for single-pass, `vitest` for watch)
- Test files: `tests/**/*.test.ts`
- Mock external calls (Octokit, filesystem) using `vi.mock` — no real HTTP in unit tests
- Coverage target: all public functions in `src/`

## ESLint

- Flat config at `eslint.config.js`
- Rules: `strictTypeChecked` + `stylisticTypeChecked` from `typescript-eslint`
- `@typescript-eslint/no-floating-promises` is an error — always `await` or `.catch()`

## Build

- `npm run typecheck` — `tsc --noEmit`, must pass with zero errors before any commit
- `npm run build` — emits to `dist/`; only needed for deployment
