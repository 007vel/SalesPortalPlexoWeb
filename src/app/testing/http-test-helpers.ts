import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EnvironmentProviders, Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';

/** Adds a mockable HttpClient to a TestBed — every spec touching Api (directly or via a store) needs this. */
export function provideTestHttp(): (Provider | EnvironmentProviders)[] {
  return [provideHttpClient(), provideHttpClientTesting()];
}

/** Builds the full request URL Api.* would issue for a given path — mirrors Api's own url() building. */
export function apiUrl(path: string): string {
  return `${environment.apiBaseUrl}/${path.replace(/^\/+/, '')}`;
}

/** Flushes the `GET api/reps` request RepDirectoryStore fires from its constructor on first injection. */
export function flushInitialReps(reps: unknown[] = []): void {
  TestBed.inject(HttpTestingController).expectOne(apiUrl('reps')).flush(reps);
}
