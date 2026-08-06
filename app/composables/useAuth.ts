// ========================================================
// 管理員身分驗證與 Session Composable (useAuth.ts)
// ========================================================
import { ref, computed } from 'vue'

export interface AdminUser {
  id: number
  username: string
  role: string
}

const adminUser = ref<AdminUser | null>(null)
const isCheckingAuth = ref<boolean>(true)
const isInitialized = ref<boolean>(false)

export function useAuth() {
  const config = useRuntimeConfig()
  const backendUrl = config.public.backendUrl

  const isAuthenticated = computed(() => !!adminUser.value)

  /**
   * 1. 檢查當前 Session 身分狀態 (GET /api/admin/me)
   */
  const checkAuth = async (): Promise<boolean> => {
    try {
      const res = await fetch(`${backendUrl}/api/admin/me`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success && data.data?.admin) {
          adminUser.value = data.data.admin
          return true
        }
      }
      adminUser.value = null
      return false
    } catch (e) {
      console.error('Check auth error:', e)
      adminUser.value = null
      return false
    } finally {
      isCheckingAuth.value = false
      isInitialized.value = true
    }
  }

  /**
   * 2. 管理員登入 (POST /api/admin/login)
   */
  const login = async (username: string, password: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await fetch(`${backendUrl}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      })

      const data = await res.json()

      if (res.ok && data.success) {
        adminUser.value = data.data?.admin || { id: 1, username, role: 'admin' }
        return { success: true, message: data.message || '登入成功' }
      } else {
        return { success: false, message: data.error || data.message || '帳號或密碼錯誤' }
      }
    } catch (e: any) {
      return { success: false, message: '連線失敗，請確認後端 API 伺服器狀態' }
    }
  }

  /**
   * 3. 管理員登出 (POST /api/admin/logout)
   */
  const logout = async () => {
    try {
      await fetch(`${backendUrl}/api/admin/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      })
    } catch (e) {
      console.error('Logout error:', e)
    } finally {
      adminUser.value = null
      useRouter().push('/login')
    }
  }

  return {
    adminUser,
    isAuthenticated,
    isCheckingAuth,
    isInitialized,
    checkAuth,
    login,
    logout
  }
}
