import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/tailwind.css'],

  app: {
    head: {
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Khmer:wght@400;700&display=swap',
        },
      ],
    },
  },

  vite: {
    plugins: [tailwindcss()],
  },

  modules: ['@nuxt/eslint', '@pinia/nuxt', 'shadcn-nuxt'],

  shadcn: {
    /** Prefix for all the imported component */
    prefix: '',
    /** Directory that the component lives in. */
    componentDir: './app/components/ui',
  },
})
