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

interface CreateErrorOptions {
  createErrorClass?: typeof createErrorClass;
  throwFn?: (err: Error) => void;
}

const defaultErrorOptions: CreateErrorOptions = {
  createErrorClass: createErrorClass,
  throwFn: throwFn,
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

  // TODO: contextOptions using
  return function createErrorContext(contextName: string, contextOptions: { projectName?: string } = {}) {
    const errorsMap = Array.isArray(errorTypes)
      ? errorTypes.reduce<ErrorMap>((acc, errorConfig) => {
          acc[errorConfig.errorType] = {
            errorClass: _options.createErrorClass!(errorConfig.errorType, contextName),
            ...(errorConfig.createMessagePostfix ? { createMessagePostfix: errorConfig.createMessagePostfix } : {}),
          };

          return acc;
        }, {})
      : {};

    const UnknownError = _options.createErrorClass!("UnknownError", contextName);

    function _createErrorContext(_contextName: string, options: { projectName?: string } = {}) {
      return {
        context: function (childContextName: string, childProjectName: string) {
          return _createErrorContext(`${_contextName}/${childContextName}`, {
            projectName: childProjectName,
          });
        },
        feature: function (childFeatureName: string) {
          return _createErrorFeature(childFeatureName, _contextName);
        },
      };
    }

    function _createErrorFeature(featureName: string, contextName: string) {
      return {
        throw: function (
          errorType: ExtractTypeFieldFromArrayOfObjects<ErrorTypes[number]>["errorType"],
          message: string,
          originalError?: Error
        ) {
          const errorMapItem = errorsMap[errorType];
          const messagePostfix =
            originalError && errorMapItem?.createMessagePostfix ? errorMapItem.createMessagePostfix(originalError) : "";

          const error = new (errorMapItem?.errorClass ?? UnknownError)(
            createContextedMessage(contextName, featureName, message + messagePostfix)
          );
          _options.throwFn!(error);
        },
      };
    }

    return _createErrorContext(contextName, {
      projectName: contextOptions.projectName,
    });
  };
}
