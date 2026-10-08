import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { createHash, randomUUID } from "crypto";
import type { AuthResponse, LoginInput, RegisterInput } from "@orbit/shared";
import { PrismaService } from "../prisma/prisma.service";
import { GoogleTokenVerifier, type GoogleIdentity } from "./google-token.verifier";
import type { JwtPayload } from "./types";

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly google: GoogleTokenVerifier,
  ) {}

  async register(input: RegisterInput): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existing) {
      throw new ConflictException("Email already in use");
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        displayName: input.displayName,
      },
    });

    return this.buildAuthResponse(user);
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException("Ce compte utilise la connexion avec Google");
    }

    const passwordMatches = await bcrypt.compare(
      input.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException("Invalid credentials");
    }

    return this.buildAuthResponse(user);
  }

  /**
   * Sign in with Google: the account linked to that Google identity, else an
   * existing account with the same (Google-verified) email, which gets
   * linked, else a new account.
   */
  async loginWithGoogle(idToken: string): Promise<AuthResponse> {
    if (!this.google.configured) {
      throw new ServiceUnavailableException("La connexion Google n'est pas configurée sur le serveur");
    }

    let identity: GoogleIdentity;
    try {
      identity = await this.google.verify(idToken);
    } catch {
      throw new UnauthorizedException("Jeton Google invalide");
    }

    const linked = await this.prisma.user.findUnique({ where: { googleId: identity.sub } });
    if (linked) return this.buildAuthResponse(linked);

    const sameEmail = await this.prisma.user.findUnique({ where: { email: identity.email } });
    if (sameEmail) {
      // Linking on an unverified email would let anyone claim someone else's account.
      if (!identity.emailVerified) {
        throw new ConflictException("Un compte existe déjà avec cet email");
      }
      const user = await this.prisma.user.update({
        where: { id: sameEmail.id },
        data: { googleId: identity.sub },
      });
      return this.buildAuthResponse(user);
    }

    const user = await this.prisma.user.create({
      data: {
        email: identity.email,
        googleId: identity.sub,
        passwordHash: null,
        displayName: (identity.name ?? identity.email.split("@")[0]).slice(0, 60),
      },
    });
    return this.buildAuthResponse(user);
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    let payload: JwtPayload;
    try {
      payload = this.jwt.verify<JwtPayload>(refreshToken, {
        secret: this.config.getOrThrow("JWT_REFRESH_SECRET"),
      });
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    // Rotate: revoke the used token so it cannot be replayed.
    await this.prisma.refreshToken.update({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    });

    return this.buildAuthResponse(user);
  }

  private async buildAuthResponse(user: {
    id: string;
    email: string;
    displayName: string;
    createdAt: Date;
  }): Promise<AuthResponse> {
    const payload: JwtPayload = { sub: user.id, email: user.email };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.getOrThrow("JWT_ACCESS_SECRET"),
      expiresIn: this.config.get("JWT_ACCESS_TTL") ?? "15m",
    });

    const refreshTtlDays = Number(
      this.config.get("JWT_REFRESH_TTL_DAYS") ?? 30,
    );
    // jti guarantees a unique token (and thus a unique tokenHash row) even
    // when two refreshes for the same user happen within the same second.
    const refreshToken = this.jwt.sign(
      { ...payload, jti: randomUUID() },
      {
        secret: this.config.getOrThrow("JWT_REFRESH_SECRET"),
        expiresIn: `${refreshTtlDays}d`,
      },
    );

    const expiresAt = new Date(
      Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000,
    );
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashToken(refreshToken),
        userId: user.id,
        expiresAt,
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt,
      },
      tokens: { accessToken, refreshToken },
    };
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
