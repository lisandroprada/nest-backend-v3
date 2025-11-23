# Copilot / AI contributor quick instructions

Purpose: give an AI coding agent immediate, actionable context to be productive in this repository.

Key facts (read first)

- This is a NestJS (TypeScript) backend using Mongoose for MongoDB. Entry point: `src/main.ts` and modules live under `src/modules/`.
- Common runtime commands:
  - Install: `pnpm install`
  - Run tests: `pnpm test`
  - Run dev server: `pnpm run start:dev`

Big-picture architecture (what to know)

- Modular NestJS structure: each feature is a module under `src/modules/` (e.g. `service-sync`, `detected-expenses`, `accounting-entries`, `properties`, `agents`, `chart-of-accounts`).
- Data flow example: emails are parsed in `service-sync` → persisted as `ServiceCommunication` → classified (see `ClassificationService`) → may create entries in `detected-expenses` → proposals are produced in `accounting-entries` → operator uses endpoint to convert proposals to definitive accounting entries.
- Important new module: `service-account-mappings` stores provider → account mappings used by the accounting flow; there's a seed script at `scripts/seed-service-account-mappings.ts`.

Project-specific patterns and gotchas

- Mongoose model usage varies across code:
  - Some code does `new Model(payload).save()` (constructor + `.save()`) — tests must mock constructor behavior.
  - Some code awaits `Model.findById(...)` directly (no `.exec()`), while other places chain `.find(...).sort(...).limit(...)` and await the final call. Tests must mock chainable methods accordingly.
  - When converting test fixtures to `Types.ObjectId(...)`, provide valid 24-character hex strings (e.g. `507f1f77bcf86cd799439011`) to avoid BSONError.
- Tests and TestModule wiring:
  - Unit tests should avoid importing full application modules that create circular provider graphs. Instead use `Test.createTestingModule({ providers: [...] })` and `overrideProvider` when needed.
  - Use `getModelToken(ModelName)` from `@nestjs/mongoose` to mock Mongoose models in tests.
  - For constructor-style models mock a function that returns an object with a `save` method. For chainable queries mock `find()` to return `{ sort: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([...]) }) }` (or include `exec` where the service calls it).

Where to look (high-value files)

- `src/modules/service-sync/service-sync.service.ts` — shows `new this.commModel(...)` + `.save()` and `findById(...)` usage.
- `src/modules/service-sync/services/classification.service.ts` — shows `find(...).sort(...).limit(...)` pattern and calls into `detected-expenses`.
- `src/modules/accounting-entries/accounting-entries.service.ts` — contains proposal → entry logic (`processDetectedUtilityInvoices`, `processDetectedExpenseToEntry`).
- `scripts/seed-service-account-mappings.ts` — seed script for provider→account mappings.
- `src/modules/service-account-mappings/` — new module storing mappings (entity + service + controller).

Testing & debugging tips (practical)

- Run a single spec to iterate quickly (example):
  ```bash
  pnpm test src/modules/service-sync/services/classification.service.spec.ts -i
  ```
- If you hit `RangeError: Maximum call stack size exceeded` during Jest TestModule init, check imported modules in that spec — replace costly imports with provider mocks and avoid importing modules that `forwardRef` each other.
- Common failing test symptoms and fixes:
  - "doc.save is not a function": tests returned a plain object; mock a document object with `save: jest.fn().mockResolvedValue(...)`.
  - "this.commModel.find(...).sort is not a function": mock the full chain shape (see pattern above).
  - "input must be a 24 character hex string": use valid 24-char hex fixture IDs.

Conventions & coding style notes

- Use `forwardRef()` in module imports / `@Inject(forwardRef(() => OtherService))` when circular dependencies appear. Tests should avoid re-creating those cycles.
- DTOs live under `src/modules/**/dto/`. Prefer using DTOs instead of constructing ad-hoc plain objects for service calls when possible.

Integration points & external services

- Mail parsing / IMAP: in `src/modules/service-sync` (IMAP clients and Camuzzi-specific parsing). Pay attention to parser changes: the code no longer extracts payment links for Camuzzi.
- Mongo: local tests use in-memory mocks; seeds/scripts assume a real Mongo connection if used directly.

Prompt templates for the AI agent (examples)

- "I need to add a unit test for X. Which providers should I mock and how do they behave?" → Inspect the service, list `getModelToken(...)` models, note whether code uses `new Model()` or chained queries, and return a test scaffold mocking those shapes.
- "Fix failing spec Y where BSONError occurs" → Search the spec for non-24-char IDs passed to `Types.ObjectId` and replace with `507f1f77bcf86cd799439011`-style fixtures; adjust mocks to return documents with `.save()` when the code constructs models.

If something is unclear

- Ask the human for runtime context: do you want me to run seeds against your dev DB? (I won't connect unless asked.)
- If a test fails with injector/circular errors, point me to the failing spec and I will produce a minimal TestModule provider set that avoids imports.

Thank you — after you review this, tell me which part to expand (tests, architecture diagram, or onboarding checklist).
