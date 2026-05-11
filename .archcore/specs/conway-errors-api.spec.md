---
title: "Conway errors public API"
status: accepted
tags:
  - "api"
  - "public-contract"
---

## Purpose

Define the canonical, externally visible contract of `conway-errors` so that consumers and contributors agree on the API shape, naming semantics, and emission/throw model. The spec is the source of truth — implementation details in `index.ts` may evolve, but the contract surface described here is what dependent code may rely on.

## Scope

In scope:

- The four exported names from `index.ts`: `createError`, `isConwayError`, `IConwayError`, `AnyFeatureOfSubcontext`.
- The runtime behavior of the chain `createError → (root context) → subcontext → feature → error instance`.
- The naming convention encoded into `name` and `message` of thrown errors.
- The `emit()` channel for log-without-throw delivery.

Out of scope:

- Internal helpers (`createErrorClass`, `createContextedMessage`, `defaultHandleEmit`).
- Tracker-specific adapters (Sentry, PostHog) — those are consumer code built on top of `handleEmit`.

## Authority

This document is the canonical contract. `index.ts` and `index.test.ts` are authoritative for current implementation behavior; when they diverge from this spec, the spec governs unless a new ADR overrides it.

## Subject

The single published module `conway-errors` (entry: `dist/index.js` / `dist/index.module.js`, types: `dist/index.d.ts`).

## Contract Surface

### Exports

| Symbol | Kind | Purpose |
|---|---|---|
| `createError(errorTypes?, options?)` | function | Factory returning a root-context constructor. |
| `isConwayError(error)` | function | Type guard narrowing `unknown → IConwayError`. |
| `IConwayError` | interface | Shape of every error instance the library produces. |
| `AnyFeatureOfSubcontext<S>` | type util | Derive a feature signature from a subcontext type. |

### `createError(errorTypes, options) → createErrorContext`

- `errorTypes`: `ReadonlyArray<{ errorType: string; createMessagePostfix?: (originalError?) => string }>` — declared up-front; the literal union of `errorType` values becomes a type parameter that flows through every descendant feature.
- `options.handleEmit`: callback invoked by `.emit()`; defaults to `console.error(err)`.
- `options.extendedParams`: base map merged into every error's extended params.

Returns `createErrorContext(contextName, extendedParams?)`.

### Root context, subcontext, feature

- `createErrorContext(name, extendedParams?)` returns a **branded subcontext**: `ErrorSubcontext<Name, ErrorType>`.
- `subcontext(name, extendedParams?)` produces a child subcontext whose brand path is `"<parent>/<child>"`. Extended params merge parent → child.
- `feature(name, extendedParams?)` produces a **branded feature**: `ErrorFeature<"<path>/<name>", ErrorType>`. Extended params merge subcontext → feature.

The brand is a structural marker (`__brand`) — see `branded-types-for-context.adr.md` for the design decision.

### Throwing and emitting

A feature is callable: `feature(errorType, message, options?) → IConwayError`.

- The returned object is an `Error` subclass and may be thrown or held.
- Its `.emit(extendedParams?)` invokes `options.handleEmit` with the error and the merged extended-params map (root → subcontext → feature → call-site).
- `options.originalError` is preserved on the instance and passed to `createMessagePostfix` if the matching `errorType` defines one.

### `IConwayError`

```ts
interface IConwayError extends Error {
  rootContext: string;
  contextsChunk: string;     // full "/"-joined path of contexts above the feature
  feature: string;
  originalError?: OriginalError;
  extendedParams?: ExtendedParams;
  emit: (extendedParams?) => void;
}
```

## Normative Behavior

1. **Naming.** `error.name` MUST equal the `errorType` argument (or `"UnknownError"` when an unconfigured type is requested). `error.message` MUST follow `<contextsChunk>/<feature>: <message><postfix?>` where `<postfix?>` is the output of `createMessagePostfix` when an `originalError` was passed, else empty.
2. **Brand fidelity.** Each subcontext and feature MUST carry a `__brand` value equal to its full path string. This is structural and is preserved through `Object.assign` on the feature callable.
3. **Extended-params merging.** Order of precedence is call-site > feature > subcontext > root > `options.extendedParams`. Later layers override earlier ones; deep merging is not performed.
4. **Unknown error types.** When `createError` is called with a fixed `errorTypes` config and a feature is invoked with a string not in that union, the implementation MUST construct an `UnknownError` instance rather than throwing synchronously.
5. **Emit isolation.** `.emit()` MUST NOT throw the error; it only invokes `handleEmit`. Throwing is the consumer's responsibility (`throw feature("X", "...")`).
6. **Type guard.** `isConwayError(x)` MUST return `true` only for instances produced by this library's internal `ConwayError` class.

## Constraints

- **Zero runtime dependencies.** The compiled artifact MUST NOT pull external packages — see `zero-runtime-dependencies.adr.md`.
- **TypeScript-first.** Generic parameters must propagate without consumer-side casts; this is the reason for `<const ContextName extends string>` patterns throughout.
- **Tree-shakeable.** `sideEffects: false` in `package.json` MUST hold.

## Invariants

- Brands on subcontexts and features are read-only after construction.
- An error instance's `rootContext`, `contextsChunk`, `originalError`, and `extendedParams` are read-only.
- `error.feature` is the only mutable field (set during construction; the type allows reassignment because of class-field semantics, but it is not part of the contract).

## Error Handling

- The library itself does not throw. All thrown values are constructed `IConwayError` instances surfaced to the consumer.
- `handleEmit` is not wrapped in `try/catch`; a throwing `handleEmit` propagates to the caller of `.emit()`. Consumers integrating Sentry/PostHog must handle their own failure modes.

## Conformance

A consumer conforms to this spec when:

- It treats `IConwayError` as the only documented runtime shape.
- It does not depend on internal class identity beyond what `isConwayError` checks.
- It does not bypass `createError` (e.g., by manually constructing `ConwayError` — not exported, so this is structurally prevented).

Test coverage in `index.test.ts` exercises every line of this contract; PRs that change the contract MUST update both the tests and this spec.
