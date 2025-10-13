import test from 'node:test';
import assert from 'node:assert/strict';
import User from '../../models/User';
import { DEFAULT_ROLE, Roles } from '../../types/roles';

test('User defaults role to member when not provided', () => {
  const user = new User({
    email: 'role-default@example.com',
    password: 'Password123!',
  });

  assert.equal(user.role, DEFAULT_ROLE);
});

test('User preserves explicitly assigned role', () => {
  const user = new User({
    email: 'role-assigned@example.com',
    password: 'Password123!',
    role: Roles.admin,
  });

  assert.equal(user.role, Roles.admin);
});
