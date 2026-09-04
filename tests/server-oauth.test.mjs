import assert from "node:assert/strict";
import test from "node:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { createOAuthServices, oauthToolMeta, readOAuthDeploymentConfig } from "../server/dist/oauth.js";

const env = {
  STORYFRAME_OAUTH_ISSUER: "https://identity.example.com/",
  STORYFRAME_OAUTH_RESOURCE: "https://storyframe.example.com/",
  STORYFRAME_OAUTH_JWKS_URI: "https://identity.example.com/.well-known/jwks.json",
};

test("OAuth deployment config is disabled locally and rejects partial or insecure production values", () => {
  assert.equal(readOAuthDeploymentConfig({}), undefined);
  assert.throws(() => readOAuthDeploymentConfig({ STORYFRAME_OAUTH_ISSUER: env.STORYFRAME_OAUTH_ISSUER }), /requires/);
  assert.throws(() => readOAuthDeploymentConfig({ ...env, STORYFRAME_OAUTH_RESOURCE: "http://storyframe.example.com" }), /HTTPS/);
});

test("OAuth services expose protected-resource metadata and authorize verified claims", async () => {
  const verifier = {
    verify: async () => ({
      subject: "user-a",
      issuer: "https://identity.example.com/",
      audience: "https://storyframe.example.com",
      expiresAt: 2_000_000_000,
      scopes: ["story:sessions:read", "story:sessions:write"],
    }),
  };
  const services = createOAuthServices(env, verifier);
  assert.equal(services.config.resource, "https://storyframe.example.com");
  assert.deepEqual(services.authorizer.protectedResourceMetadata().authorization_servers, ["https://identity.example.com/"]);
  const actor = await services.authorizer.authorize({
    authorizationHeader: "Bearer signed-token",
    requiredScopes: ["story:sessions:write"],
    nowEpochSeconds: 1_900_000_000,
  });
  assert.equal(actor.subjectId, "user-a");
});

test("OAuth configuration preserves exact issuer identifiers", () => {
  for (const issuer of ["https://identity.example.com", "https://identity.example.com/", "https://identity.example.com/tenant/"]) {
    assert.equal(readOAuthDeploymentConfig({ ...env, STORYFRAME_OAUTH_ISSUER: issuer }).issuer, issuer);
  }
});

test("signed tokens with a trailing-slash issuer authorize without weakening token checks", async (t) => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = { ...await exportJWK(publicKey), kid: "test-key", alg: "RS256", use: "sig" };
  t.mock.method(globalThis, "fetch", async () => Response.json({ keys: [jwk] }));
  const services = createOAuthServices(env);
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: "https://identity.example.com/",
    aud: "https://storyframe.example.com",
    sub: "player-test",
    exp: now + 300,
    scope: "story:sessions:read",
  };
  async function authorize(overrides = {}, key = privateKey) {
    const token = await new SignJWT({ ...claims, ...overrides })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" }).sign(key);
    return services.authorizer.authorize({
      authorizationHeader: `Bearer ${token}`,
      requiredScopes: ["story:sessions:read"],
      nowEpochSeconds: now,
    });
  }
  assert.equal((await authorize()).subjectId, "player-test");
  for (const overrides of [
    { iss: "https://identity.example.com" },
    { aud: "https://another.example.com" },
    { exp: now - 60 },
  ]) {
    await assert.rejects(authorize(overrides), { code: "invalid-token" });
  }
  await assert.rejects(authorize({ scope: "" }), { code: "insufficient-scope" });
  const otherKeys = await generateKeyPair("RS256");
  await assert.rejects(authorize({}, otherKeys.privateKey), { code: "invalid-token" });
});

test("tool auth compatibility metadata names the exact OAuth scopes", () => {
  assert.deepEqual(oauthToolMeta(["story:sessions:read"]), {
    securitySchemes: [{ type: "oauth2", scopes: ["story:sessions:read"] }],
  });
});

test("tool auth metadata is omitted for unauthenticated local mode", () => {
  assert.deepEqual(oauthToolMeta(["story:sessions:read"], false), {});
});
