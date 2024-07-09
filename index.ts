class BaseError extends Error {
  context: string;

  constructor(name: string, context: string, message: string) {
    super(message);
    this.name = name;
    this.context = context;
  }
}

function createErrorClass(name: string, context: string) {
  return class extends BaseError {
    constructor(message: string) {
      super(name, context, message);
    }
  };
}

const createContextedMessage = (contextPath: string, featureName: string, message: string) =>
  `${contextPath}/${featureName}: ${message}`;

function throwFn(err: unknown) {
  throw err;
}

type Context = Record<string, unknown>;

type CreateContextFn = (context?: Context) => Context;

interface CreateErrorOptions {
  throwFn?: (err: Error, context?: Context) => void;
  createContext?: CreateContextFn;
}

const noop = () => {};

function mergeContext(context1: Context, context2: Context) {
  return { ...context1, ...context2 };
}

const defaultErrorOptions: CreateErrorOptions = {
  throwFn: throwFn,
  createContext: noop as CreateContextFn,
};

type ExtractTypeFieldFromArrayOfObjects<T> = T extends { type: infer U } ? U : T;
type ErrorTypeConfig = Readonly<
  Readonly<{ errorType: string; createMessagePostfix?: (originalError?: Error) => string }>[]
>;

type ErrorMap = {
  [key: string]: {
    errorClass: ReturnType<typeof createErrorClass>;
    createMessagePostfix?: (originalError?: Error) => string;
  };
};

export function createError<ErrorTypes extends ErrorTypeConfig>(errorTypes?: ErrorTypes, options?: CreateErrorOptions) {
  const _options = { ...defaultErrorOptions, ...options };
  const initialContext = options?.createContext?.() ?? {};

  return function (contextName: string, createContext?: CreateErrorOptions["createContext"]) {
    const outerErrorContext = mergeContext(initialContext, createContext?.() ?? {});

    const errorsMap = Array.isArray(errorTypes)
      ? errorTypes.reduce<ErrorMap>((acc, errorConfig) => {
          acc[errorConfig.errorType] = {
            errorClass: createErrorClass!(errorConfig.errorType, contextName),
            ...(errorConfig.createMessagePostfix ? { createMessagePostfix: errorConfig.createMessagePostfix } : {}),
          };

          return acc;
        }, {})
      : {};

    const UnknownError = createErrorClass!("UnknownError", contextName);

    function _createErrorContext(_contextName: string, subContext: Context = outerErrorContext) {
      return {
        context: function (childContextName: string, createContext?: CreateErrorOptions["createContext"]) {
          const subErrorContext = mergeContext(subContext, createContext?.() ?? {});
          return _createErrorContext(`${_contextName}/${childContextName}`, subErrorContext);
        },
        feature: function (childFeatureName: string, createContext?: CreateErrorOptions["createContext"]) {
          const featureErrorContext = mergeContext(subContext, createContext?.() ?? {});
          return _createErrorFeature(childFeatureName, _contextName, featureErrorContext);
        },
      };
    }

    function _createErrorFeature(featureName: string, contextName: string, featureContext?: Context) {
      return {
        throw: function (
          errorType: ExtractTypeFieldFromArrayOfObjects<ErrorTypes[number]>["errorType"],
          message: string,
          options: { originalError?: Error; context?: Context } = {}
        ) {
          const errorMapItem = errorsMap[errorType];
          const messagePostfix =
            options?.originalError && errorMapItem?.createMessagePostfix
              ? errorMapItem.createMessagePostfix(options?.originalError)
              : "";

          const error = new (errorMapItem?.errorClass ?? UnknownError)(
            createContextedMessage(contextName, featureName, message + messagePostfix)
          );

          const errorContext = mergeContext(featureContext ?? {}, options?.context ?? {});
          _options.throwFn!(error, errorContext);
        },
      };
    }

    return _createErrorContext(contextName);
  };
}
