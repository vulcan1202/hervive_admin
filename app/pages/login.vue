<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '../composables/useAuth'

definePageMeta({
  layout: false
})

const { login } = useAuth()
const router = useRouter()

const username = ref('')
const password = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const handleLogin = async () => {
  if (!username.value || !password.value) {
    errorMessage.value = '請輸入帳號與密碼！'
    return
  }

  isLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const res = await login(username.value.trim(), password.value)

    if (res.success) {
      successMessage.value = '✅ 驗證成功，正在登入系統...'
      setTimeout(() => {
        router.push('/')
      }, 500)
    } else {
      errorMessage.value = res.message || '帳號或密碼錯誤，請重新輸入'
    }
  } catch (e: any) {
    errorMessage.value = '系統連線異常，請稍後再試'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen w-full bg-[#FAF4EE] flex items-center justify-center p-4 relative overflow-hidden font-sans">
    
    <!-- 背景裝飾光暈 -->
    <div class="absolute -top-32 -left-32 w-96 h-96 bg-[#154337]/10 rounded-full blur-3xl pointer-events-none"></div>
    <div class="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

    <!-- 主卡片 (Double-Bezel 7/5/8 高奢外框) -->
    <div class="w-full max-w-md p-1.5 bg-[#154337]/10 border border-[#154337]/15 rounded-3xl shadow-2xl relative z-10 backdrop-blur-md">
      <div class="bg-white rounded-[calc(1.5rem-0.375rem)] p-6 sm:p-8 space-y-6">
        
        <!-- Header: Logo 與抬頭 -->
        <div class="text-center space-y-2">
          <div class="inline-flex items-center justify-center p-3 bg-[#FAF4EE] rounded-2xl border border-[#154337]/15 shadow-xs mb-1">
            <img src="/hervive.png" alt="Hervive Logo" class="h-8 w-auto object-contain" />
          </div>
          <h1 class="text-2xl font-black text-[#154337] tracking-tight font-serif">後台管理系統登入</h1>
          <p class="text-xs text-gray-500">Hervive Cloud Administrative Portal</p>
        </div>

        <!-- 錯誤 / 成功提示 Banner -->
        <div v-if="errorMessage" class="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 font-medium animate-headshake">
          <Icon name="mdi:alert-circle" class="text-base text-rose-600 shrink-0" />
          <span>{{ errorMessage }}</span>
        </div>

        <div v-if="successMessage" class="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 font-medium">
          <Icon name="mdi:check-circle" class="text-base text-emerald-600 shrink-0" />
          <span>{{ successMessage }}</span>
        </div>

        <!-- 表單內容 -->
        <form @submit.prevent="handleLogin" class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Icon name="mdi:account-outline" class="text-sm text-[#154337]" />
              管理員帳號 (Username)
            </label>
            <input 
              v-model="username" 
              type="text" 
              required 
              placeholder="請輸入管理員帳號"
              class="w-full bg-[#FAF4EE]/50 border border-[#154337]/20 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#154337] focus:bg-white transition" 
            />
          </div>

          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Icon name="mdi:lock-outline" class="text-sm text-[#154337]" />
              安全密碼 (Argon2id Encrypted)
            </label>
            <input 
              v-model="password" 
              type="password" 
              required 
              placeholder="請輸入密碼"
              class="w-full bg-[#FAF4EE]/50 border border-[#154337]/20 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#154337] focus:bg-white transition" 
            />
          </div>

          <button 
            type="submit" 
            :disabled="isLoading"
            class="w-full py-3 bg-[#154337] text-white rounded-xl text-sm font-bold hover:bg-[#0e2f27] transition shadow-md flex items-center justify-center gap-2 active:scale-98 cursor-pointer disabled:opacity-60"
          >
            <Icon v-if="isLoading" name="mdi:loading" class="animate-spin text-base" />
            <span>{{ isLoading ? '身份驗證中...' : '安全登入系統' }}</span>
          </button>
        </form>

        <!-- 底部安全標示 -->
        <div class="pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
          <span class="flex items-center gap-1">
            <Icon name="mdi:shield-check" class="text-emerald-600" />
            Argon2id Encrypted Session
          </span>
          <span class="font-mono text-[10px] text-gray-400">Hervive Auth v2.4</span>
        </div>

      </div>
    </div>

  </div>
</template>
