import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

type QueryParams = Record<string, string | number | boolean>;

/**
 * Thin HTTP wrapper every feature (login, reps, documents, ...) calls
 * through. Endpoint paths are relative to `environment.apiBaseUrl` —
 * e.g. `api.get('reps')` hits `${apiBaseUrl}/reps`.
 */
@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  get<T>(path: string, params?: QueryParams): Observable<T>;
  get(path: string, params: QueryParams | undefined, responseType: 'blob'): Observable<Blob>;
  get<T>(path: string, params?: QueryParams, responseType: 'json' | 'blob' = 'json'): Observable<T | Blob> {
    if (responseType === 'blob') {
      return this.http.get(this.url(path), { params: this.toHttpParams(params), responseType: 'blob' });
    }
    return this.http.get<T>(this.url(path), { params: this.toHttpParams(params) });
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(this.url(path), body);
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(this.url(path), body);
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(this.url(path));
  }

  /** Absolute URL for a path, for use outside HttpClient (e.g. a direct `<a href>`/`<img src>` link to a file endpoint). */
  fileUrl(path: string): string {
    return this.url(path);
  }

  private url(path: string): string {
    return `${this.baseUrl}/${path.replace(/^\/+/, '')}`;
  }

  private toHttpParams(params?: QueryParams): HttpParams | undefined {
    if (!params) return undefined;
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      httpParams = httpParams.set(key, String(value));
    }
    return httpParams;
  }
}
