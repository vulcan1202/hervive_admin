// ========================================================
// 全域路由守衛 (middleware/auth.global.ts)
// 未登入使用者強制重定向至 /login，已登入使用者存取 /login 時自動導至首頁
// ========================================================
import { useAuth } from '../composables/useAuth'

export default defineNuxtRouteMiddleware(async (to) => {
  // 只在客戶端執行 Session 驗證 (避免 SSR / SSG 跨站 cookie 問題)
  if (import.meta.server) return

  const { isAuthenticated, checkAuth, isInitialized } = useAuth()

  // 第一次載入時向後端驗證 Session
  if (!isInitialized.value) {
    await checkAuth()
  }

  // 1. 如果前往登入頁面 (/login)
  if (to.path === '/login') {
    if (isAuthenticated.value) {
      return navigateTo('/', { replace: true })
    }
    return
  }

  // 2. 前往其他後台系統頁面 -> 未驗證身份時即刻跳轉至 /login
  if (!isAuthenticated.value) {
    return navigateTo('/login', { replace: true })
  }
})
