---
title: "Branded types for context, subcontext, and feature"
status: accepted
tags:
  - "api-design"
  - "typescript"
---

## Context

The library composes hierarchical error paths: `createError → context → subcontext* → feature`. Before this decision, those layers were typed structurally but produced equivalent shapes — a `subcontext("Auth")` and a `subcontext("Billing")` had identical types. Consumers could not write a type like *"any feature derived from the Auth subcontext"* because the type system had no way to discriminate one subcontext from another.

The repeated `subcontext(name)` / `feature(name)` chain also lost the literal name in the resulting type — `feature("LoginError")` returned `CreateErrorFn<ErrorType>` with no record of `"LoginError"` in the type.

## Decision

Add a generic `Brand<T, B>` helper and apply it to subcontexts and features so the literal path becomes part of the type:

```ts
type Brand<T, B> = T & { __brand: B };
type ErrorSubcontext<Name extends string, ErrorType extends string> = Brand<Subcontext<Name, ErrorType>, Name>;
type ErrorFeature<Name extends string, ErrorType extends string> = Brand<CreateErrorFn<ErrorType>, Name>;
```

Each layer carries its full slash-joined path as the brand:

- A root context `"PaymentForm"` has brand `"PaymentForm"`.
- `subcontext("APIError")` chained on it has brand `"PaymentForm/APIError"`.
- `feature("APIPaymentError")` chained on that has brand `"PaymentForm/APIError/APIPaymentError"`.

The brand is also written as a runtime field (`__brand: <path>`) on the returned object — the call sites use `Object.assign(createNewErrorObject, { __brand: ... })` for features and an inline property on subcontexts. Internal helpers gained `<const ContextName extends string>` / `<const FeatureName extends string>` template parameters so the literal flows through.

Companion export: `AnyFeatureOfSubcontext<S>` derives the feature type for *any* feature reachable from a given subcontext, using template literal types and `infer`.

Implemented in commit `9f2fe47`; the public type util `AnyFeatureOfSubcontext` was added in `94f32cb`.

## Alternatives Considered

1. **Pure structural typing (status quo).** Rejected — consumers could not target specific contexts in type space, and library code lost the literal name as soon as a generic captured it.
2. **Nominal classes per context.** Considered and rejected — would require runtime subclassing per call site, balloon the bundle, and break the zero-dependency stance. Would not interop with the existing `IConwayError` interface.
3. **Phantom-only brand (no runtime `__brand`).** Considered — would have kept the runtime payload smaller. Rejected because users debugging in DevTools benefit from seeing the brand string on the object, and the spec-level invariant is easier to write when the brand is observable.

## Consequences

**Positive**

- Consumers can write helpers like *"accept any feature under `Subcontext<Auth>`"* using `AnyFeatureOfSubcontext`.
- Hover-info in editors shows the full path of an error feature, not a generic `CreateErrorFn` placeholder.
- The brand reflects the runtime string used in error messages — type and message agree.

**Negative**

- One extra property (`__brand`) on every subcontext/feature object. Negligible memory cost, but a visible property in object dumps.
- Internal call sites needed `<const>` generic parameters in several places; future contributors must preserve those `const` modifiers or the literals widen to `string` and the brand collapses.

**Neutral**

- `Brand<T, B>` is intentionally minimal — no `Symbol` key, no opaque marker. Equivalent to `T & { __brand: B }`. Consumers can replicate the trick locally if they need additional brands.
