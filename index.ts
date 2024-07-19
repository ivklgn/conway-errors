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

function createContextedMessage(contextPath: string, featureName: string, message: string) {
  return `${contextPath}/${featureName}: ${message}`;
}

function throwFn(err: unknown) {
  throw err;
}

type ExtendedParams = Record<string, unknown>;

interface CreateErrorOptions {
  throwFn?: (err: Error, extendedParams?: ExtendedParams) => void;
  extendedParams?: ExtendedParams;
}

const defaultErrorOptions: CreateErrorOptions = {
  throwFn,
  extendedParams: {},
};

type ErrorTypeConfig = ReadonlyArray<{
  errorType: string;
  createMessagePostfix?: (originalError?: Error) => string;
}>;

type ErrorMap = Record<
  string,
  {
    errorClass: ReturnType<typeof createErrorClass>;
    createMessagePostfix?: (originalError?: Error) => string;
  }
>;

type FeatureFn = (
  featureName: string,
  featureContextExtendedParams?: ExtendedParams
) => {
  throw: (
    errorType: ErrorTypeConfig[number]["errorType"],
    message: string,
    options?: { originalError?: Error; extendedParams?: ExtendedParams }
  ) => void;
};

type ErrorSubcontext = {
  subcontext: (subcontextName: string, extendedParams?: ExtendedParams) => ErrorSubcontext;
  feature: FeatureFn;
};

/**
 * Function to create an error context with specified error types and options.
 *
 * @param {ErrorTypeConfig} errorTypes - Array of error types and optional message postfix creation functions.
 * @param {CreateErrorOptions} options - Options for error creation, including custom throw function and extended params.
 * @return {Function} Function to create an error context with specific context name and extended params.
 */
export function createError<ErrorTypes extends ErrorTypeConfig>(errorTypes?: ErrorTypes, options?: CreateErrorOptions) {
  const _options = { ...defaultErrorOptions, ...options };
  const initialExtendedParams = options?.extendedParams ?? {};

  return (contextName: string, extendedParams: ExtendedParams = {}) => {
    const outerExtendedParams = { ...initialExtendedParams, ...extendedParams };

    const errorsMap: ErrorMap = Array.isArray(errorTypes)
      ? errorTypes.reduce<ErrorMap>((acc, { errorType, createMessagePostfix }) => {
          acc[errorType] = {
            errorClass: createErrorClass(errorType, contextName),
            createMessagePostfix,
          };
          return acc;
        }, {})
      : {};

    const UnknownError = createErrorClass("UnknownError", contextName);

    const _createSubcontext =
      (contextName: string, subContextExtendedParams: ExtendedParams) =>
      (childContextName: string, extendedParams: ExtendedParams = {}) => {
        const subErrorContext = { ...subContextExtendedParams, ...extendedParams };
        return _createErrorContext(`${contextName}/${childContextName}`, subErrorContext);
      };

    function _createErrorContext(
      _contextName: string,
      subContextExtendedParams: ExtendedParams = outerExtendedParams
    ): ErrorSubcontext {
      return {
        /**
         * Create a child context within the current context.
         *
         * @param {string} childContextName - The name of the child context.
         * @param {ExtendedParams} extendedParams - Additional extended parameters for the child context.
         * @return {Function} Function to create an error context with the specified child context name and extended params.
         */
        subcontext: _createSubcontext(_contextName, subContextExtendedParams),
        /**
         * Creates a child feature within the current context.
         *
         * @param {string} childFeatureName - The name of the child feature.
         * @param {ExtendedParams} [extendedParams={}] - Additional extended parameters for the child feature.
         * @return {Function} The created error feature.
         */
        feature: (childFeatureName: string, extendedParams: ExtendedParams = {}) => {
          const featureErrorContext = { ...subContextExtendedParams, ...extendedParams };
          return _createErrorFeature(childFeatureName, _contextName, featureErrorContext);
        },
      };
    }

    function _createErrorFeature(
      featureName: string,
      contextName: string,
      featureContextExtendedParams: ExtendedParams = {}
    ) {
      return {
        /**
         * Throws an error of the specified type with the given message and optional original error and extended parameters.
         *
         * @param {ErrorTypes[number]["errorType"]} errorType - The type of the error to throw.
         * @param {string} message - The message for the error.
         * @param {Object} [options={}] - Optional parameters for the error.
         * @param {Error} [options.originalError] - The original error that caused this error.
         * @param {ExtendedParams} [options.extendedParams] - Additional extended parameters for the error.
         * @return {void} This function does not return anything.
         */
        throw: (
          errorType: ErrorTypes[number]["errorType"],
          message: string,
          options: { originalError?: Error; extendedParams?: ExtendedParams } = {}
        ) => {
          const errorMapItem = errorsMap[errorType];
          const messagePostfix =
            options.originalError && errorMapItem?.createMessagePostfix
              ? errorMapItem.createMessagePostfix(options.originalError)
              : "";

          const error = new (errorMapItem?.errorClass ?? UnknownError)(
            createContextedMessage(contextName, featureName, message + messagePostfix)
          );

          const _extendedParams = { ...featureContextExtendedParams, ...options.extendedParams };
          _options.throwFn?.(error, _extendedParams);
        },
      };
    }

    return _createErrorContext(contextName);
  };
}
