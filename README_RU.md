# conway-errors

Библиотека позволяет с помощью минимального API создать иерархию ошибок без использования явного наследования классов.

[Go to english documentation](README.md)

## Использование

### Простой пример

```ts
import { createError } from "conway-errors"; 

// (1) Создаем корневой контекст, где определяются базовые типы ошибок
const createErrorContext = createError([
  { errorType: "FrontendLogicError" },
  { errorType: "BackendLogicError" },
] as const);

// (2) Создаем любое количество контекстов, например разделяем по команде или контексту
const errorAuthTeamContext = createErrorContext("AuthTeamContext");
const errorPaymentTeamContext = createErrorContext("PaymentTeamContext");

// (3) Определяем конкретные реализации на базе функционала (features)
const oauthError = errorAuthTeamContext.feature("OauthError");
const paymentError = errorPaymentTeamContext.feature("PaymentError");

// (4) Пример выброса ошибок
throw oauthError("FrontendLogicError", "User not found");
throw paymentError("BackendLogicError", "Payment already processed");

// (5) Пример эмиттинга выброшенных ошибок
try {
  throw oauthError("FrontendLogicError", "User not found");
}
catch(error) {
  oauthError.emitCreatedError(error);
}

// (6) Пример эмиттинга ошибок без вызова throw 
oauthError.emit("FrontendLogicError", "User not found");
```

### Вложенные контексты

```ts
import { createError } from "conway-errors"; 

// (1) создаем корневой контекст, где определяются базовые типы ошибок
const createErrorContext = createError([
  { errorType: "FrontendLogicError" },
  { errorType: "BackendLogicError" },
] as const);

// (2) создаем любое количество контекстов, например разделяем по команде или контексту
const authTeamErrorContext = createErrorContext("AuthTeamContext");

// (3) создаем любое количество вложенных контекстов
const socialAuthErrorContext = createErrorContext.subcontext("SocialAuth");
const phoneAuthErrorContext = createErrorContext.subcontext("PhoneAuth");

// (3) определяем конкретные реализации на базе функционала (features)
const facebookError = socialAuthErrorContext.feature("FacebookAuth");
const smsSendError = phoneAuthErrorContext.feature("SmsSender");

// (4) пример выброса ошибок
throw facebookError("FrontendLogicError", "Account inactive");
throw smsSendError("BackendLogicError", "Limit exceed");
```

### Переопределение функции выброса ошибки

Пример для интеграции с Sentry (<https://sentry.io/>)

```ts
import { createError } from "conway-errors"; 
import * as Sentry from "@sentry/nextjs";

const createErrorContext = createError([
  { errorType: "FrontendLogicError" },
  { errorType: "BackendLogicError" }
] as const, {
  // переопределяем поведение выброса ошибки
  emitFn: (err) => {
    Sentry.captureException(err);
  },
});
```

данны код не выбросит ошибку глобально

### Дополнение сообщения базовых ошибок

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
  // будет выброшена ошибка:
  // FrontendLogicError("Context/Feature: Failed upload avatar >>> Server upload avatar failed")
}
```

### Передача расширяемых параметров в контексты и ошибки

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

throw cardPaymentError("BackendLogicError", "Payment failed", { extendedParams: { logLevel: "fatal" } });
```
