import assert from "node:assert/strict";
import test from "node:test";
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
      issuer: "https://identity.example.com",
      audience: "https://storyframe.example.com",
      expiresAt: 2_000_000_000,
      scopes: ["story:sessions:read", "story:sessions:write"],
    }),
  };
  const services = createOAuthServices(env, verifier);
  assert.equal(services.config.resource, "https://storyframe.example.com");
  assert.deepEqual(services.authorizer.protectedResourceMetadata().authorization_servers, ["https://identity.example.com"]);
  const actor = await services.authorizer.authorize({
    authorizationHeader: "Bearer signed-token",
    requiredScopes: ["story:sessions:write"],
    nowEpochSeconds: 1_900_000_000,
  });
  assert.equal(actor.subjectId, "user-a");
});

test("tool auth compatibility metadata names the exact OAuth scopes", () => {
  assert.deepEqual(oauthToolMeta(["story:sessions:read"]), {
    securitySchemes: [{ type: "oauth2", scopes: ["story:sessions:read"] }],
  });
});

test("tool auth metadata is omitted for unauthenticated local mode", () => {
  assert.deepEqual(oauthToolMeta(["story:sessions:read"], false), {});
});
