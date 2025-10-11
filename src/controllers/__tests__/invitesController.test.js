import test from "node:test";
import assert from "node:assert/strict";
import {
  createInvite,
  listInvites,
  setInviteModel,
} from "../invitesController.js";

class FakeQuery {
  constructor(results = []) {
    this.results = results;
    this.sortField = null;
    this.sortOrder = 1;
    this.skipValue = 0;
    this.limitValue = null;
  }

  sort(sortObj = {}) {
    const [field, order] = Object.entries(sortObj)[0] || [];
    this.sortField = field;
    this.sortOrder = order || 1;
    return this;
  }

  skip(value) {
    this.skipValue = value;
    return this;
  }

  limit(value) {
    this.limitValue = value;
    return this;
  }

  async exec() {
    let items = [...this.results];

    if (this.sortField) {
      items.sort((a, b) => {
        const aValue = a[this.sortField];
        const bValue = b[this.sortField];
        if (aValue < bValue) {
          return -1 * this.sortOrder;
        }
        if (aValue > bValue) {
          return 1 * this.sortOrder;
        }
        return 0;
      });
    }

    if (this.skipValue) {
      items = items.slice(this.skipValue);
    }

    if (this.limitValue !== null) {
      items = items.slice(0, this.limitValue);
    }

    return items;
  }
}

class FakeInvite {
  static store = [];

  constructor(data = {}) {
    Object.assign(this, data);
    this._id = this._id || `${Date.now()}-${Math.random()}`;
    this.status = this.status || "pending";
    this.createdAt = this.createdAt || new Date();
    this.expiresAt = this.expiresAt || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  }

  static reset() {
    FakeInvite.store = [];
  }

  static matches(doc, filter = {}) {
    if (!filter || Object.keys(filter).length === 0) {
      return true;
    }

    if (filter.status && doc.status !== filter.status) {
      return false;
    }

    if (filter.code && doc.code !== filter.code) {
      return false;
    }

    if (filter.$or) {
      const orMatch = filter.$or.some((condition) => {
        const [key, value] = Object.entries(condition)[0] || [];
        if (!key) {
          return false;
        }

        const target = doc[key] || "";
        if (value instanceof RegExp) {
          return value.test(target);
        }

        return target === value;
      });

      if (!orMatch) {
        return false;
      }
    }

    return true;
  }

  static async exists(filter = {}) {
    return FakeInvite.store.some((doc) => FakeInvite.matches(doc, filter));
  }

  static async countDocuments(filter = {}) {
    return FakeInvite.store.filter((doc) => FakeInvite.matches(doc, filter)).length;
  }

  static find(filter = {}) {
    const matches = FakeInvite.store.filter((doc) => FakeInvite.matches(doc, filter));
    return new FakeQuery(matches);
  }

  static async findOne(filter = {}) {
    return (
      FakeInvite.store.find((doc) => FakeInvite.matches(doc, filter)) || null
    );
  }

  static async findById(id) {
    return FakeInvite.store.find((doc) => doc._id === id) || null;
  }

  get inviteUrl() {
    return `http://localhost:3000/join/${this.code}`;
  }

  toJSON() {
    return {
      ...this,
      inviteUrl: this.inviteUrl,
    };
  }

  isExpired() {
    return this.expiresAt && this.expiresAt.getTime() < Date.now();
  }

  async save() {
    const index = FakeInvite.store.findIndex((doc) => doc._id === this._id);
    if (index >= 0) {
      FakeInvite.store[index] = this;
    } else {
      FakeInvite.store.push(this);
    }
    return this;
  }
}

const createMockResponse = () => {
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
  };

  res.status = (code) => {
    res.statusCode = code;
    return res;
  };

  res.json = (payload) => {
    res.body = payload;
    return res;
  };

  res.redirect = (code, location) => {
    if (typeof code === "string") {
      res.statusCode = 302;
      res.redirectLocation = code;
    } else {
      res.statusCode = code;
      res.redirectLocation = location;
    }

    return res;
  };

  return res;
};

test("creates an invite and returns it in the list", async () => {
  FakeInvite.reset();
  setInviteModel(FakeInvite);

  const adminUser = {
    _id: "admin-user-id",
    role: "admin",
  };

  const createReq = {
    body: {
      email: "invitee@example.com",
      role: "user",
    },
    user: adminUser,
  };
  const createRes = createMockResponse();

  await createInvite(createReq, createRes);

  assert.equal(createRes.statusCode, 201);
  assert.ok(createRes.body.code);
  assert.equal(createRes.body.status, "pending");
  assert.ok(createRes.body.inviteUrl.includes(createRes.body.code));

  const listReq = {
    query: {},
    user: adminUser,
  };
  const listRes = createMockResponse();

  await listInvites(listReq, listRes);

  assert.equal(listRes.statusCode, 200);
  assert.ok(Array.isArray(listRes.body.data));
  assert.equal(listRes.body.data.length, 1);
  assert.equal(listRes.body.data[0].code, createRes.body.code);
});

test.after(() => {
  FakeInvite.reset();
  setInviteModel(null);
});
