import test from 'node:test';
import assert from 'node:assert/strict';
import { registerSchema } from '../validators';
import { DEFAULT_ROLE, Roles } from '../../types/roles';

test('registerSchema applies default role when none provided', () => {
  const result = registerSchema.parse({
    name: 'Example User',
    email: 'user@example.com',
    password: 'Password123!',
  });

  assert.equal(result.role, DEFAULT_ROLE);
});

test('registerSchema rejects invalid roles', () => {
  const result = registerSchema.safeParse({
    name: 'Example User',
    email: 'user2@example.com',
    password: 'Password123!',
    role: 'superuser',
  });

  assert.equal(result.success, false);
});

test('registerSchema allows valid roles', () => {
  const result = registerSchema.parse({
    name: 'Example User',
    email: 'user3@example.com',
    password: 'Password123!',
    role: Roles.promoter,
  });

  assert.equal(result.role, Roles.promoter);
});
