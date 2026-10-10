import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OAuth2Client } from "google-auth-library";

export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
}

/**
 * Checks an ID token from the Google Sign-In SDK: signature (Google's public
 * keys), expiry, issuer, and that it was issued for one of our OAuth clients
 * (GOOGLE_CLIENT_IDS, comma-separated: the web client the app requests tokens for).
 */
@Injectable()
export class GoogleTokenVerifier {
  private readonly client = new OAuth2Client();

  constructor(private readonly config: ConfigService) {}

  private audiences(): string[] {
    return (this.config.get<string>("GOOGLE_CLIENT_IDS") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
  }

  get configured(): boolean {
    return this.audiences().length > 0;
  }

  /** Throws when the token is invalid, expired or meant for another app. */
  async verify(idToken: string): Promise<GoogleIdentity> {
    const ticket = await this.client.verifyIdToken({ idToken, audience: this.audiences() });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) throw new Error("Google token without identity");
    return {
      sub: payload.sub,
      email: payload.email.toLowerCase(),
      emailVerified: payload.email_verified === true,
      name: payload.name ?? payload.given_name ?? null,
      picture: payload.picture ?? null,
    };
  }
}
