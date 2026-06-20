import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/tailwind.css'],

  app: {
    head: {
      title: 'ztudio — audio to captioned video',
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Khmer:wght@400;700&display=swap',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;500;600;700;800&family=Kantumruy+Pro:wght@400;500;600;700&display=swap',
        },
      ],
    },
  },

  vite: {
    plugins: [tailwindcss()],
  },

  modules: ['@nuxt/eslint', '@pinia/nuxt', 'shadcn-nuxt', '@nuxtjs/i18n'],

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
