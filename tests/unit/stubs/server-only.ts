// Test stub for the `server-only` marker module.
//
// In the app, `import 'server-only'` is a build-time guard that makes the
// bundler fail if a server module is pulled into a client bundle. It has no
// runtime behaviour, so unit tests alias it to this empty module.
export {}
