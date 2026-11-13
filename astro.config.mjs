// @ts-check
import svelte from '@astrojs/svelte'
import { AstroPWAIntegration } from '@vite-pwa/astro'
import { defineConfig } from 'astro/config'

const base = '/vector/'

export default defineConfig({
  site: 'https://krishnapilato.github.io',
  base,
  output: 'static',
  trailingSlash: 'ignore',
  markdown: { syntaxHighlight: false },
  // Zero-network by construction (PIANO-V3-LITE §2.1, ADR 0006): the browser itself refuses any
  // connection to another address, so nothing could leave the device even by mistake.
  security: {
    csp: {
      algorithm: 'SHA-256',
      directives: [
        "default-src 'self'",
        "connect-src 'self'",
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
        description: 'Privacy-first focus sessions. The camera stays on your device.',
        lang: 'en',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#f6f6f7',
        theme_color: '#f6f6f7',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      generateSW: {
        // App and fonts are precached: the app works offline after the first visit.
        globPatterns: ['**/*.{html,js,css,svg,png,woff2}'],
        globIgnores: ['**/*.woff', 'models/**'],
        // The face model and WASM (~18 MB) are cached in the background on the first visit
        // (lib/warm.ts), too big for the precache step: from then on the camera works offline.
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
