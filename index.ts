/**
 * Root interface for any specific error type.
 */
export interface IConwayError extends Error {
  rootContext: string;
  contextsChunk: string;
  originalError?: OriginalError;

  emit: EmitFn;
}

class ConwayError extends Error implements IConwayError {
  readonly rootContext: string;
  readonly contextsChunk: string;
  readonly originalError?: OriginalError;

  constructor(
    name: string,
    rootContext: string,
    contextsChunk: string,
    message: string,
    emit: EmitFn,
    originalError?: OriginalError,
  ) {
    super(message);
    this.name = name;
    this.rootContext = rootContext;
    this.contextsChunk = contextsChunk;
    this.originalError = originalError;
    this.emit = emit;
  }

  emit: EmitFn;
}

type EmitFn = (extendedParams?: ExtendedParams) => void;

/**
 * Type guard which helps to understand if error is Conway error.
 * @param error
 * @return {boolean}
 */
export function isConwayError(error: unknown): error is IConwayError {
  return typeof error === "object" && error instanceof ConwayError;
}

function createErrorClass(name: string, rootContext: string) {
  return class extends ConwayError {
    constructor(contextsChunk: string, message: string, emit: EmitFn, originalError?: OriginalError) {
      super(name, rootContext, contextsChunk, message, emit, originalError);
    }
  };
}

function createContextedMessage(contextPath: string, featureName: string, message: string) {
  return `${contextPath}/${featureName}: ${message}`;
}

function defaultHandleEmit(err: IConwayError) {
  console.error(err);
}

type ExtendedParams = Record<string, unknown>;

type OriginalError = Error | Record<string, unknown> | unknown;

interface CreateErrorOptions {
  handleEmit?: (err: IConwayError, extendedParams?: ExtendedParams) => void;
  extendedParams?: ExtendedParams;
}

const defaultErrorOptions: CreateErrorOptions = {
  handleEmit: defaultHandleEmit,
  extendedParams: {},
};

type ErrorTypeConfig = ReadonlyArray<{
  errorType: string;
  createMessagePostfix?: (originalError?: OriginalError) => string;
}>;

type ErrorMap = Record<
  string,
  {
    errorClass: ReturnType<typeof createErrorClass>;
    createMessagePostfix?: (originalError?: OriginalError) => string;
  }
>;

type FeatureFn<ErrorType extends string> = (
  featureName: string,
  featureContextExtendedParams?: ExtendedParams,
) => CreateErrorFn<ErrorType>;

type CreateErrorFn<ErrorType extends string> = (
  errorType: ErrorType,
  message: string,
  originalError?: OriginalError,
) => IConwayError;

type ErrorSubcontext<ErrorType extends string> = {
  /**
   * Create a child context within the current context.
   *
   * @param {string} childContextName - The name of the child context.
   * @param {ExtendedParams} extendedParams - Additional extended parameters for the child context.
   * @return {Function} Function to create an error context with the specified child context name and extended params.
   */
  subcontext: (subcontextName: string, extendedParams?: ExtendedParams) => ErrorSubcontext<ErrorType>;
  /**
   * Creates a child feature within the current context.
   *
   * @param {string} childFeatureName - The name of the child feature.
   * @param {ExtendedParams} [extendedParams={}] - Additional extended parameters for the child feature.
   * @return {Function} The created error feature.
   */
  feature: FeatureFn<ErrorType>;
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
      contextExtendedParams: ExtendedParams = outerExtendedParams,
    ): ErrorSubcontext<ErrorTypes[number]["errorType"]> {
      return {
        subcontext: _createSubcontext(_contextName, contextExtendedParams),
        feature: (childFeatureName: string, extendedParams: ExtendedParams = {}) => {
          const featureErrorContext = { ...contextExtendedParams, ...extendedParams };
          return _createErrorFeature(childFeatureName, _contextName, featureErrorContext);
        },
      };
    }

    function _createErrorFeature(
      featureName: string,
      contextName: string,
      featureContextExtendedParams: ExtendedParams = {},
    ) {
      const createNewErrorObject: CreateErrorFn<ErrorTypes[number]["errorType"]> = (
        errorType,
        message: string,
        originalError?: OriginalError,
      ) => {
        const errorMapItem = errorsMap[errorType];
        const messagePostfix =
          originalError && errorMapItem?.createMessagePostfix ? errorMapItem.createMessagePostfix(originalError) : "";

        const emit: EmitFn = (extendedParams = {}) => {
          const _extendedParams = { ...featureContextExtendedParams, ...extendedParams };
          _options.handleEmit?.(error, _extendedParams);
        };

        const error = new (errorMapItem?.errorClass ?? UnknownError)(
          contextName,
          createContextedMessage(contextName, featureName, message + messagePostfix),
          emit,
          originalError,
        );

        return error;
      };

      return createNewErrorObject;
    }

    return _createErrorContext(contextName);
  };
}
