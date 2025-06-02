/**
 * Root interface for any specific error type.
 */
export interface IConwayError extends Error {
  rootContext: string;
  contextsChunk: string;
  feature: string;
  originalError?: OriginalError;
  extendedParams?: ExtendedParams;

  emit: EmitFn;
}

class ConwayError extends Error implements IConwayError {
  readonly rootContext: string;
  readonly contextsChunk: string;
  readonly originalError?: OriginalError;
  readonly extendedParams?: ExtendedParams;

  feature = "";

  constructor(
    name: string,
    rootContext: string,
    contextsChunk: string,
    message: string,
    emit: EmitFn,
    originalError?: OriginalError,
    extendedParams?: ExtendedParams
  ) {
    super(message);
    this.name = name;
    this.rootContext = rootContext;
    this.contextsChunk = contextsChunk;
    this.originalError = originalError;
    this.emit = emit;
    this.extendedParams = extendedParams;
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
    constructor(
      contextsChunk: string,
      message: string,
      emit: EmitFn,
      originalError?: OriginalError,
      extendedParams?: ExtendedParams
    ) {
      super(name, rootContext, contextsChunk, message, emit, originalError, extendedParams);
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

type ErrorFnOptions = {
  originalError?: OriginalError;
  extendedParams?: ExtendedParams;
};

type CreateErrorFn<ErrorType extends string> = (
  errorType: ErrorType,
  message: string,
  options?: ErrorFnOptions
) => IConwayError;

type Brand<T, B> = T & { __brand: B };

type ErrorSubcontext<Name extends string, ErrorType extends string> = Brand<Subcontext<Name, ErrorType>, Name>;
type ErrorFeature<Name extends string, ErrorType extends string> = Brand<CreateErrorFn<ErrorType>, Name>;
export type AnyFeatureOfSubcontext<S> = S extends ErrorSubcontext<infer Name, infer ErrorType>
  ? ErrorFeature<`${Name}/${string}`, ErrorType>
  : never;

type Subcontext<Name extends string, ErrorType extends string> = {
  /**
   * Create a child context within the current context.
   *
   * @param {string} childContextName - The name of the child context.
   * @param {ExtendedParams} extendedParams - Additional extended parameters for the child context.
   * @return {Function} Function to create an error context with the specified child context name and extended params.
   */
  subcontext: <const ChildContextName extends string>(
    subcontextName: ChildContextName,
    extendedParams?: ExtendedParams
  ) => ErrorSubcontext<`${Name}/${ChildContextName}`, ErrorType>;
  /**
   * Creates a child feature within the current context.
   *
   * @param {string} childFeatureName - The name of the child feature.
   * @param {ExtendedParams} [extendedParams={}] - Additional extended parameters for the child feature.
   * @return {Function} The created error feature.
   */
  feature: <const FeatureName extends string>(
    featureName: FeatureName,
    featureContextExtendedParams?: ExtendedParams
  ) => ErrorFeature<`${Name}/${FeatureName}`, ErrorType>;
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

  return <const ContextName extends string>(contextName: ContextName, extendedParams: ExtendedParams = {}) => {
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
      <const ContextName extends string>(contextName: ContextName, subContextExtendedParams: ExtendedParams) =>
      <const ChildContextName extends string>(
        childContextName: ChildContextName,
        extendedParams: ExtendedParams = {}
      ) => {
        const subErrorContext = { ...subContextExtendedParams, ...extendedParams };
        return _createErrorContext(`${contextName}/${childContextName}`, subErrorContext);
      };

    function _createErrorContext<const ContextName extends string>(
      _contextName: ContextName,
      contextExtendedParams: ExtendedParams = outerExtendedParams
    ): ErrorSubcontext<ContextName, ErrorTypes[number]["errorType"]> {
      return {
        __brand: _contextName,
        subcontext: _createSubcontext(_contextName, contextExtendedParams),
        feature: <const FeatureName extends string>(
          childFeatureName: FeatureName,
          extendedParams: ExtendedParams = {}
        ) => {
          const featureErrorContext = { ...contextExtendedParams, ...extendedParams };
          return _createErrorFeature(childFeatureName, _contextName, featureErrorContext);
        },
      };
    }

    function _createErrorFeature<const ContextName extends string, const FeatureName extends string>(
      featureName: FeatureName,
      contextName: ContextName,
      featureContextExtendedParams: ExtendedParams = {}
    ): ErrorFeature<`${ContextName}/${FeatureName}`, ErrorTypes[number]["errorType"]> {
      const createNewErrorObject: CreateErrorFn<ErrorTypes[number]["errorType"]> = (
        errorType,
        message: string,
        options?: ErrorFnOptions
      ) => {
        const errorMapItem = errorsMap[errorType];
        const messagePostfix =
          options?.originalError && errorMapItem?.createMessagePostfix
            ? errorMapItem.createMessagePostfix(options?.originalError)
            : "";

        const emit: EmitFn = (extendedParams = {}) => {
          const _extendedParams = { ...featureContextExtendedParams, ...options?.extendedParams, ...extendedParams };
          _options.handleEmit?.(error, _extendedParams);
        };

        const error = new (errorMapItem?.errorClass ?? UnknownError)(
          contextName,
          createContextedMessage(contextName, featureName, message + messagePostfix),
          emit,
          options?.originalError,
          options?.extendedParams
        );

        error.feature = featureName;

        return error;
      };

      Object.assign(createNewErrorObject, { __brand: `${contextName}/${featureName}` as const });
      return createNewErrorObject as ErrorFeature<`${ContextName}/${FeatureName}`, ErrorTypes[number]["errorType"]>;
    }

    return _createErrorContext(contextName);
  };
}
