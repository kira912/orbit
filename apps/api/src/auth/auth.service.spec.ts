import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";

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

  const existingUser = {
    id: "user-1",
    email: "ada@example.com",
    displayName: "Ada",
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    passwordHash: "" as string,
  };

  beforeEach(async () => {
    existingUser.passwordHash = await bcrypt.hash("correct-horse", 4);
    prisma = buildPrismaMock();
    service = new AuthService(
      prisma as unknown as PrismaService,
      new JwtService(),
      buildConfigService(),
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
});
