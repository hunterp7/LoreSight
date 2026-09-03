import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import {
  OAuthResourceAuthorizer,
  type AccessTokenVerifier,
  type ResourceAuthorizationConfig,
  type VerifiedAccessToken,
} from "@storyframe/auth";
import type { StoryScope } from "@storyframe/application";

export const STORY_SCOPES: StoryScope[] = [
  "story:sessions:read",
  "story:sessions:write",
  "story:worlds:read",
  "story:worlds:write",
  "story:worlds:publish",
];

export interface OAuthDeploymentConfig extends ResourceAuthorizationConfig {
  jwksUri: string;
}

export interface OAuthServices {
  config: OAuthDeploymentConfig;
  authorizer: OAuthResourceAuthorizer;
}

type OAuthEnvironment = Partial<Record<
  "STORYFRAME_OAUTH_ISSUER" | "STORYFRAME_OAUTH_RESOURCE" | "STORYFRAME_OAUTH_JWKS_URI",
  string | undefined
>>;

function normalizeOAuthValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function requireHttpsUrl(value: string, label: string, options?: { originOnly?: boolean }): string {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error(`${label} must use HTTPS.`);
  if (options?.originOnly && (url.pathname !== "/" || url.search !== "" || url.hash !== "")) {
    throw new Error(`${label} must be the canonical HTTPS origin without a path, query, or fragment.`);
  }
  return options?.originOnly ? url.origin : url.toString().replace(/\/$/, "");
}

export function readOAuthDeploymentConfig(env: OAuthEnvironment): OAuthDeploymentConfig | undefined {
  const issuer = normalizeOAuthValue(env.STORYFRAME_OAUTH_ISSUER);
  const resource = normalizeOAuthValue(env.STORYFRAME_OAUTH_RESOURCE);
  const jwksUri = normalizeOAuthValue(env.STORYFRAME_OAUTH_JWKS_URI);
  const values = [
    issuer,
    resource,
    jwksUri,
  ];
  if (values.every((value) => !value)) return undefined;
  if (values.some((value) => !value)) {
    throw new Error(
      "OAuth configuration requires STORYFRAME_OAUTH_ISSUER, STORYFRAME_OAUTH_RESOURCE, and STORYFRAME_OAUTH_JWKS_URI together.",
    );
  }
  return {
    issuer: requireHttpsUrl(issuer!, "OAuth issuer"),
    resource: requireHttpsUrl(resource!, "OAuth resource", { originOnly: true }),
    jwksUri: requireHttpsUrl(jwksUri!, "OAuth JWKS URI"),
    supportedScopes: STORY_SCOPES,
    allowedClockSkewSeconds: 30,
  };
}

function scopesFromPayload(payload: JWTPayload): string[] {
  const scope = typeof payload.scope === "string" ? payload.scope.split(/\s+/) : [];
  const scp = Array.isArray(payload.scp)
    ? payload.scp.filter((value): value is string => typeof value === "string")
    : typeof payload.scp === "string" ? payload.scp.split(/\s+/) : [];
  return [...new Set([...scope, ...scp].filter(Boolean))];
}

export class JoseAccessTokenVerifier implements AccessTokenVerifier {
  private readonly keys;

  constructor(private readonly config: OAuthDeploymentConfig) {
    this.keys = createRemoteJWKSet(new URL(config.jwksUri), {
      cooldownDuration: 30_000,
      cacheMaxAge: 10 * 60_000,
      timeoutDuration: 5_000,
    });
  }

  async verify(accessToken: string): Promise<VerifiedAccessToken> {
    const { payload } = await jwtVerify(accessToken, this.keys, {
      issuer: this.config.issuer,
      audience: this.config.resource,
      clockTolerance: this.config.allowedClockSkewSeconds,
    });
    if (!payload.sub || !payload.iss || !payload.aud || payload.exp === undefined) {
      throw new Error("The verified access token is missing required claims.");
    }
    return {
      subject: payload.sub,
      issuer: payload.iss,
      audience: payload.aud,
      expiresAt: payload.exp,
      notBefore: payload.nbf,
      scopes: scopesFromPayload(payload),
      tokenId: payload.jti,
    };
  }
}

export function createOAuthServices(
  env: OAuthEnvironment,
  verifier?: AccessTokenVerifier,
): OAuthServices | undefined {
  const config = readOAuthDeploymentConfig(env);
  if (!config) return undefined;
  return {
    config,
    authorizer: new OAuthResourceAuthorizer(verifier ?? new JoseAccessTokenVerifier(config), config),
  };
}

export function oauthToolMeta(scopes: readonly StoryScope[], enabled = true) {
  // Do not advertise OAuth on local/dev deployments that have no authorizer.
  // ChatGPT treats a server with a mixture of unauthenticated and OAuth
  // metadata as a mixed-auth connector and rejects it during setup.
  return enabled ? { securitySchemes: [{ type: "oauth2", scopes }] } : {};
}
