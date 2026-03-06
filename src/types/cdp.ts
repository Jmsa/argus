// CDP Protocol types

export interface CDPCommand {
  id: number;
  method: string;
  params?: Record<string, unknown>;
  sessionId?: string;
}

export interface CDPResponse {
  id: number;
  result?: Record<string, unknown>;
  error?: CDPError;
  sessionId?: string;
}

export interface CDPEvent {
  method: string;
  params?: Record<string, unknown>;
  sessionId?: string;
}

export interface CDPMessage {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: CDPError;
  sessionId?: string;
}

export interface CDPError {
  code: number;
  message: string;
  data?: string;
}

// Browser domain
export interface BrowserVersion {
  protocolVersion: string;
  product: string;
  revision: string;
  userAgent: string;
  jsVersion: string;
}

// Target domain
export interface TargetInfo {
  targetId: string;
  type: string;
  title: string;
  url: string;
  attached: boolean;
  browserContextId?: string;
}

export interface AttachToTargetParams {
  targetId: string;
  flatten?: boolean;
}

export interface AttachToTargetResult {
  sessionId: string;
}

export interface CreateTargetParams {
  url: string;
  width?: number;
  height?: number;
  browserContextId?: string;
  enableBeginFrameControl?: boolean;
  newWindow?: boolean;
  background?: boolean;
}

export interface CreateTargetResult {
  targetId: string;
}

// Page domain
export interface NavigateParams {
  url: string;
  referrer?: string;
  transitionType?: string;
  frameId?: string;
}

export interface NavigateResult {
  frameId: string;
  loaderId?: string;
  errorText?: string;
}

export interface ScreenshotParams {
  format?: 'jpeg' | 'png' | 'webp';
  quality?: number;
  clip?: Viewport;
  fromSurface?: boolean;
  captureBeyondViewport?: boolean;
}

export interface ScreenshotResult {
  data: string;
}

export interface LayoutMetricsResult {
  contentSize: { width: number; height: number };
  visualViewport: { clientWidth: number; clientHeight: number; scale: number; pageX: number; pageY: number; scrollX: number; scrollY: number; zoom: number };
  cssContentSize: { width: number; height: number };
  cssLayoutViewport: { clientWidth: number; clientHeight: number };
  cssVisualViewport: { clientWidth: number; clientHeight: number; scale: number; pageX: number; pageY: number; scrollX: number; scrollY: number; zoom: number };
}

export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

export interface AddScriptParams {
  source: string;
  worldName?: string;
  includeCommandLineAPI?: boolean;
  runImmediately?: boolean;
}

export interface AddScriptResult {
  identifier: string;
}

// Runtime domain
export interface EvaluateParams {
  expression: string;
  objectGroup?: string;
  includeCommandLineAPI?: boolean;
  silent?: boolean;
  contextId?: number;
  returnByValue?: boolean;
  generatePreview?: boolean;
  userGesture?: boolean;
  awaitPromise?: boolean;
  throwOnSideEffect?: boolean;
}

export interface EvaluateResult {
  result: RemoteObject;
  exceptionDetails?: ExceptionDetails;
}

export interface RemoteObject {
  type: string;
  subtype?: string;
  className?: string;
  value?: unknown;
  unserializableValue?: string;
  description?: string;
  objectId?: string;
  preview?: ObjectPreview;
}

export interface ObjectPreview {
  type: string;
  subtype?: string;
  description?: string;
  overflow: boolean;
  properties: PropertyPreview[];
}

export interface PropertyPreview {
  name: string;
  type: string;
  value?: string;
  valuePreview?: ObjectPreview;
  subtype?: string;
}

export interface ExceptionDetails {
  exceptionId: number;
  text: string;
  lineNumber: number;
  columnNumber: number;
  scriptId?: string;
  url?: string;
  stackTrace?: StackTrace;
  exception?: RemoteObject;
  executionContextId?: number;
}

export interface StackTrace {
  description?: string;
  callFrames: CallFrame[];
  parent?: StackTrace;
}

export interface CallFrame {
  functionName: string;
  scriptId: string;
  url: string;
  lineNumber: number;
  columnNumber: number;
}

export interface ConsoleAPICalledEvent {
  type: 'log' | 'debug' | 'info' | 'error' | 'warning' | 'dir' | 'dirxml' | 'table' | 'trace' | 'clear' | 'startGroup' | 'startGroupCollapsed' | 'endGroup' | 'assert' | 'profile' | 'profileEnd' | 'count' | 'timeEnd';
  args: RemoteObject[];
  executionContextId: number;
  timestamp: number;
  stackTrace?: StackTrace;
  context?: string;
}

export interface ExceptionThrownEvent {
  timestamp: number;
  exceptionDetails: ExceptionDetails;
}

// Network domain
export interface NetworkRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  postData?: string;
  hasPostData?: boolean;
  mixedContentType?: string;
  initialPriority?: string;
  referrerPolicy?: string;
  isLinkPreload?: boolean;
}

export interface NetworkResponse {
  url: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  mimeType: string;
  requestHeaders?: Record<string, string>;
  connectionReused?: boolean;
  connectionId?: number;
  remoteIPAddress?: string;
  remotePort?: number;
  fromDiskCache?: boolean;
  fromServiceWorker?: boolean;
  encodedDataLength?: number;
  timing?: ResourceTiming;
}

export interface ResourceTiming {
  requestTime: number;
  proxyStart: number;
  proxyEnd: number;
  dnsStart: number;
  dnsEnd: number;
  connectStart: number;
  connectEnd: number;
  sslStart: number;
  sslEnd: number;
  workerStart: number;
  workerReady: number;
  sendStart: number;
  sendEnd: number;
  pushStart: number;
  pushEnd: number;
  receiveHeadersEnd: number;
}

export interface RequestWillBeSentEvent {
  requestId: string;
  loaderId: string;
  documentURL: string;
  request: NetworkRequest;
  timestamp: number;
  wallTime: number;
  initiator: Initiator;
  redirectHasExtraInfo?: boolean;
  redirectResponse?: NetworkResponse;
  type?: string;
  frameId?: string;
  hasUserGesture?: boolean;
}

export interface ResponseReceivedEvent {
  requestId: string;
  loaderId: string;
  timestamp: number;
  type: string;
  response: NetworkResponse;
  hasExtraInfo?: boolean;
  frameId?: string;
}

export interface LoadingFinishedEvent {
  requestId: string;
  timestamp: number;
  encodedDataLength: number;
  shouldReportCorbBlocking?: boolean;
}

export interface LoadingFailedEvent {
  requestId: string;
  timestamp: number;
  type: string;
  errorText: string;
  canceled?: boolean;
  blockedReason?: string;
  corsErrorStatus?: CorsErrorStatus;
}

export interface CorsErrorStatus {
  corsError: string;
  failedParameter: string;
}

export interface Initiator {
  type: 'parser' | 'script' | 'preload' | 'SignedExchange' | 'preflight' | 'other';
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
  requestId?: string;
  stack?: StackTrace;
}

export interface GetResponseBodyResult {
  body: string;
  base64Encoded: boolean;
}

// Fetch domain
export interface RequestPattern {
  urlPattern?: string;
  resourceType?: string;
  requestStage?: 'Request' | 'Response';
}

export interface FetchEnableParams {
  patterns?: RequestPattern[];
  handleAuthRequests?: boolean;
}

export interface RequestPausedEvent {
  requestId: string;
  request: NetworkRequest;
  frameId: string;
  resourceType: string;
  responseErrorReason?: string;
  responseStatusCode?: number;
  responseStatusText?: string;
  responseHeaders?: HeaderEntry[];
  networkId?: string;
  redirectedRequestId?: string;
}

export interface HeaderEntry {
  name: string;
  value: string;
}

export interface FulfillRequestParams {
  requestId: string;
  responseCode: number;
  responseHeaders?: HeaderEntry[];
  binaryResponseHeaders?: string;
  body?: string;
  responsePhrase?: string;
}

export interface ContinueRequestParams {
  requestId: string;
  url?: string;
  method?: string;
  postData?: string;
  headers?: HeaderEntry[];
  interceptResponse?: boolean;
}

// Runtime.addBinding
export interface BindingCalledEvent {
  name: string;
  payload: string;
  executionContextId: number;
}

// Tab info from /json HTTP endpoint
export interface TabInfo {
  id: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl: string;
  devtoolsFrontendUrl: string;
  description: string;
}
