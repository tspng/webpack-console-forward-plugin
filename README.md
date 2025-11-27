# webpack-console-forward-plugin

A Webpack plugin that forwards browser console logs to your webpack dev server console for better debugging experience during development.

## What it does

This plugin intercepts browser console logs (`console.log`, `console.warn`, `console.error`, etc.) and forwards them to your webpack dev server console. This is particularly useful when:

- Debugging client-side JavaScript in environments where browser dev tools aren't easily accessible
- You want to see all application logs in one place (terminal/IDE)
- Working with mobile devices or embedded browsers
- Running automated tests and want console output in your CI logs

## Installation

### As a local package

Create a directory in your project:

```bash
mkdir -p webpack-console-forward-plugin
```

Copy `index.js` and `package.json` into that directory, then install it locally:

```bash
npm install ./webpack-console-forward-plugin
```

<!--
### As a published npm package

```bash
npm install @tspng/webpack-console-forward-plugin --save-dev
```
-->

## Usage

Add the plugin to your `webpack.config.js`:

```javascript
const ConsoleForwardPlugin = require('@tspng/webpack-console-forward-plugin');

module.exports = {
  // ... your webpack config
  plugins: [
    new ConsoleForwardPlugin({
      // Enable console forwarding (default: true)
      enabled: true,

      // Port for the log server (default: 9999)
      port: 9999,

      // Log file path (default: 'dev.log')
      logFile: 'dev.log',

      // Which console levels to forward (default: all)
      levels: ['log', 'warn', 'error', 'info', 'debug'],
    }),
  ],
};
```

### Minimal example

```javascript
const ConsoleForwardPlugin = require('webpack-console-forward-plugin');

module.exports = (env, argv) => {
  const isDevMode = argv.mode === 'development';

  return {
    mode: argv.mode,
    entry: './src/index.js',
    plugins: [
      // Only enable in development
      isDevMode && new ConsoleForwardPlugin(),
    ].filter(Boolean),
  };
};
```

## Configuration

| Option    | Type       | Default     | Description |
|-----------|------------|-------------|-------------|
| `enabled` | `boolean`  | `true`      | Whether to enable console forwarding |
| `port`    | `number`   | `9999`      | Port for the HTTP server that receives logs |
| `logFile` | `string`   | `"dev.log"` | Path to the log file |
| `levels`  | `string[]` | `["log", "warn", "error", "info", "debug"]` | Console levels to forward |

## How it works

1. **Client-side injection**: The plugin automatically injects code into your webpack bundles that patches browser console methods
2. **Buffering**: Console logs are buffered and sent in batches to reduce network overhead
3. **Server-side logging**: A lightweight HTTP server receives the logs and writes them to your log file
4. **Formatting**: Logs maintain their original formatting and include stack traces for errors
5. **Error handling**: Network failures are handled gracefully without breaking your application

## Development mode only

The plugin automatically detects when webpack is running in development mode and only activates then. In production builds:

- The HTTP server never starts
- No code is injected into your bundles
- Zero overhead

## Example output

When you run your webpack dev server, browser console logs will appear like this:

```
14:23:45 browser  | [LOG] Application started (http://localhost:3000/)
14:23:47 browser  | [WARN] API deprecated (http://localhost:3000/app)
14:23:50 browser  | [ERROR] Failed to load data (http://localhost:3000/app)
14:23:50 browser  |     at fetch (app.js:123:45)
14:23:50 browser  |     at loadData (app.js:98:12)
14:23:50 browser  |     Extra data:
14:23:50 browser  |     {
14:23:50 browser  |       "status": 404,
14:23:50 browser  |       "url": "/api/data"
14:23:50 browser  |     }
```

## Inspired by

This plugin is inspired by [vite-console-forward-plugin](https://github.com/mitsuhiko/vite-console-forward-plugin) and brings the same functionality to plain Javascript projects using Webpack.

## License

MIT

## Contributing

Issues and pull requests are welcome.
