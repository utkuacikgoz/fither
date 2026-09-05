// Expo's default Metro config, wrapped by Sentry so release bundles carry
// debug ids and the source maps EAS uploads symbolicate (ADR-0016).
// Without a DSN the wrapper changes nothing at runtime.
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

module.exports = getSentryExpoConfig(__dirname);
