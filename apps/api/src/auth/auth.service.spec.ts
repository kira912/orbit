import { ConflictException, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";
import type { GoogleIdentity, GoogleTokenVerifier } from "./google-token.verifier";

const CONFIG: Record<string, string> = {
  JWT_ACCESS_SECRET: "test-access-secret",
  JWT_REFRESH_SECRET: "test-refresh-secret",
  JWT_ACCESS_TTL: "15m",
  JWT_REFRESH_TTL_DAYS: "30",
};

function buildConfigService(): ConfigService {
  return {
    get: (key: string) => CONFIG[key],
    getOrThrow: (key: string) => {
      const value = CONFIG[key];
      if (!value) throw new Error(`missing config ${key}`);
      return value;
    },
  } as unknown as ConfigService;
}

function buildPrismaMock() {
  return {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
}

describe("AuthService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: AuthService;
  let google: { configured: boolean; verify: jest.Mock };

  const existingUser = {
    id: "user-1",
    email: "ada@example.com",
    displayName: "Ada",
    pictureUrl: null as string | null,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    passwordHash: "" as string,
  };

  beforeEach(async () => {
    existingUser.passwordHash = await bcrypt.hash("correct-horse", 4);
    prisma = buildPrismaMock();
    google = { configured: true, verify: jest.fn() };
    service = new AuthService(
      prisma as unknown as PrismaService,
      new JwtService(),
      buildConfigService(),
      google as unknown as GoogleTokenVerifier,
    );
  });

  describe("register", () => {
    it("rejects a duplicate email", async () => {
      prisma.user.findUnique.mockResolvedValue(existingUser);

      await expect(
        service.register({
          email: existingUser.email,
          password: "whatever123",
          displayName: "Ada",
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("hashes the password and issues a token pair", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(existingUser);
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register({
        email: existingUser.email,
        password: "correct-horse",
        displayName: "Ada",
      });

      const createArgs = prisma.user.create.mock.calls[0][0];
      expect(createArgs.data.passwordHash).not.toBe("correct-horse");
      expect(result.tokens.accessToken).toEqual(expect.any(String));
      expect(result.tokens.refreshToken).toEqual(expect.any(String));
      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
    });
  });

  describe("login", () => {
    it("rejects an unknown email", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: "nobody@example.com", password: "x" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("rejects a wrong password", async () => {
      prisma.user.findUnique.mockResolvedValue(existingUser);

      await expect(
        service.login({ email: existingUser.email, password: "wrong" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("issues tokens on a correct password", async () => {
      prisma.user.findUnique.mockResolvedValue(existingUser);
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login({
        email: existingUser.email,
        password: "correct-horse",
      });

      expect(result.user.email).toBe(existingUser.email);
      expect(result.tokens.accessToken).toEqual(expect.any(String));
    });
  });

  describe("refresh", () => {
    it("rejects a token that isn't in the store (already used/revoked)", async () => {
      const jwt = new JwtService();
      const token = jwt.sign(
        { sub: existingUser.id, email: existingUser.email },
        { secret: CONFIG.JWT_REFRESH_SECRET, expiresIn: "30d" },
      );
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh(token)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("rotates a valid refresh token: revokes old, issues a new pair", async () => {
      const jwt = new JwtService();
      const token = jwt.sign(
        { sub: existingUser.id, email: existingUser.email },
        { secret: CONFIG.JWT_REFRESH_SECRET, expiresIn: "30d" },
      );
      prisma.refreshToken.findUnique.mockResolvedValue({
        tokenHash: "irrelevant-because-mocked",
        userId: existingUser.id,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        revokedAt: null,
      });
      prisma.user.findUnique.mockResolvedValue(existingUser);
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refresh(token);

      expect(prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { revokedAt: expect.any(Date) } }),
      );
      expect(result.tokens.refreshToken).not.toBe(token);
    });

    it("rejects a malformed token", async () => {
      await expect(service.refresh("not-a-jwt")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe("loginWithGoogle", () => {
    const identity: GoogleIdentity = {
      sub: "google-123",
      email: "ada@example.com",
      emailVerified: true,
      name: "Ada Lovelace",
      picture: "https://lh3.googleusercontent.com/ada",
    };

    it("signs in the account already linked to that Google identity", async () => {
      google.verify.mockResolvedValue(identity);
      prisma.user.findUnique.mockResolvedValueOnce({ ...existingUser, pictureUrl: identity.picture });

      const result = await service.loginWithGoogle("id-token");

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { googleId: "google-123" } });
      expect(result.user.id).toBe("user-1");
      expect(result.tokens.accessToken).toBeTruthy();
    });

    it("refreshes the stored photo when Google's changed", async () => {
      google.verify.mockResolvedValue(identity);
      prisma.user.findUnique.mockResolvedValueOnce(existingUser);
      prisma.user.update.mockResolvedValue({ ...existingUser, pictureUrl: identity.picture });

      const result = await service.loginWithGoogle("id-token");

      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "user-1" }, data: { pictureUrl: identity.picture } });
      expect(result.user.pictureUrl).toBe(identity.picture);
    });

    it("links an existing account with the same verified email", async () => {
      google.verify.mockResolvedValue(identity);
      prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(existingUser);
      prisma.user.update.mockResolvedValue({ ...existingUser, googleId: "google-123" });

      await service.loginWithGoogle("id-token");

      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "user-1" }, data: { googleId: "google-123", pictureUrl: identity.picture } });
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it("never links on an email Google hasn't verified", async () => {
      google.verify.mockResolvedValue({ ...identity, emailVerified: false });
      prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(existingUser);

      await expect(service.loginWithGoogle("id-token")).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("creates a password-less account for a new Google user", async () => {
      google.verify.mockResolvedValue(identity);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ ...existingUser, id: "user-2", passwordHash: null });

      await service.loginWithGoogle("id-token");

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: "ada@example.com",
          googleId: "google-123",
          pictureUrl: identity.picture,
          passwordHash: null,
          displayName: "Ada Lovelace",
        },
      });
    });

    it("rejects an invalid token", async () => {
      google.verify.mockRejectedValue(new Error("bad signature"));
      await expect(service.loginWithGoogle("forged")).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("says so when Google sign-in isn't configured on the server", async () => {
      google.configured = false;
      await expect(service.loginWithGoogle("id-token")).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(google.verify).not.toHaveBeenCalled();
    });

    it("refuses a password login on a Google-only account", async () => {
      prisma.user.findUnique.mockResolvedValue({ ...existingUser, passwordHash: null });
      await expect(service.login({ email: "ada@example.com", password: "whatever" })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
