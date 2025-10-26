# conway-errors

[![npm version](https://badge.fury.io/js/conway-errors.svg)](https://badge.fury.io/js/conway-errors)
[![Downloads](https://img.shields.io/npm/dm/conway-errors.svg)](https://www.npmjs.com/package/conway-errors)

[RU Translation](README_RU.md)

JS/TS library for creating structured and readable errors

## Why conway-errors?

- **🎯 Structured Error Hierarchy**: Organize errors by context and functionality
- **📝 Readable Error Messages**: Clear, contextual messages with complete information
- **🔧 Flexible Configuration**: Full control over throwing and logging
- **🏗️ Separation of Concerns**: Elegant programmatic API for domain and team separation
- **📊 Tracker Integration**: Easy integration with error monitoring tools like Sentry, PostHog

```sh
ConwayError [BackendLogicError]: PaymentForm/APIError/APIPaymentError: Payment already processed
    at createNewErrorObject (/project/index.ts:205:23)
    at Object.<anonymous> (/project/index.test.ts:26:1)
    at Module._compile (node:internal/modules/cjs/loader:1740:14)
    at Module.m._compile (/project/node_modules/ts-node/src/index.ts:1618:23)
    at node:internal/modules/cjs/loader:1905:10
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
// Create an error
const loginError = appErrors.feature("LoginError");

throw loginError("ValidationError", "Invalid email format");
// Result: ValidationError: MyApp/LoginError: Invalid email format
```

## Examples

### Simple Structure

```ts
import { createError } from "conway-errors";

// Configure error types for your application
const createErrorContext = createError([
  { errorType: "ValidationError" },
  { errorType: "NetworkError" },
  { errorType: "BusinessLogicError" },
] as const);

// Create your application's root error context
const appErrors = createErrorContext("ECommerceApp");

// Create specific errors
const userRegistration = appErrors.feature("UserRegistration");
const paymentProcessing = appErrors.feature("PaymentProcessing");

// Throw contextual errors
try {
  // Some validation logic
  throw userRegistration("ValidationError", "Email already exists");
} catch (error) {
  console.log(error.message);
  // Output: "ValidationError: ECommerceApp/UserRegistration: Email already exists"
}

// Log errors without throwing
paymentProcessing("NetworkError", "Payment gateway timeout").emit();
```

### Hierarchical Error Organization

```ts
import { createError } from "conway-errors";

// Setup error configuration
const createErrorContext = createError([
  { errorType: "FrontendLogicError" },
  { errorType: "BackendLogicError" },
] as const);

// Create root context
const errorContext = createErrorContext("MyProject");

// Create organized subcontexts
const apiErrorContext = errorContext.subcontext("APIError");
const authErrorContext = errorContext.subcontext("AuthError");

// Create specific error functions
const oauthError = authErrorContext.feature("OauthError");
const apiPaymentError = apiErrorContext.feature("APIPaymentError");

// Throw errors
throw oauthError("FrontendLogicError", "User not found");
// Result: "FrontendLogicError: MyProject/AuthError/OauthError: User not found"

throw apiPaymentError("BackendLogicError", "Payment already processed");
// Result: "BackendLogicError: MyProject/APIError/APIPaymentError: Payment already processed"
```

### Separate Root Contexts

```ts
import { createError } from "conway-errors";

// Configure API-specific error types
const createAPIErrorContext = createError([
  { errorType: "MissingRequiredHeader" },
  { errorType: "InvalidInput" },
  { errorType: "InternalError" },
  { errorType: "RateLimitExceeded" },
] as const);

// Create service-specific error contexts
const authAPIErrors = createAPIErrorContext("AuthAPI");
const stockAPIErrors = createAPIErrorContext("StockAPI");

// Create feature-specific error handlers
const loginError = authAPIErrors.feature("LoginError");
const registerError = authAPIErrors.feature("RegisterError");
const stockSearchError = stockAPIErrors.feature("StockSearchError");

// Handle different error scenarios
try {
  // API call logic
  throw loginError("InvalidInput", "Invalid email format");
} catch (error) {
  // Handle login validation errors
}

// Log errors for monitoring
stockSearchError("RateLimitExceeded", "API quota exceeded").emit();
```

### Domain-Driven Error Organization

```ts
import { createError } from "conway-errors";

// Separate type sets for different contexts
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

// Payment domain errors
const paymentErrors = createPaymentErrors("Payment");
const recurringPayments = paymentErrors.subcontext("Recurring");
const refunds = paymentErrors.subcontext("Refund");

const recurringError = recurringPayments.feature("RecurringPaymentError");
const refundError = refunds.feature("RefundError");

// Auth domain errors
const authErrors = createAuthErrors("Authentication");
const oauthError = authErrors.feature("OAuthError");

// Usage examples
throw recurringError("ProcessingError", "Card declined for recurring payment");
throw oauthError("TokenError", "OAuth token has expired");
```

## Advanced Usage

### Team-Based Error Organization

Associate errors with teams for better debugging:

```ts
import { createError } from "conway-errors";

const createErrorContext = createError([
  { errorType: "FrontendLogicError" },
  { errorType: "BackendLogicError" },
] as const);

const projectErrors = createErrorContext("MyProject");

// Method 1: Using extendedParams for team attribution (recommended)
const authErrors = projectErrors.subcontext("Auth", {
  extendedParams: { team: "Platform Team", component: "Authentication" }
});

const searchErrors = projectErrors.subcontext("Search", {
  extendedParams: { team: "User Experience Team", component: "Search" }
});

// Method 2: Team-specific root contexts
const platformErrors = createErrorContext("PlatformTeam");
const uxErrors = createErrorContext("UXTeam");
```

## Configuration Options

### Error Monitoring Integration

#### Sentry Integration

Override `.emit()` to send events to Sentry:

```ts
import { createError } from "conway-errors";
import * as Sentry from "@sentry/nextjs";

const createErrorContext = createError([
  { errorType: "FrontendLogicError" },
  { errorType: "BackendLogicError" }
] as const, {
  // Custom error handling for monitoring
  handleEmit: (err) => {
    Sentry.captureException(err);
  },
});

const appErrors = createErrorContext("MyApp");
const userError = appErrors.feature("UserAction");

// Automatically logs to Sentry when using emit()
userError("FrontendLogicError", "Form validation failed").emit();
```

#### PostHog Integration

Integrate with PostHog for error tracking with user analytics:

```ts
import { createError } from "conway-errors";
import posthog from "posthog-js";

const createErrorContext = createError([
  { errorType: "ValidationError" },
  { errorType: "NetworkError" },
  { errorType: "BusinessLogicError" }
] as const, {
  extendedParams: {
    userId: null,
    sessionId: null,
    feature: null
  },
  handleEmit: (err, extendedParams) => {
    const { userId, sessionId, feature, severity = "error" } = extendedParams;
    
    // Capture exception with PostHog
    posthog.captureException(err, {
      user_id: userId,
      session_id: sessionId,
      feature: feature,
      severity: severity,
      error_context: err.name, // Conway error context path
      timestamp: Date.now()
    });
  },
});

const checkoutErrors = createErrorContext("Checkout", {
  extendedParams: { feature: "payment_flow" }
});

const paymentError = checkoutErrors.feature("PaymentProcessing");

// Error with user context for PostHog analytics
paymentError("NetworkError", "Payment gateway timeout").emit({
  extendedParams: {
    userId: "user-123",
    sessionId: "session-456",
    severity: "critical"
  }
});
```

### Custom Error Message Formatting

```ts
import { createError } from "conway-errors";

const createErrorContext = createError([
  {
    errorType: "FrontendLogicError",
    createMessagePostfix: (originalError) => " >>> " + originalError?.message
  },
  { errorType: "BackendLogicError" },
] as const);

const context = createErrorContext("FileUpload");
const uploadError = context.feature("AvatarUpload");

try {
  await uploadAvatar();
} catch (err) {
  throw uploadError("FrontendLogicError", "Failed to upload avatar", err);
  // Result: "FrontendLogicError: FileUpload/AvatarUpload: Failed to upload avatar >>> Network timeout"
}
```

### Extended Parameters and Metadata

Add custom metadata to errors for enhanced debugging and monitoring:

```ts
import { createError } from "conway-errors";
import * as Sentry from "@sentry/nextjs";

const createErrorContext = createError(
  ["FrontendLogicError", "BackendLogicError"],
  {
    extendedParams: {
      environment: process.env.NODE_ENV,
      version: "1.2.3"
    },
    handleEmit: (err, extendedParams) => {
      const { environment, version, severity = "error", userId, action } = extendedParams;

      Sentry.withScope(scope => {
        scope.setTags({ environment, version, action });
        scope.setUser({ id: userId });
        scope.setLevel(severity);
        Sentry.captureException(err);
      });
    },
  }
);

const paymentErrors = createErrorContext("Payment", {
  extendedParams: { service: "stripe" }
});

const cardPayment = paymentErrors.feature("CardPayment", {
  extendedParams: { region: "us-east-1" }
});

// Error with context-specific metadata
const error = cardPayment("BackendLogicError", "Payment processing failed");
error.emit({
  extendedParams: {
    userId: "user-123",
    action: "checkout",
    severity: "critical"
  }
});
```

## TypeScript Support

### Type Utilities

#### AnyFeatureOfSubcontext

Type-safe error handling with explicit subcontext constraints:

```ts
import { createError, AnyFeatureOfSubcontext } from "conway-errors";

const createErrorContext = createError([
  { errorType: "ValidationError" },
  { errorType: "ProcessingError" },
] as const);

const appErrors = createErrorContext("App");
const authErrors = appErrors.subcontext("Auth");

const loginError = authErrors.feature("LoginError");
const generalError = appErrors.feature("GeneralError");

// Type-safe error handler for auth-specific features
function handleAuthError(errorFeature: AnyFeatureOfSubcontext<typeof authErrors>) {
  // Only accepts features from authErrors subcontext
}

handleAuthError(loginError);    // ✅ Valid
handleAuthError(generalError);  // ❌ TypeScript error
```

## Troubleshooting

### Common Issues

**Q: Error messages are not showing the full context path**

A: Make sure you're using `as const` when defining error types:

```ts
// ✅ Correct
const createErrorContext = createError(["ValidationError"] as const);

// ❌ Incorrect
const createErrorContext = createError(["ValidationError"]);
```

**Q: TypeScript errors when using custom error types**

A: Ensure proper typing with const assertions and avoid mixing string literals with objects:

```ts
// ✅ Correct
const createErrorContext = createError([
  { errorType: "CustomError" },
  { errorType: "AnotherError" }
] as const);
```

**Q: Extended parameters not appearing in error handlers**

A: Extended parameters are inherited through the hierarchy. Child contexts override parent parameters with the same key.

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