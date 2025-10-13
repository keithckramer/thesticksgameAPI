import type { RequestHandler } from 'express';
import type { AuthenticatedRequest } from './auth';
import { auditLogger, logger } from './logging';
import { withFeature } from './withFeature';
import User from '../models/User';
import { recordUnauthorizedAccessAttempt } from '../observability/metrics';
import { Roles, type Role } from '../types/roles';
import { roleCache } from '../utils/roleCache';

const AUTH_REQUIRED_RESPONSE = { error: 'Authorization required.' } as const;
const FORBIDDEN_RESPONSE = { error: 'Forbidden.' } as const;

const ROLE_PRIORITY: Record<Role, number> = {
  [Roles.member]: 0,
  [Roles.promoter]: 1,
  [Roles.admin]: 2,
};

const hasSufficientRole = (current: Role, required: Role): boolean =>
  ROLE_PRIORITY[current] >= ROLE_PRIORITY[required];

export const requireRole = (minRole: Role): RequestHandler => {
  const evaluateFeature = withFeature('rbac');

  return (req, res, next) => {
    const typedReq = req as AuthenticatedRequest;
    const startTime = process.hrtime.bigint();
    const stopwatch = () => Number(process.hrtime.bigint() - startTime) / 1_000_000;

    if (!typedReq.auth?.userId) {
      const anonymousLogger = (typedReq.log ?? logger).child({
        component: 'requireRole',
        endpoint: typedReq.originalUrl,
      });
      anonymousLogger.warn(
        { event: 'security.requireRole.unauthenticated', durationMs: stopwatch() },
        'Authorization required for protected endpoint',
      );
      res.status(401).json(AUTH_REQUIRED_RESPONSE);
      return;
    }

    const { userId } = typedReq.auth;
    const contextLogger = (typedReq.log ?? logger).child({
      component: 'requireRole',
      userId,
      endpoint: typedReq.originalUrl,
      requiredRole: minRole,
    });

    evaluateFeature({
      enabled: async () => {
        let role = typedReq.auth?.role;

        if (!role) {
          role = roleCache.get(userId);
          if (role) {
            contextLogger.debug(
              { event: 'security.requireRole.cache_hit', role, durationMs: stopwatch() },
              'Resolved role from cache',
            );
          }
        }

        if (!role) {
          const user = await User.findById(userId).select('role').lean<{ role: Role }>().exec();
          if (!user) {
            contextLogger.warn(
              { event: 'security.requireRole.user_missing', durationMs: stopwatch() },
              'User no longer exists while enforcing role',
            );
            res.status(403).json(FORBIDDEN_RESPONSE);
            return;
          }

          role = user.role;
          roleCache.set(userId, role);
          contextLogger.debug(
            { event: 'security.requireRole.cache_store', role, durationMs: stopwatch() },
            'Cached role after database lookup',
          );
        }

        typedReq.auth.role = role;

        if (hasSufficientRole(role, minRole)) {
          contextLogger.debug(
            { event: 'security.requireRole.authorized', role, durationMs: stopwatch() },
            'Role check passed',
          );
          next();
          return;
        }

        const durationMs = stopwatch();
        contextLogger.warn(
          { event: 'security.unauthorized_access_attempt', role, durationMs },
          'Unauthorized access attempt blocked',
        );

        auditLogger.info({
          event: 'audit.unauthorized_access_attempt',
          userId,
          role,
          endpoint: typedReq.originalUrl,
          requiredRole: minRole,
          durationMs,
        });

        recordUnauthorizedAccessAttempt();

        res.status(403).json(FORBIDDEN_RESPONSE);
      },
      disabled: async () => {
        const durationMs = stopwatch();
        contextLogger.debug(
          { event: 'security.requireRole.bypass', reason: 'feature.disabled', durationMs },
          'RBAC disabled - bypassing role enforcement',
        );
        if (typedReq.auth) {
          typedReq.auth.role = Roles.admin;
        }
        next();
      },
    }).catch((error: unknown) => {
      contextLogger.error(
        { event: 'security.requireRole.error', err: error, durationMs: stopwatch() },
        'Failed to enforce role requirement',
      );
      next(error as Error);
    });
  };
};

export default requireRole;
