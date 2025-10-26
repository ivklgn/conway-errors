# conway-errors

[![npm version](https://badge.fury.io/js/conway-errors.svg)](https://badge.fury.io/js/conway-errors)
[![Downloads](https://img.shields.io/npm/dm/conway-errors.svg)](https://www.npmjs.com/package/conway-errors)

[Английский перевод](README.md)

JS/TS библиотека для создания структурированных и читабельных ошибок

## Почему conway-errors?

- **🎯 Структурированная иерархия ошибок**: Организуйте ошибки по контексту и функционалу
- **📝 Читаемые сообщения об ошибках**: Понятные, контекстуальные сообщения с полной информацией
- **🔧 Гибкая конфигурация**: Полный контроль выброса и логирования
- **🏗️ Разделение зон ответственности**: Изящный программный API для разбивки по доменам и командам
- **📊 Интеграция с трекерами**: Удобное подключение мониторинга ошибок, таких как Sentry, Posthog

```sh
ConwayError [BackendLogicError]: PaymentForm/APIError/APIPaymentError: Payment already processed
    at createNewErrorObject (/project/index.ts:205:23)
    at Object.<anonymous> (/project/index.test.ts:26:1)
    at Module._compile (node:internal/modules/cjs/loader:1740:14)
    at Module.m._compile (/project/node_modules/ts-node/src/index.ts:1618:23)
    at node:internal/modules/cjs/loader:1905:10
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
// Создайте ошибку
const loginError = appErrors.feature("LoginError");

throw loginError("ValidationError", "Неверный формат email");
// Результат: ValidationError: MyApp/LoginError: Неверный формат email
```

## Примеры

### Простая структура

```ts
import { createError } from "conway-errors";

// Настройте типы ошибок для вашего приложения
const createErrorContext = createError([
  { errorType: "ValidationError" },
  { errorType: "NetworkError" },
  { errorType: "BusinessLogicError" },
] as const);

// Создайте корневой контекст ошибок приложения
const appErrors = createErrorContext("ECommerceApp");

// Создайте конкретные ошибки
const userRegistration = appErrors.feature("UserRegistration");
const paymentProcessing = appErrors.feature("PaymentProcessing");

// Выбрасывайте контекстуальные ошибки
try {
  // Какая-то логика валидации
  throw userRegistration("ValidationError", "Email уже существует");
} catch (error) {
  console.log(error.message);
  // Вывод: "ValidationError: ECommerceApp/UserRegistration: Email уже существует"
}

// Логируйте ошибки без выброса
paymentProcessing("NetworkError", "Таймаут платежного шлюза").emit();
```

### Иерархическая организация ошибок

```ts
import { createError } from "conway-errors";

// Настройка конфигурации ошибок
const createErrorContext = createError([
  { errorType: "FrontendLogicError" },
  { errorType: "BackendLogicError" },
] as const);

// Создание корневого контекста
const errorContext = createErrorContext("MyProject");

// Создание организованных подконтекстов
const apiErrorContext = errorContext.subcontext("APIError");
const authErrorContext = errorContext.subcontext("AuthError");

// Создание конкретных функций ошибок
const oauthError = authErrorContext.feature("OauthError");
const apiPaymentError = apiErrorContext.feature("APIPaymentError");

// Выброс ошибок
throw oauthError("FrontendLogicError", "Пользователь не найден");
// Результат: "FrontendLogicError: MyProject/AuthError/OauthError: Пользователь не найден"

throw apiPaymentError("BackendLogicError", "Платеж уже обработан");
// Результат: "BackendLogicError: MyProject/APIError/APIPaymentError: Платеж уже обработан"
```

### Отдельные корневые контексты

```ts
import { createError } from "conway-errors";

// Настройка типов ошибок, специфичных для API
const createAPIErrorContext = createError([
  { errorType: "MissingRequiredHeader" },
  { errorType: "InvalidInput" },
  { errorType: "InternalError" },
  { errorType: "RateLimitExceeded" },
] as const);

// Создание контекстов ошибок для конкретных сервисов
const authAPIErrors = createAPIErrorContext("AuthAPI");
const stockAPIErrors = createAPIErrorContext("StockAPI");

// Создание обработчиков ошибок для конкретных функций
const loginError = authAPIErrors.feature("LoginError");
const registerError = authAPIErrors.feature("RegisterError");
const stockSearchError = stockAPIErrors.feature("StockSearchError");

// Обработка различных сценариев ошибок
try {
  // Логика API вызова
  throw loginError("InvalidInput", "Неверный формат email");
} catch (error) {
  // Обработка ошибок валидации входа
}

// Логирование ошибок для мониторинга
stockSearchError("RateLimitExceeded", "Превышена квота API").emit();
```

### Доменно-ориентированная организация ошибок

```ts
import { createError } from "conway-errors";

// Отдельные наборы типов для разных контекстов
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

// Ошибки домена платежей
const paymentErrors = createPaymentErrors("Payment");
const recurringPayments = paymentErrors.subcontext("Recurring");
const refunds = paymentErrors.subcontext("Refund");

const recurringError = recurringPayments.feature("RecurringPaymentError");
const refundError = refunds.feature("RefundError");

// Ошибки домена аутентификации
const authErrors = createAuthErrors("Authentication");
const oauthError = authErrors.feature("OAuthError");

// Примеры использования
throw recurringError("ProcessingError", "Карта отклонена для регулярного платежа");
throw oauthError("TokenError", "OAuth токен истек");
```

## Продвинутое использование

### Организация ошибок по командам

Связывайте ошибки с команд для лучшей отладки:

```ts
import { createError } from "conway-errors";

const createErrorContext = createError([
  { errorType: "FrontendLogicError" },
  { errorType: "BackendLogicError" },
] as const);

const projectErrors = createErrorContext("MyProject");

// Метод 1: Использование extendedParams для атрибуции команды (рекомендуется)
const authErrors = projectErrors.subcontext("Auth", {
  extendedParams: { team: "Platform Team", component: "Authentication" }
});

const searchErrors = projectErrors.subcontext("Search", {
  extendedParams: { team: "User Experience Team", component: "Search" }
});

// Метод 2: Корневые контексты для конкретных команд
const platformErrors = createErrorContext("PlatformTeam");
const uxErrors = createErrorContext("UXTeam");
```

## Параметры конфигурации

### Интеграция с мониторингом ошибок

#### Интеграция с Sentry

Перегрузка `.emit()` для отправки событий в Sentry:

```ts
import { createError } from "conway-errors";
import * as Sentry from "@sentry/nextjs";

const createErrorContext = createError([
  { errorType: "FrontendLogicError" },
  { errorType: "BackendLogicError" }
] as const, {
  // Пользовательская обработка ошибок для мониторинга
  handleEmit: (err) => {
    Sentry.captureException(err);
  },
});

const appErrors = createErrorContext("MyApp");
const userError = appErrors.feature("UserAction");

// Автоматически логирует в Sentry при использовании emit()
userError("FrontendLogicError", "Валидация формы не прошла").emit();
```

#### Интеграция с PostHog

Интегрируйтесь с PostHog для отслеживания ошибок с пользовательской аналитикой:

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
    
    // Захват исключения с PostHog
    posthog.captureException(err, {
      user_id: userId,
      session_id: sessionId,
      feature: feature,
      severity: severity,
      error_context: err.name, // Путь контекста Conway error
      timestamp: Date.now()
    });
  },
});

const checkoutErrors = createErrorContext("Checkout", {
  extendedParams: { feature: "payment_flow" }
});

const paymentError = checkoutErrors.feature("PaymentProcessing");

// Ошибка с пользовательским контекстом для аналитики PostHog
paymentError("NetworkError", "Таймаут платежного шлюза").emit({
  extendedParams: {
    userId: "user-123",
    sessionId: "session-456",
    severity: "critical"
  }
});
```

### Пользовательское форматирование сообщений об ошибках

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
  throw uploadError("FrontendLogicError", "Не удалось загрузить аватар", err);
  // Результат: "FrontendLogicError: FileUpload/AvatarUpload: Не удалось загрузить аватар >>> Таймаут сети"
}
```

### Расширенные параметры и метаданные

Добавляйте пользовательские метаданные к ошибкам для улучшения отладки и мониторинга:

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

// Ошибка с контекстно-специфичными метаданными
const error = cardPayment("BackendLogicError", "Сбой обработки платежа");
error.emit({
  extendedParams: {
    userId: "user-123",
    action: "checkout",
    severity: "critical"
  }
});
```

## Поддержка TypeScript

### Утилиты типов

#### AnyFeatureOfSubcontext

Типобезопасная обработка ошибок с явными ограничениями подконтекста:

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

// Типобезопасный обработчик ошибок для функций, специфичных для аутентификации
function handleAuthError(errorFeature: AnyFeatureOfSubcontext<typeof authErrors>) {
  // Принимает только функции из подконтекста authErrors
}

handleAuthError(loginError);    // ✅ Валидно
handleAuthError(generalError);  // ❌ Ошибка TypeScript
```

## Устранение неполадок

### Распространенные проблемы

**В: Сообщения об ошибках не показывают полный путь контекста**

О: Убедитесь, что вы используете `as const` при определении типов ошибок:

```ts
// ✅ Правильно
const createErrorContext = createError(["ValidationError"] as const);

// ❌ Неправильно
const createErrorContext = createError(["ValidationError"]);
```

**В: Ошибки TypeScript при использовании пользовательских типов ошибок**

О: Обеспечьте правильную типизацию с const assertions и избегайте смешивания строковых литералов с объектами:

```ts
// ✅ Правильно
const createErrorContext = createError([
  { errorType: "CustomError" },
  { errorType: "AnotherError" }
] as const);
```

**В: Расширенные параметры не появляются в обработчиках ошибок**

О: Расширенные параметры наследуются через иерархию. Дочерние контексты переопределяют родительские параметры с тем же ключом.

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
