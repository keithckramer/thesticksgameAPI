import type { RequestHandler } from 'express';
import { Counter, Registry, collectDefaultMetrics } from 'prom-client';

export const metricsRegistry = new Registry();

collectDefaultMetrics({ register: metricsRegistry });

const createCounter = (name: string, help: string): Counter<string> =>
  new Counter({ name, help, registers: [metricsRegistry] });

const authLoginSuccess = createCounter('auth_login_success', 'Successful login attempts');
const authLoginFail = createCounter('auth_login_fail', 'Failed login attempts');
const authSignupSuccess = createCounter('auth_signup_success', 'Successful registrations');
const authRefreshSuccess = createCounter('auth_refresh_success', 'Successful refresh token rotations');
const authRefreshFail = createCounter('auth_refresh_fail', 'Failed refresh token attempts');

export const recordAuthLoginSuccess = (): void => {
  authLoginSuccess.inc();
};

export const recordAuthLoginFail = (): void => {
  authLoginFail.inc();
};

export const recordAuthSignupSuccess = (): void => {
  authSignupSuccess.inc();
};

export const recordAuthRefreshSuccess = (): void => {
  authRefreshSuccess.inc();
};

export const recordAuthRefreshFail = (): void => {
  authRefreshFail.inc();
};

export const metricsHandler: RequestHandler = async (_req, res) => {
  res.setHeader('content-type', metricsRegistry.contentType);
  res.setHeader('Cache-Control', 'no-store');
  res.send(await metricsRegistry.metrics());
};

