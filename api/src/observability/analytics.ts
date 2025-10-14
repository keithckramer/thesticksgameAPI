import { EventEmitter } from 'events';

export type LoginAttemptEventProperties = {
  origin: string;
  hasEmail: boolean;
  ipHash: string;
};

export type LoginSuccessEventProperties = {
  origin: string;
  userId: string;
  ipHash: string;
};

export type LoginFailureEventProperties = {
  origin: string;
  reason: 'validation' | 'auth';
  ipHash: string;
};

export type AnalyticsEvent =
  | { name: 'LoginAttempt'; properties: LoginAttemptEventProperties }
  | { name: 'LoginSuccess'; properties: LoginSuccessEventProperties }
  | { name: 'LoginFailure'; properties: LoginFailureEventProperties };

const emitter = new EventEmitter();
const ANALYTICS_EVENT_NAME = 'analytics';

export const onAnalyticsEvent = (listener: (event: AnalyticsEvent) => void): void => {
  emitter.on(ANALYTICS_EVENT_NAME, listener);
};

const emitEvent = (event: AnalyticsEvent): void => {
  emitter.emit(ANALYTICS_EVENT_NAME, event);
};

export const emitLoginAttempt = (properties: LoginAttemptEventProperties): void => {
  emitEvent({ name: 'LoginAttempt', properties });
};

export const emitLoginSuccess = (properties: LoginSuccessEventProperties): void => {
  emitEvent({ name: 'LoginSuccess', properties });
};

export const emitLoginFailure = (properties: LoginFailureEventProperties): void => {
  emitEvent({ name: 'LoginFailure', properties });
};

export default {
  onAnalyticsEvent,
  emitLoginAttempt,
  emitLoginSuccess,
  emitLoginFailure,
};
