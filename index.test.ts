import { test } from "uvu";
import { snoop } from "snoop";
import * as assert from "uvu/assert";

import { createError, isConwayError, type IConwayError } from "./index";

test("UnknownError behavior in different scenarios", () => {
  // Test 1: undefined errorTypes - should always create UnknownError
  const createErrorContext = createError();
  const errorContext = createErrorContext("Context");
  const featureError = errorContext.feature("Feature");

  try {
    throw featureError("ErrorName", "ErrorMessage");
  } catch (e) {
    const err = e as IConwayError;
    assert.is(err.name, "UnknownError");
    assert.is(err.message, "Context/Feature: ErrorMessage");
  }

  // Test 2: empty array - should always create UnknownError
  const createErrorContextEmpty = createError([] as const);
  const emptyContext = createErrorContextEmpty("Context");
  const emptyFeature = emptyContext.feature("Feature");

  try {
    // @ts-expect-error - testing runtime behavior with invalid error type
    throw emptyFeature("AnyErrorType", "ErrorMessage");
  } catch (e) {
    const err = e as IConwayError;
    assert.is(err.name, "UnknownError");
    assert.is(err.message, "Context/Feature: ErrorMessage");
  }

  // Test 3: using wrong error type - should create UnknownError
  const createErrorContextSingle = createError([{ errorType: "SingleErrorType" }] as const);
  const singleContext = createErrorContextSingle("Context");
  const singleFeature = singleContext.feature("Feature");

  try {
    // @ts-expect-error - testing runtime behavior with invalid error type
    throw singleFeature("WrongErrorType", "ErrorMessage");
  } catch (e) {
    const err = e as IConwayError;
    assert.is(err.name, "UnknownError");
    assert.is(err.message, "Context/Feature: ErrorMessage");
  }
});

test("error types throw always mapped errors", () => {
  const createErrorContext = createError([{ errorType: "ErrorType1" }, { errorType: "ErrorType2" }] as const);
  const errorContext = createErrorContext("Context");
  const featureError = errorContext.feature("Feature");

  try {
    throw featureError("ErrorType1", "ErrorMessage");
  } catch (e) {
    const err = e as IConwayError;
    assert.is(err.name, "ErrorType1");
    assert.is(err.message, "Context/Feature: ErrorMessage");
    assert.is(err.feature, "Feature");
  }

  try {
    throw featureError("ErrorType2", "ErrorMessage");
  } catch (e) {
    const err = e as IConwayError;
    assert.is(err.name, "ErrorType2");
    assert.is(err.message, "Context/Feature: ErrorMessage");
    assert.is(err.feature, "Feature");
  }
});

test("nested context write correct message", () => {
  const createErrorContext = createError([{ errorType: "ErrorType1" }, { errorType: "ErrorType2" }] as const);

  const context = createErrorContext("Context");
  const subcontext1 = context.subcontext("Subcontext1");
  const subcontext2 = subcontext1.subcontext("Subcontext2");

  const feature1Error = subcontext2.feature("Feature 1");

  try {
    throw feature1Error("ErrorType1", "ErrorMessage");
  } catch (e) {
    const err = e as IConwayError;
    assert.is(err.name, "ErrorType1");
    assert.is(err.message, "Context/Subcontext1/Subcontext2/Feature 1: ErrorMessage");
  }

  const subcontext3 = subcontext2.subcontext("Subcontext3");
  const subcontext4 = subcontext3.subcontext("Subcontext4");

  const feature2Error = subcontext4.feature("Feature 2");

  try {
    throw feature2Error("ErrorType2", "ErrorMessage");
  } catch (e) {
    const err = e as IConwayError;
    assert.is(err.name, "ErrorType2");
    assert.is(err.message, "Context/Subcontext1/Subcontext2/Subcontext3/Subcontext4/Feature 2: ErrorMessage");
  }
});

test("custom emit function should override default emit", () => {
  const mockedEmit = snoop((err, context) => {});

  const createErrorContext = createError([{ errorType: "ErrorType1" }, { errorType: "ErrorType2" }] as const, {
    handleEmit: (err, context) => {
      mockedEmit.fn(err.message, context);
    },
  });

  const errorContext = createErrorContext("Context");
  const featureError = errorContext.feature("Feature");

  featureError("ErrorType1", "ErrorMessage").emit();

  assert.ok(mockedEmit.calledOnce);

  assert.equal(
    // @ts-ignore
    mockedEmit.calls[0].arguments[0],
    "Context/Feature: ErrorMessage"
  );

  assert.equal(
    // @ts-ignore
    mockedEmit.calls[0].arguments[1],
    {}
  );
});

test("createMessagePostfix add message if originalError provided", () => {
  const createErrorContext = createError([
    { errorType: "ErrorType1", createMessagePostfix: (originalError) => ` >>> ${(originalError as Error).message}` },
    { errorType: "ErrorType2", createMessagePostfix: () => " some additional info" },
  ] as const);

  const context = createErrorContext("Context");
  const subcontext = context.subcontext("Subcontext1");

  const featureError = subcontext.feature("Feature");
  const originalError = new Error("OriginalError");

  try {
    throw featureError("ErrorType1", "ErrorMessage", { originalError });
  } catch (e) {
    const err = e as IConwayError;
    assert.is(err.name, "ErrorType1");
    assert.is(err.message, "Context/Subcontext1/Feature: ErrorMessage >>> OriginalError");
  }

  try {
    throw featureError("ErrorType2", "ErrorMessage", { originalError });
  } catch (e) {
    const err = e as IConwayError;
    assert.is(err.name, "ErrorType2");
    assert.is(err.message, "Context/Subcontext1/Feature: ErrorMessage some additional info");
  }
});

test("createContext provide context from createError to feature and available in emitting", () => {
  const mockedEmit = snoop((err, extendedParams) => {});

  const createErrorContext = createError([{ errorType: "ErrorType1" }, { errorType: "ErrorType2" }] as const, {
    extendedParams: {
      ctxA: 1,
    },
    handleEmit: (err, extendedParams) => {
      mockedEmit.fn(err, extendedParams);
    },
  });

  const context = createErrorContext("Context", {
    ctxB: 2,
  });

  const subcontext1 = context.subcontext("Subcontext1", {
    ctxC: 3,
  });

  const feature1Error = subcontext1.feature("Feature1", {
    ctxD: 4,
  });

  feature1Error("ErrorType1", "ErrorMessage").emit();
  assert.equal(
    // @ts-ignore
    mockedEmit.calls[0].arguments[1],
    {
      ctxA: 1,
      ctxB: 2,
      ctxC: 3,
      ctxD: 4,
    }
  );

  // rewrite context

  const subcontext2 = context.subcontext("Subcontext2", {
    ctxA: 100,
    ctxC: 3,
  });

  const feature2Error = subcontext2.feature("Feature2", {
    ctxB: 1000,
    ctxD: 4,
  });

  feature2Error("ErrorType1", "ErrorMessage").emit();

  assert.equal(
    // @ts-ignore
    mockedEmit.calls[1].arguments[1],
    {
      ctxA: 100,
      ctxB: 1000,
      ctxC: 3,
      ctxD: 4,
    }
  );

  feature2Error("ErrorType1", "ErrorMessage").emit({ ctxE: 5 });
  assert.equal(
    // @ts-ignore
    mockedEmit.calls[2].arguments[1],
    {
      ctxA: 100,
      ctxB: 1000,
      ctxC: 3,
      ctxD: 4,
      ctxE: 5,
    }
  );
});

test("isConwayError type guard works correctly", () => {
  assert.equal(isConwayError(null), false);
  assert.equal(isConwayError("just string"), false);
  assert.equal(isConwayError(0), false);

  const nativeError = new Error("Native JS error");
  assert.equal(isConwayError(nativeError), false);

  const createErrorContext = createError();
  const errorContext = createErrorContext("Context");
  const featureError = errorContext.feature("Feature");
  try {
    throw featureError("ErrorName", "ErrorMessage");
  } catch (e) {
    const err = e as IConwayError;
    assert.equal(isConwayError(err), true);
  }
});

test("feature error can receive extendedParams before emit", () => {
  const mockedEmit = snoop((err, extendedParams) => {});

  const createErrorContext = createError([{ errorType: "ErrorType1" }, { errorType: "ErrorType2" }] as const, {
    handleEmit: (err, extendedParams) => {
      mockedEmit.fn(err, extendedParams);
    },
  });

  const context = createErrorContext("Context");
  const subcontext = context.subcontext("Subcontext");
  const featureError = subcontext.feature("Feature");

  featureError("ErrorType1", "ErrorMessage", { extendedParams: { a: 1 } }).emit({ b: 2 });

  try {
    throw featureError("ErrorType1", "ErrorMessage", { extendedParams: { a: 1 } });
  } catch (e) {
    const err = e as IConwayError;
    assert.equal(err?.extendedParams, { a: 1 });
  }

  assert.equal(
    // @ts-ignore
    mockedEmit.calls[0].arguments[1],
    {
      a: 1,
      b: 2,
    }
  );
});

test("error object write extendedParams to properties", () => {
  const createErrorContext = createError([{ errorType: "ErrorType1" }, { errorType: "ErrorType2" }] as const, {});

  const context = createErrorContext("Context");
  const subcontext = context.subcontext("Subcontext");
  const featureError = subcontext.feature("Feature");

  try {
    throw featureError("ErrorType1", "ErrorMessage");
  } catch (e) {
    const err = e as IConwayError;
    assert.is(err?.extendedParams, undefined);
  }

  try {
    throw featureError("ErrorType1", "ErrorMessage", { extendedParams: { a: 1 } });
  } catch (e) {
    const err = e as IConwayError;
    assert.equal(err?.extendedParams, { a: 1 });
  }
});

test("error properties validation (rootContext, contextsChunk)", () => {
  const createErrorContext = createError([{ errorType: "ErrorType1" }] as const);
  const context = createErrorContext("RootContext");
  const subcontext = context.subcontext("Subcontext");
  const featureError = subcontext.feature("Feature");

  try {
    throw featureError("ErrorType1", "ErrorMessage");
  } catch (e) {
    const err = e as IConwayError;
    assert.is(err.rootContext, "RootContext");
    assert.is(err.contextsChunk, "RootContext/Subcontext");
    assert.is(err.feature, "Feature");
    assert.is(err.name, "ErrorType1");
    assert.is(err.message, "RootContext/Subcontext/Feature: ErrorMessage");
  }

  // Test with just context, no subcontext
  const directFeatureError = context.feature("DirectFeature");
  try {
    throw directFeatureError("ErrorType1", "ErrorMessage");
  } catch (e) {
    const err = e as IConwayError;
    assert.is(err.rootContext, "RootContext");
    assert.is(err.contextsChunk, "RootContext");
    assert.is(err.feature, "DirectFeature");
  }

  // Test with originalError
  const originalError = new Error("Original");
  try {
    throw featureError("ErrorType1", "ErrorMessage", { originalError });
  } catch (e) {
    const err = e as IConwayError;
    assert.is(err.originalError, originalError);
  }
});

test("default emit behavior calls console.error", () => {
  // Mock console.error
  const originalConsoleError = console.error;
  let capturedError: IConwayError | null = null;
  console.error = (err: IConwayError) => {
    capturedError = err;
  };

  // Create error context without custom handleEmit (should use default)
  const createErrorContext = createError([{ errorType: "ErrorType1" }] as const);
  const context = createErrorContext("Context");
  const featureError = context.feature("Feature");

  const error = featureError("ErrorType1", "ErrorMessage");
  error.emit();

  // Verify console.error was called with the error
  assert.ok(capturedError !== null);
  const captured = capturedError as IConwayError;
  assert.is(captured.message, "Context/Feature: ErrorMessage");
  assert.is(captured.name, "ErrorType1");

  // Restore console.error
  console.error = originalConsoleError;
});

test("originalError edge cases", () => {
  const createErrorContext = createError(
    [
      { errorType: "ErrorType1", createMessagePostfix: (originalError) => ` >>> ${(originalError as Error).message}` },
      { errorType: "ErrorType2" },
    ] as const
  );

  const context = createErrorContext("Context");
  const featureError = context.feature("Feature");

  // Test with Error object as originalError
  const errorObject = new Error("Native error message");
  try {
    throw featureError("ErrorType1", "ErrorMessage", { originalError: errorObject });
  } catch (e) {
    const err = e as IConwayError;
    assert.is(err.originalError, errorObject);
    assert.is(err.message, "Context/Feature: ErrorMessage >>> Native error message");
  }

  // Test with non-Error object as originalError
  const plainObject = { code: 500, detail: "Server error" };
  try {
    throw featureError("ErrorType1", "ErrorMessage", { originalError: plainObject });
  } catch (e) {
    const err = e as IConwayError;
    assert.equal(err.originalError, plainObject);
  }

  // Test with primitive value as originalError
  const primitiveValue = "string error";
  try {
    throw featureError("ErrorType1", "ErrorMessage", { originalError: primitiveValue });
  } catch (e) {
    const err = e as IConwayError;
    assert.is(err.originalError, primitiveValue);
  }

  // Test with undefined originalError - should not append postfix
  try {
    throw featureError("ErrorType1", "ErrorMessage");
  } catch (e) {
    const err = e as IConwayError;
    assert.is(err.originalError, undefined);
    assert.is(err.message, "Context/Feature: ErrorMessage");
  }

  // Test with null originalError - should not append postfix
  try {
    throw featureError("ErrorType1", "ErrorMessage", { originalError: null });
  } catch (e) {
    const err = e as IConwayError;
    assert.is(err.originalError, null);
    assert.is(err.message, "Context/Feature: ErrorMessage");
  }

  // Test originalError without createMessagePostfix - should not append anything
  try {
    throw featureError("ErrorType2", "ErrorMessage", { originalError: errorObject });
  } catch (e) {
    const err = e as IConwayError;
    assert.is(err.originalError, errorObject);
    assert.is(err.message, "Context/Feature: ErrorMessage");
  }
});

test("empty and special character handling in names", () => {
  const createErrorContext = createError([{ errorType: "ErrorType1" }] as const);

  // Test with empty strings
  const emptyContext = createErrorContext("");
  const emptySubcontext = emptyContext.subcontext("");
  const emptyFeature = emptySubcontext.feature("");

  try {
    throw emptyFeature("ErrorType1", "ErrorMessage");
  } catch (e) {
    const err = e as IConwayError;
    assert.is(err.message, "//: ErrorMessage");
    assert.is(err.rootContext, "");
    assert.is(err.contextsChunk, "/");
  }

  // Test with special characters in context names
  const specialContext = createErrorContext("Context-With-Dashes");
  const specialSubcontext = specialContext.subcontext("Sub_Context_Underscore");
  const specialFeature = specialSubcontext.feature("Feature.With.Dots");

  try {
    throw specialFeature("ErrorType1", "ErrorMessage");
  } catch (e) {
    const err = e as IConwayError;
    assert.is(err.message, "Context-With-Dashes/Sub_Context_Underscore/Feature.With.Dots: ErrorMessage");
    assert.is(err.feature, "Feature.With.Dots");
  }

  // Test with spaces in names
  const spaceContext = createErrorContext("Context With Spaces");
  const spaceFeature = spaceContext.feature("Feature With Spaces");

  try {
    throw spaceFeature("ErrorType1", "Error Message");
  } catch (e) {
    const err = e as IConwayError;
    assert.is(err.message, "Context With Spaces/Feature With Spaces: Error Message");
  }

  // Test with slashes in names (edge case)
  const slashContext = createErrorContext("Context/With/Slashes");
  const slashFeature = slashContext.feature("Feature/Name");

  try {
    throw slashFeature("ErrorType1", "ErrorMessage");
  } catch (e) {
    const err = e as IConwayError;
    assert.is(err.message, "Context/With/Slashes/Feature/Name: ErrorMessage");
  }

  // Test with unicode characters
  const unicodeContext = createErrorContext("コンテキスト");
  const unicodeFeature = unicodeContext.feature("機能");

  try {
    throw unicodeFeature("ErrorType1", "メッセージ");
  } catch (e) {
    const err = e as IConwayError;
    assert.is(err.message, "コンテキスト/機能: メッセージ");
  }
});

test("error type configurations (single type, many types)", () => {
  // Test with single error type
  const createErrorContextSingle = createError([{ errorType: "SingleErrorType" }] as const);
  const singleContext = createErrorContextSingle("Context");
  const singleFeature = singleContext.feature("Feature");

  try {
    throw singleFeature("SingleErrorType", "ErrorMessage");
  } catch (e) {
    const err = e as IConwayError;
    assert.is(err.name, "SingleErrorType");
    assert.is(err.message, "Context/Feature: ErrorMessage");
  }

  // Test with many error types
  const createErrorContextMany = createError([
    { errorType: "Type1" },
    { errorType: "Type2" },
    { errorType: "Type3" },
    { errorType: "Type4" },
    { errorType: "Type5" },
  ] as const);
  const manyContext = createErrorContextMany("Context");
  const manyFeature = manyContext.feature("Feature");

  // Test each type works
  try {
    throw manyFeature("Type1", "Message1");
  } catch (e) {
    const err = e as IConwayError;
    assert.is(err.name, "Type1");
  }

  try {
    throw manyFeature("Type5", "Message5");
  } catch (e) {
    const err = e as IConwayError;
    assert.is(err.name, "Type5");
  }
});

test("stack trace preservation and verification", () => {
  const createErrorContext = createError([{ errorType: "ErrorType1" }] as const);
  const context = createErrorContext("Context");
  const featureError = context.feature("Feature");

  try {
    throw featureError("ErrorType1", "ErrorMessage");
  } catch (e) {
    const err = e as IConwayError;
    // Verify stack trace exists
    assert.ok(err.stack);
    assert.type(err.stack, "string");

    // Verify stack trace contains error message
    assert.ok(err.stack.includes("ErrorType1"));
    assert.ok(err.stack.includes("Context/Feature: ErrorMessage"));

    // Verify error is instance of Error
    assert.instance(err, Error);
  }
});

test("emit can be called multiple times on same error object", () => {
  const mockedEmit = snoop((err, extendedParams) => {});

  const createErrorContext = createError([{ errorType: "ErrorType1" }] as const, {
    handleEmit: (err, extendedParams) => {
      mockedEmit.fn(err.message, extendedParams);
    },
  });

  const context = createErrorContext("Context");
  const featureError = context.feature("Feature");
  const error = featureError("ErrorType1", "ErrorMessage");

  // Call emit multiple times
  error.emit();
  error.emit();
  error.emit({ extra: "param" });

  // Verify emit was called three times
  assert.is(mockedEmit.callCount, 3);

  // Verify the third call has the extra param
  // @ts-ignore
  assert.equal(mockedEmit.calls[2].arguments[1], { extra: "param" });
});

test("multiple independent error contexts are isolated", () => {
  const mockedEmit1 = snoop((err, extendedParams) => {});
  const mockedEmit2 = snoop((err, extendedParams) => {});

  // Create two independent error contexts
  const createErrorContext1 = createError([{ errorType: "Type1" }] as const, {
    handleEmit: (err, extendedParams) => {
      mockedEmit1.fn(err, extendedParams);
    },
    extendedParams: { context: "first" },
  });

  const createErrorContext2 = createError([{ errorType: "Type2" }] as const, {
    handleEmit: (err, extendedParams) => {
      mockedEmit2.fn(err, extendedParams);
    },
    extendedParams: { context: "second" },
  });

  const context1 = createErrorContext1("Context1");
  const context2 = createErrorContext2("Context2");

  const feature1 = context1.feature("Feature1");
  const feature2 = context2.feature("Feature2");

  const error1 = feature1("Type1", "Message1");
  const error2 = feature2("Type2", "Message2");

  // Emit from both contexts
  error1.emit();
  error2.emit();

  // Verify each emit function was called once
  assert.is(mockedEmit1.callCount, 1);
  assert.is(mockedEmit2.callCount, 1);

  // Verify isolation - context1 should only have context: "first"
  // @ts-ignore
  assert.equal(mockedEmit1.calls[0].arguments[1], { context: "first" });

  // Verify isolation - context2 should only have context: "second"
  // @ts-ignore
  assert.equal(mockedEmit2.calls[0].arguments[1], { context: "second" });

  // Verify error names are different
  assert.is(error1.name, "Type1");
  assert.is(error2.name, "Type2");
});

test("error readonly properties are set and frozen at runtime", () => {
  const createErrorContext = createError([{ errorType: "ErrorType1" }] as const);
  const context = createErrorContext("RootContext");
  const featureError = context.feature("Feature");
  const originalError = new Error("Original");

  try {
    throw featureError("ErrorType1", "ErrorMessage", {
      originalError,
      extendedParams: { a: 1 },
    });
  } catch (e) {
    const err = e as IConwayError;
    assert.is(err.rootContext, "RootContext");
    assert.is(err.contextsChunk, "RootContext");
    assert.is(err.originalError, originalError);
    assert.equal(err.extendedParams, { a: 1 });

    assert.ok(Object.isFrozen(err));
    assert.throws(() => {
      (err as { rootContext: string }).rootContext = "MUTATED";
    });
    assert.is(err.rootContext, "RootContext");
  }
});

test("extended params merging order and precedence", () => {
  const mockedEmit = snoop((err, extendedParams) => {});

  const createErrorContext = createError([{ errorType: "ErrorType1" }] as const, {
    handleEmit: (err, extendedParams) => {
      mockedEmit.fn(err, extendedParams);
    },
    extendedParams: { level1: "createError", shared: "createError" },
  });

  const context = createErrorContext("Context", { level2: "context", shared: "context" });
  const subcontext = context.subcontext("Subcontext", { level3: "subcontext", shared: "subcontext" });
  const featureError = subcontext.feature("Feature", { level4: "feature", shared: "feature" });

  featureError("ErrorType1", "ErrorMessage", {
    extendedParams: { level5: "errorOptions", shared: "errorOptions" },
  }).emit({ level6: "emit", shared: "emit" });

  // Verify merging order: later params override earlier ones
  // Order: createError < context < subcontext < feature < errorOptions < emit
  assert.equal(
    // @ts-ignore
    mockedEmit.calls[0].arguments[1],
    {
      level1: "createError",
      level2: "context",
      level3: "subcontext",
      level4: "feature",
      level5: "errorOptions",
      level6: "emit",
      shared: "emit", // Should be overridden to last value
    }
  );
});

test("error can be thrown or emitted without throwing", () => {
  const mockedEmit = snoop((err, extendedParams) => {});

  const createErrorContext = createError([{ errorType: "ErrorType1" }] as const, {
    handleEmit: (err, extendedParams) => {
      mockedEmit.fn(err.message, extendedParams);
    },
  });

  const context = createErrorContext("Context");
  const featureError = context.feature("Feature");

  // Test emitting without throwing
  const error1 = featureError("ErrorType1", "Message1");
  error1.emit();

  assert.is(mockedEmit.callCount, 1);
  // @ts-ignore
  assert.is(mockedEmit.calls[0].arguments[0], "Context/Feature: Message1");

  // Test throwing
  try {
    throw featureError("ErrorType1", "Message2");
  } catch (e) {
    const err = e as IConwayError;
    assert.is(err.name, "ErrorType1");
    assert.is(err.message, "Context/Feature: Message2");
  }

  // Emit count should still be 1 (throwing doesn't call emit)
  assert.is(mockedEmit.callCount, 1);

  // Test throw then emit
  try {
    throw featureError("ErrorType1", "Message3");
  } catch (e) {
    const err = e as IConwayError;
    err.emit();
  }

  // Now emit count should be 2
  assert.is(mockedEmit.callCount, 2);
  // @ts-ignore
  assert.is(mockedEmit.calls[1].arguments[0], "Context/Feature: Message3");
});

test("UnknownError fallback never applies createMessagePostfix even with originalError", () => {
  // Spec: postfix is bound to a registered errorType. UnknownError has no postfix
  // because no createMessagePostfix is associated with it. Consumers must register
  // the type explicitly to get per-instance message decoration.
  const createErrorContext = createError(
    [{ errorType: "Known", createMessagePostfix: () => " >>> SHOULD_NOT_APPEAR" }] as const,
  );
  const context = createErrorContext("Context");
  const featureError = context.feature("Feature");

  const originalError = new Error("orig");
  try {
    // @ts-expect-error — unknown errorType triggers UnknownError fallback
    throw featureError("Unknown", "msg", { originalError });
  } catch (e) {
    const err = e as IConwayError;
    assert.is(err.name, "UnknownError");
    assert.is(err.message, "Context/Feature: msg");
    assert.is(err.originalError, originalError);
  }
});

test("createMessagePostfix is applied for falsy originalError values (0, '', false)", () => {
  // Postfix gating uses `!= null`, so falsy-but-present values are forwarded.
  const createErrorContext = createError(
    [{ errorType: "ErrorType1", createMessagePostfix: (originalError) => ` >>> ${String(originalError)}` }] as const,
  );
  const context = createErrorContext("Context");
  const featureError = context.feature("Feature");

  try {
    throw featureError("ErrorType1", "msg", { originalError: 0 });
  } catch (e) {
    const err = e as IConwayError;
    assert.is(err.message, "Context/Feature: msg >>> 0");
    assert.is(err.originalError, 0);
  }

  try {
    throw featureError("ErrorType1", "msg", { originalError: "" });
  } catch (e) {
    const err = e as IConwayError;
    assert.is(err.message, "Context/Feature: msg >>> ");
    assert.is(err.originalError, "");
  }

  try {
    throw featureError("ErrorType1", "msg", { originalError: false });
  } catch (e) {
    const err = e as IConwayError;
    assert.is(err.message, "Context/Feature: msg >>> false");
    assert.is(err.originalError, false);
  }
});

test("handleEmit throwing propagates to .emit() caller", () => {
  // Spec invariant: handleEmit is not wrapped in try/catch.
  const createErrorContext = createError([{ errorType: "ErrorType1" }] as const, {
    handleEmit: () => {
      throw new Error("boom from handleEmit");
    },
  });

  const context = createErrorContext("Context");
  const featureError = context.feature("Feature");
  const err = featureError("ErrorType1", "msg");

  assert.throws(
    () => err.emit(),
    (e: Error) => e.message === "boom from handleEmit",
  );
});

test("cross-factory instances both pass isConwayError", () => {
  // Errors produced by separate createError() calls share the internal ConwayError base class.
  const factoryA = createError([{ errorType: "A" }] as const);
  const factoryB = createError([{ errorType: "B" }] as const);

  const errA = factoryA("CtxA").feature("FeatA")("A", "msg-a");
  const errB = factoryB("CtxB").feature("FeatB")("B", "msg-b");

  assert.equal(isConwayError(errA), true);
  assert.equal(isConwayError(errB), true);
  assert.instance(errA, Error);
  assert.instance(errB, Error);

  // Each call to createErrorClass produces a fresh subclass — instance constructors differ,
  // but both are still ConwayError subclasses recognised by the type guard.
  assert.is.not(errA.constructor, errB.constructor);
});

test("isConwayError rejects non-ConwayError values", () => {
  assert.equal(isConwayError(undefined), false);
  assert.equal(isConwayError({}), false);
  assert.equal(isConwayError(Object.freeze({ name: "ErrorType1", message: "fake" })), false);
  assert.equal(isConwayError(Symbol("err")), false);
  assert.equal(isConwayError(() => {}), false);
  assert.equal(isConwayError(new Date()), false);
  assert.equal(isConwayError([]), false);
  assert.equal(isConwayError(true), false);
});

test("error.extendedParams stores call-site slice only; handleEmit receives merged set", () => {
  // Spec: error.extendedParams is the call-site annotation; the merged map is delivered via emit.
  const mockedEmit = snoop((_err, _params) => {});

  const createErrorContext = createError([{ errorType: "ErrorType1" }] as const, {
    handleEmit: (err, params) => mockedEmit.fn(err, params),
    extendedParams: { root: 1 },
  });

  const context = createErrorContext("Context", { ctx: 2 });
  const subcontext = context.subcontext("Sub", { sub: 3 });
  const featureError = subcontext.feature("Feature", { feat: 4 });

  const err = featureError("ErrorType1", "msg", { extendedParams: { callSite: 5 } });

  // Instance-side: only the call-site slice is preserved.
  assert.equal(err.extendedParams, { callSite: 5 });

  // Emit-side: full merged map is delivered.
  err.emit();
  assert.equal(
    // @ts-ignore
    mockedEmit.calls[0].arguments[1],
    { root: 1, ctx: 2, sub: 3, feat: 4, callSite: 5 },
  );
});

test("UnknownError fallback preserves rootContext, contextsChunk, and feature", () => {
  const createErrorContext = createError([{ errorType: "Known" }] as const);
  const root = createErrorContext("Root");
  const sub1 = root.subcontext("L1");
  const sub2 = sub1.subcontext("L2");
  const featureError = sub2.feature("Feat");

  try {
    // @ts-expect-error — unknown errorType triggers UnknownError fallback
    throw featureError("MissingType", "msg");
  } catch (e) {
    const err = e as IConwayError;
    assert.is(err.name, "UnknownError");
    assert.is(err.rootContext, "Root");
    assert.is(err.contextsChunk, "Root/L1/L2");
    assert.is(err.feature, "Feat");
    assert.is(err.message, "Root/L1/L2/Feat: msg");
  }
});

test("__brand is present on subcontexts and features at runtime", () => {
  const createErrorContext = createError([{ errorType: "ErrorType1" }] as const);
  const root = createErrorContext("Root");
  const sub = root.subcontext("Sub");
  const deepSub = sub.subcontext("Deep");
  const feat = deepSub.feature("Feat");

  assert.is((root as { __brand: string }).__brand, "Root");
  assert.is((sub as { __brand: string }).__brand, "Root/Sub");
  assert.is((deepSub as { __brand: string }).__brand, "Root/Sub/Deep");
  assert.is((feat as unknown as { __brand: string }).__brand, "Root/Sub/Deep/Feat");
});

test.run();
