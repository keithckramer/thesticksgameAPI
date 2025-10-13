export const Roles = {
  member: 'member',
  promoter: 'promoter',
  admin: 'admin',
} as const;

export type Role = (typeof Roles)[keyof typeof Roles];

export const ROLE_VALUES = Object.values(Roles) as Role[];

export const DEFAULT_ROLE: Role = Roles.member;

export const isRole = (value: unknown): value is Role =>
  typeof value === 'string' && (ROLE_VALUES as string[]).includes(value);
