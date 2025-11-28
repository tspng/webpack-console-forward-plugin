/**
 * webpack-console-forward-plugin
 * A Webpack plugin that forwards browser console logs to the webpack dev server console
 */

const fs = require("fs");
const http = require("http");
const webpack = require("webpack");

/**
 * HTTP server that receives console logs from the browser and writes them to a log file
 */
class ConsoleForwardServer {
  constructor(options = {}) {
    this.port = options.port || 9999;
    this.logFile = options.logFile || "dev.log";
    this.server = null;
  }

  start() {
    if (this.server) return;

    this.server = http.createServer((req, res) => {
      // Set CORS headers for all requests
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      // Handle preflight OPTIONS request
      if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
      }

      if (req.method !== "POST" || req.url !== "/api/debug/client-logs") {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
        return;
      }

      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });

      req.on("end", () => {
        try {
          const { logs } = JSON.parse(body);

          logs.forEach((log) => {
            const timestamp = new Date().toLocaleTimeString("en-US", {
              hour12: false,
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });

            const level = log.level.toUpperCase();
            const location = log.url ? ` (${log.url})` : "";
            let logLine = `${timestamp} browser\t| [${level}] ${log.message}${location}`;

            // Add stack traces
            if (log.stacks && log.stacks.length > 0) {
              log.stacks.forEach((stack) => {
                stack.split("\n").forEach((line) => {
                  logLine += `\n${timestamp} browser\t|     ${line}`;
                });
              });
            }

            // Add extra data
            if (log.extra && log.extra.length > 0) {
              logLine += `\n${timestamp} browser\t|     Extra data:`;
              const extraStr = JSON.stringify(log.extra, null, 2);
              extraStr.split("\n").forEach((line) => {
                logLine += `\n${timestamp} browser\t|     ${line}`;
              });
            }

            // Write to log file
            fs.appendFileSync(this.logFile, logLine + "\n");

            // Also output to console
            console.log(logLine);
          });

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        } catch (error) {
          console.error("Error processing client logs:", error);
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
    });

    this.server.listen(this.port, () => {
      console.log(`[Console Forward] Server listening on port ${this.port}`);
    });

    // Allow the process to exit naturally even if the server is listening
    this.server.unref();
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}

/**
 * Generates the client-side console forwarding code
 */
function generateConsoleForwardCode(port) {
  return `
// Console forwarding for development mode (injected by webpack)
(function() {
  if (typeof window === 'undefined') return;

  // Mark as injected to avoid duplicate injection
  window.__CONSOLE_FORWARD_INJECTED__ = true;

  // Only run once
  if (window.__CONSOLE_FORWARD_ACTIVE__) return;
  window.__CONSOLE_FORWARD_ACTIVE__ = true;

  var originalMethods = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    info: console.info.bind(console),
    debug: console.debug.bind(console),
  };

  var logBuffer = [];
  var flushTimeout = null;
  var FLUSH_DELAY = 100;
  var MAX_BUFFER_SIZE = 50;
  var ENDPOINT = 'http://localhost:${port}/api/debug/client-logs';

  function createLogEntry(level, args) {
    var stacks = [];
    var extra = [];

    var message = args.map(function(arg) {
      if (arg === undefined) return 'undefined';
      if (typeof arg === 'string') return arg;
      if (arg instanceof Error || typeof arg.stack === 'string') {
        var stringifiedError = arg.toString();
        if (arg.stack) {
          var stack = arg.stack.toString();
          if (stack.startsWith(stringifiedError)) {
            stack = stack.slice(stringifiedError.length).trimStart();
          }
          if (stack) {
            stacks.push(stack);
          }
        }
        return stringifiedError;
      }
      if (typeof arg === 'object' && arg !== null) {
        try {
          extra.push(JSON.parse(JSON.stringify(arg)));
        } catch (e) {
          extra.push(String(arg));
        }
        return '[extra#' + extra.length + ']';
      }
      return String(arg);
    }).join(' ');

    return {
      level: level,
      message: message,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      stacks: stacks,
      extra: extra,
    };
  }

  function sendLogs(logs) {
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logs: logs }),
    }).catch(function() {
      // Fail silently
    });
  }

  function flushLogs() {
    if (logBuffer.length === 0) return;
    var logsToSend = logBuffer.slice();
    logBuffer.length = 0;
    sendLogs(logsToSend);
    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
    }
  }

  function addToBuffer(entry) {
    logBuffer.push(entry);
    if (logBuffer.length >= MAX_BUFFER_SIZE) {
      flushLogs();
      return;
    }
    if (!flushTimeout) {
      flushTimeout = setTimeout(flushLogs, FLUSH_DELAY);
    }
  }

  // Patch console methods
  ['log', 'warn', 'error', 'info', 'debug'].forEach(function(level) {
    console[level] = function() {
      var args = Array.prototype.slice.call(arguments);
      originalMethods[level].apply(console, args);
      var entry = createLogEntry(level, args);
      addToBuffer(entry);
    };
  });

  // Cleanup handlers
  window.addEventListener('beforeunload', flushLogs);
  setInterval(flushLogs, 10000);

  console.log('[Console Forward] Browser console logs will be forwarded to dev.log');
})();
`;
}

/**
 * Webpack plugin for console forwarding
 */
class ConsoleForwardPlugin {
  constructor(options = {}) {
    this.options = {
      enabled: options.enabled !== undefined ? options.enabled : true,
      port: options.port || 9999,
      logFile: options.logFile || "dev.log",
      levels: options.levels || ["log", "warn", "error", "info", "debug"],
    };
    this.server = null;
  }

  apply(compiler) {
    // Only run in development mode
    const isDevMode = compiler.options.mode === "development";
    if (!isDevMode || !this.options.enabled) {
      return;
    }

    // Start the HTTP server
    compiler.hooks.afterEmit.tapAsync(
      "ConsoleForwardPlugin",
      (compilation, callback) => {
        if (!this.server) {
          this.server = new ConsoleForwardServer({
            port: this.options.port,
            logFile: this.options.logFile,
          });
          this.server.start();
        }
        callback();
      }
    );

    // Inject console forwarding code into all JS assets
    compiler.hooks.compilation.tap("ConsoleForwardPlugin", (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: "ConsoleForwardPlugin",
          stage: webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE,
        },
        (assets) => {
          Object.keys(assets).forEach((filename) => {
            if (filename.endsWith(".js")) {
              const asset = assets[filename];
              let source = asset.source();

              // Only inject once per file
              if (
                typeof source === "string" &&
                !source.includes("__CONSOLE_FORWARD_INJECTED__")
              ) {
                const consoleForwardCode = generateConsoleForwardCode(
                  this.options.port
                );
                source = consoleForwardCode + source;
                compilation.updateAsset(
                  filename,
                  new webpack.sources.RawSource(source)
                );
              }
            }
          });
        }
      );
    });
  }
}

module.exports = ConsoleForwardPlugin;
