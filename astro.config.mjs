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
        globPatterns: ['**/*.{html,js,css,svg,png,woff2}'],
        navigateFallback: null,
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
})
