import assert from "node:assert/strict";
import test from "node:test";
import { AuthorizationError, OAuthResourceAuthorizer } from "../packages/auth/dist/index.js";

const now = 1_800_000_000;
const claims = {
  subject: "user-123",
  issuer: "https://identity.example.com",
  audience: "https://storyframe.example.com",
  expiresAt: now + 300,
  scopes: ["story:sessions:read", "story:sessions:write"],
};

function authorizer(overrides = {}, verifier = undefined) {
  return new OAuthResourceAuthorizer(
    verifier ?? { verify: async () => ({ ...claims, ...overrides }) },
    {
      issuer: claims.issuer,
      resource: claims.audience,
      supportedScopes: [
        "story:sessions:read",
        "story:sessions:write",
        "story:worlds:read",
        "story:worlds:write",
        "story:worlds:publish",
      ],
    },
  );
}

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => error instanceof AuthorizationError && error.code === code);
}

test("resource authorizer validates signature claims and derives actor identity", async () => {
  const actor = await authorizer().authorize({
    authorizationHeader: "Bearer opaque-signed-token",
    requiredScopes: ["story:sessions:write"],
    nowEpochSeconds: now,
    traceId: "trace-a",
  });
  assert.deepEqual(actor, {
    subjectId: "user-123",
    scopes: ["story:sessions:read", "story:sessions:write"],
    traceId: "trace-a",
  });
});

test("resource authorizer rejects missing, malformed, unverified, expired, and premature tokens", async () => {
  await expectCode(authorizer().authorize({ authorizationHeader: undefined, requiredScopes: [], nowEpochSeconds: now }), "missing-token");
  await expectCode(authorizer().authorize({ authorizationHeader: "Basic nope", requiredScopes: [], nowEpochSeconds: now }), "invalid-token");
  await expectCode(authorizer({}, { verify: async () => { throw new Error("bad signature"); } }).authorize({ authorizationHeader: "Bearer token", requiredScopes: [], nowEpochSeconds: now }), "invalid-token");
  await expectCode(authorizer({ expiresAt: now - 31 }).authorize({ authorizationHeader: "Bearer token", requiredScopes: [], nowEpochSeconds: now }), "token-expired");
  await expectCode(authorizer({ notBefore: now + 31 }).authorize({ authorizationHeader: "Bearer token", requiredScopes: [], nowEpochSeconds: now }), "token-not-active");
});

test("resource authorizer rejects issuer, audience, and scope confusion", async () => {
  await expectCode(authorizer({ issuer: "https://attacker.example" }).authorize({ authorizationHeader: "Bearer token", requiredScopes: [], nowEpochSeconds: now }), "wrong-issuer");
  await expectCode(authorizer({ audience: "https://other.example" }).authorize({ authorizationHeader: "Bearer token", requiredScopes: [], nowEpochSeconds: now }), "wrong-audience");
  await expectCode(authorizer().authorize({ authorizationHeader: "Bearer token", requiredScopes: ["story:worlds:publish"], nowEpochSeconds: now }), "insufficient-scope");
});

test("metadata and challenges advertise the canonical protected resource", () => {
  const service = authorizer();
  assert.deepEqual(service.protectedResourceMetadata().authorization_servers, [claims.issuer]);
  assert.match(service.challenge(["story:sessions:read"]), /oauth-protected-resource/);
  assert.match(service.challenge(["story:sessions:read"]), /story:sessions:read/);
});
