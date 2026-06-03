import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setupStatefulEndpoints, touchSession } from "../../src/transports/http/sessions/stateful.js";
import type { HttpTransportState } from "../../src/transports/http/types.js";
import {
  SESSION_TIMEOUT_MS,
  SESSION_SWEEP_INTERVAL_MS,
  SESSION_ABSOLUTE_TTL_MS,
} from "../../src/transports/http/types.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

// Mock the Express app
const mockApp = {
  post: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
};

// Mock the MCP Server
const mockMcpServer = {
  server: { transport: null },
  connect: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
};

describe("Session Timeout Enforcement", () => {
  let state: HttpTransportState;
  let timer: ReturnType<typeof setInterval>;

  beforeEach(() => {
    vi.useFakeTimers();

    state = {
      config: {
        port: 3000,
        oauth: { enabled: false } as any,
      },
      app: mockApp as any,
      httpServer: null,
      transports: new Map(),
      sseTransports: new Map(),
      sessionOwners: new Map(),
      sessionLastActivity: new Map(),
      sessionCreatedAt: new Map(),
      sessionLocks: new Map(),
      statelessTransport: null,
      resourceServer: null,
      authServerDiscovery: null,
      tokenValidator: null,
      mcpServer: mockMcpServer as any,
    };

    // Initialize the stateful endpoints (which starts the sweep timer)
    timer = setupStatefulEndpoints(state);
  });

  afterEach(() => {
    clearInterval(timer);
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("should expire idle HTTP sessions after SESSION_TIMEOUT_MS", () => {
    const sessionId = "test-session-1";
    
    // Setup a mock transport
    const mockTransport = { close: vi.fn() } as unknown as StreamableHTTPServerTransport;
    state.transports.set(sessionId, mockTransport);
    
    // Simulate activity just now
    touchSession(state, sessionId);
    
    // Advance time by 29 minutes (less than timeout)
    vi.advanceTimersByTime(29 * 60 * 1000);
    
    // Session should still exist
    expect(state.transports.has(sessionId)).toBe(true);
    expect(mockTransport.close).not.toHaveBeenCalled();
    
    // Advance past timeout + sweep interval
    vi.advanceTimersByTime(2 * 60 * 1000); // Total 31 mins
    
    // Session should be closed (timer calls close, the onclose handler in real life removes from map)
    expect(mockTransport.close).toHaveBeenCalled();
  });

  it("should not expire active sessions", () => {
    const sessionId = "test-session-2";
    const mockTransport = { close: vi.fn() } as unknown as StreamableHTTPServerTransport;
    state.transports.set(sessionId, mockTransport);
    
    touchSession(state, sessionId);
    
    // Advance 20 mins
    vi.advanceTimersByTime(20 * 60 * 1000);
    
    // Touch session (activity!)
    touchSession(state, sessionId);
    
    // Advance another 20 mins (total 40 mins since creation, but only 20 mins idle)
    vi.advanceTimersByTime(20 * 60 * 1000);
    
    expect(mockTransport.close).not.toHaveBeenCalled();
  });

  it("should skip sessions with active locks (in-flight requests)", () => {
    const sessionId = "test-session-3";
    const mockTransport = { close: vi.fn() } as unknown as StreamableHTTPServerTransport;
    state.transports.set(sessionId, mockTransport);
    
    touchSession(state, sessionId);
    
    // Set lock
    state.sessionLocks.set(sessionId, 1);
    
    // Advance past timeout
    vi.advanceTimersByTime(31 * 60 * 1000);
    
    // Should NOT be closed because it's locked
    expect(mockTransport.close).not.toHaveBeenCalled();
    
    // Release lock
    state.sessionLocks.delete(sessionId);
    
    // Advance to next sweep
    vi.advanceTimersByTime(SESSION_SWEEP_INTERVAL_MS);
    
    // Now it should be closed
    expect(mockTransport.close).toHaveBeenCalled();
  });

  it("should expire idle SSE sessions", () => {
    const sessionId = "test-sse-1";
    const mockSseTransport = { close: vi.fn() } as unknown as SSEServerTransport;
    state.sseTransports.set(sessionId, mockSseTransport);
    
    touchSession(state, sessionId);
    
    vi.advanceTimersByTime(31 * 60 * 1000);
    
    expect(mockSseTransport.close).toHaveBeenCalled();
  });
});
