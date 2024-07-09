# conway-errors

(Library API in progress)

## Idea

1. Implement root error types (FrontendLogickError, BackendInteractionError)
2. Split and structurize errors with Conway's law. (<https://en.wikipedia.org/wiki/Conway%27s_law>) - per team or area
3. Implement context (team/area) with this library
4. Create features
5. Throw throw throw! :)

## Usage

### Basic usage

```ts
import createError from "conway-errors"; // (!!!) at this moment not published

// (1) init error types 
const createErrorContext = createError([
  { errorType: "FrontendLogickError" },
  { errorType: "BackendLogickError" },
] as const);

// (2) create contexts (per team or area)
const errorAuthTeamContext = createErrorContext("AuthTeamContext");
const errorPaymentTeamContext = createErrorContext("PaymentTeamContext");

// (3) create features
const oauthError = errorAuthTeamContext.feature("OauthError");
const paymentError = errorPaymentTeamContext.feature("PaymentError");

// (4) throw errors
oauthError.throw("FrontendLogickError", "User not found");
paymentError.throw("BackendLogickError", "Payment already processed"); // node.js:
```

### Nested context (subcontext)

```ts
import createError from "conway-errors"; // (!!!) at this moment not published

// (1) init error types 
const createErrorContext = createError([
  { errorType: "FrontendLogickError" },
  { errorType: "BackendLogickError" },
] as const);

// (2) create context 
const authTeamErrorContext = createErrorContext("AuthTeamContext");

// (3) create subcontext for authTeamErrorContext
const socialAuthErrorContext = createErrorContext.context("SocialAuth");
const phoneAuthErrorContext = createErrorContext.context("PhoneAuth");

// (4) create features

const facebookError = socialAuthErrorContext.feature("FacebookAuth");
const smsSendError = phoneAuthErrorContext.feature("SmsSender");

facebookError.throw("FrontendLogickError", "Account inactive");
smsSendError.throw("BackendLogickError", "Limit exceed");
```

### Overload throwing (Sentry example)

```ts
import createError from "conway-errors"; // (!!!) at this moment not published
import * as Sentry from "@sentry/nextjs";

const createErrorContext = createError(["FrontendLogickError", "BackendLogickError"], {
  throwFn: (err) => { // overload throwing behavior
    Sentry.captureException(err);
  },
});
```

this code will throw error to sentry, but not throw global error

### Provide your custom message postfix

```ts
import createError from "conway-errors"; // (!!!) at this moment not published

const createErrorContext = createError([
  { errorType: "FrontendLogickError", createMessagePostfix: (originalError) => " >>> " + originalError?.message },
  { errorType: "BackendLogickError" },
] as const);

const context = createErrorContext("Context");
const feature = subcontext.feature("Feature");

try {
  // some business logick throwing error with message "Server upload avatar failed"
  uploadAvatar();
} catch (err) {
  feature.throw("FrontendLogickError", "Failed upload avatar", err);
  // will throw FrontendLogickError("Context/Feature: Failed upload avatar >>> Server upload avatar failed")
}
```

### Provide custom context with callback

For example you can provide custom createContext callback in createError, context creator, subcontext and features:

```ts
import createError from "conway-errors"; // (!!!) at this moment not published
import * as Sentry from "@sentry/nextjs";

const createErrorContext = createError(["FrontendLogickError", "BackendLogickError"], {
  createContext: () => ({
    isSSR: typeof window === "undefined",
    projectName: "My cool frontend"
  }),
  throwFn: (err, context) => {
    const { isSSR, projectName, logLevel = "error", location, subdomain } = context;

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


const paymentErrorContext = createErrorContext("Payment", () => ({
  subdomain: "Payment",
}));

const cardPaymentError = subcontext.feature("Cardpayment", () => ({
  location: "USA",
}));

cardPaymentError.throw("BackendLogickError", "Payment failed", { context: { logLevel: "fatal" } });
```
