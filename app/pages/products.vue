<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'

interface Product {
  id?: number
  name: string
  cost_price: number
  selling_price: number
  stock_quantity: number
}

interface InventoryTransaction {
  id?: number
  product_id: number
  product_name?: string
  type: 'purchase' | 'sale' | 'usage' | 'adjustment'
  quantity: number
  unit_price: number
  total_amount?: number
  user_id?: number | null
  client_name?: string
  description?: string
  date: string
}

const config = useRuntimeConfig()
const backendUrl = config.public.backendUrl

const activeTab = ref<'products' | 'transactions'>('products')
const products = ref<Product[]>([])
const transactions = ref<InventoryTransaction[]>([])
const isLoading = ref(false)
const statusMessage = ref('')
const isError = ref(false)

// 🌟 改用 Modal 顯示單一產品的歷史異動
const showHistoryModal = ref(false)
const selectedHistoryProduct = ref<Product | null>(null)
const currentProductHistory = ref<InventoryTransaction[]>([])
const isLoadingHistory = ref(false)

// 產品 Modal 狀態
const showProductModal = ref(false)
const isEditingProduct = ref(false)
const productForm = reactive<Product>({
  id: undefined,
  name: '',
  cost_price: 0,
  selling_price: 0,
  stock_quantity: 0
})

// 庫存異動 Modal 狀態
const showStockModal = ref(false)
const isEditingStock = ref(false)
const stockForm = reactive<{
  id?: number
  product_id: number
  product_name: string
  type: 'purchase' | 'sale' | 'usage' | 'adjustment'
  quantity: number
  unit_price: number
  description: string
  date: string
}>({
  id: undefined,
  product_id: 0,
  product_name: '',
  type: 'purchase',
  quantity: 1,
  unit_price: 0,
  description: '',
  date: new Date().toISOString().split('T')[0]
})

// 危險刪除 Warning Modal 狀態
const showDeleteWarningModal = ref(false)
const targetDeleteProduct = ref<Product | null>(null)
const isDeleting = ref(false)

// 載入產品列表
const fetchProducts = async () => {
  isLoading.value = true
  try {
    const res = await fetch(`${backendUrl}/api/products`)
    const result = await res.json()
    if (res.ok) products.value = result.data || []
    else throw new Error(result.error || '讀取失敗')
  } catch (err: any) {
    showToast(err.message, true)
  } finally {
    isLoading.value = false
  }
}

// 載入全站異動紀錄
const fetchTransactions = async () => {
  isLoading.value = true
  try {
    const res = await fetch(`${backendUrl}/api/inventory-transactions`)
    const result = await res.json()
    if (res.ok) transactions.value = result.data || []
    else throw new Error(result.error || '讀取紀錄失敗')
  } catch (err: any) {
    showToast(err.message, true)
  } finally {
    isLoading.value = false
  }
}

// 🌟 開啟單一產品歷史紀錄 Modal
const openProductHistoryModal = async (product: Product) => {
  selectedHistoryProduct.value = product
  showHistoryModal.value = true
  isLoadingHistory.value = true
  currentProductHistory.value = []

  try {
    const res = await fetch(`${backendUrl}/api/inventory-transactions?product_id=${product.id}`)
    const result = await res.json()
    if (res.ok) {
      currentProductHistory.value = result.data || []
    }
  } catch (err: any) {
    showToast("讀取產品異動失敗", true)
  } finally {
    isLoadingHistory.value = false
  }
}

// 開啟產品編輯 Modal
const openProductModal = (product?: Product) => {
  if (product) {
    isEditingProduct.value = true
    productForm.id = product.id
    productForm.name = product.name
    productForm.cost_price = product.cost_price
    productForm.selling_price = product.selling_price
    productForm.stock_quantity = product.stock_quantity
  } else {
    isEditingProduct.value = false
    productForm.id = undefined
    productForm.name = ''
    productForm.cost_price = 0
    productForm.selling_price = 0
    productForm.stock_quantity = 0
  }
  showProductModal.value = true
}

// 開啟登記/編輯庫存 Modal
const openStockModal = (product: Product, trans?: InventoryTransaction) => {
  if (trans) {
    isEditingStock.value = true
    stockForm.id = trans.id
    stockForm.product_id = trans.product_id
    stockForm.product_name = product.name
    stockForm.type = trans.type
    stockForm.quantity = trans.quantity
    stockForm.unit_price = trans.unit_price
    stockForm.description = trans.description || ''
    stockForm.date = trans.date
  } else {
    isEditingStock.value = false
    stockForm.id = undefined
    stockForm.product_id = product.id!
    stockForm.product_name = product.name
    stockForm.type = 'purchase'
    stockForm.quantity = 1
    stockForm.unit_price = product.cost_price
    stockForm.description = ''
    stockForm.date = new Date().toISOString().split('T')[0]
  }
  showStockModal.value = true
}

const handleTypeChange = (product: Product) => {
  if (isEditingStock.value) return
  if (stockForm.type === 'purchase') stockForm.unit_price = product.cost_price
  else if (stockForm.type === 'sale') stockForm.unit_price = product.selling_price
  else stockForm.unit_price = 0
}

// 送出產品基本資料
const handleProductSubmit = async () => {
  if (!productForm.name.trim()) return showToast('請輸入產品名稱', true)
  const url = `${backendUrl}/api/products`
  const method = isEditingProduct.value ? 'PUT' : 'POST'

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productForm)
    })
    const result = await res.json()
    if (res.ok) {
      showToast(isEditingProduct.value ? '產品資料更新成功！' : '新增產品成功！')
      showProductModal.value = false
      fetchProducts()
    } else throw new Error(result.error || '操作失敗')
  } catch (err: any) {
    showToast(err.message, true)
  }
}

// 送出庫存異動
const handleStockSubmit = async () => {
  if (!stockForm.quantity || stockForm.quantity === 0) {
    return showToast('變動數量不能為 0，請輸入有效數量', true)
  }
  if (!stockForm.date) {
    return showToast('請選擇發生日期', true)
  }

  const method = isEditingStock.value ? 'PUT' : 'POST'

  try {
    const res = await fetch(`${backendUrl}/api/inventory-transactions`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stockForm)
    })
    
    if (res.status === 404) {
      throw new Error('找不到 API 路由 (404)，請確認 Worker 已重新部署並包含 PUT 路由')
    }

    const result = await res.json()
    if (res.ok) {
      showToast(isEditingStock.value ? '異動紀錄已更新，庫存已重新計算！' : '庫存異動登記成功！')
      showStockModal.value = false
      fetchProducts()
      if (selectedHistoryProduct.value) {
        openProductHistoryModal(selectedHistoryProduct.value)
      }
      if (activeTab.value === 'transactions') fetchTransactions()
    } else {
      throw new Error(result.error || '異動儲存失敗')
    }
  } catch (err: any) {
    showToast(err.message, true)
  }
}

// 刪除異動紀錄
const handleDeleteTransaction = async (transId: number) => {
  if (!confirm('確定要刪除此筆異動紀錄？刪除後，舊數量將自動還原回產品庫存中。')) return
  try {
    const res = await fetch(`${backendUrl}/api/inventory-transactions?id=${transId}`, { method: 'DELETE' })
    const result = await res.json()
    if (res.ok) {
      showToast('異動已刪除，產品庫存已還原！')
      fetchProducts()
      if (selectedHistoryProduct.value) {
        openProductHistoryModal(selectedHistoryProduct.value)
      }
      if (activeTab.value === 'transactions') fetchTransactions()
    } else throw new Error(result.error || '刪除失敗')
  } catch (err: any) {
    showToast(err.message, true)
  }
}

// 觸發刪除防呆 Modal
const promptDeleteProduct = (product: Product) => {
  targetDeleteProduct.value = product
  showDeleteWarningModal.value = true
}

// 確認執行刪除產品與連帶異動
const confirmDeleteProduct = async () => {
  if (!targetDeleteProduct.value?.id) return
  isDeleting.value = true

  try {
    const res = await fetch(`${backendUrl}/api/products?id=${targetDeleteProduct.value.id}`, { method: 'DELETE' })
    const result = await res.json()
    if (res.ok) {
      showToast(`已成功刪除產品「${targetDeleteProduct.value.name}」及其所有歷史紀錄！`)
      showDeleteWarningModal.value = false
      targetDeleteProduct.value = null
      fetchProducts()
      if (activeTab.value === 'transactions') fetchTransactions()
    } else throw new Error(result.error || '刪除失敗')
  } catch (err: any) {
    showToast(err.message, true)
  } finally {
    isDeleting.value = false
  }
}

const showToast = (msg: string, error = false) => {
  statusMessage.value = msg
  isError.value = error
  setTimeout(() => { statusMessage.value = '' }, 3000)
}

const switchTab = (tab: 'products' | 'transactions') => {
  activeTab.value = tab
  if (tab === 'products') fetchProducts()
  else fetchTransactions()
}

const getTypeName = (type: string) => {
  switch (type) {
    case 'purchase': return '進貨 (+支出)'
    case 'sale': return '銷售 (+收入)'
    case 'usage': return '店內耗用'
    case 'adjustment': return '盤點調整'
    default: return type
  }
}

const getTypeBadgeClass = (type: string) => {
  switch (type) {
    case 'purchase': return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'sale': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'usage': return 'bg-purple-50 text-purple-700 border-purple-200'
    case 'adjustment': return 'bg-amber-50 text-amber-700 border-amber-200'
    default: return 'bg-gray-50 text-gray-600'
  }
}

onMounted(() => { fetchProducts() })
</script>

<template>
  <div class="max-w-6xl mx-auto py-4 sm:py-8 px-3 sm:px-4">
    <!-- 🌟 頂部頁頭與手機端優化選單 -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b pb-4">
      <div>
        <h1 class="text-xl sm:text-2xl font-bold text-gray-800">產品與進銷存管理</h1>
        <p class="text-xs sm:text-sm text-gray-500 mt-1">進貨、銷售財務連動與庫存紀錄</p>
      </div>

      <div class="flex flex-wrap items-center justify-between sm:justify-end gap-2 w-full md:w-auto">
        <div class="bg-gray-100 p-1 rounded-xl flex border w-full sm:w-auto">
          <button @click="switchTab('products')" :class="['flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition', activeTab === 'products' ? 'bg-white text-[#154337] shadow-sm' : 'text-gray-500']">
            產品列表
          </button>
          <button @click="switchTab('transactions')" :class="['flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition', activeTab === 'transactions' ? 'bg-white text-[#154337] shadow-sm' : 'text-gray-500']">
            全站異動紀錄
          </button>
        </div>

        <button v-if="activeTab === 'products'" @click="openProductModal()" class="w-full sm:w-auto justify-center bg-[#154337] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md hover:bg-opacity-90 flex items-center gap-1.5 mt-2 sm:mt-0">
          <Icon name="mdi:plus" size="16" />
          <span>新增產品</span>
        </button>
      </div>
    </div>

    <!-- Toast 提示 -->
    <div v-if="statusMessage" :class="['p-3 sm:p-3.5 rounded-xl mb-4 sm:mb-6 text-xs sm:text-sm font-bold text-center border animate-fade-in', isError ? 'bg-red-50 text-red-600 border-red-200' : 'bg-green-50 text-green-700 border-green-200']">
      {{ statusMessage }}
    </div>

    <!-- 區塊 A: 產品清單 (手機響應式卡片 + 桌機表格) -->
    <div v-if="activeTab === 'products'" class="space-y-3 sm:space-y-0 bg-transparent sm:bg-white rounded-2xl sm:shadow-sm sm:border overflow-hidden">
      <div v-if="isLoading" class="p-12 text-center text-gray-400 bg-white rounded-2xl">
        <Icon name="mdi:loading" class="animate-spin text-3xl mb-2 text-[#154337]" />
        <p class="text-sm">載入產品中...</p>
      </div>

      <div v-else-if="products.length === 0" class="p-12 text-center text-gray-400 bg-white rounded-2xl">
        <p class="text-sm">目前尚無產品資料。</p>
      </div>

      <div v-else>
        <!-- 📱 手機端：響應式卡片列表 (< 640px) -->
        <div class="block sm:hidden space-y-3">
          <div v-for="item in products" :key="item.id" class="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-3">
            <div class="flex justify-between items-start">
              <div>
                <h3 class="font-bold text-gray-800 text-base">{{ item.name }}</h3>
                <span class="text-[11px] font-mono text-gray-400">ID: #{{ item.id }}</span>
              </div>
              <span :class="['px-2.5 py-0.5 rounded-full text-xs font-bold border font-mono', item.stock_quantity > 5 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200']">
                庫存: {{ item.stock_quantity }} 件
              </span>
            </div>

            <div class="grid grid-cols-2 gap-2 bg-gray-50 p-2.5 rounded-xl text-xs font-mono">
              <div><span class="text-gray-400">成本:</span> ${{ item.cost_price }}</div>
              <div><span class="text-gray-400">售價:</span> <span class="font-bold text-[#154337]">${{ item.selling_price }}</span></div>
            </div>

            <div class="flex items-center justify-between pt-1 border-t border-gray-100 gap-2">
              <button @click="openProductHistoryModal(item)" class="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition flex items-center gap-1">
                <Icon name="mdi:history" size="15" />
                <span>紀錄</span>
              </button>

              <div class="flex items-center gap-1.5">
                <button @click="openStockModal(item)" class="px-2.5 py-1.5 bg-[#154337]/10 text-[#154337] rounded-lg text-xs font-bold transition flex items-center gap-1">
                  <Icon name="mdi:package-variant-closed-plus" size="15" />
                  <span>異動</span>
                </button>
                <button @click="openProductModal(item)" class="p-1.5 text-gray-400 hover:text-[#154337]">
                  <Icon name="mdi:pencil" size="18" />
                </button>
                <button @click="promptDeleteProduct(item)" class="p-1.5 text-gray-400 hover:text-red-600">
                  <Icon name="mdi:trash-can-outline" size="18" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 💻 桌機端：傳統表格 (>= 640px) -->
        <div class="hidden sm:block overflow-x-auto">
          <table class="w-full text-left text-sm text-gray-600">
            <thead class="bg-gray-50 border-b text-xs font-bold text-gray-700 uppercase">
              <tr>
                <th class="px-6 py-4">ID</th>
                <th class="px-6 py-4">產品名稱</th>
                <th class="px-6 py-4">成本價</th>
                <th class="px-6 py-4">售價</th>
                <th class="px-6 py-4">目前庫存</th>
                <th class="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="item in products" :key="item.id" class="hover:bg-gray-50/80 transition">
                <td class="px-6 py-4 font-mono text-gray-400">#{{ item.id }}</td>
                <td class="px-6 py-4 font-bold text-gray-800">{{ item.name }}</td>
                <td class="px-6 py-4 font-mono text-gray-500">${{ item.cost_price }}</td>
                <td class="px-6 py-4 font-mono font-bold text-[#154337]">${{ item.selling_price }}</td>
                <td class="px-6 py-4 font-mono">
                  <span :class="['px-2.5 py-0.5 rounded-full text-xs font-bold border font-mono', item.stock_quantity > 5 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200']">
                    {{ item.stock_quantity }} 件
                  </span>
                </td>
                <td class="px-6 py-4 text-right space-x-2">
                  <!-- 🌟 桌機點擊彈出歷史 Modal -->
                  <button @click="openProductHistoryModal(item)" class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition inline-flex items-center gap-1">
                    <Icon name="mdi:history" size="15" />
                    <span>查看紀錄</span>
                  </button>
                  <button @click="openStockModal(item)" class="px-3 py-1.5 bg-[#154337]/10 hover:bg-[#154337]/20 text-[#154337] rounded-lg text-xs font-bold transition inline-flex items-center gap-1">
                    <Icon name="mdi:package-variant-closed-plus" size="15" />
                    <span>庫存異動</span>
                  </button>
                  <button @click="openProductModal(item)" class="p-1.5 text-gray-400 hover:text-[#154337]">
                    <Icon name="mdi:pencil" size="18" />
                  </button>
                  <button @click="promptDeleteProduct(item)" class="p-1.5 text-gray-400 hover:text-red-600">
                    <Icon name="mdi:trash-can-outline" size="18" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 區塊 B: 全站異動歷史紀錄 (手機響應式) -->
    <div v-if="activeTab === 'transactions'" class="bg-transparent sm:bg-white rounded-2xl sm:shadow-sm sm:border overflow-hidden">
      <div v-if="isLoading" class="p-12 text-center text-gray-400 bg-white rounded-2xl">
        <Icon name="mdi:loading" class="animate-spin text-3xl mb-2 text-[#154337]" />
        <p class="text-sm">載入異動紀錄中...</p>
      </div>

      <div v-else-if="transactions.length === 0" class="p-12 text-center text-gray-400 bg-white rounded-2xl">
        <p class="text-sm">尚無庫存異動紀錄。</p>
      </div>

      <div v-else>
        <!-- 📱 手機端卡片列表 (< 640px) -->
        <div class="block sm:hidden space-y-3">
          <div v-for="t in transactions" :key="t.id" class="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-2">
            <div class="flex justify-between items-start">
              <div>
                <span class="text-[11px] font-mono text-gray-400 block">{{ t.date }}</span>
                <h4 class="font-bold text-gray-800 text-sm mt-0.5">{{ t.product_name }}</h4>
              </div>
              <span :class="['px-2 py-0.5 rounded-full text-[10px] font-bold border', getTypeBadgeClass(t.type)]">
                {{ getTypeName(t.type) }}
              </span>
            </div>

            <div class="flex justify-between items-center bg-gray-50 p-2.5 rounded-xl text-xs font-mono">
              <div>數量: <span class="font-bold">{{ t.type === 'purchase' ? '+' : t.type === 'sale' || t.type === 'usage' ? '-' : '' }}{{ t.quantity }}</span></div>
              <div>總額: <span class="font-bold text-gray-800">${{ t.total_amount }}</span></div>
            </div>

            <p v-if="t.description" class="text-xs text-gray-500 pt-1">備註: {{ t.description }}</p>

            <div class="flex justify-end gap-3 pt-2 border-t border-gray-100 text-xs font-bold">
              <button @click="openStockModal(products.find(p => p.id === t.product_id) || { id: t.product_id, name: t.product_name!, cost_price: 0, selling_price: 0, stock_quantity: 0 }, t)" class="text-[#154337]">編輯</button>
              <button @click="handleDeleteTransaction(t.id!)" class="text-red-600">刪除</button>
            </div>
          </div>
        </div>

        <!-- 💻 桌機端表格 (>= 640px) -->
        <div class="hidden sm:block overflow-x-auto">
          <table class="w-full text-left text-sm text-gray-600">
            <thead class="bg-gray-50 border-b text-xs font-bold text-gray-700 uppercase">
              <tr>
                <th class="px-6 py-4">發生日期</th>
                <th class="px-6 py-4">產品名稱</th>
                <th class="px-6 py-4">異動類型</th>
                <th class="px-6 py-4">數量</th>
                <th class="px-6 py-4">單價 / 總金額</th>
                <th class="px-6 py-4">備註說明</th>
                <th class="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="t in transactions" :key="t.id" class="hover:bg-gray-50/80 transition">
                <td class="px-6 py-4 font-mono text-gray-500 text-xs">{{ t.date }}</td>
                <td class="px-6 py-4 font-bold text-gray-800">{{ t.product_name }}</td>
                <td class="px-6 py-4">
                  <span :class="['px-2.5 py-1 rounded-full text-xs font-bold border', getTypeBadgeClass(t.type)]">
                    {{ getTypeName(t.type) }}
                  </span>
                </td>
                <td class="px-6 py-4 font-mono font-bold">
                  {{ t.type === 'purchase' ? '+' : t.type === 'sale' || t.type === 'usage' ? '-' : '' }}{{ t.quantity }}
                </td>
                <td class="px-6 py-4 font-mono text-xs">
                  <div>單價: ${{ t.unit_price }}</div>
                  <div class="font-bold text-gray-800 mt-0.5">總金額: ${{ t.total_amount }}</div>
                </td>
                <td class="px-6 py-4 text-xs text-gray-500 max-w-xs truncate">{{ t.description || '-' }}</td>
                <td class="px-6 py-4 text-right space-x-2">
                  <button @click="openStockModal(products.find(p => p.id === t.product_id) || { id: t.product_id, name: t.product_name!, cost_price: 0, selling_price: 0, stock_quantity: 0 }, t)" class="text-gray-500 hover:text-[#154337] font-bold text-xs">編輯</button>
                  <button @click="handleDeleteTransaction(t.id!)" class="text-gray-400 hover:text-red-600 font-bold text-xs">刪除</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 🌟 獨立彈出視窗 1：單一產品進銷存歷史履歷 Modal -->
    <div v-if="showHistoryModal" class="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-fade-in">
      <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
        <!-- Modal 標題區 -->
        <div class="p-4 sm:p-5 border-b flex justify-between items-center bg-gray-50 shrink-0">
          <div>
            <h3 class="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-1.5">
              <Icon name="mdi:history" class="text-[#154337]" size="20" />
              <span>「{{ selectedHistoryProduct?.name }}」進銷存紀錄</span>
            </h3>
            <p class="text-xs text-gray-400 mt-0.5 font-mono">產品 ID: #{{ selectedHistoryProduct?.id }} | 當前庫存: {{ selectedHistoryProduct?.stock_quantity }} 件</p>
          </div>
          <button @click="showHistoryModal = false" class="text-gray-400 hover:text-gray-600 p-1">
            <Icon name="mdi:close" size="20" />
          </button>
        </div>

        <!-- Modal 歷史內容區 -->
        <div class="p-4 overflow-y-auto flex-1 space-y-3">
          <div v-if="isLoadingHistory" class="p-8 text-center text-gray-400">
            <Icon name="mdi:loading" class="animate-spin text-2xl mb-1 text-[#154337]" />
            <p class="text-xs">讀取異動紀錄中...</p>
          </div>

          <div v-else-if="currentProductHistory.length === 0" class="p-8 text-center text-gray-400">
            <p class="text-xs">尚無相關進銷存紀錄。</p>
          </div>

          <div v-else class="space-y-2">
            <div v-for="h in currentProductHistory" :key="h.id" class="p-3 bg-gray-50 border rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-xs">
              <div class="space-y-1">
                <div class="flex items-center gap-2">
                  <span class="font-mono text-gray-400">{{ h.date }}</span>
                  <span :class="['px-2 py-0.5 rounded-full text-[10px] font-bold border', getTypeBadgeClass(h.type)]">
                    {{ getTypeName(h.type) }}
                  </span>
                </div>
                <div class="text-gray-600 font-mono">
                  數量: <span class="font-bold text-gray-800">{{ h.type === 'purchase' ? '+' : h.type === 'sale' || h.type === 'usage' ? '-' : '' }}{{ h.quantity }}</span> | 
                  單價: ${{ h.unit_price }} | 
                  總計: <span class="font-bold text-gray-800">${{ h.total_amount }}</span>
                </div>
                <p v-if="h.description" class="text-gray-400 truncate">備註: {{ h.description }}</p>
              </div>

              <div class="flex items-center justify-end gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0">
                <button @click="openStockModal(selectedHistoryProduct!, h)" class="px-2.5 py-1 bg-white border text-gray-700 rounded-lg font-bold hover:text-[#154337]">編輯</button>
                <button @click="handleDeleteTransaction(h.id!)" class="px-2.5 py-1 bg-white border text-red-600 rounded-lg font-bold hover:bg-red-50">刪除</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Modal 底部關閉 -->
        <div class="p-3 bg-gray-50 border-t text-right shrink-0">
          <button @click="showHistoryModal = false" class="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-xl text-xs font-bold text-gray-700">關閉視窗</button>
        </div>
      </div>
    </div>

    <!-- Modal 2: 編輯/新增產品基本資料 -->
    <div v-if="showProductModal" class="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-fade-in">
      <div class="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 sm:p-6 space-y-4">
        <h3 class="text-base sm:text-lg font-bold text-gray-800 border-b pb-2">{{ isEditingProduct ? '編輯產品' : '新增產品' }}</h3>
        <form @submit.prevent="handleProductSubmit" class="space-y-3">
          <div>
            <label class="text-xs font-bold text-gray-700">產品名稱 *</label>
            <input v-model="productForm.name" type="text" required class="w-full border rounded-xl p-2.5 text-sm mt-1 focus:ring-2 focus:ring-[#154337]" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs font-bold text-gray-700">成本價 *</label>
              <input v-model.number="productForm.cost_price" type="number" min="0" required class="w-full border rounded-xl p-2.5 text-sm mt-1" />
            </div>
            <div>
              <label class="text-xs font-bold text-gray-700">售價 *</label>
              <input v-model.number="productForm.selling_price" type="number" min="0" required class="w-full border rounded-xl p-2.5 text-sm mt-1" />
            </div>
          </div>
          <div v-if="!isEditingProduct">
            <label class="text-xs font-bold text-gray-700">初始庫存量</label>
            <input v-model.number="productForm.stock_quantity" type="number" min="0" class="w-full border rounded-xl p-2.5 text-sm mt-1" />
          </div>
          <div class="flex justify-end gap-2 pt-3 border-t">
            <button type="button" @click="showProductModal = false" class="px-4 py-2 border rounded-xl text-xs font-bold text-gray-600">取消</button>
            <button type="submit" class="px-4 py-2 bg-[#154337] text-white rounded-xl text-xs font-bold">儲存</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal 3: 庫存異動登記與修改 -->
    <div v-if="showStockModal" class="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-fade-in">
      <div class="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 sm:p-6 space-y-4">
        <div class="border-b pb-2">
          <h3 class="text-base sm:text-lg font-bold text-gray-800">{{ isEditingStock ? '修改庫存異動紀錄' : '登記庫存異動' }}</h3>
          <p class="text-xs text-gray-500 mt-0.5">目標產品：<span class="font-bold text-[#154337]">{{ stockForm.product_name }}</span></p>
        </div>

        <form @submit.prevent="handleStockSubmit" class="space-y-3">
          <div>
            <label class="text-xs font-bold text-gray-700">異動類型 *</label>
            <select v-model="stockForm.type" @change="handleTypeChange(products.find(p => p.id === stockForm.product_id)!)" class="w-full border rounded-xl p-2.5 text-sm mt-1 font-bold">
              <option value="purchase">進貨 (+庫存 / +現金支出)</option>
              <option value="sale">銷售 (-庫存 / +現金收入與營收)</option>
              <option value="usage">店內耗用 (-庫存 / 不影響財務)</option>
              <option value="adjustment">盤點調整 (+/-庫存 / 不影響財務)</option>
            </select>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs font-bold text-gray-700">變動數量 *</label>
              <input v-model.number="stockForm.quantity" type="number" step="1" required placeholder="進/銷正數，盤虧負數" class="w-full border rounded-xl p-2.5 text-sm mt-1" />
            </div>
            <div>
              <label class="text-xs font-bold text-gray-700">單價 (NT$)</label>
              <input v-model.number="stockForm.unit_price" type="number" min="0" class="w-full border rounded-xl p-2.5 text-sm mt-1" />
            </div>
          </div>

          <div>
            <label class="text-xs font-bold text-gray-700">發生日期 *</label>
            <input v-model="stockForm.date" type="date" required class="w-full border rounded-xl p-2.5 text-sm mt-1" />
          </div>

          <div>
            <label class="text-xs font-bold text-gray-700">備註說明</label>
            <input v-model="stockForm.description" type="text" placeholder="說明或原由" class="w-full border rounded-xl p-2.5 text-sm mt-1" />
          </div>

          <div class="flex justify-end gap-2 pt-3 border-t">
            <button type="button" @click="showStockModal = false" class="px-4 py-2 border rounded-xl text-xs font-bold text-gray-600">取消</button>
            <button type="submit" class="px-4 py-2 bg-[#154337] text-white rounded-xl text-xs font-bold">
              {{ isEditingStock ? '更新異動並重算庫存' : '確認登記並同步財務' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal 4: 危險操作警示與防呆 - 刪除產品及一併清除歷史紀錄 -->
    <div v-if="showDeleteWarningModal" class="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-[60] animate-fade-in">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 sm:p-6 space-y-4 text-center border-2 border-red-100">
        <div class="w-12 h-12 sm:w-14 sm:h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto text-2xl shadow-inner">
          <Icon name="mdi:alert-circle-outline" size="30" />
        </div>

        <div>
          <h3 class="text-base sm:text-lg font-bold text-gray-800">確定要刪除「{{ targetDeleteProduct?.name }}」？</h3>
          <p class="text-xs text-red-600 font-bold mt-2 bg-red-50 p-2.5 rounded-xl border border-red-100">
            ⚠️ 警告：刪除產品後，該產品過往的所有「進銷存與庫存異動紀錄」也將一併被永久清空且無法復原！
          </p>
        </div>

        <div class="bg-gray-50 p-3 rounded-xl text-left text-xs text-gray-500 space-y-1 font-mono">
          <div>• 產品 ID：#{{ targetDeleteProduct?.id }}</div>
          <div>• 目前庫存：{{ targetDeleteProduct?.stock_quantity }} 件</div>
          <div>• 成本價 / 售價：${{ targetDeleteProduct?.cost_price }} / ${{ targetDeleteProduct?.selling_price }}</div>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <button type="button" @click="showDeleteWarningModal = false" :disabled="isDeleting" class="flex-1 py-2.5 border rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition">
            取消
          </button>
          <button type="button" @click="confirmDeleteProduct" :disabled="isDeleting" class="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition shadow-md disabled:opacity-50 flex items-center justify-center gap-1">
            <Icon v-if="isDeleting" name="mdi:loading" class="animate-spin" size="16" />
            <span>{{ isDeleting ? '刪除中...' : '確定強制刪除' }}</span>
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.98); }
  to { opacity: 1; transform: scale(1); }
}
.animate-fade-in {
  animation: fadeIn 0.2s ease-out;
}
</style>