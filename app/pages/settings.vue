<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const config = useRuntimeConfig()
const backendUrl = config.public.backendUrl

interface Beautician {
  id: number
  name: string
}

// 狀態宣告
const beauticians = ref<Beautician[]>([])
const isLoading = ref(true)
const searchQuery = ref('')
const toastMessage = ref('')
const toastType = ref<'success' | 'error'>('success')

// Modal 控制狀態
const showAddModal = ref(false)
const showEditModal = ref(false)
const showDeleteModal = ref(false)

const newBeauticianName = ref('')
const editingBeautician = ref<Beautician | null>(null)
const deletingBeautician = ref<Beautician | null>(null)
const isSubmitting = ref(false)

// Toast 提示框函式
const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
  toastMessage.value = msg
  toastType.value = type
  setTimeout(() => {
    toastMessage.value = ''
  }, 3000)
}

// 載入美容師清單
const fetchBeauticians = async () => {
  isLoading.value = true
  try {
    const res = await fetch(`${backendUrl}/api/beauticians`)
    if (res.ok) {
      const data = await res.json()
      beauticians.value = data.data || []
    } else {
      showToast('載入美容師資料失敗', 'error')
    }
  } catch (e) {
    console.error('Fetch beauticians error:', e)
    showToast('網路連線異常，請稍後再試', 'error')
  } finally {
    isLoading.value = false
  }
}

// 搜尋過濾
const filteredBeauticians = computed(() => {
  if (!searchQuery.value.trim()) return beauticians.value
  const q = searchQuery.value.toLowerCase().trim()
  return beauticians.value.filter(b => b.name.toLowerCase().includes(q) || String(b.id).includes(q))
})

// 新增美容師
const handleAddBeautician = async () => {
  if (!newBeauticianName.value.trim()) {
    showToast('請輸入美容師姓名', 'error')
    return
  }

  isSubmitting.value = true
  try {
    const res = await fetch(`${backendUrl}/api/beauticians`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newBeauticianName.value.trim() })
    })

    const data = await res.json()
    if (res.ok && data.success) {
      showToast('新增美容師成功！', 'success')
      newBeauticianName.value = ''
      showAddModal.value = false
      await fetchBeauticians()
    } else {
      showToast(data.message || '新增失敗', 'error')
    }
  } catch (e) {
    console.error('Add beautician error:', e)
    showToast('系統發生錯誤，無法完成新增', 'error')
  } finally {
    isSubmitting.value = false
  }
}

// 開啟編輯視窗
const openEditModal = (b: Beautician) => {
  editingBeautician.value = { ...b }
  showEditModal.value = true
}

// 更新美容師
const handleUpdateBeautician = async () => {
  if (!editingBeautician.value || !editingBeautician.value.name.trim()) {
    showToast('美容師姓名不能為空', 'error')
    return
  }

  isSubmitting.value = true
  try {
    const res = await fetch(`${backendUrl}/api/beauticians`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editingBeautician.value.id,
        name: editingBeautician.value.name.trim()
      })
    })

    const data = await res.json()
    if (res.ok && data.success) {
      showToast('更新美容師資料成功！', 'success')
      showEditModal.value = false
      editingBeautician.value = null
      await fetchBeauticians()
    } else {
      showToast(data.message || '更新失敗', 'error')
    }
  } catch (e) {
    console.error('Update beautician error:', e)
    showToast('系統發生錯誤，無法完成更新', 'error')
  } finally {
    isSubmitting.value = false
  }
}

// 開啟刪除確認
const openDeleteModal = (b: Beautician) => {
  deletingBeautician.value = b
  showDeleteModal.value = true
}

// 刪除美容師
const handleDeleteBeautician = async () => {
  if (!deletingBeautician.value) return

  isSubmitting.value = true
  try {
    const res = await fetch(`${backendUrl}/api/beauticians?id=${deletingBeautician.value.id}`, {
      method: 'DELETE'
    })

    const data = await res.json()
    if (res.ok && data.success) {
      showToast('已成功刪除該美容師', 'success')
      showDeleteModal.value = false
      deletingBeautician.value = null
      await fetchBeauticians()
    } else {
      showToast(data.message || '刪除失敗', 'error')
    }
  } catch (e) {
    console.error('Delete beautician error:', e)
    showToast('系統發生錯誤，無法完成刪除', 'error')
  } finally {
    isSubmitting.value = false
  }
}

onMounted(() => {
  fetchBeauticians()
})
</script>

<template>
  <div class="max-w-6xl mx-auto space-y-6">
    <!-- Toast 浮動提示 -->
    <div 
      v-if="toastMessage" 
      :class="[
        'fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-xl border backdrop-blur-md flex items-center gap-3 transition-all duration-300 animate-bounce',
        toastType === 'success' 
          ? 'bg-[#154337] text-white border-emerald-400/30' 
          : 'bg-rose-900 text-white border-rose-400/30'
      ]"
    >
      <Icon :name="toastType === 'success' ? 'mdi:check-circle-outline' : 'mdi:alert-circle-outline'" class="text-xl shrink-0" />
      <span class="text-sm font-medium">{{ toastMessage }}</span>
    </div>

    <!-- 頂部頁面標題與操作按鈕 -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-[#154337]/10 shadow-xs">
      <div>
        <div class="flex items-center gap-2">
          <span class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#154337]/10 text-[#154337] tracking-wider uppercase">團隊管理</span>
          <h1 class="text-2xl font-bold text-[#154337]">系統設定 — 美容師團隊管理</h1>
        </div>
        <p class="text-xs sm:text-sm text-gray-500 mt-1">管理門市駐店美容師與芳療師名單，自動連動預約與排班系統</p>
      </div>

      <button 
        @click="showAddModal = true"
        class="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-[#154337] text-white font-medium text-sm shadow-sm hover:bg-[#0e2f27] transition active:scale-98 cursor-pointer shrink-0"
      >
        <Icon name="mdi:account-plus-outline" class="text-lg" />
        <span>新增美容師</span>
      </button>
    </div>

    <!-- 美容師團隊概覽卡片 -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div class="p-5 rounded-2xl bg-white border border-[#154337]/10 shadow-xs flex items-center gap-4">
        <div class="w-12 h-12 rounded-xl bg-[#154337]/10 flex items-center justify-center text-[#154337]">
          <Icon name="mdi:account-group-outline" class="text-2xl" />
        </div>
        <div>
          <div class="text-xs text-gray-400 font-medium">總駐店美容師人數</div>
          <div class="text-2xl font-bold text-[#154337]">{{ beauticians.length }} <span class="text-xs font-normal text-gray-500">位</span></div>
        </div>
      </div>

      <div class="p-5 rounded-2xl bg-white border border-[#154337]/10 shadow-xs flex items-center gap-4">
        <div class="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
          <Icon name="mdi:check-decagram-outline" class="text-2xl" />
        </div>
        <div>
          <div class="text-xs text-gray-400 font-medium">預約系統服務狀態</div>
          <div class="text-sm font-semibold text-emerald-700 mt-1">正常提供可排班</div>
        </div>
      </div>

      <div class="p-5 rounded-2xl bg-white border border-[#154337]/10 shadow-xs flex items-center gap-4">
        <div class="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
          <Icon name="mdi:link-variant" class="text-2xl" />
        </div>
        <div>
          <div class="text-xs text-gray-400 font-medium">資料庫連動模式</div>
          <div class="text-sm font-semibold text-gray-700 mt-1">Cloudflare D1 連線</div>
        </div>
      </div>
    </div>

    <!-- 搜尋與過濾區 -->
    <div class="bg-white p-4 rounded-2xl border border-[#154337]/10 shadow-xs flex items-center justify-between gap-4">
      <div class="relative flex-1 max-w-md">
        <Icon name="mdi:magnify" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-base" />
        <input 
          v-model="searchQuery"
          type="text" 
          placeholder="搜尋美容師姓名或編號..." 
          class="w-full pl-10 pr-4 py-2 bg-[#FAF4EE]/60 border border-[#154337]/10 rounded-xl text-sm outline-none focus:border-[#154337] focus:bg-white transition"
        />
      </div>
      <div class="text-xs text-gray-400 hidden sm:block">
        共 {{ filteredBeauticians.length }} 位人員
      </div>
    </div>

    <!-- 載入中骨架屏 -->
    <div v-if="isLoading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      <div v-for="i in 6" :key="i" class="p-6 bg-white rounded-3xl border border-gray-100 shadow-xs animate-pulse space-y-4">
        <div class="flex items-center gap-4">
          <div class="w-14 h-14 bg-gray-200 rounded-full"></div>
          <div class="space-y-2 flex-1">
            <div class="h-4 bg-gray-200 rounded w-2/3"></div>
            <div class="h-3 bg-gray-100 rounded w-1/3"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 空白狀態 -->
    <div v-else-if="filteredBeauticians.length === 0" class="bg-white p-12 rounded-3xl border border-[#154337]/10 text-center shadow-xs">
      <div class="w-16 h-16 bg-[#154337]/10 rounded-2xl flex items-center justify-center mx-auto text-[#154337] mb-3">
        <Icon name="mdi:account-search-outline" class="text-3xl" />
      </div>
      <h3 class="text-lg font-semibold text-gray-700">未找到相關美容師</h3>
      <p class="text-xs text-gray-400 mt-1 max-w-sm mx-auto">請確認搜尋關鍵字是否正確，或是點擊上方「新增美容師」按鈕建立新成員。</p>
    </div>

    <!-- 美容師列表網格 (Double-Bezel 質感雙層架構) -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      <div 
        v-for="b in filteredBeauticians" 
        :key="b.id"
        class="p-1 rounded-3xl bg-[#154337]/5 border border-[#154337]/10 hover:border-[#154337]/30 transition duration-300 group shadow-xs hover:shadow-md"
      >
        <div class="p-5 bg-white rounded-[calc(1.5rem-0.25rem)] h-full flex flex-col justify-between space-y-4">
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-3.5">
              <!-- 美容師 Monogram Avatar -->
              <div class="w-12 h-12 rounded-2xl bg-[#154337] text-white flex items-center justify-center text-lg font-bold shadow-sm group-hover:scale-105 transition duration-300">
                {{ b.name.charAt(0) }}
              </div>
              <div>
                <h3 class="font-bold text-gray-900 text-base leading-snug">{{ b.name }}</h3>
                <span class="inline-block mt-0.5 text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#FAF4EE] text-[#154337] font-semibold">
                  ID: #{{ String(b.id).padStart(3, '0') }}
                </span>
              </div>
            </div>

            <!-- 狀態印記 -->
            <span class="flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/50">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              服務中
            </span>
          </div>

          <!-- 操作按鈕列 -->
          <div class="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
            <button 
              @click="openEditModal(b)"
              class="px-3 py-1.5 rounded-xl text-xs font-medium text-gray-600 hover:text-[#154337] hover:bg-[#FAF4EE] transition flex items-center gap-1 cursor-pointer"
            >
              <Icon name="mdi:pencil-outline" class="text-sm" />
              <span>修改姓名</span>
            </button>

            <button 
              @click="openDeleteModal(b)"
              class="px-3 py-1.5 rounded-xl text-xs font-medium text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition flex items-center gap-1 cursor-pointer"
            >
              <Icon name="mdi:trash-can-outline" class="text-sm" />
              <span>刪除</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 新增美容師 Modal -->
    <div v-if="showAddModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div class="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#154337]/10 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div class="flex items-center justify-between border-b border-gray-100 pb-4">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-[#154337]/10 flex items-center justify-center text-[#154337]">
              <Icon name="mdi:account-plus" class="text-lg" />
            </div>
            <h3 class="text-lg font-bold text-gray-900">新增美容師成員</h3>
          </div>
          <button @click="showAddModal = false" class="text-gray-400 hover:text-gray-600 transition">
            <Icon name="mdi:close" class="text-xl" />
          </button>
        </div>

        <div class="space-y-2">
          <label class="text-xs font-semibold text-gray-700">美容師姓名 <span class="text-rose-500">*</span></label>
          <input 
            v-model="newBeauticianName"
            type="text" 
            placeholder="請輸入美容師真實姓名或暱稱（例如：Emily）"
            class="w-full px-4 py-2.5 bg-[#FAF4EE]/70 border border-[#154337]/20 rounded-xl text-sm outline-none focus:border-[#154337] focus:bg-white transition"
            @keyup.enter="handleAddBeautician"
          />
        </div>

        <div class="flex items-center justify-end gap-3 pt-2">
          <button 
            @click="showAddModal = false"
            class="px-4 py-2 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-100 transition cursor-pointer"
          >
            取消
          </button>
          <button 
            @click="handleAddBeautician"
            :disabled="isSubmitting"
            class="px-5 py-2 rounded-xl bg-[#154337] text-white text-sm font-medium hover:bg-[#0e2f27] transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
          >
            <Icon v-if="isSubmitting" name="mdi:loading" class="animate-spin text-base" />
            <span>儲存資料</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 編輯美容師 Modal -->
    <div v-if="showEditModal && editingBeautician" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div class="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#154337]/10 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div class="flex items-center justify-between border-b border-gray-100 pb-4">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-[#154337]/10 flex items-center justify-center text-[#154337]">
              <Icon name="mdi:pencil" class="text-lg" />
            </div>
            <h3 class="text-lg font-bold text-gray-900">修改美容師姓名</h3>
          </div>
          <button @click="showEditModal = false" class="text-gray-400 hover:text-gray-600 transition">
            <Icon name="mdi:close" class="text-xl" />
          </button>
        </div>

        <div class="space-y-2">
          <label class="text-xs font-semibold text-gray-700">美容師姓名</label>
          <input 
            v-model="editingBeautician.name"
            type="text" 
            class="w-full px-4 py-2.5 bg-[#FAF4EE]/70 border border-[#154337]/20 rounded-xl text-sm outline-none focus:border-[#154337] focus:bg-white transition"
            @keyup.enter="handleUpdateBeautician"
          />
        </div>

        <div class="flex items-center justify-end gap-3 pt-2">
          <button 
            @click="showEditModal = false"
            class="px-4 py-2 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-100 transition cursor-pointer"
          >
            取消
          </button>
          <button 
            @click="handleUpdateBeautician"
            :disabled="isSubmitting"
            class="px-5 py-2 rounded-xl bg-[#154337] text-white text-sm font-medium hover:bg-[#0e2f27] transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
          >
            <Icon v-if="isSubmitting" name="mdi:loading" class="animate-spin text-base" />
            <span>更新名稱</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 刪除美容師 Modal -->
    <div v-if="showDeleteModal && deletingBeautician" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div class="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-100 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div class="flex items-center gap-3 text-rose-600">
          <div class="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
            <Icon name="mdi:alert-outline" class="text-2xl" />
          </div>
          <div>
            <h3 class="text-lg font-bold text-gray-900">確認刪除美容師？</h3>
            <p class="text-xs text-gray-500">刪除後該成員將無法在預約清單中被選擇</p>
          </div>
        </div>

        <div class="p-4 bg-rose-50/50 rounded-2xl border border-rose-100 text-sm text-gray-700 space-y-1">
          <div><span class="text-gray-400">美容師姓名：</span> <strong class="text-rose-700">{{ deletingBeautician.name }}</strong></div>
          <div><span class="text-gray-400">成員編號：</span> <span class="font-mono">#{{ deletingBeautician.id }}</span></div>
        </div>

        <div class="flex items-center justify-end gap-3 pt-2">
          <button 
            @click="showDeleteModal = false"
            class="px-4 py-2 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-100 transition cursor-pointer"
          >
            取消
          </button>
          <button 
            @click="handleDeleteBeautician"
            :disabled="isSubmitting"
            class="px-5 py-2 rounded-xl bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <Icon v-if="isSubmitting" name="mdi:loading" class="animate-spin text-base" />
            <span>確定刪除</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>