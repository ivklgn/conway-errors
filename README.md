# conway-errors

[![npm version](https://badge.fury.io/js/conway-errors.svg)](https://badge.fury.io/js/conway-errors)
[![Downloads](https://img.shields.io/npm/dm/conway-errors.svg)](https://www.npmjs.com/package/conway-errors)

[RU Translation](README_RU.md)

JS/TS library for creating structured and readable errors.

> **Upgrading from 3.x?** See [Migrating to 4.0](#migrating-to-40) — error instances are now frozen and read-only.

## Why conway-errors?

- **🎯 Structured Error Hierarchy**: Organize errors by context and functionality
- **📝 Readable Error Messages**: Clear, contextual messages with complete information
- **🔧 Flexible Configuration**: Full control over throwing and logging
- **🏗️ Separation of Concerns**: Elegant programmatic API for domain and team separation
- **📊 Tracker Integration**: Easy integration with error monitoring tools like Sentry, PostHog
- **🔒 Immutable Errors**: Every error instance is frozen — safe to pass between layers

```sh
BackendLogicError: MyProject/APIError/APIPaymentError: Payment already processed
    at createNewErrorObject (/project/dist/index.js:205:23)
    at handleCheckout (/project/src/checkout.ts:42:11)
    ...
```

## Quick Start

### 1. Installation

```bash
npm install conway-errors
```

### 2. Basic Setup

```ts
import { createError } from "conway-errors";

// Define your error types
const createErrorContext = createError([
  { errorType: "ValidationError" },
  { errorType: "NetworkError" },
] as const);

// Create your first error context
const appErrors = createErrorContext("MyApp");
```

### 3. Create and Throw Errors

```ts
const loginError = appErrors.feature("LoginError");

throw loginError("ValidationError", "Invalid email format");
// error.name    === "ValidationError"
// error.message === "MyApp/LoginError: Invalid email format"
// console.error(error) prints: "ValidationError: MyApp/LoginError: Invalid email format"
```

`error.message` carries only the contextual path and the message text. The error-type prefix (`ValidationError:`) is added by the runtime when the error is converted to a string (e.g. `console.error`, `error.toString()`).

## Examples

### Simple Structure

```ts
import { createError } from "conway-errors";

const createErrorContext = createError([
  { errorType: "ValidationError" },
  { errorType: "NetworkError" },
  { errorType: "BusinessLogicError" },
] as const);

const appErrors = createErrorContext("ECommerceApp");

const userRegistration = appErrors.feature("UserRegistration");
const paymentProcessing = appErrors.feature("PaymentProcessing");

try {
  throw userRegistration("ValidationError", "Email already exists");
} catch (error) {
  console.log((error as Error).message);
  // "ECommerceApp/UserRegistration: Email already exists"
}

// Log errors without throwing
paymentProcessing("NetworkError", "Payment gateway timeout").emit();
```

### Hierarchical Error Organization

```ts
import { createError } from "conway-errors";

const createErrorContext = createError([
  { errorType: "FrontendLogicError" },
  { errorType: "BackendLogicError" },
] as const);

const errorContext = createErrorContext("MyProject");

const apiErrorContext = errorContext.subcontext("APIError");
const authErrorContext = errorContext.subcontext("AuthError");

const oauthError = authErrorContext.feature("OauthError");
const apiPaymentError = apiErrorContext.feature("APIPaymentError");

throw oauthError("FrontendLogicError", "User not found");
// error.message === "MyProject/AuthError/OauthError: User not found"

throw apiPaymentError("BackendLogicError", "Payment already processed");
// error.message === "MyProject/APIError/APIPaymentError: Payment already processed"
```

### Separate Root Contexts

```ts
import { createError } from "conway-errors";

const createAPIErrorContext = createError([
  { errorType: "MissingRequiredHeader" },
  { errorType: "InvalidInput" },
  { errorType: "InternalError" },
  { errorType: "RateLimitExceeded" },
] as const);

const authAPIErrors = createAPIErrorContext("AuthAPI");
const stockAPIErrors = createAPIErrorContext("StockAPI");

const loginError = authAPIErrors.feature("LoginError");
const stockSearchError = stockAPIErrors.feature("StockSearchError");

try {
  throw loginError("InvalidInput", "Invalid email format");
} catch (error) {
  // Handle login validation errors
}

stockSearchError("RateLimitExceeded", "API quota exceeded").emit();
```

### Domain-Driven Error Organization

```ts
import { createError } from "conway-errors";

const createPaymentErrors = createError([
  { errorType: "ValidationError" },
  { errorType: "ProcessingError" },
  { errorType: "GatewayError" },
] as const);

const createAuthErrors = createError([
  { errorType: "AuthenticationError" },
  { errorType: "AuthorizationError" },
  { errorType: "TokenError" },
] as const);

const paymentErrors = createPaymentErrors("Payment");
const recurringPayments = paymentErrors.subcontext("Recurring");

const recurringError = recurringPayments.feature("RecurringPaymentError");

const authErrors = createAuthErrors("Authentication");
const oauthError = authErrors.feature("OAuthError");

throw recurringError("ProcessingError", "Card declined for recurring payment");
throw oauthError("TokenError", "OAuth token has expired");
```

## Extended Parameters

`extendedParams` is an arbitrary map of metadata that flows from `createError` → root context → subcontext → feature → call-site. Each layer takes a **plain object** as its second positional argument:

```ts
const createErrorContext = createError(
  [{ errorType: "FrontendLogicError" }, { errorType: "BackendLogicError" }] as const,
  {
    extendedParams: { environment: process.env.NODE_ENV },  // ← wrapped in CreateErrorOptions
    handleEmit: (err, params) => {
      // `params` is the FULL merged map (root → ctx → sub → feature → call-site)
      console.error({ err, params });
    },
  }
);

const projectErrors = createErrorContext("MyProject", { app: "web" });          // ← direct map
const authErrors = projectErrors.subcontext("Auth", { team: "Platform Team" }); // ← direct map
const loginError = authErrors.feature("Login", { component: "LoginForm" });    // ← direct map

loginError("FrontendLogicError", "Invalid token").emit({ severity: "warn" });    // ← direct map
// handleEmit receives: { environment, app: "web", team: "Platform Team",
//                       component: "LoginForm", severity: "warn" }
```

**Important:** the second argument of `createErrorContext`, `subcontext`, `feature`, and `.emit()` is **the params map itself**, not `{ extendedParams: ... }`. Only the top-level `createError(types, options)` wraps it inside `CreateErrorOptions` (alongside `handleEmit`).

**Asymmetry to be aware of:** `error.extendedParams` on a thrown instance contains **only the call-site slice** (whatever was passed via `options.extendedParams` at the feature invocation). The full merged map is delivered exclusively to `handleEmit`. Consumers wanting the merged context must read it inside the handler.

## Configuration Options

### Sentry Integration

Override `handleEmit` to send events to Sentry:

```ts
import { createError } from "conway-errors";
import * as Sentry from "@sentry/nextjs";

const createErrorContext = createError(
  [{ errorType: "FrontendLogicError" }, { errorType: "BackendLogicError" }] as const,
  {
    handleEmit: (err) => {
      Sentry.captureException(err);
    },
  }
);

const appErrors = createErrorContext("MyApp");
const userError = appErrors.feature("UserAction");

userError("FrontendLogicError", "Form validation failed").emit();
```

### PostHog Integration

```ts
import { createError } from "conway-errors";
import posthog from "posthog-js";

const createErrorContext = createError(
  [
    { errorType: "ValidationError" },
    { errorType: "NetworkError" },
    { errorType: "BusinessLogicError" },
  ] as const,
  {
    extendedParams: { userId: null, sessionId: null, feature: null },
    handleEmit: (err, extendedParams) => {
      const { userId, sessionId, feature, severity = "error" } = extendedParams ?? {};

      posthog.captureException(err, {
        user_id: userId,
        session_id: sessionId,
        feature,
        severity,
        error_context: err.name,
        timestamp: Date.now(),
      });
    },
  }
);

const checkoutErrors = createErrorContext("Checkout", { feature: "payment_flow" });
const paymentError = checkoutErrors.feature("PaymentProcessing");

paymentError("NetworkError", "Payment gateway timeout").emit({
  userId: "user-123",
  sessionId: "session-456",
  severity: "critical",
});
```

### Original Error and Message Postfix

Pass the upstream error via `options.originalError` (the **third** argument to a feature invocation). If the matching `errorType` declares `createMessagePostfix`, its output is appended to `error.message`.

```ts
import { createError } from "conway-errors";

const createErrorContext = createError([
  {
    errorType: "FrontendLogicError",
    createMessagePostfix: (originalError) =>
      originalError instanceof Error ? ` >>> ${originalError.message}` : "",
  },
  { errorType: "BackendLogicError" },
] as const);

const context = createErrorContext("FileUpload");
const uploadError = context.feature("AvatarUpload");

try {
  await uploadAvatar();
} catch (cause) {
  throw uploadError("FrontendLogicError", "Failed to upload avatar", { originalError: cause });
  // error.message === "FileUpload/AvatarUpload: Failed to upload avatar >>> Network timeout"
}
```

The first argument of `createMessagePostfix` is typed as `unknown` — narrow it (`instanceof Error`, `typeof === "string"`, etc.) before reading properties. Falsy-but-present values (`0`, `""`, `false`) are forwarded; only `undefined` and `null` skip the postfix.

### Combining `extendedParams` and Sentry

```ts
import { createError } from "conway-errors";
import * as Sentry from "@sentry/nextjs";

const createErrorContext = createError(
  [{ errorType: "FrontendLogicError" }, { errorType: "BackendLogicError" }] as const,
  {
    extendedParams: { environment: process.env.NODE_ENV, version: "1.2.3" },
    handleEmit: (err, params) => {
      const { environment, version, severity = "error", userId, action } = params ?? {};

      Sentry.withScope((scope) => {
        scope.setTags({ environment, version, action });
        scope.setUser({ id: userId });
        scope.setLevel(severity);
        Sentry.captureException(err);
      });
    },
  }
);

const paymentErrors = createErrorContext("Payment", { service: "stripe" });
const cardPayment = paymentErrors.feature("CardPayment", { region: "us-east-1" });

const error = cardPayment("BackendLogicError", "Payment processing failed");
error.emit({ userId: "user-123", action: "checkout", severity: "critical" });
```

## Error Identification

Use `isConwayError` to narrow `unknown` to `IConwayError`:

```ts
import { isConwayError } from "conway-errors";

try {
  await doWork();
} catch (err) {
  if (isConwayError(err)) {
    console.error(err.rootContext, err.contextsChunk, err.feature);
    err.emit();
  } else {
    throw err;
  }
}
```

The guard uses a `Symbol.for("conway-errors:brand")` marker, so it works correctly across realms (workers, iframes, or when multiple copies of the library are bundled together).

## TypeScript Support

### `AnyFeatureOfSubcontext`

Type-safe error handling constrained to a specific subcontext:

```ts
import { createError, type AnyFeatureOfSubcontext } from "conway-errors";

const createErrorContext = createError([
  { errorType: "ValidationError" },
  { errorType: "ProcessingError" },
] as const);

const appErrors = createErrorContext("App");
const authErrors = appErrors.subcontext("Auth");

const loginError = authErrors.feature("LoginError");
const generalError = appErrors.feature("GeneralError");

function handleAuthError(errorFeature: AnyFeatureOfSubcontext<typeof authErrors>) {
  // Only accepts features whose path starts with "App/Auth"
}

handleAuthError(loginError);    // ✅ Valid
handleAuthError(generalError);  // ❌ TypeScript error
```

### Public Type Exports

For consumers building wrappers or typed handlers:

| Type | Purpose |
|---|---|
| `IConwayError` | Shape of every thrown instance (extends `Error`). |
| `EmitFn` | Signature of `IConwayError.emit`. |
| `ExtendedParams` | `Record<string, unknown>` map used everywhere. |
| `CreateErrorOptions` | `options` argument of `createError`. |
| `ErrorFnOptions` | `options` argument of a feature invocation. |
| `ErrorTypeConfig` | Type of the `errorTypes` array. |
| `AnyFeatureOfSubcontext<S>` | Derive a feature signature from a subcontext type. |

## Migrating to 4.0

### Frozen, read-only error instances

`Object.freeze` is now called inside the `ConwayError` constructor, and every public field is `readonly`. Code that mutated thrown errors must move the data into `extendedParams`:

```ts
// 3.x — silently mutated the error (compile-time only readonly)
err.feature = "renamed";
(err as any).requestId = "abc-123";

// 4.0 — both lines throw TypeError in strict mode
//        feature is read-only AND the instance is frozen

// 4.0 — store metadata via extendedParams
feature("X", "msg", { extendedParams: { requestId: "abc-123" } });
```

If you used integrations that decorate thrown errors after the fact (e.g. attaching a `__captured__` marker, rewriting `stack`), they will now fail. Switch to the `handleEmit` callback or keep a side-table keyed by the error instance.

### `isConwayError` is brand-based

Previously the guard used `instanceof ConwayError`, which broke across realms. 4.0 uses a `Symbol.for("conway-errors:brand")` marker — the guard is now cross-realm safe but stops recognising hand-rolled `Error` subclasses that happen to extend the (unexported) base class.

### `OriginalError` is no longer exported

It was an alias for `unknown` and carried no narrowing value. Remove the import and use `unknown` directly. `originalError` is still typed as `unknown` everywhere it appears.

### Stricter TypeScript

The library now compiles under `exactOptionalPropertyTypes`. `error.originalError` and `error.extendedParams` are always own properties (`"originalError" in err === true`), with value `undefined` when not provided. Existence checks should use `err.originalError !== undefined`, not `"originalError" in err`.

### `package.json#exports`

The conditional export map uses the standard `{ types, import, require }` shape. Modern bundlers and Node ≥ 12 work unchanged; tooling pinning legacy keys may need an update.

## Troubleshooting

**Q: My error types are widened to `string` instead of the literal union.**

A: Add `as const` to the `errorTypes` array:

```ts
// ✅ Correct — errorType is narrowed to "ValidationError" | "NetworkError"
const createErrorContext = createError([
  { errorType: "ValidationError" },
  { errorType: "NetworkError" },
] as const);

// ❌ Incorrect — errorType inferred as `string`
const createErrorContext = createError([
  { errorType: "ValidationError" },
  { errorType: "NetworkError" },
]);
```

**Q: `error.extendedParams` shows only what I passed at the call site, not the merged map.**

A: That is by design. The full merged map is delivered to `handleEmit` as its second argument. The instance carries only the call-site slice.

**Q: My `createMessagePostfix` doesn't run for `UnknownError`.**

A: `UnknownError` is the fallback when an unconfigured `errorType` is requested. Postfix functions are bound to registered types — register the type explicitly to get message decoration.

**Q: My `handleEmit` is wrapped in try/catch and now my Sentry/PostHog failure breaks the app.**

A: The library does **not** wrap `handleEmit`. A throwing handler propagates to the caller of `.emit()`. Wrap your own integration if you want fail-safe delivery.

## Acknowledgment for Contributions

<table>
  <tbody>
    <tr>
      <td align="center" valign="top">
        <a href="https://github.com/alex-knyazev">
          <img src="https://github.com/alex-knyazev.png" width="100px;" alt="Alexander Knyazev" />
          <br />
          <sub><b>Alexander Knyazev</b></sub></a
        >
      </td>
      <td align="center" valign="top">
        <a href="https://github.com/AlexMubarakshin">
          <img src="https://github.com/AlexMubarakshin.png" width="100px;" alt="Alexander Mubarakshin" />
          <br />
          <sub><b>Alexander Mubarakshin</b></sub></a
        >
      </td>
    </tr>
  </tbody>
</table>
