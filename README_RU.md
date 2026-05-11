# conway-errors

[![npm version](https://badge.fury.io/js/conway-errors.svg)](https://badge.fury.io/js/conway-errors)
[![Downloads](https://img.shields.io/npm/dm/conway-errors.svg)](https://www.npmjs.com/package/conway-errors)

[Английский перевод](README.md)

JS/TS библиотека для создания структурированных и читабельных ошибок.

> **Обновляетесь с 3.x?** См. [Миграция на 4.0](#миграция-на-40) — экземпляры ошибок теперь заморожены и read-only.

## Почему conway-errors?

- **🎯 Структурированная иерархия ошибок**: Организуйте ошибки по контексту и функционалу
- **📝 Читаемые сообщения об ошибках**: Понятные, контекстуальные сообщения с полной информацией
- **🔧 Гибкая конфигурация**: Полный контроль выброса и логирования
- **🏗️ Разделение зон ответственности**: Изящный программный API для разбивки по доменам и командам
- **📊 Интеграция с трекерами**: Удобное подключение мониторинга ошибок, таких как Sentry, PostHog
- **🔒 Иммутабельные ошибки**: Каждый экземпляр заморожен — безопасно передавать между слоями

```sh
BackendLogicError: MyProject/APIError/APIPaymentError: Payment already processed
    at createNewErrorObject (/project/dist/index.js:205:23)
    at handleCheckout (/project/src/checkout.ts:42:11)
    ...
```

## Быстрый старт

### 1. Установка

```bash
npm install conway-errors
```

### 2. Базовая настройка

```ts
import { createError } from "conway-errors";

// Определите типы ошибок
const createErrorContext = createError([
  { errorType: "ValidationError" },
  { errorType: "NetworkError" },
] as const);

// Создайте ваш первый контекст ошибок
const appErrors = createErrorContext("MyApp");
```

### 3. Создание и выброс ошибок

```ts
const loginError = appErrors.feature("LoginError");

throw loginError("ValidationError", "Неверный формат email");
// error.name    === "ValidationError"
// error.message === "MyApp/LoginError: Неверный формат email"
// console.error(error) выведет: "ValidationError: MyApp/LoginError: Неверный формат email"
```

`error.message` содержит только путь контекста и текст сообщения. Префикс с типом ошибки (`ValidationError:`) добавляется рантаймом при приведении к строке (`console.error`, `error.toString()`).

## Примеры

### Простая структура

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
  throw userRegistration("ValidationError", "Email уже существует");
} catch (error) {
  console.log((error as Error).message);
  // "ECommerceApp/UserRegistration: Email уже существует"
}

// Логирование ошибок без выброса
paymentProcessing("NetworkError", "Таймаут платёжного шлюза").emit();
```

### Иерархическая организация ошибок

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

throw oauthError("FrontendLogicError", "Пользователь не найден");
// error.message === "MyProject/AuthError/OauthError: Пользователь не найден"

throw apiPaymentError("BackendLogicError", "Платёж уже обработан");
// error.message === "MyProject/APIError/APIPaymentError: Платёж уже обработан"
```

### Отдельные корневые контексты

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
  throw loginError("InvalidInput", "Неверный формат email");
} catch (error) {
  // Обработка ошибок валидации входа
}

stockSearchError("RateLimitExceeded", "Превышена квота API").emit();
```

### Доменно-ориентированная организация ошибок

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

throw recurringError("ProcessingError", "Карта отклонена для регулярного платежа");
throw oauthError("TokenError", "OAuth токен истёк");
```

## Расширенные параметры

`extendedParams` — произвольная карта метаданных, которая течёт от `createError` → корневого контекста → подконтекста → feature → точки вызова. Каждый уровень принимает **обычный объект** вторым позиционным аргументом:

```ts
const createErrorContext = createError(
  [{ errorType: "FrontendLogicError" }, { errorType: "BackendLogicError" }] as const,
  {
    extendedParams: { environment: process.env.NODE_ENV },  // ← обёрнуто в CreateErrorOptions
    handleEmit: (err, params) => {
      // `params` — это ПОЛНАЯ объединённая карта (root → ctx → sub → feature → call-site)
      console.error({ err, params });
    },
  }
);

const projectErrors = createErrorContext("MyProject", { app: "web" });          // ← карта напрямую
const authErrors = projectErrors.subcontext("Auth", { team: "Platform Team" }); // ← карта напрямую
const loginError = authErrors.feature("Login", { component: "LoginForm" });     // ← карта напрямую

loginError("FrontendLogicError", "Невалидный токен").emit({ severity: "warn" }); // ← карта напрямую
// handleEmit получит: { environment, app: "web", team: "Platform Team",
//                       component: "LoginForm", severity: "warn" }
```

**Важно:** второй аргумент `createErrorContext`, `subcontext`, `feature` и `.emit()` — **сама карта параметров**, а не `{ extendedParams: ... }`. Только верхнеуровневый `createError(types, options)` оборачивает её в `CreateErrorOptions` (вместе с `handleEmit`).

**Асимметрия, которую важно знать:** `error.extendedParams` на брошенном экземпляре содержит **только срез call-site** (то, что было передано через `options.extendedParams` при вызове feature). Полная объединённая карта доставляется исключительно в `handleEmit`. Потребителям, которым нужен объединённый контекст, следует читать его внутри хендлера.

## Параметры конфигурации

### Интеграция с Sentry

Переопределите `handleEmit` для отправки событий в Sentry:

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

userError("FrontendLogicError", "Валидация формы не прошла").emit();
```

### Интеграция с PostHog

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

paymentError("NetworkError", "Таймаут платёжного шлюза").emit({
  userId: "user-123",
  sessionId: "session-456",
  severity: "critical",
});
```

### Исходная ошибка и постфикс сообщения

Передавайте исходную ошибку через `options.originalError` (**третий** аргумент вызова feature). Если для подходящего `errorType` определена `createMessagePostfix`, её вывод дописывается к `error.message`.

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
  throw uploadError("FrontendLogicError", "Не удалось загрузить аватар", { originalError: cause });
  // error.message === "FileUpload/AvatarUpload: Не удалось загрузить аватар >>> Network timeout"
}
```

Первый аргумент `createMessagePostfix` имеет тип `unknown` — сузьте его (`instanceof Error`, `typeof === "string"` и т.д.) перед чтением свойств. Falsy-но-присутствующие значения (`0`, `""`, `false`) пробрасываются; только `undefined` и `null` пропускают постфикс.

### Комбинация `extendedParams` и Sentry

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

const error = cardPayment("BackendLogicError", "Сбой обработки платежа");
error.emit({ userId: "user-123", action: "checkout", severity: "critical" });
```

## Идентификация ошибок

Используйте `isConwayError`, чтобы сузить `unknown` до `IConwayError`:

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

Тайп-гард использует маркер `Symbol.for("conway-errors:brand")`, поэтому корректно работает через realm-границы (workers, iframe, или когда несколько копий библиотеки попадают в один бандл).

## Поддержка TypeScript

### `AnyFeatureOfSubcontext`

Типобезопасная обработка ошибок с ограничением на конкретный подконтекст:

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
  // Принимает только features, чей путь начинается с "App/Auth"
}

handleAuthError(loginError);    // ✅ Валидно
handleAuthError(generalError);  // ❌ Ошибка TypeScript
```

### Публичные экспорты типов

Для потребителей, строящих обёртки или типизированные хендлеры:

| Тип | Назначение |
|---|---|
| `IConwayError` | Форма каждого брошенного экземпляра (extends `Error`). |
| `EmitFn` | Сигнатура `IConwayError.emit`. |
| `ExtendedParams` | `Record<string, unknown>`, используется везде. |
| `CreateErrorOptions` | Аргумент `options` функции `createError`. |
| `ErrorFnOptions` | Аргумент `options` при вызове feature. |
| `ErrorTypeConfig` | Тип массива `errorTypes`. |
| `AnyFeatureOfSubcontext<S>` | Вывести сигнатуру feature из типа подконтекста. |

## Миграция на 4.0

### Заморозка и read-only поля

`Object.freeze` теперь вызывается внутри конструктора `ConwayError`, и все публичные поля помечены `readonly`. Код, мутировавший брошенные ошибки, должен переехать на `extendedParams`:

```ts
// 3.x — молчаливо мутировал ошибку (readonly работал только на этапе компиляции)
err.feature = "renamed";
(err as any).requestId = "abc-123";

// 4.0 — обе строки бросят TypeError в strict mode
//        feature read-only И сам экземпляр заморожен

// 4.0 — храните метаданные через extendedParams
feature("X", "msg", { extendedParams: { requestId: "abc-123" } });
```

Если использовались интеграции, декорирующие брошенные ошибки постфактум (например, навешивание маркера `__captured__`, переписывание `stack`), они теперь упадут. Перейдите на коллбэк `handleEmit` или ведите side-таблицу по экземпляру ошибки.

### `isConwayError` теперь на основе бренда

Раньше гард использовал `instanceof ConwayError`, что ломалось между realm'ами. 4.0 использует маркер `Symbol.for("conway-errors:brand")` — гард стал безопасен к cross-realm, но перестал распознавать вручную написанные подклассы `Error`, унаследованные от (неэкспортированного) базового класса.

### `OriginalError` больше не экспортируется

Это был алиас на `unknown` без какой-либо пользы для narrowing. Удалите импорт и используйте `unknown` напрямую. `originalError` по-прежнему типизирован как `unknown` везде, где встречается.

### Более строгий TypeScript

Библиотека теперь компилируется под `exactOptionalPropertyTypes`. `error.originalError` и `error.extendedParams` всегда являются собственными свойствами (`"originalError" in err === true`), со значением `undefined`, если не передано. Проверки на наличие следует делать через `err.originalError !== undefined`, а не `"originalError" in err`.

### `package.json#exports`

Условный экспорт-маппинг использует стандартную форму `{ types, import, require }`. Современные бандлеры и Node ≥ 12 работают без изменений; тулинг, привязанный к старым ключам, может потребовать обновления.

## Устранение неполадок

**В: Типы ошибок расширены до `string` вместо литерального юниона.**

О: Добавьте `as const` к массиву `errorTypes`:

```ts
// ✅ Правильно — errorType сужен до "ValidationError" | "NetworkError"
const createErrorContext = createError([
  { errorType: "ValidationError" },
  { errorType: "NetworkError" },
] as const);

// ❌ Неправильно — errorType выводится как `string`
const createErrorContext = createError([
  { errorType: "ValidationError" },
  { errorType: "NetworkError" },
]);
```

**В: `error.extendedParams` показывает только то, что я передал на call-site, а не объединённую карту.**

О: Это by design. Полная объединённая карта доставляется в `handleEmit` как второй аргумент. Экземпляр несёт только срез call-site.

**В: `createMessagePostfix` не срабатывает для `UnknownError`.**

О: `UnknownError` — fallback для незарегистрированного `errorType`. Постфикс-функции привязаны к зарегистрированным типам — зарегистрируйте тип явно, чтобы получить декорирование сообщения.

**В: Мой `handleEmit` обёрнут в try/catch и теперь сбой Sentry/PostHog ломает приложение.**

О: Библиотека **не** оборачивает `handleEmit`. Бросающий хендлер пробрасывает исключение в вызывающего `.emit()`. Заверните свою интеграцию сами, если нужна fail-safe доставка.

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
