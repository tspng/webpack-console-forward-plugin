# webpack-console-forward-plugin

A Webpack plugin that forwards browser console logs to your webpack dev server console.

## Installation

```bash
npm install --save-dev @tspng/webpack-console-forward-plugin
```

## Usage

Add to your `webpack.config.js`:

```javascript
const ConsoleForwardPlugin = require('@tspng/webpack-console-forward-plugin');

module.exports = {
  // ...
  plugins: [
    new ConsoleForwardPlugin({
      enabled: true,       // Optional: Enable/disable (default: true)
      port: 9999,          // Optional: Server port (default: 9999)
      logFile: 'dev.log',  // Optional: Log file path (default: 'dev.log')
    }),
  ],
};
```

> [!NOTE]
> The plugin processes logs only when webpack `mode` is set to `development`.

## Features

- **Forwarding:** Intercepts `console.log`, `warn`, `error`, `info`, and `debug` and sends them to your terminal.
- **Buffering:** Logs are batched to minimize network traffic.
- **Zero Overhead in Prod:** Automatically disabled in non-development builds.
- **Mobile Debugging:** useful for debugging on devices without accessible dev tools.

## Credits

Adapted from Armin Ronacher's [vite-console-forward-plugin](https://github.com/mitsuhiko/vite-console-forward-plugin).

## License

MIT
