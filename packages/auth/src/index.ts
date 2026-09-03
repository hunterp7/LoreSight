import type { ActorContext, StoryScope } from "@storyframe/application";

export interface VerifiedAccessToken {
  subject: string;
  issuer: string;
  audience: string | string[];
  expiresAt: number;
  notBefore?: number;
  scopes: string[];
  tokenId?: string;
}

export interface AccessTokenVerifier {
  /** Verify cryptographic signature before returning claims. */
  verify(accessToken: string): Promise<VerifiedAccessToken>;
}

export interface ResourceAuthorizationConfig {
  issuer: string;
  resource: string;
  supportedScopes: StoryScope[];
  allowedClockSkewSeconds?: number;
}

export type AuthorizationFailureCode =
  | "missing-token"
  | "invalid-token"
  | "wrong-issuer"
  | "wrong-audience"
  | "token-expired"
  | "token-not-active"
  | "insufficient-scope";

export class AuthorizationError extends Error {
  constructor(readonly code: AuthorizationFailureCode, message: string) {
    super(message);
  }
}

export interface AuthorizeRequestInput {
  authorizationHeader: string | undefined;
  requiredScopes: StoryScope[];
  nowEpochSeconds: number;
  traceId?: string;
}

function bearerToken(header: string | undefined): string {
  if (!header) throw new AuthorizationError("missing-token", "A bearer access token is required.");
  const match = /^Bearer ([^\s]+)$/i.exec(header.trim());
  if (!match) throw new AuthorizationError("invalid-token", "The authorization header is invalid.");
  return match[1];
}

function includesAudience(audience: string | string[], resource: string): boolean {
  return Array.isArray(audience) ? audience.includes(resource) : audience === resource;
}

function supportedScope(value: string, supported: readonly StoryScope[]): value is StoryScope {
  return supported.includes(value as StoryScope);
}

export class OAuthResourceAuthorizer {
  constructor(
    private readonly verifier: AccessTokenVerifier,
    private readonly config: ResourceAuthorizationConfig,
  ) {
    if (!config.issuer.startsWith("https://") || !config.resource.startsWith("https://")) {
      throw new Error("Production issuer and resource identifiers must use HTTPS.");
    }
  }

  async authorize(input: AuthorizeRequestInput): Promise<ActorContext> {
    const raw = bearerToken(input.authorizationHeader);
    let token: VerifiedAccessToken;
    try {
      token = await this.verifier.verify(raw);
    } catch {
      throw new AuthorizationError("invalid-token", "The access token could not be verified.");
    }
    const skew = this.config.allowedClockSkewSeconds ?? 30;
    if (token.issuer !== this.config.issuer) {
      throw new AuthorizationError("wrong-issuer", "The access token issuer is not trusted.");
    }
    if (!includesAudience(token.audience, this.config.resource)) {
      throw new AuthorizationError("wrong-audience", "The access token was not issued for Storyframe.");
    }
    if (token.expiresAt <= input.nowEpochSeconds - skew) {
      throw new AuthorizationError("token-expired", "The access token has expired.");
    }
    if (token.notBefore !== undefined && token.notBefore > input.nowEpochSeconds + skew) {
      throw new AuthorizationError("token-not-active", "The access token is not active yet.");
    }
    if (!token.subject.trim()) {
      throw new AuthorizationError("invalid-token", "The access token has no subject.");
    }
    const scopes = token.scopes.filter((scope) => supportedScope(scope, this.config.supportedScopes));
    if (input.requiredScopes.some((scope) => !scopes.includes(scope))) {
      throw new AuthorizationError("insufficient-scope", "The access token lacks a required scope.");
    }
    return { subjectId: token.subject, scopes, traceId: input.traceId };
  }

  protectedResourceMetadata() {
    return {
      resource: this.config.resource,
      authorization_servers: [this.config.issuer],
      scopes_supported: [...this.config.supportedScopes],
      resource_documentation: `${this.config.resource}/docs/authorization`,
    };
  }

  challenge(requiredScopes: StoryScope[], code: "invalid_token" | "insufficient_scope" = "invalid_token") {
    const metadata = `${this.config.resource}/.well-known/oauth-protected-resource`;
    return `Bearer resource_metadata="${metadata}", scope="${requiredScopes.join(" ")}", error="${code}"`;
  }
}
