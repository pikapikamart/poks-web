export const apiRateLimitPolicies = {
  "account-delete": {
    limit: 60,
    windowSeconds: 60 * 60,
  },
  "ai-apply": {
    limit: 60,
    windowSeconds: 60 * 60,
  },
  "ai-process": {
    limit: 60,
    windowSeconds: 60 * 60,
  },
  "ai-prepare": {
    limit: 60,
    windowSeconds: 60 * 60,
  },
  "invitation-accept": {
    limit: 60,
    windowSeconds: 60 * 60,
  },
} as const;

export type ApiRateLimitPolicyName = keyof typeof apiRateLimitPolicies;

export type ApiRateLimitPolicy =
  (typeof apiRateLimitPolicies)[ApiRateLimitPolicyName];

export const getAuthenticatedRateLimitSubject = (userId: string) =>
  `user:${userId}`;
