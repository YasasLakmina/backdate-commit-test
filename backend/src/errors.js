/** An error that maps directly to an HTTP status and a client-safe message. */
export class HttpError extends Error {
  constructor(status, detail) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

export const badRequest = (detail) => new HttpError(422, detail);
export const unavailable = (detail) => new HttpError(503, detail);
