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

export function createError(errorTypes: string[] = [], options?: CreateErrorOptions) {
  const _options = { ...defaultErrorOptions, ...options };

  // TODO: contextOptions using
  return function createErrorContext(contextName: string, contextOptions: { projectName?: string } = {}) {
    const errorsMap = errorTypes.reduce<{ [key: string]: typeof BaseError }>((acc, errorType) => {
      acc[errorType] = _options.createErrorClass!(errorType, contextName);
      return acc;
    }, {});

    const UnknownError = _options.createErrorClass!("UnknownError", contextName);

    function _createErrorContext(_contextName: string, options: { projectName?: string } = {}) {
      return {
        context: function (childContextName: string, childProjectName: string) {
          return _createErrorContext(`${_contextName}/${childContextName}`, { projectName: childProjectName });
        },
        feature: function (childFeatureName: string) {
          return _createErrorFeature(childFeatureName, _contextName);
        },
      };
    }

    function _createErrorFeature(featureName: string, contextName: string) {
      return {
        throw: function (errorName: string, message: string) {
          // TODO:
          // @ts-ignore
          const error = new (errorsMap[errorName] ?? UnknownError)(
            createContextedMessage(contextName, featureName, message)
          );
          _options.throwFn!(error);
        },
      };
    }

    return _createErrorContext(contextName, { projectName: contextOptions.projectName });
  };
}
