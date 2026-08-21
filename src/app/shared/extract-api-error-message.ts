import { HttpErrorResponse } from '@angular/common/http';

/** Pulls a human-readable message out of a failed HTTP response, covering the shapes the API returns:
 * a plain string body, ASP.NET's ValidationProblemDetails ({ errors: { field: [msg] } }), a
 * ProblemDetails-style { title, detail }, or a generic { message }. */
export function extractApiErrorMessage(err: HttpErrorResponse): string | null {
  const body = err.error;
  if (typeof body === 'string' && body.trim()) return body;

  if (body && typeof body === 'object') {
    if (body.errors && typeof body.errors === 'object') {
      const messages = Object.values(body.errors as Record<string, unknown>)
        .flat()
        .filter((m): m is string => typeof m === 'string' && !!m);
      if (messages.length) return messages.join(' ');
    }
    if (typeof body.detail === 'string' && body.detail.trim()) return body.detail;
    if (typeof body.message === 'string' && body.message.trim()) return body.message;
    if (typeof body.title === 'string' && body.title.trim()) return body.title;
  }

  if (typeof err.message === 'string' && err.message.trim()) return err.message;
  return null;
}
