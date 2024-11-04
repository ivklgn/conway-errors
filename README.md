# conway-errors

The library allows you to create an error hierarchy with minimal API usage without explicit class inheritance.

[Go to russian documentation](README_RU.md)

## Usage

### Simple Example

```ts
import { createError } from "conway-errors"; 

// (1) Create the root context, where the base error types are defined
const createErrorContext = createError([
  { errorType: "FrontendLogicError" },
  { errorType: "BackendLogicError" },
] as const);

// (2) Create any number of contexts, for example, divided by team or context
const errorAuthTeamContext = createErrorContext("AuthTeamContext");
const errorPaymentTeamContext = createErrorContext("PaymentTeamContext");

// (3) Define specific implementations based on features
const oauthError = errorAuthTeamContext.feature("OauthError");
const paymentError = errorPaymentTeamContext.feature("PaymentError");

// (4) Example of throwing errors
throw oauthError("FrontendLogicError", "User not found");
throw paymentError("BackendLogicError", "Payment already processed");

// (5) Example of emitting thrown errors
try {
  throw oauthError("FrontendLogicError", "User not found");
}
catch(error) {
  (error as IConwayError).emit(error);
}

// (6) You also can emit error without throwing
oauthError("FrontendLogicError", "User not found").emit();
```

### Nested Contexts

```ts
import { createError } from "conway-errors"; 

// (1) Create the root context, where the base error types are defined
const createErrorContext = createError([
  { errorType: "FrontendLogicError" },
  { errorType: "BackendLogicError" },
] as const);

// (2) Create any number of contexts, for example, divided by team or context
const authTeamErrorContext = createErrorContext("AuthTeamContext");

// (3) Create any number of nested contexts
const socialAuthErrorContext = createErrorContext.subcontext("SocialAuth");
const phoneAuthErrorContext = createErrorContext.subcontext("PhoneAuth");

// (3) Define specific implementations based on features
const facebookError = socialAuthErrorContext.feature("FacebookAuth");
const smsSendError = phoneAuthErrorContext.feature("SmsSender");

// (4) Example of throwing errors
throw facebookError("FrontendLogicError", "Account inactive");
throw smsSendError("BackendLogicError", "Limit exceed");
```

### Overriding the Error Emitting Function

Example for integration with Sentry (<https://sentry.io/>)

```ts
import { createError } from "conway-errors"; 
import * as Sentry from "@sentry/nextjs";

const createErrorContext = createError([
  { errorType: "FrontendLogicError" },
  { errorType: "BackendLogicError" }
] as const, {
  // use sentry to log errors instead of default behavior with console.error()
  emitFn: (err) => {
    Sentry.captureException(err);
  },
});
```

### Extending Base Error Messages

```ts
import { createError } from "conway-errors";

const createErrorContext = createError([
  { errorType: "FrontendLogicError", createMessagePostfix: (originalError) => " >>> " + (originalError as Error).message },
  { errorType: "BackendLogicError" },
] as const);

const context = createErrorContext("Context");
const featureError = subcontext.feature("Feature");

try {
  uploadAvatar();
} catch (err) {
  featureError("FrontendLogicError", "Failed upload avatar", err).emit();
  // The following error will be emitted:
  // FrontendLogicError("Context/Feature: Failed upload avatar >>> Server upload avatar failed")
}
```

### Passing Extended Parameters to Contexts and Errors

```ts
import { createError } from "conway-errors"; 
import * as Sentry from "@sentry/nextjs";

const createErrorContext = createError(["FrontendLogicError", "BackendLogicError"], {
  extendedParams: {
    isSSR: typeof window === "undefined",
    projectName: "My cool frontend"
  },
  emitFn: (err, extendedParams) => {
    const { isSSR, projectName, logLevel = "error", location, subdomain } = extendedParams;

    Sentry.withScope(scope => {
      scope.setTags({
        isSSR,
        projectName,
        subdomain,
        location,
      });
      

      scope.setLevel(logLevel);
      Sentry.captureException(err);
    });
  },
});

const paymentErrorContext = createErrorContext("Payment", {
  subdomain: "Payment",
});

const cardPaymentError = subcontext.feature("CardPayment", {
  location: "USA",
});

const error = cardPaymentError("BackendLogicError", "Payment failed", { extendedParams: { a: 1 } });
error.emit({ extendedParams: { logLevel: "fatal" } })
```
