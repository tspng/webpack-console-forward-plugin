const fs = require("fs");
const http = require("http");
const ConsoleForwardPlugin = require("./index");

// Access the internals via the underscore properties
const ConsoleForwardServer = ConsoleForwardPlugin._ConsoleForwardServer;
const generateConsoleForwardCode =
  ConsoleForwardPlugin._generateConsoleForwardCode;

// Mock fs to prevent actual file writing during tests
jest.mock("fs", () => ({
  appendFileSync: jest.fn(),
}));

// Suppress console output during tests
const originalConsole = { ...console };
beforeAll(() => {
  global.console = {
    ...console,
    log: jest.fn(),
    error: jest.fn(),
  };
});

afterAll(() => {
  global.console = originalConsole;
});

describe("webpack-console-forward-plugin", () => {
  describe("ConsoleForwardPlugin Configuration", () => {
    test("should apply default options", () => {
      const plugin = new ConsoleForwardPlugin();
      expect(plugin.options.enabled).toBe(true);
      expect(plugin.options.port).toBe(9999);
      expect(plugin.options.logFile).toBe("dev.log");
      expect(plugin.options.levels).toEqual([
        "log",
        "warn",
        "error",
        "info",
        "debug",
      ]);
    });

    test("should allow overriding options", () => {
      const plugin = new ConsoleForwardPlugin({
        enabled: false,
        port: 3000,
        logFile: "test.log",
        levels: ["error"],
      });
      expect(plugin.options.enabled).toBe(false);
      expect(plugin.options.port).toBe(3000);
      expect(plugin.options.logFile).toBe("test.log");
      expect(plugin.options.levels).toEqual(["error"]);
    });

    test("should handle partial options", () => {
      const plugin = new ConsoleForwardPlugin({ port: 8080 });
      expect(plugin.options.enabled).toBe(true);
      expect(plugin.options.port).toBe(8080);
      expect(plugin.options.logFile).toBe("dev.log");
    });
  });

  describe("generateConsoleForwardCode", () => {
    test("should inject the correct port into client code", () => {
      const code = generateConsoleForwardCode(1234);
      expect(code).toContain("http://localhost:1234/api/debug/client-logs");
    });

    test("should include injection guard", () => {
      const code = generateConsoleForwardCode(9999);
      expect(code).toContain("window.__CONSOLE_FORWARD_INJECTED__ = true");
    });

    test("should include active guard to prevent double execution", () => {
      const code = generateConsoleForwardCode(9999);
      expect(code).toContain("window.__CONSOLE_FORWARD_ACTIVE__");
    });

    test("should patch all console methods", () => {
      const code = generateConsoleForwardCode(9999);
      expect(code).toContain("'log', 'warn', 'error', 'info', 'debug'");
    });
  });

  describe("ConsoleForwardServer", () => {
    let serverInstance;
    const testPort = 19876; // Use a high port unlikely to conflict

    beforeEach(() => {
      jest.clearAllMocks();
      serverInstance = new ConsoleForwardServer({
        port: testPort,
        logFile: "test-output.log",
      });
      serverInstance.start();
    });

    afterEach((done) => {
      serverInstance.stop();
      // Small delay to ensure port is released
      setTimeout(done, 50);
    });

    test("should use default options when not provided", () => {
      const defaultServer = new ConsoleForwardServer();
      expect(defaultServer.port).toBe(9999);
      expect(defaultServer.logFile).toBe("dev.log");
    });

    test("should handle log POST requests correctly", (done) => {
      const logData = {
        logs: [
          {
            level: "info",
            message: "Hello World",
            url: "http://localhost/test",
            timestamp: new Date().toISOString(),
          },
        ],
      };

      const req = http.request(
        {
          hostname: "localhost",
          port: testPort,
          path: "/api/debug/client-logs",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        },
        (res) => {
          expect(res.statusCode).toBe(200);

          let responseBody = "";
          res.on("data", (chunk) => {
            responseBody += chunk;
          });

          res.on("end", () => {
            expect(JSON.parse(responseBody)).toEqual({ success: true });

            // Check if fs.appendFileSync was called with correct content
            expect(fs.appendFileSync).toHaveBeenCalled();
            const writtenContent = fs.appendFileSync.mock.calls[0][1];
            expect(writtenContent).toContain("[INFO] Hello World");
            expect(writtenContent).toContain("(http://localhost/test)");

            done();
          });
        },
      );

      req.write(JSON.stringify(logData));
      req.end();
    });

    test("should handle multiple log levels", (done) => {
      const logData = {
        logs: [
          {
            level: "warn",
            message: "Warning message",
            timestamp: new Date().toISOString(),
          },
          {
            level: "error",
            message: "Error message",
            timestamp: new Date().toISOString(),
          },
        ],
      };

      const req = http.request(
        {
          hostname: "localhost",
          port: testPort,
          path: "/api/debug/client-logs",
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
        (res) => {
          expect(res.statusCode).toBe(200);

          res.on("end", () => {
            expect(fs.appendFileSync).toHaveBeenCalledTimes(2);

            const firstCall = fs.appendFileSync.mock.calls[0][1];
            const secondCall = fs.appendFileSync.mock.calls[1][1];

            expect(firstCall).toContain("[WARN]");
            expect(secondCall).toContain("[ERROR]");

            done();
          });

          res.resume(); // Consume response data
        },
      );

      req.write(JSON.stringify(logData));
      req.end();
    });

    test("should handle OPTIONS preflight requests", (done) => {
      const req = http.request(
        {
          hostname: "localhost",
          port: testPort,
          path: "/api/debug/client-logs",
          method: "OPTIONS",
        },
        (res) => {
          expect(res.statusCode).toBe(200);
          expect(res.headers["access-control-allow-origin"]).toBe("*");
          expect(res.headers["access-control-allow-methods"]).toBe(
            "POST, OPTIONS",
          );
          done();
        },
      );
      req.end();
    });

    test("should reject invalid paths with 404", (done) => {
      const req = http.request(
        {
          hostname: "localhost",
          port: testPort,
          path: "/api/invalid-endpoint",
          method: "POST",
        },
        (res) => {
          expect(res.statusCode).toBe(404);
          done();
        },
      );
      req.end();
    });

    test("should reject GET requests with 404", (done) => {
      const req = http.request(
        {
          hostname: "localhost",
          port: testPort,
          path: "/api/debug/client-logs",
          method: "GET",
        },
        (res) => {
          expect(res.statusCode).toBe(404);
          done();
        },
      );
      req.end();
    });

    test("should handle invalid JSON with 400", (done) => {
      const req = http.request(
        {
          hostname: "localhost",
          port: testPort,
          path: "/api/debug/client-logs",
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
        (res) => {
          expect(res.statusCode).toBe(400);

          let responseBody = "";
          res.on("data", (chunk) => {
            responseBody += chunk;
          });

          res.on("end", () => {
            expect(JSON.parse(responseBody)).toEqual({ error: "Invalid JSON" });
            done();
          });
        },
      );

      req.write("not valid json");
      req.end();
    });

    test("should handle logs with stack traces", (done) => {
      const logData = {
        logs: [
          {
            level: "error",
            message: "Error: Something failed",
            timestamp: new Date().toISOString(),
            stacks: ["at foo (file.js:10:5)", "at bar (file.js:20:10)"],
          },
        ],
      };

      const req = http.request(
        {
          hostname: "localhost",
          port: testPort,
          path: "/api/debug/client-logs",
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
        (res) => {
          expect(res.statusCode).toBe(200);

          res.on("end", () => {
            const writtenContent = fs.appendFileSync.mock.calls[0][1];
            expect(writtenContent).toContain("at foo (file.js:10:5)");
            expect(writtenContent).toContain("at bar (file.js:20:10)");
            done();
          });

          res.resume();
        },
      );

      req.write(JSON.stringify(logData));
      req.end();
    });

    test("should handle logs with extra data", (done) => {
      const logData = {
        logs: [
          {
            level: "log",
            message: "Object logged",
            timestamp: new Date().toISOString(),
            extra: [{ key: "value", nested: { data: 123 } }],
          },
        ],
      };

      const req = http.request(
        {
          hostname: "localhost",
          port: testPort,
          path: "/api/debug/client-logs",
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
        (res) => {
          expect(res.statusCode).toBe(200);

          res.on("end", () => {
            const writtenContent = fs.appendFileSync.mock.calls[0][1];
            expect(writtenContent).toContain("Extra data:");
            expect(writtenContent).toContain('"key": "value"');
            done();
          });

          res.resume();
        },
      );

      req.write(JSON.stringify(logData));
      req.end();
    });

    test("should not start a second server if already running", () => {
      const initialServer = serverInstance.server;
      serverInstance.start(); // Call start again
      expect(serverInstance.server).toBe(initialServer); // Same instance
    });

    test("should handle stop when server is not running", () => {
      const newServer = new ConsoleForwardServer({ port: 19877 });
      // Don't start it, just stop - should not throw
      expect(() => newServer.stop()).not.toThrow();
    });
  });
});
