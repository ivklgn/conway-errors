import {
  type AnyFeatureOfSubcontext,
  type CreateErrorOptions,
  createError,
  type EmitFn,
  type ErrorFnOptions,
  type ErrorTypeConfig,
  type ExtendedParams,
  type IConwayError,
  isConwayError,
} from "./index";

type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

const createCtx = createError([
  { errorType: "ValidationError" },
  { errorType: "NetworkError", createMessagePostfix: (e) => ` (caused by ${String(e)})` },
] as const);

const root = createCtx("App");

type _RootBrand = Expect<Equals<(typeof root)["__brand"], "App">>;

const sub = root.subcontext("Auth");
type _SubBrand = Expect<Equals<(typeof sub)["__brand"], "App/Auth">>;

const deepSub = sub.subcontext("OAuth");
type _DeepSubBrand = Expect<Equals<(typeof deepSub)["__brand"], "App/Auth/OAuth">>;

const feat = deepSub.feature("Login");
type _FeatBrand = Expect<Equals<(typeof feat)["__brand"], "App/Auth/OAuth/Login">>;

const validationErr = feat("ValidationError", "bad input");
type _ValidationReturn = Expect<Equals<typeof validationErr, IConwayError>>;

const networkErr = feat("NetworkError", "fetch failed", { originalError: new Error("ECONNRESET") });
type _NetworkReturn = Expect<Equals<typeof networkErr, IConwayError>>;

// @ts-expect-error — "BogusError" is not in the configured errorTypes union
feat("BogusError", "should not compile");

declare const guarded: IConwayError;
// @ts-expect-error — readonly: rootContext cannot be assigned
guarded.rootContext = "x";
// @ts-expect-error — readonly: feature cannot be assigned
guarded.feature = "x";
// @ts-expect-error — readonly: emit cannot be assigned
guarded.emit = () => {};
// @ts-expect-error — readonly: originalError cannot be assigned
guarded.originalError = undefined;
// @ts-expect-error — readonly: extendedParams cannot be assigned
guarded.extendedParams = undefined;

type FeatFromSub = AnyFeatureOfSubcontext<typeof sub>;
declare const derivedFeat: FeatFromSub;
const derivedErr = derivedFeat("ValidationError", "msg");
type _DerivedReturn = Expect<Equals<typeof derivedErr, IConwayError>>;
// @ts-expect-error — derived feature retains the same errorType union
derivedFeat("BogusError", "msg");

type _AnyFeatNeverForNonSubcontext = Expect<Equals<AnyFeatureOfSubcontext<string>, never>>;
type _AnyFeatNeverForObject = Expect<Equals<AnyFeatureOfSubcontext<{ foo: "bar" }>, never>>;

type _UnionFeatures = AnyFeatureOfSubcontext<typeof sub | typeof deepSub>;
declare const unionFeat: _UnionFeatures;
const unionErr = unionFeat("ValidationError", "msg");
type _UnionReturn = Expect<Equals<typeof unionErr, IConwayError>>;
// @ts-expect-error — union distribution preserves the shared errorType union
unionFeat("BogusError", "msg");

const narrowingChain = createError([{ errorType: "A" }, { errorType: "B" }] as const)("Root")
  .subcontext("Sub")
  .feature("Feat");
narrowingChain("A", "ok");
narrowingChain("B", "ok");
// @ts-expect-error — end-to-end `as const` narrows errorType to "A" | "B"
narrowingChain("C", "should fail");

const bareCtx = createError();
const bareRoot = bareCtx("Bare");
const bareFeat = bareRoot.feature("X");
const bareErr = bareFeat("AnyStringWorks", "msg");
type _BareReturn = Expect<Equals<typeof bareErr, IConwayError>>;

declare const unknownVal: unknown;
if (isConwayError(unknownVal)) {
  type _Narrowed = Expect<Equals<typeof unknownVal, IConwayError>>;
}

declare const emit: EmitFn;
declare const params: ExtendedParams;
declare const opts: CreateErrorOptions;
declare const fnOpts: ErrorFnOptions;
declare const cfg: ErrorTypeConfig;
type _EmitFnSig = Expect<Equals<typeof emit, (extendedParams?: ExtendedParams) => void>>;
type _ParamsSig = Expect<Equals<typeof params, Record<string, unknown>>>;
type _OptsHandle = Expect<Equals<typeof opts.handleEmit, ((err: IConwayError, p?: ExtendedParams) => void) | undefined>>;
type _FnOptsOriginal = Expect<Equals<typeof fnOpts.originalError, unknown>>;
type _CfgItemErrorType = Expect<Equals<(typeof cfg)[number]["errorType"], string>>;
