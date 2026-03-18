import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAuthMiddleware } from "../../../src/auth/middleware/express-auth.js";
import type { TokenValidator, TokenValidationResult } from "../../../src/auth/token-validator.js";
import type { OAuthResourceServer } from "../../../src/auth/oauth-resource-server.js";
import type { Request, Response, NextFunction } from "express";

describe("createAuthMiddleware", () => {
  let mockTokenValidator: TokenValidator;
  let mockResourceServer: OAuthResourceServer;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockTokenValidator = {
      validate: vi.fn(),
    } as unknown as TokenValidator;

    mockResourceServer = {
      getResourceUri: vi.fn().mockReturnValue("https://api.example.com"),
      getWWWAuthenticateHeader: vi.fn().mockImplementation((error, description) => `Bearer error="${error}", error_description="${description}"`),
    } as unknown as OAuthResourceServer;

    mockRequest = {
      path: "/api/tools",
      headers: {},
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  it("should bypass authentication for well-known paths", async () => {
    mockRequest.path = "/.well-known/mcp/configuration";
    const middleware = createAuthMiddleware({
      tokenValidator: mockTokenValidator,
      resourceServer: mockResourceServer,
    });

    await middleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockTokenValidator.validate).not.toHaveBeenCalled();
    expect(mockRequest.requestId).toBeDefined();
  });

  it("should bypass authentication for configured public paths", async () => {
    mockRequest.path = "/health";
    const middleware = createAuthMiddleware({
      tokenValidator: mockTokenValidator,
      resourceServer: mockResourceServer,
      publicPaths: ["/health", "/public/*"],
    });

    await middleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockTokenValidator.validate).not.toHaveBeenCalled();
  });

  it("should bypass authentication for configured public paths with wildcards", async () => {
    mockRequest.path = "/public/assets/logo.png";
    const middleware = createAuthMiddleware({
      tokenValidator: mockTokenValidator,
      resourceServer: mockResourceServer,
      publicPaths: ["/health", "/public/*"],
    });

    await middleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockTokenValidator.validate).not.toHaveBeenCalled();
  });

  it("should return 401 with WWW-Authenticate header when token is missing", async () => {
    const middleware = createAuthMiddleware({
      tokenValidator: mockTokenValidator,
      resourceServer: mockResourceServer,
    });

    await middleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.setHeader).toHaveBeenCalledWith("WWW-Authenticate", expect.stringContaining("Bearer"));
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: "unauthorized",
      error_description: "No access token provided",
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("should return 401 when token is invalid", async () => {
    mockRequest.headers = { authorization: "Bearer invalid-token" };
    (mockTokenValidator.validate as any).mockResolvedValue({
      valid: false,
      error: "Token expired",
    } as TokenValidationResult);

    const middleware = createAuthMiddleware({
      tokenValidator: mockTokenValidator,
      resourceServer: mockResourceServer,
    });

    await middleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockTokenValidator.validate).toHaveBeenCalledWith("invalid-token");
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      "WWW-Authenticate",
      'Bearer error="invalid_token", error_description="Token expired"'
    );
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: "invalid_token",
      error_description: "Token expired",
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("should return 500 when valid token has no claims", async () => {
    mockRequest.headers = { authorization: "Bearer valid-token" };
    (mockTokenValidator.validate as any).mockResolvedValue({
      valid: true,
      // missing claims
    } as TokenValidationResult);

    const middleware = createAuthMiddleware({
      tokenValidator: mockTokenValidator,
      resourceServer: mockResourceServer,
    });

    await middleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: "internal_error" });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("should populate req.auth and req.accessToken and call next for valid token", async () => {
    mockRequest.headers = { authorization: "Bearer valid-token" };
    const mockClaims = { sub: "user123", scopes: ["read", "write"] };
    (mockTokenValidator.validate as any).mockResolvedValue({
      valid: true,
      claims: mockClaims,
    } as TokenValidationResult);

    const middleware = createAuthMiddleware({
      tokenValidator: mockTokenValidator,
      resourceServer: mockResourceServer,
    });

    await middleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockTokenValidator.validate).toHaveBeenCalledWith("valid-token");
    expect((mockRequest as any).auth).toEqual(mockClaims);
    expect((mockRequest as any).accessToken).toBe("valid-token");
    expect(mockResponse.status).not.toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalled();
  });
});
