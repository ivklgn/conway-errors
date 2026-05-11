---
title: "Structuring errors by application type"
status: accepted
tags:
  - "api-usage"
  - "patterns"
---

A catalog of proven combinations for using `conway-errors` across common application archetypes. Each recipe maps to working code in `README.md` and behavior verified in `index.test.ts`.

## Prerequisites

- Familiarity with the contract in `.archcore/specs/conway-errors-api.spec.md`.
- Working knowledge of: `createError`, `subcontext`, `feature`, `.emit()`, `extendedParams`, `originalError`, `createMessagePostfix`, `isConwayError`, `AnyFeatureOfSubcontext`.

## Steps

### 1. Identify your application archetype

| Archetype                              | Recipe |
| -------------------------------------- | ------ |
| Small SPA / CLI tool / script          | **A**  |
| Multi-feature frontend with monitoring | **B**  |
| HTTP API / backend service             | **C**  |
| Multi-domain app (DDD-style)           | **D**  |
| Library / SDK wrapping native errors   | **E**  |
| Full-stack with layered telemetry      | **F**  |

If you sit between two archetypes (e.g., small backend with telemetry), combine recipes — the patterns compose.

### 2. Pick an error-type taxonomy

Always declared with `as const` (see README troubleshooting). Pick one shape:

- **Semantic** — `ValidationError`, `NetworkError`, `BusinessLogicError`. Default choice for product apps (README "Simple Structure", PostHog example).
- **Layered** — `FrontendLogicError`, `BackendLogicError`. When the same code emits errors that should be routed by layer to different dashboards (README "Hierarchical", "Sentry", "Extended Parameters").
- **HTTP-shaped** — `MissingRequiredHeader`, `InvalidInput`, `InternalError`, `RateLimitExceeded`. For backend services emitting at API boundaries (README "Separate Root Contexts").
- **Per-domain** — separate type sets per `createError(...)` call, one per bounded context (README "Domain-Driven").

### 3. Set hierarchy depth

| Depth      | Shape                           | When                                                                                                                            |
| ---------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Flat       | `root → feature`                | Small surface; one bounded scope.                                                                                               |
| 2-level    | `root → subcontext → feature`   | Default for product apps.                                                                                                       |
| Deep (3+)  | nested `subcontext` chains      | Verified up to 4 nested subcontexts (test _"nested context write correct message"_); use sparingly — long paths bloat messages. |
| Multi-root | one factory, many root contexts | One service / team / domain per root.                                                                                           |

### 4. Wire `extendedParams` at the right layer

Merge precedence (verified by test _"extended params merging order and precedence"_):

```
createError < root context < subcontext < feature < error-options < emit
```

Place each value at the layer matching its lifecycle:

| Layer                    | Typical values                                           |
| ------------------------ | -------------------------------------------------------- |
| `createError`            | `env`, `version`, `release` — set once at process start. |
| Root context             | `service` / `domain` identifier.                         |
| Subcontext               | `team`, `component`.                                     |
| Feature                  | `region`, `action`.                                      |
| Call-site `errorOptions` | per-error data captured where the error happens.         |
| `.emit({...})`           | request-scoped: `userId`, `sessionId`, `severity`.       |

### 5. Choose an emit handler

- **Default `console.error`** — leave `handleEmit` unset for dev tools, CLIs, libraries with no telemetry strategy.
- **Sentry** — `handleEmit: (err) => Sentry.captureException(err)` (README "Sentry Integration"). Add tags/scope from `extendedParams` for richer reports (README "Extended Parameters").
- **PostHog** — read `extendedParams` for `userId` / `sessionId` / `severity` and forward to `posthog.captureException` (README "PostHog Integration").

`.emit()` never throws — throwing is always explicit at the call site (test _"error can be thrown or emitted without throwing"_).

### 6. (Optional) Type-safe handler boundaries

Use `AnyFeatureOfSubcontext<typeof subctx>` when a helper should only accept features that live under a specific subcontext (README "Type Utilities"). Combine with branded paths so editor hover reports the exact path.

## Recipes

### A — Small SPA / CLI tool

Flat hierarchy, semantic taxonomy, default emit.

```ts
const createCtx = createError([
  { errorType: "ValidationError" },
  { errorType: "NetworkError" },
  { errorType: "BusinessLogicError" },
] as const);

const app = createCtx("MyApp");
const login = app.feature("Login");

throw login("ValidationError", "Invalid email format");
// "ValidationError: MyApp/Login: Invalid email format"
```

### B — Multi-feature frontend with monitoring

2-level hierarchy, layered taxonomy, Sentry handler, team attribution on subcontext.

```ts
const createCtx = createError([{ errorType: "FrontendLogicError" }, { errorType: "BackendLogicError" }] as const, {
  handleEmit: (err) => Sentry.captureException(err),
});

const project = createCtx("MyProject");
const auth = project.subcontext("Auth", { team: "Platform Team" });
const oauth = auth.feature("OAuth");

oauth("FrontendLogicError", "User not found").emit();
// "FrontendLogicError: MyProject/Auth/OAuth: User not found"
```

### C — HTTP API service

Multi-root pattern, HTTP-shaped taxonomy, one factory per API surface.

```ts
const createAPI = createError([
  { errorType: "MissingRequiredHeader" },
  { errorType: "InvalidInput" },
  { errorType: "InternalError" },
  { errorType: "RateLimitExceeded" },
] as const);

const authAPI = createAPI("AuthAPI");
const stockAPI = createAPI("StockAPI");

throw authAPI.feature("Login")("InvalidInput", "Invalid email format");
stockAPI.feature("StockSearch")("RateLimitExceeded", "API quota exceeded").emit();
```

### D — Multi-domain (DDD)

One factory per bounded context, domain-specific error types per factory.

```ts
const createPayment = createError([
  { errorType: "ValidationError" },
  { errorType: "ProcessingError" },
  { errorType: "GatewayError" },
] as const);

const createAuth = createError([{ errorType: "AuthenticationError" }, { errorType: "TokenError" }] as const);

const payments = createPayment("Payment");
const recurring = payments.subcontext("Recurring");
const recurringErr = recurring.feature("RecurringPaymentError");

const authentication = createAuth("Authentication");
const oauthErr = authentication.feature("OAuthError");

throw recurringErr("ProcessingError", "Card declined for recurring payment");
throw oauthErr("TokenError", "OAuth token has expired");
```

### E — Library / SDK wrapping native errors

Use `originalError` plus `createMessagePostfix` to preserve the underlying message in the formatted output.

```ts
const createCtx = createError([
  {
    errorType: "FrontendLogicError",
    createMessagePostfix: (e) => " >>> " + (e as Error).message,
  },
  { errorType: "BackendLogicError" },
] as const);

const ctx = createCtx("FileUpload");
const upload = ctx.feature("AvatarUpload");

try {
  await uploadAvatar();
} catch (err) {
  throw upload("FrontendLogicError", "Failed to upload avatar", { originalError: err });
  // "FrontendLogicError: FileUpload/AvatarUpload: Failed to upload avatar >>> Network timeout"
}
```

Without a `createMessagePostfix` the original error stays on `err.originalError` but is omitted from the message (test _"originalError edge cases"_).

### F — Full-stack with layered telemetry

Stack `extendedParams` across layers; let `handleEmit` read them.

```ts
const createCtx = createError([{ errorType: "FrontendLogicError" }, { errorType: "BackendLogicError" }] as const, {
  extendedParams: { environment: process.env.NODE_ENV, version: "1.2.3" },
  handleEmit: (err, ep) =>
    Sentry.withScope((scope) => {
      scope.setTags({ environment: ep.environment, version: ep.version, action: ep.action });
      scope.setUser({ id: ep.userId });
      scope.setLevel(ep.severity ?? "error");
      Sentry.captureException(err);
    }),
});

const payments = createCtx("Payment", { service: "stripe" });
const cardPayment = payments.feature("CardPayment", { region: "us-east-1" });

cardPayment("BackendLogicError", "Payment processing failed").emit({
  userId: "user-123",
  action: "checkout",
  severity: "critical",
});
```

## Verification

After choosing a recipe, sanity-check the integration:

- `npm run type-check` passes — error-type union narrows correctly when `as const` is in place.
- Throw + catch: `err.message === "<contextsChunk>/<feature>: <msg>"` (test _"error properties validation"_).
- `isConwayError(err) === true` for library errors, `false` for native `Error` (test _"isConwayError type guard works correctly"_).
- Emit handler receives merged extended-params in expected precedence (test _"extended params merging order and precedence"_).
- `throw feature(...)` propagates; `.emit()` alone does not — confirm by checking handler call count (test _"error can be thrown or emitted without throwing"_).

## Common Issues

- **Missing `as const`** — error-type union widens to `string`; autocomplete and exhaustiveness vanish. README troubleshooting Q1.
- **Typo in `errorType` string** — falls back to `UnknownError` silently at runtime (test _"UnknownError behavior in different scenarios"_). The compile-time error is your safety net; do not bypass it with `as any`.
- **Extended-params key collisions** — later layers always overwrite. If `team` is set on both the subcontext and the `.emit()` call, the emit value wins.
- **`originalError` without `createMessagePostfix`** — original message is stored on `err.originalError` but does not appear in `err.message`. Add a postfix at the matching `errorType` entry if you want it in the formatted output.
- **Deep hierarchies** — Subcontext chains beyond 3 levels produce long path strings in messages. The library supports it (4 levels verified in tests) but consider whether the depth is paying for itself.
- **Forgetting that `.emit()` does not throw** — if a code path must both report and abort, do `throw feature(...)` and call `err.emit()` from the catch block.
