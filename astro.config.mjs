// @ts-check
import svelte from '@astrojs/svelte'
import { AstroPWAIntegration } from '@vite-pwa/astro'
import { defineConfig } from 'astro/config'

const base = '/vector/'
/** The sync server (ADR 0005): the only origin the app may talk to besides itself. */
const syncOrigin = 'https://gjerxjpchkyuddjiobze.supabase.co'

export default defineConfig({
  site: 'https://krishnapilato.github.io',
  base,
  output: 'static',
  trailingSlash: 'ignore',
  markdown: { syntaxHighlight: false },
  // The browser itself refuses any other connection: camera data cannot leave (ADR 0006).
  security: {
    csp: {
      algorithm: 'SHA-256',
      directives: [
        "default-src 'self'",
        `connect-src 'self' ${syncOrigin}`,
        "img-src 'self' data: blob:",
        "font-src 'self'",
        "media-src 'self' blob: mediastream:",
        "worker-src 'self' blob:",
        "manifest-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'none'",
      ],
      scriptDirective: { resources: ["'self'", "'wasm-unsafe-eval'"] },
      styleDirective: {
        resources: [
          { resource: "'self'", kind: 'element' },
          { resource: "'unsafe-inline'", kind: 'attribute' },
        ],
      },
    },
  },
  integrations: [
    svelte(),
    AstroPWAIntegration({
      registerType: 'autoUpdate',
      includeManifestIcons: false,
      injectRegister: false,
      manifest: {
        name: 'Vector',
        short_name: 'Vector',
        description: 'A calm study companion for the EASA PPL(A) theory.',
        lang: 'en',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#f8f6f1',
        theme_color: '#f8f6f1',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      generateSW: {
        // App, fonts, the face model and its WASM: everything works offline (PIANO-V3 §12).
        globPatterns: ['**/*.{html,js,css,svg,png,woff2}'],
        globIgnores: ['**/*.woff', 'models/**'],
        // The face model and WASM (~18 MB) are cached on first use, when the camera is turned
        // on (lib/camera.ts warmModels): from then on the camera works offline too.
        runtimeCaching: [
          {
            // Serialised into the service worker: no closure over `base`.
            urlPattern: ({ url }) => url.pathname.startsWith('/vector/models/'),
            handler: 'CacheFirst',
            options: { cacheName: 'vector-models', cacheableResponse: { statuses: [200] } },
          },
        ],
        navigateFallback: null,
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
})
