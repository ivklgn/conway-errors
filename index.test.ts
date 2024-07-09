import { test } from "uvu";
import { snoop } from "snoop";
import * as assert from "uvu/assert";

import { createError } from "./index";

test("without error types will throw always UnknownError", () => {
  const createErrorContext = createError();
  const errorContext = createErrorContext("Context");
  const feature = errorContext.feature("Feature");

  try {
    feature.throw("ErrorName", "ErrorMessage");
  } catch (err: any) {
    assert.is(err.name, "UnknownError");
    assert.is(err.message, "Context/Feature: ErrorMessage");
  }
});

test("error types throw always mapped errors", () => {
  const createErrorContext = createError([{ errorType: "ErrorType1" }, { errorType: "ErrorType2" }] as const);
  const errorContext = createErrorContext("Context");
  const feature = errorContext.feature("Feature");

  try {
    feature.throw("ErrorType1", "ErrorMessage");
  } catch (err: any) {
    assert.is(err.name, "ErrorType1");
    assert.is(err.message, "Context/Feature: ErrorMessage");
  }

  try {
    feature.throw("ErrorType2", "ErrorMessage");
  } catch (err: any) {
    assert.is(err.name, "ErrorType2");
    assert.is(err.message, "Context/Feature: ErrorMessage");
  }
});

test("nested context write correct message", () => {
  const createErrorContext = createError([{ errorType: "ErrorType1" }, { errorType: "ErrorType2" }] as const);

  const context = createErrorContext("Context");
  const subcontext1 = context.context("Subcontext1");
  const subcontext2 = subcontext1.context("Subcontext2");

  const feature1 = subcontext2.feature("Feature 1");

  try {
    feature1.throw("ErrorType1", "ErrorMessage");
  } catch (err: any) {
    assert.is(err.name, "ErrorType1");
    assert.is(err.message, "Context/Subcontext1/Subcontext2/Feature 1: ErrorMessage");
  }

  const subcontext3 = subcontext2.context("Subcontext3");
  const subcontext4 = subcontext3.context("Subcontext4");

  const feature2 = subcontext4.feature("Feature 2");

  try {
    feature2.throw("ErrorType2", "ErrorMessage");
  } catch (err: any) {
    assert.is(err.name, "ErrorType2");
    assert.is(err.message, "Context/Subcontext1/Subcontext2/Subcontext3/Subcontext4/Feature 2: ErrorMessage");
  }
});

test("custom throw function should override default throw", () => {
  const mockedThrow = snoop((err, context) => {});

  const createErrorContext = createError([{ errorType: "ErrorType1" }, { errorType: "ErrorType2" }] as const, {
    throwFn: (err, context) => {
      mockedThrow.fn(err.message, context);
    },
  });

  const errorContext = createErrorContext("Context");
  const feature = errorContext.feature("Feature");

  assert.not.throws(() => {
    feature.throw("ErrorType1", "ErrorMessage");
  });

  assert.equal(
    // @ts-ignore
    mockedThrow.calls[0].arguments[0],
    "Context/Feature: ErrorMessage"
  );

  assert.equal(
    // @ts-ignore
    mockedThrow.calls[0].arguments[1],
    {}
  );
});

test("createMessagePostfix add message if originalError provided", () => {
  const createErrorContext = createError([
    { errorType: "ErrorType1", createMessagePostfix: (originalError) => " >>> " + originalError?.message },
    { errorType: "ErrorType2", createMessagePostfix: () => " some additional info" },
  ] as const);

  const context = createErrorContext("Context");
  const subcontext = context.context("Subcontext1");

  const feature = subcontext.feature("Feature");
  const originalError = new Error("OriginalError");

  try {
    feature.throw("ErrorType1", "ErrorMessage", { originalError });
  } catch (err: any) {
    assert.is(err.name, "ErrorType1");
    assert.is(err.message, "Context/Subcontext1/Feature: ErrorMessage >>> OriginalError");
  }

  try {
    feature.throw("ErrorType2", "ErrorMessage", { originalError });
  } catch (err: any) {
    assert.is(err.name, "ErrorType2");
    assert.is(err.message, "Context/Subcontext1/Feature: ErrorMessage some additional info");
  }
});

test("createContext provide context from createError to feature and available in throwFn", () => {
  const mockedThrow = snoop((err, context) => {});

  const createErrorContext = createError([{ errorType: "ErrorType1" }, { errorType: "ErrorType2" }] as const, {
    createContext: () => ({
      ctxA: 1,
    }),
    throwFn: (err, context) => {
      mockedThrow.fn(err, context);
    },
  });

  const context = createErrorContext("Context", () => ({
    ctxB: 2,
  }));

  const subcontext1 = context.context("Subcontext1", () => ({
    ctxC: 3,
  }));

  const feature1 = subcontext1.feature("Feature1", () => ({
    ctxD: 4,
  }));

  feature1.throw("ErrorType1", "ErrorMessage");

  assert.equal(
    // @ts-ignore
    mockedThrow.calls[0].arguments[1],
    {
      ctxA: 1,
      ctxB: 2,
      ctxC: 3,
      ctxD: 4,
    }
  );

  // rewrite context

  const subcontext2 = context.context("Subcontext2", () => ({
    ctxA: 100,
    ctxC: 3,
  }));

  const feature2 = subcontext2.feature("Feature2", () => ({
    ctxB: 1000,
    ctxD: 4,
  }));

  feature2.throw("ErrorType1", "ErrorMessage");

  assert.equal(
    // @ts-ignore
    mockedThrow.calls[1].arguments[1],
    {
      ctxA: 100,
      ctxB: 1000,
      ctxC: 3,
      ctxD: 4,
    }
  );
});

test.run();
