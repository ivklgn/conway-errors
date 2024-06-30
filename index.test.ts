import { test } from "uvu";
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
  const createErrorContext = createError(["ErrorType1", "ErrorType2"]);
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
  const createErrorContext = createError(["ErrorType1", "ErrorType2"]);

  const context = createErrorContext("Context");
  const subcontext1 = context.context("Subcontext1", "ProjectName");
  const subcontext2 = subcontext1.context("Subcontext2", "ProjectName");

  const feature1 = subcontext2.feature("Feature 1");

  try {
    feature1.throw("ErrorType1", "ErrorMessage");
  } catch (err: any) {
    assert.is(err.name, "ErrorType1");
    assert.is(err.message, "Context/Subcontext1/Subcontext2/Feature 1: ErrorMessage");
  }

  const subcontext3 = subcontext2.context("Subcontext3", "ProjectName");
  const subcontext4 = subcontext3.context("Subcontext4", "ProjectName");

  const feature2 = subcontext4.feature("Feature 2");

  try {
    feature2.throw("ErrorType2", "ErrorMessage");
  } catch (err: any) {
    assert.is(err.name, "ErrorType2");
    assert.is(err.message, "Context/Subcontext1/Subcontext2/Subcontext3/Subcontext4/Feature 2: ErrorMessage");
  }
});

test("custom throw function should override default throw", () => {
  let mockedError: Error | undefined = undefined;

  assert.equal(mockedError, undefined);

  const createErrorContext = createError(["ErrorType1", "ErrorType2"], {
    throwFn: (err) => {
      mockedError = err;
    },
  });

  const errorContext = createErrorContext("Context");
  const feature = errorContext.feature("Feature");

  assert.not.throws(() => {
    feature.throw("ErrorType1", "ErrorMessage");
  });

  // TODO: create normal mocks

  // @ts-ignore
  assert.equal(mockedError?.name, "ErrorType1");
  // @ts-ignore
  assert.equal(mockedError?.message, "Context/Feature: ErrorMessage");
});

test.run();
