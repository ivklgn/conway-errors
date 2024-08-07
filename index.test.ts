import { test } from "uvu";
import { snoop } from "snoop";
import * as assert from "uvu/assert";

import { createError, isConwayError, type IConwayError } from "./index";

test("without error types will throw always UnknownError", () => {
  const createErrorContext = createError();
  const errorContext = createErrorContext("Context");
  const featureError = errorContext.feature("Feature");

  try {
    throw featureError("ErrorName", "ErrorMessage");
  } catch (err: any) {
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
  } catch (err: any) {
    assert.is(err.name, "ErrorType1");
    assert.is(err.message, "Context/Feature: ErrorMessage");
  }

  try {
    throw featureError("ErrorType2", "ErrorMessage");
  } catch (err: any) {
    assert.is(err.name, "ErrorType2");
    assert.is(err.message, "Context/Feature: ErrorMessage");
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
  } catch (err: any) {
    assert.is(err.name, "ErrorType1");
    assert.is(err.message, "Context/Subcontext1/Subcontext2/Feature 1: ErrorMessage");
  }

  const subcontext3 = subcontext2.subcontext("Subcontext3");
  const subcontext4 = subcontext3.subcontext("Subcontext4");

  const feature2Error = subcontext4.feature("Feature 2");

  try {
    throw feature2Error("ErrorType2", "ErrorMessage");
  } catch (err: any) {
    assert.is(err.name, "ErrorType2");
    assert.is(err.message, "Context/Subcontext1/Subcontext2/Subcontext3/Subcontext4/Feature 2: ErrorMessage");
  }
});

test("custom emit function should override default emit", () => {
  const mockedEmit = snoop((err, context) => {});

  const createErrorContext = createError([{ errorType: "ErrorType1" }, { errorType: "ErrorType2" }] as const, {
    emitFn: (err, context) => {
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
    "Context/Feature: ErrorMessage",
  );

  assert.equal(
    // @ts-ignore
    mockedEmit.calls[0].arguments[1],
    {},
  );
});

test("createMessagePostfix add message if originalError provided", () => {
  const createErrorContext = createError([
    { errorType: "ErrorType1", createMessagePostfix: (originalError) => " >>> " + (originalError as Error).message },
    { errorType: "ErrorType2", createMessagePostfix: () => " some additional info" },
  ] as const);

  const context = createErrorContext("Context");
  const subcontext = context.subcontext("Subcontext1");

  const featureError = subcontext.feature("Feature");
  const originalError = new Error("OriginalError");

  try {
    throw featureError("ErrorType1", "ErrorMessage", originalError);
  } catch (err: any) {
    assert.is(err.name, "ErrorType1");
    assert.is(err.message, "Context/Subcontext1/Feature: ErrorMessage >>> OriginalError");
  }

  try {
    throw featureError("ErrorType2", "ErrorMessage", originalError);
  } catch (err: any) {
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
    emitFn: (err, extendedParams) => {
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
    },
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
    },
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
    },
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
  } catch (err: any) {
    assert.equal(isConwayError(err), true);
  }
});

test.run();
