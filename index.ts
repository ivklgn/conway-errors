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

type ExtendedParams = Record<string, unknown>;

interface CreateErrorOptions {
  throwFn?: (err: Error, extendedParams?: ExtendedParams) => void;
  extendedParams?: ExtendedParams;
}

const defaultErrorOptions: CreateErrorOptions = {
  throwFn: throwFn,
  extendedParams: {},
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
  const initialExtendedParams = options?.extendedParams ?? {};

  return function (contextName: string, extendedParams?: CreateErrorOptions["extendedParams"]) {
    const outerExtendedParams = { ...initialExtendedParams, ...(extendedParams ?? {}) };

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

    function _createErrorContext(_contextName: string, subContextExtendedParams: ExtendedParams = outerExtendedParams) {
      return {
        context: function (childContextName: string, extendedParams?: CreateErrorOptions["extendedParams"]) {
          const subErrorContext = { ...subContextExtendedParams, ...(extendedParams ?? {}) };
          return _createErrorContext(`${_contextName}/${childContextName}`, subErrorContext);
        },
        feature: function (childFeatureName: string, extendedParams?: CreateErrorOptions["extendedParams"]) {
          const featureErrorContext = { ...subContextExtendedParams, ...(extendedParams ?? {}) };
          return _createErrorFeature(childFeatureName, _contextName, featureErrorContext);
        },
      };
    }

    function _createErrorFeature(
      featureName: string,
      contextName: string,
      featureContextExtendedParams?: ExtendedParams
    ) {
      return {
        throw: function (
          errorType: ExtractTypeFieldFromArrayOfObjects<ErrorTypes[number]>["errorType"],
          message: string,
          options: { originalError?: Error; extendedParams?: ExtendedParams } = {}
        ) {
          const errorMapItem = errorsMap[errorType];
          const messagePostfix =
            options?.originalError && errorMapItem?.createMessagePostfix
              ? errorMapItem.createMessagePostfix(options?.originalError)
              : "";

          const error = new (errorMapItem?.errorClass ?? UnknownError)(
            createContextedMessage(contextName, featureName, message + messagePostfix)
          );

          const _extendedParams = { ...(featureContextExtendedParams ?? {}), ...(options?.extendedParams ?? {}) };
          _options.throwFn!(error, _extendedParams);
        },
      };
    }

    return _createErrorContext(contextName);
  };
}
