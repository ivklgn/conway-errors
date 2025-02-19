# conway-errors

[![npm version](https://badge.fury.io/js/conway-errors.svg)](https://badge.fury.io/js/conway-errors)
[![Downloads](https://img.shields.io/npm/dm/conway-errors.svg)](https://www.npmjs.com/package/conway-errors)

[Английский перевод](README.md)

Библиотека для упрощения создания, структурирования и выброса ошибок

1. Простой и минималистичный API для создания контекстов ошибок
2. Возможность конфигурации читабельного сообщения об ошибке
3. Добавление произвольных атрибутов для детализации ошибки

```sh
ConwayError [BackendLogicError]: PaymentForm/APIError/APIPaymentError: Payment already processed
    at createNewErrorObject (/project/index.ts:205:23)
    at Object.<anonymous> (/project/index.test.ts:26:1)
    at Module._compile (node:internal/modules/cjs/loader:1740:14)
    at Module.m._compile (/project/node_modules/ts-node/src/index.ts:1618:23)
    at node:internal/modules/cjs/loader:1905:10
```

## Установка

```bash
npm install conway-errors
```

## Использование

### Один корневой контекст для всего проекта

```ts
import { createError } from "conway-errors";

// (1) Конфигурация
const createErrorContext = createError([
  { errorType: "FrontendLogicError" },
  { errorType: "BackendLogicError" },
] as const);

// (2) Создание корневого конекста
const errorContext = createErrorContext("MyProject");

// (3) Создание вложенных контекстов
const apiErrorContext = errorContext.subcontext("APIError");
const authErrorContext = errorContext.subcontext("AuthError");

// (4) Создание объектов ошибок
const oauthError = authErrorContext.feature("OauthError");
const apiPaymentError = apiErrorContext.feature("APIPaymentError");

// (4) Пример выброса ошибок
throw oauthError("FrontendLogicError", "User not found");
throw apiPaymentError("BackendLogicError", "Payment already processed");

// (5) Альтернативный вариант: логирование ошибки без throw
oauthError("FrontendLogicError", "User not found").emit();
```

### Несколько корневых контекстов ошибок

В данном примере рассмотрим создание нескольких корневых контекстов для иерархии ошибок в сетевом слое

```ts
import { createError } from "conway-errors";

// (1) Конфигурация, типы ошибок могут быть связаны с техническими подробностями:
const createErrorAPIContext = createError([
  { errorType: "MissingRequiredHeader" },
  { errorType: "InvalidInput" },
  { errorType: "InternalError" },
  // ...
] as const);

// (2) Создание корневых конекстов (вы можете сами определить логику иерархии)
const authAPIErrorContext = createErrorAPIContext("AuthAPI");
const stockAPIErrorContext = createErrorAPIContext("StockAPI");

// (3) Cоздание обьектов ошибок возможно без подконтекстов
const apiLoginError = authAPIErrorContext.feature("APILoginError"); 
const apiRegisterError = authAPIErrorContext.feature("APIRegisterError"); 
const apiStockSearchError = stockAPIErrorContext.feature("APIStockSearchError");

// (4) Выбрасывание ошибок (пример: сетевой слой / слой сервисов)
throw apiLoginError("InternalError", "Unexpected error");
throw apiRegisterError("InvalidInput", "Invalid credentials");
apiStockSearchError("MissingRequiredHeader", "Application Id not found").emit();
```

### Несколько корневых ошибок

```ts
import { createError } from "conway-errors";

// (1) Конфигурация ошибок #1 для платежных операций
const createMonetizationErrorContext = createError([
  { errorType: "FrontendLogicError" },
  { errorType: "BackendLogicError" },
] as const);

// (2) Конфигурация ошибок #2 для авторизации
const createAuthErrorContext = createError([
  { errorType: "FrontendLogicError" },
  { errorType: "BackendLogicError" },
] as const);

// (3) Моделируем ошибки для платежных операций
const paymentErrorContext = createMonetizationErrorContext("Payment");
const recurentPaymentErrorContext = paymentErrorContext.subcontext("RecurentPayment");
const recurentPaymentError = recurentPaymentErrorContext.feature("RecurentPaymentError");

const refundErrorContext = createPaymentErrorContext("Refund");
const refundError = refundErrorContext.feature("RefundError");

// (4) Моделируем ошибки для авторизации
const oauthErrorContext = createAuthErrorContext("OAuth");
const oauthError = oauthErrorContext.feature("OAuthError");
// ...
```

### Моделируем ошибки относительно структуры команд проекта

для ассоциации с командами можно использовать extendedParams

```ts
import { createError } from "conway-errors";

// (1) Конфигурация
const createErrorContext = createError([
  { errorType: "FrontendLogicError" },
  { errorType: "BackendLogicError" },
  // ...
] as const);

// (2) Создание корневого конекста
const errorContext = createErrorContext("MyProject");

// (3) Создание подконтекстов
const authErrorContext = errorContext.subcontext("Auth", { extendedParams: { team: "Platform Team" } });
const searchErrorContext = errorContext.subcontext("Search", { extendedParams: { team: "User Expirience Team" } });
```

Альтернативный вариант - корневые контексты или подконтексты для команд:

```ts
import { createError } from "conway-errors";

// (1) Конфигурация
const createErrorContext = createError([
  { errorType: "FrontendLogicError" },
  { errorType: "BackendLogicError" },
  // ...
] as const);

// (2) Создание корневого конекста для каждой команды
const platformTeamErrorContext = createErrorContext("PlatformTeam");
const monetizationTeamErrorContext = createErrorContext("MonetizationTeam");
```

## Дополнительная конфигурация

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
  handleEmit: (err) => {
    Sentry.captureException(err);
  },
});

const context = createErrorContext("Context");
const featureError = context.feature("Feature");

// emit() вызовет captureException:
featureError("FrontendLogicError", "My error message").emit();
```

### Добавление разделителя для текста ошибки

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

### Передача дополнительных параметров в контексты и обьекты ошибок

В options можно передать обьект с произвольными параметрами `extendedParams`. Важно помнить что одноименные параметры extendendParams 
в подконтекстах и обьектах ошибок будут перезаписываться

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
error.emit({ extendedParams: { logLevel: "fatal" } })
```

## Благодарность за вклад

<table>
  <tbody>
    <tr>
      <td align="center" valign="top">
        <a href="https://github.com/alex-knyazev">
          <img src="https://github.com/alex-knyazev.png" width="100px;" alt="Князев Александр" />
          <br />
          <sub><b>Князев Александр</b></sub></a
        >
      </td>
      <td align="center" valign="top">
        <a href="https://github.com/AlexMubarakshin">
          <img src="https://github.com/AlexMubarakshin.png" width="100px;" alt="Мубаракшин Александр" />
          <br />
          <sub><b>Мубаракшин Александр</b></sub></a
        >
      </td>
    </tr>
  </tbody>
</table>
