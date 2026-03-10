export type ArgusErrorCode =
  | 'NOT_CONNECTED'
  | 'TAB_NOT_FOUND'
  | 'ELEMENT_NOT_FOUND'
  | 'ELEMENT_NOT_VISIBLE'
  | 'WAIT_TIMEOUT'
  | 'NAVIGATION_TIMEOUT'
  | 'EVALUATE_FAILED'
  | 'CDP_ERROR';

export class ArgusError extends Error {
  constructor(
    public readonly code: ArgusErrorCode,
    message: string,
    public readonly detail?: unknown
  ) {
    super(message);
    this.name = 'ArgusError';
  }
}
