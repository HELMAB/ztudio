import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/tailwind.css'],

  app: {
    head: {
      htmlAttrs: { class: 'dark', lang: 'en' },
      title: 'ztudio — audio to captioned video',
      meta: [
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1.0, viewport-fit=cover',
        },
        { name: 'theme-color', content: '#2a2a30' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Khmer:wght@400;700&display=swap',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Kantumruy+Pro:wght@400;500;600;700&display=swap',
        },
      ],
    },
  },

  vite: {
    plugins: [tailwindcss()],
  },

  modules: ['@nuxt/eslint', '@pinia/nuxt', 'shadcn-nuxt', '@nuxtjs/i18n', '@vite-pwa/nuxt'],

  pwa: {
    registerType: 'autoUpdate',
    pwaAssets: {
      preset: 'minimal-2023',
      image: 'public/logo.svg',
    },
    manifest: {
      id: '/',
      name: 'ztudio — audio to captioned video',
      short_name: 'ztudio',
      description:
        'Turn audio, an image and captions into a captioned video — entirely in your browser.',
      lang: 'en',
      theme_color: '#00b140',
      background_color: '#ffffff',
      display: 'standalone',
      start_url: '/',
      scope: '/',
      categories: ['video', 'productivity', 'multimedia'],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
      cleanupOutdatedCaches: true,
      clientsClaim: true,
      runtimeCaching: [
        {
          urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
          handler: 'StaleWhileRevalidate',
          options: { cacheName: 'google-fonts-stylesheets' },
        },
        {
          urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
          handler: 'CacheFirst',
          options: {
            cacheName: 'google-fonts-webfonts',
            expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          // Bundled Khmer .ttf files are loaded on demand, not precached.
          urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/fonts/'),
          handler: 'CacheFirst',
          options: {
            cacheName: 'khmer-fonts',
            expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 365 },
          },
        },
        {
          // mediabunny WebCodecs library, loaded at render time from a CDN.
          urlPattern: ({ url }) =>
            url.origin === 'https://esm.sh' || url.origin === 'https://cdn.jsdelivr.net',
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'mediabunny-cdn',
            cacheableResponse: { statuses: [0, 200] },
          },
        },
      ],
    },
    devOptions: {
      enabled: true,
      suppressWarnings: true,
      navigateFallbackAllowlist: [/^\/$/],
      type: 'module',
    },
  },

  i18n: {
    bundle: { optimizeTranslationDirective: false },
    strategy: 'no_prefix',
    defaultLocale: 'en',
    locales: [
      { code: 'en', name: 'English', file: 'en.json' },
      { code: 'km', name: 'ខ្មែរ', file: 'km.json' },
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'ztudio_locale',
      redirectOn: 'root',
    },
  },

  shadcn: {
    /** Prefix for all the imported component */
    prefix: '',
    /** Directory that the component lives in. */
    componentDir: './app/components/ui',
  },
})
