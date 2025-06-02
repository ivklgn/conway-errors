# conway-errors

[![npm version](https://badge.fury.io/js/conway-errors.svg)](https://badge.fury.io/js/conway-errors)
[![Downloads](https://img.shields.io/npm/dm/conway-errors.svg)](https://www.npmjs.com/package/conway-errors)

[RU Translation](README_RU.md)

A library to simplify the creation, structuring, and throwing of errors

1. Simple and minimalist API for creating error contexts
2. Configurable readable error messages
3. Adding arbitrary attributes for detailed error information

```sh
ConwayError [BackendLogicError]: PaymentForm/APIError/APIPaymentError: Payment already processed
    at createNewErrorObject (/project/index.ts:205:23)
    at Object.<anonymous> (/project/index.test.ts:26:1)
    at Module._compile (node:internal/modules/cjs/loader:1740:14)
    at Module.m._compile (/project/node_modules/ts-node/src/index.ts:1618:23)
    at node:internal/modules/cjs/loader:1905:10
```

## Installation

```bash
npm install conway-errors
```

## Usage

### Single root context for the entire project

```ts
import { createError } from "conway-errors";

// (1) Configuration
const createErrorContext = createError([
  { errorType: "FrontendLogicError" },
  { errorType: "BackendLogicError" },
] as const);

// (2) Creating the root context
const errorContext = createErrorContext("MyProject");

// (3) Creating nested contexts
const apiErrorContext = errorContext.subcontext("APIError");
const authErrorContext = errorContext.subcontext("AuthError");

// (4) Creating error objects
const oauthError = authErrorContext.feature("OauthError");
const apiPaymentError = apiErrorContext.feature("APIPaymentError");

// (4) Example of throwing errors
throw oauthError("FrontendLogicError", "User not found");
throw apiPaymentError("BackendLogicError", "Payment already processed");

// (5) Alternative: logging an error without throwing
oauthError("FrontendLogicError", "User not found").emit();
```

### Multiple root error contexts

In this example, we consider creating multiple root contexts for error hierarchy in the application network layer

```ts
import { createError } from "conway-errors";

// (1) Configuration, error types can be related to technical details:
const createErrorAPIContext = createError([
  { errorType: "MissingRequiredHeader" },
  { errorType: "InvalidInput" },
  { errorType: "InternalError" },
  // ...
] as const);

// (2) Creating root contexts (you can define the hierarchy logic yourself)
const authAPIErrorContext = createErrorAPIContext("AuthAPI");
const stockAPIErrorContext = createErrorAPIContext("StockAPI");

// (3) Creating error objects without subcontexts
const apiLoginError = authAPIErrorContext.feature("APILoginError"); 
const apiRegisterError = authAPIErrorContext.feature("APIRegisterError"); 
const apiStockSearchError = stockAPIErrorContext.feature("APIStockSearchError");

// (4) Throwing errors (example: network layer / service layer)
throw apiLoginError("InternalError", "Unexpected error");
throw apiRegisterError("InvalidInput", "Invalid credentials");
apiStockSearchError("MissingRequiredHeader", "Application Id not found").emit();
```

### Multiple root errors

```ts
import { createError } from "conway-errors";

// (1) Error configuration #1 for payment operations
const createMonetizationErrorContext = createError([
  { errorType: "FrontendLogicError" },
  { errorType: "BackendLogicError" },
] as const);

// (2) Error configuration #2 for authorization
const createAuthErrorContext = createError([
  { errorType: "FrontendLogicError" },
  { errorType: "BackendLogicError" },
] as const);

// (3) Modeling errors for payment operations
const paymentErrorContext = createMonetizationErrorContext("Payment");
const recurentPaymentErrorContext = paymentErrorContext.subcontext("RecurentPayment");
const recurentPaymentError = recurentPaymentErrorContext.feature("RecurentPaymentError");

const refundErrorContext = paymentErrorContext.subcontext("Refund");
const refundError = refundErrorContext.feature("RefundError");

// (4) Modeling errors for authorization
const oauthErrorContext = createAuthErrorContext("OAuth");
const oauthError = oauthErrorContext.feature("OAuthError");
// ...
```

### Modeling Errors relative to Project Team Structure

For associating errors with teams, you can use `extendedParams`.

```ts
import { createError } from "conway-errors";

// (1) Configuration
const createErrorContext = createError([
  { errorType: "FrontendLogicError" },
  { errorType: "BackendLogicError" },
  // ...
] as const);

// (2) Creating the root context
const errorContext = createErrorContext("MyProject");

// (3) Creating subcontexts
const authErrorContext = errorContext.subcontext("Auth", { extendedParams: { team: "Platform Team" } });
const searchErrorContext = errorContext.subcontext("Search", { extendedParams: { team: "User Experience Team" } });
```

An alternative approach is to create root contexts or subcontexts for each team:

```ts
import { createError } from "conway-errors";

// (1) Configuration
const createErrorContext = createError([
  { errorType: "FrontendLogicError" },
  { errorType: "BackendLogicError" },
  // ...
] as const);

// (2) Creating a root context for each team
const platformTeamErrorContext = createErrorContext("PlatformTeam");
const monetizationTeamErrorContext = createErrorContext("MonetizationTeam");
```


## Additional configuration

### Overriding the error throwing function

Example for integration with Sentry (<https://sentry.io/>)

```ts
import { createError } from "conway-errors";
import * as Sentry from "@sentry/nextjs";

const createErrorContext = createError([
  { errorType: "FrontendLogicError" },
  { errorType: "BackendLogicError" }
] as const, {
  // overriding the error "logging" (emitting) behavior
  handleEmit: (err) => {
    Sentry.captureException(err);
  },
});

const context = createErrorContext("Context");
const featureError = context.feature("Feature");

// emit() will call captureException:
featureError("FrontendLogicError", "My error message").emit();
```

### Adding a Separator for Error Messages

```ts
import { createError } from "conway-errors";

const createErrorContext = createError([
  { errorType: "FrontendLogicError", createMessagePostfix: (originalError) => " >>> " + originalError?.message },
  { errorType: "BackendLogicError" },
] as const);

const context = createErrorContext("Context");
const featureError = subcontext.feature("Feature");

try {
  uploadAvatar();
} catch (err) {
  throw featureError("FrontendLogicError", "Failed upload avatar", err);
  // The thrown error will be:
  // FrontendLogicError("Context/Feature: Failed upload avatar >>> Server upload avatar failed")
}
```

### Passing Additional Parameters to Contexts and Error Objects

You can pass an object with arbitrary parameters as `extendedParams` in the options. It is important to note that parameters with the same name in `extendedParams` will be overwritten in subcontexts and error objects.

```ts
import { createError } from "conway-errors";
import * as Sentry from "@sentry/nextjs";

const createErrorContext = createError(["FrontendLogicError", "BackendLogicError"], {
  extendedParams: {
    isSSR: typeof window === "undefined",
    projectName: "My cool frontend"
  },
  handleEmit: (err, extendedParams) => {
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

const cardPaymentError = paymentErrorContext.feature("CardPayment", {
  location: "USA",
});

const error = cardPaymentError("BackendLogicError", "Payment failed", { extendedParams: { a: 1 } });
error.emit({ extendedParams: { logLevel: "fatal" } });
```

### Helper Functions and Types

#### AnyFeatureOfSubcontext

Allows you to explicitly specify the type for any feature of the given subcontext.

```ts
import { createError } from "conway-errors";

const createErrorContext = createError([
  { errorType: "FrontendLogicError" },
  { errorType: "BackendLogicError" },
] as const);

const context = createErrorContext("Context");
const subcontext = context.subcontext("Subcontext");

const featureError1 = context.feature("Feature");
const featureError2 = subcontext.feature("Feature");

function customErrorThrower(featureError: AnyFeatureOfSubcontext<typeof subcontext>) {
  // ...
}

customErrorThrower(featureError1); // error
customErrorThrower(featureError2); // ok
```

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
