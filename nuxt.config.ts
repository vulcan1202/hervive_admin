// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  css: ['~/css/main.css'],
  modules: [
    '@nuxt/icon',
    '@nuxtjs/tailwindcss',
  ],
  tailwindcss: {
    
  },
  icon: {
    // 讓伺服器優先使用本地資料
    serverBundle: {
      collections: ['mdi']
    },
    // 可選：掃描元件並把用到的圖示打包進 client
    clientBundle: {
      scan: true
    }
  },

  nitro: {
    prerender: {
      autoSubfolderIndex: false
    }
  },

  build: {
    transpile: ['@vuepic/vue-datepicker']
  },

  runtimeConfig: {
    public: {
      // 🌟 修正：為了避免某些環境下自動替換失敗，改為明確要求讀取 process.env，並加上 || '' 作為安全防呆
      backendUrl: process.env.NUXT_PUBLIC_BACKEND_URL || '', 
      lineChannelId: process.env.NUXT_PUBLIC_LINE_CHANNEL_ID || '' ,
    }
  },
})