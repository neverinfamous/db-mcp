import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  verifySessionOwner,
  touchSession,
  setupStatefulEndpoints,
} from "../../../../src/transports/http/sessions/stateful.js";
import type { HttpTransportState } from "../../../../src/transports/http/types.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";

vi.mock("@modelcontextprotocol/sdk/server/streamableHttp.js", () => {
  return {
    StreamableHTTPServerTransport: class MockTransport {
      sessionId: string;
      onclose: any;
      constructor(options: any) {
        this.sessionId = options.sessionIdGenerator();
        setTimeout(() => {
          if (options.onsessioninitialized) {
            options.onsessioninitialized(this.sessionId);
          }
        }, 0);
      }
      handleRequest = vi.fn().mockResolvedValue(undefined);
      close = vi.fn().mockImplementation(function(this: any) {
        if (this.onclose) this.onclose();
      });
    }
  };
});

describe("Stateful Sessions", () => {
  let mockState: HttpTransportState;

  beforeEach(() => {
    mockState = {
      app: {
        post: vi.fn(),
        get: vi.fn(),
        delete: vi.fn(),
      } as any,
      mcpServer: new Server({ name: "test", version: "1.0.0" }, { capabilities: {} }),
      transports: new Map(),
      sseTransports: new Map(),
      sessionLastActivity: new Map(),
      sessionCreatedAt: new Map(),
      sessionOwners: new Map(),
      sessionLocks: new Map(),
      config: {},
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("verifySessionOwner", () => {
    it("should allow if owner is undefined (auth disabled)", () => {
      mockState.sessionOwners.set("sid", undefined);
      expect(verifySessionOwner(mockState, "sid", "user1")).toBe(true);
      expect(verifySessionOwner(mockState, "sid", undefined)).toBe(true);
    });

    it("should allow if reqAuthSub matches owner", () => {
      mockState.sessionOwners.set("sid", "user1");
      expect(verifySessionOwner(mockState, "sid", "user1")).toBe(true);
    });

    it("should deny if reqAuthSub does not match owner", () => {
      mockState.sessionOwners.set("sid", "user1");
      expect(verifySessionOwner(mockState, "sid", "user2")).toBe(false);
      expect(verifySessionOwner(mockState, "sid", undefined)).toBe(false);
    });
  });

  describe("touchSession", () => {
    it("should update sessionLastActivity", () => {
      const now = Date.now();
      touchSession(mockState, "sid");
      const activity = mockState.sessionLastActivity.get("sid");
      expect(activity).toBeDefined();
      expect(activity).toBeGreaterThanOrEqual(now);
    });
  });

  describe("setupStatefulEndpoints", () => {
    it("should throw if transport or server not initialized", () => {
      mockState.app = undefined as any;
      expect(() => setupStatefulEndpoints(mockState)).toThrow("Transport or server not initialized");
    });

    it("should register post, get, delete endpoints", () => {
      const timer = setupStatefulEndpoints(mockState);
      expect(mockState.app?.post).toHaveBeenCalledWith("/mcp", expect.any(Function));
      expect(mockState.app?.get).toHaveBeenCalledWith("/mcp", expect.any(Function));
      expect(mockState.app?.delete).toHaveBeenCalledWith("/mcp", expect.any(Function));
      clearInterval(timer);
    });

    it("should clear idle sessions on sweep", () => {
      vi.useFakeTimers();
      const timer = setupStatefulEndpoints(mockState);

      const mockTransport = { close: vi.fn() } as any;
      mockState.transports.set("idle-sid", mockTransport);
      mockState.sessionLastActivity.set("idle-sid", Date.now() - 3600000); // 1 hour ago
      
      const mockSse = { close: vi.fn() } as any;
      mockState.sseTransports.set("idle-sse", mockSse);
      mockState.sessionLastActivity.set("idle-sse", Date.now() - 3600000); // 1 hour ago

      vi.advanceTimersByTime(300000); // 5 minutes

      expect(mockTransport.close).toHaveBeenCalled();
      expect(mockSse.close).toHaveBeenCalled();

      clearInterval(timer);
      vi.useRealTimers();
    });
  });

  describe("Express Routes", () => {
    let postHandler: any;
    let getHandler: any;
    let deleteHandler: any;
    let timer: NodeJS.Timeout;

    beforeEach(() => {
      timer = setupStatefulEndpoints(mockState);
      postHandler = (mockState.app?.post as any).mock.calls[0][1];
      getHandler = (mockState.app?.get as any).mock.calls[0][1];
      deleteHandler = (mockState.app?.delete as any).mock.calls[0][1];
    });

    afterEach(() => {
      clearInterval(timer);
    });

    const createMockRes = () => ({
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      send: vi.fn(),
      headersSent: false,
      on: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
    });

    describe("POST /mcp", () => {
      it("should reject invalid session ID format", async () => {
        const req = { headers: { "mcp-session-id": "invalid" }, body: {} };
        const res = createMockRes();
        postHandler(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
      });

      it("should reject if session exists as SSE", async () => {
        const sid = "00000000-0000-4000-8000-000000000000";
        mockState.sseTransports.set(sid, {} as any);
        const req = { headers: { "mcp-session-id": sid }, body: {} };
        const res = createMockRes();
        postHandler(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
      });

      it("should reject missing session ID if not an initialize request", async () => {
        const req = { headers: {}, body: { method: "other" } };
        const res = createMockRes();
        postHandler(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
      });

      it("should reject unauthorized session ID owner", async () => {
        const sid = "00000000-0000-4000-8000-000000000000";
        mockState.transports.set(sid, {} as any);
        mockState.sessionOwners.set(sid, "user1");
        const req = { headers: { "mcp-session-id": sid }, body: {}, auth: { sub: "user2" } };
        const res = createMockRes();
        postHandler(req, res);
        expect(res.status).toHaveBeenCalledWith(403);
      });

      it("should reject absolute TTL expired", async () => {
        const sid = "00000000-0000-4000-8000-000000000000";
        mockState.transports.set(sid, {} as any);
        mockState.sessionCreatedAt.set(sid, Date.now() - 25 * 3600000); // 25 hours
        const req = { headers: { "mcp-session-id": sid }, body: {} };
        const res = createMockRes();
        postHandler(req, res);
        expect(res.status).toHaveBeenCalledWith(401);
      });

      it("should reject if max sessions reached", async () => {
        mockState.config.maxSessions = 1;
        mockState.transports.set("some-sid", {} as any);
        const req = { headers: {}, body: { method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1" } } } };
        const res = createMockRes();
        postHandler(req, res);
        expect(res.status).toHaveBeenCalledWith(429);
      });

      it("should create new session successfully", async () => {
        const req = { headers: {}, body: { method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1" } } } };
        const res = createMockRes();
        vi.spyOn(mockState.mcpServer, "connect").mockResolvedValue(undefined);
        // The real Server instance has a 'server' property internally but might not have transport yet
        (mockState.mcpServer as any).server = { transport: undefined };
        
        await postHandler(req, res);
        
        // Wait for the simulated async initialization to populate transports
        await new Promise(r => setTimeout(r, 10));
        
        // After creation, transports map should have the new transport
        expect(mockState.transports.size).toBe(1);
        const newSid = Array.from(mockState.transports.keys())[0];
        expect(newSid).toBeDefined();
        
        // Also simulate transport close to cover onclose
        const transport = mockState.transports.get(newSid) as any;
        if (transport && transport.onclose) {
          transport.onclose();
        }
        expect(mockState.transports.size).toBe(0);
      });
    });

    describe("GET /mcp", () => {
      it("should reject missing/invalid session ID", () => {
        const req = { headers: {} };
        const res = createMockRes();
        getHandler(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
      });

      it("should reject unknown session ID", () => {
        const sid = "00000000-0000-4000-8000-000000000000";
        const req = { headers: { "mcp-session-id": sid } };
        const res = createMockRes();
        getHandler(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
      });

      it("should handle valid GET request", async () => {
        const sid = "00000000-0000-4000-8000-000000000000";
        const mockTransport = { handleRequest: vi.fn() } as any;
        mockState.transports.set(sid, mockTransport);
        const req = { headers: { "mcp-session-id": sid } };
        const res = createMockRes();
        getHandler(req, res);
        expect(mockTransport.handleRequest).toHaveBeenCalled();
      });
    });

    describe("DELETE /mcp", () => {
      it("should reject unknown session ID", () => {
        const sid = "00000000-0000-4000-8000-000000000000";
        const req = { headers: { "mcp-session-id": sid } };
        const res = createMockRes();
        deleteHandler(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
      });

      it("should handle valid DELETE request", async () => {
        const sid = "00000000-0000-4000-8000-000000000000";
        const mockTransport = { handleRequest: vi.fn() } as any;
        mockState.transports.set(sid, mockTransport);
        const req = { headers: { "mcp-session-id": sid } };
        const res = createMockRes();
        deleteHandler(req, res);
        expect(mockTransport.handleRequest).toHaveBeenCalled();
      });
    });
  });
});
