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

// 🌟 搜尋與篩選 State (參考課程管理規格)
const productSearchText = ref('')
const transactionSearchText = ref('')
const transactionProductFilter = ref<number | ''>('')
const transactionDateFilter = ref('')
const transactionTypeFilter = ref<string>('')

// 產品列表過濾
const filteredProducts = computed(() => {
  if (!productSearchText.value.trim()) return products.value
  const q = productSearchText.value.trim().toLowerCase()
  return products.value.filter(p => p.name.toLowerCase().includes(q) || String(p.id).includes(q))
})

// 全站異動紀錄過濾 (支援產品名稱/下拉、日期、類型、關鍵字即時篩選)
const filteredTransactions = computed(() => {
  return transactions.value.filter(t => {
    // 1. 產品下拉篩選
    if (transactionProductFilter.value !== '' && t.product_id !== Number(transactionProductFilter.value)) {
      return false
    }
    // 2. 異動類型篩選
    if (transactionTypeFilter.value && t.type !== transactionTypeFilter.value) {
      return false
    }
    // 3. 日期篩選
    if (transactionDateFilter.value && t.date !== transactionDateFilter.value) {
      return false
    }
    // 4. 關鍵字搜尋 (產品名稱、備註說明、客戶名稱)
    if (transactionSearchText.value.trim()) {
      const q = transactionSearchText.value.trim().toLowerCase()
      const pName = (t.product_name || '').toLowerCase()
      const desc = (t.description || '').toLowerCase()
      const client = (t.client_name || '').toLowerCase()
      if (!pName.includes(q) && !desc.includes(q) && !client.includes(q)) {
        return false
      }
    }
    return true
  })
})

const isTransactionFilterActive = computed(() => {
  return !!(transactionSearchText.value.trim() || transactionProductFilter.value !== '' || transactionDateFilter.value || transactionTypeFilter.value)
})

const clearTransactionFilters = () => {
  transactionSearchText.value = ''
  transactionProductFilter.value = ''
  transactionDateFilter.value = ''
  transactionTypeFilter.value = ''
}

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

const handleTypeChange = (product?: Product) => {
  if (stockForm.type === 'adjustment' || stockForm.type === 'usage') {
    stockForm.unit_price = 0
  } else if (!isEditingStock.value && product) {
    if (stockForm.type === 'purchase') stockForm.unit_price = product.cost_price
    else if (stockForm.type === 'sale') stockForm.unit_price = product.selling_price
    else stockForm.unit_price = 0
  }
}

// 送出產品基本資料
const handleProductSubmit = async () => {
  if (!productForm.name.trim()) return showToast('請輸入產品名稱', true)
  if (!isEditingProduct.value) {
    productForm.stock_quantity = 0
  }
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

const getStockChange = (type: string, quantity: number): number => {
  const qty = Math.abs(quantity)
  if (type === 'purchase') return qty
  if (type === 'sale' || type === 'usage') return -qty
  if (type === 'adjustment') return quantity
  return 0
}

const getSignedQuantity = (type: string, quantity: number): number => {
  if (type === 'purchase') return Math.abs(quantity)
  if (type === 'sale' || type === 'usage') return -Math.abs(quantity)
  if (type === 'adjustment') return quantity
  return quantity
}

const formatQuantityDisplay = (type: string, quantity: number): string => {
  const signed = getSignedQuantity(type, quantity)
  if (signed > 0) return `+${signed}`
  if (signed < 0) return `${signed}`
  return '0'
}

const getQuantityColorClass = (type: string, quantity: number): string => {
  const signed = getSignedQuantity(type, quantity)
  if (signed > 0) return 'text-emerald-700'
  if (signed < 0) return 'text-rose-600'
  return 'text-gray-500'
}

// 送出庫存異動
const handleStockSubmit = async () => {
  if (stockForm.type !== 'adjustment' && (stockForm.quantity === undefined || stockForm.quantity === null || stockForm.quantity === 0)) {
    return showToast('變動數量不能為 0，請輸入有效數量', true)
  }
  if (stockForm.type === 'adjustment' || stockForm.type === 'usage') {
    stockForm.unit_price = 0
  }
  if (!stockForm.date) {
    return showToast('請選擇發生日期', true)
  }

  const targetProduct = products.value.find(p => p.id === stockForm.product_id)
  if (targetProduct && !isEditingStock.value) {
    const change = getStockChange(stockForm.type, stockForm.quantity)
    if (targetProduct.stock_quantity + change < 0) {
      return showToast(`庫存不足！「${targetProduct.name}」目前庫存為 ${targetProduct.stock_quantity} 件，異動後剩餘數量不能小於 0`, true)
    }
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
      showToast('已刪除紀錄，庫存已更新')
      if (selectedHistoryProduct.value) {
        openProductHistoryModal(selectedHistoryProduct.value)
      }
      fetchProducts()
      if (activeTab.value === 'transactions') fetchTransactions()
    } else throw new Error(result.error || '刪除失敗')
  } catch (err: any) {
    showToast(err.message, true)
  }
}

// 彈出刪除產品 Warning Modal
const promptDeleteProduct = (product: Product) => {
  targetDeleteProduct.value = product
  showDeleteWarningModal.value = true
}

// 執行刪除產品及其所有異動
const confirmDeleteProduct = async () => {
  if (!targetDeleteProduct.value || !targetDeleteProduct.value.id) return
  isDeleting.value = true
  try {
    const res = await fetch(`${backendUrl}/api/products?id=${targetDeleteProduct.value.id}`, {
      method: 'DELETE'
    })
    const result = await res.json()
    if (res.ok) {
      showToast(`已刪除「${targetDeleteProduct.value.name}」及其歷史異動紀錄`)
      showDeleteWarningModal.value = false
      targetDeleteProduct.value = null
      fetchProducts()
    } else {
      throw new Error(result.error || '刪除產品失敗')
    }
  } catch (err: any) {
    showToast(err.message, true)
  } finally {
    isDeleting.value = false
  }
}

const showToast = (msg: string, error = false) => {
  statusMessage.value = msg
  isError.value = error
  setTimeout(() => { statusMessage.value = '' }, 3500)
}

const switchTab = (tab: 'products' | 'transactions') => {
  activeTab.value = tab
  if (tab === 'products') fetchProducts()
  else fetchTransactions()
}

const getTypeName = (type: string) => {
  switch (type) {
    case 'purchase': return '進貨 (+)'
    case 'sale': return '銷售 (-)'
    case 'usage': return '耗損/領用 (-)'
    case 'adjustment': return '盤點調整'
    default: return type
  }
}

const getTypeBadgeClass = (type: string) => {
  switch (type) {
    case 'purchase': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'sale': return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'usage': return 'bg-rose-50 text-rose-700 border-rose-200'
    case 'adjustment': return 'bg-amber-50 text-amber-700 border-amber-200'
    default: return 'bg-gray-50 text-gray-600'
  }
}

onMounted(() => { fetchProducts() })
</script>

<template>
  <div class="max-w-6xl mx-auto py-2 sm:py-4 px-2 sm:px-4 space-y-4 sm:space-y-6">
    <!-- 頂部頁頭與操作按鈕區 (針對手機/平板/電腦各視窗優化，參考課程管理) -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-gray-200 shadow-xs">
      <div>
        <h1 class="text-xl sm:text-2xl font-black text-[#154337] tracking-tight">產品與進銷存管理</h1>
        <p class="text-xs text-gray-500 mt-1">進貨、銷售財務連動與庫存紀錄追蹤</p>
      </div>

      <div class="flex flex-row items-center gap-2.5 w-full md:w-auto">
        <button 
          v-if="activeTab === 'products'" 
          @click="openProductModal()" 
          class="w-full sm:w-auto px-4 py-2.5 bg-[#154337] text-white rounded-xl text-xs font-bold hover:bg-[#0e2f27] transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
        >
          <Icon name="mdi:plus-circle-outline" class="text-base" />
          <span>新增產品建檔</span>
        </button>
      </div>
    </div>

    <!-- 頁籤分頁 (高奢膠囊導航列) -->
    <div class="bg-[#FAF4EE]/70 p-1.5 rounded-2xl flex border border-[#154337]/10 w-full sm:w-auto max-w-md">
      <button 
        @click="switchTab('products')" 
        :class="['flex-1 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5', activeTab === 'products' ? 'bg-[#154337] text-white shadow-2xs' : 'text-gray-600 hover:text-[#154337]']"
      >
        <span>📦 產品清單</span>
        <span :class="['px-1.5 py-0.2 rounded-full text-[10px] font-mono', activeTab === 'products' ? 'bg-white/20 text-white' : 'bg-gray-200/80 text-gray-600']">
          {{ products.length }}
        </span>
      </button>
      <button 
        @click="switchTab('transactions')" 
        :class="['flex-1 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5', activeTab === 'transactions' ? 'bg-[#154337] text-white shadow-2xs' : 'text-gray-600 hover:text-[#154337]']"
      >
        <span>📋 全站異動紀錄</span>
        <span :class="['px-1.5 py-0.2 rounded-full text-[10px] font-mono', activeTab === 'transactions' ? 'bg-white/20 text-white' : 'bg-gray-200/80 text-gray-600']">
          {{ transactions.length }}
        </span>
      </button>
    </div>

    <!-- Toast 提示 Banner -->
    <div v-if="statusMessage" :class="['p-3 sm:p-4 rounded-2xl text-xs sm:text-sm font-bold text-center border animate-fade-in shadow-xs', isError ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200']">
      {{ statusMessage }}
    </div>

    <!-- 區塊 A: 產品清單 (手機端雙重優化卡片 + 桌機精緻表格) -->
    <div v-if="activeTab === 'products'" class="space-y-3.5 sm:space-y-4">
      <!-- 產品搜尋列 -->
      <div class="bg-white p-3 sm:p-4 rounded-2xl border border-gray-200/90 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
        <div class="relative flex-1 max-w-full sm:max-w-md">
          <Icon 
            name="mdi:magnify" 
            class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-base z-10" 
          />
          <input 
            type="text" 
            v-model="productSearchText" 
            placeholder="搜尋產品名稱或編號..." 
            class="w-full pl-10 pr-8 py-2 bg-gray-50/70 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-[#154337] rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-[#154337]/20 outline-none transition"
          />
          <button 
            v-if="productSearchText" 
            @click="productSearchText = ''" 
            type="button"
            class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-200 transition cursor-pointer z-10"
            title="清除搜尋"
          >
            <Icon name="mdi:close" size="14" />
          </button>
        </div>

        <div class="text-[11px] font-bold text-gray-400 text-right sm:text-left">
          共 <span class="text-gray-800 font-mono">{{ filteredProducts.length }}</span> 項產品
        </div>
      </div>

      <!-- 列表容器 -->
      <div class="bg-transparent sm:bg-white rounded-2xl sm:shadow-xs sm:border sm:border-gray-200 overflow-hidden">
        <div v-if="isLoading" class="p-12 text-center text-gray-400 bg-white rounded-2xl">
          <Icon name="mdi:loading" class="animate-spin text-3xl mb-2 text-[#154337]" />
          <p class="text-xs sm:text-sm font-bold text-gray-500">載入產品清單中...</p>
        </div>

        <div v-else-if="filteredProducts.length === 0" class="p-12 text-center text-gray-400 bg-white rounded-2xl border sm:border-0 border-gray-200">
          <Icon name="mdi:package-variant-closed" class="text-3xl text-gray-300 mx-auto mb-2" />
          <p v-if="productSearchText" class="text-xs sm:text-sm font-bold">找不到符合「{{ productSearchText }}」的產品項目。</p>
          <p v-else class="text-xs sm:text-sm font-bold">目前尚無產品資料，請點擊右上角「新增產品建檔」。</p>
        </div>

        <div v-else>
          <!-- 📱 手機端：高奢觸控優化卡片列表 (< 640px) -->
          <div class="block sm:hidden space-y-3">
            <div 
              v-for="item in filteredProducts" 
              :key="item.id" 
              class="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-2xs space-y-3 relative overflow-hidden"
            >
              <!-- 卡片頂部：產品名稱與庫存徽章 -->
              <div class="flex justify-between items-start gap-2">
                <div>
                  <div class="flex items-center gap-1.5">
                    <span class="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-bold">#{{ item.id }}</span>
                    <h3 class="font-bold text-gray-900 text-base leading-snug">{{ item.name }}</h3>
                  </div>
                </div>
                <span :class="['px-2.5 py-1 rounded-full text-xs font-bold border font-mono shrink-0 shadow-2xs', item.stock_quantity > 5 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200']">
                  庫存: {{ item.stock_quantity }} 件
                </span>
              </div>

              <!-- 價格與毛利展示 -->
              <div class="grid grid-cols-2 gap-2 bg-[#FAF4EE]/70 p-3 rounded-xl text-xs">
                <div>
                  <span class="text-gray-400 block text-[10px]">進貨成本</span>
                  <span class="font-mono font-bold text-gray-700 text-sm">${{ item.cost_price.toLocaleString() }}</span>
                </div>
                <div>
                  <span class="text-gray-400 block text-[10px]">建議售價</span>
                  <span class="font-mono font-black text-[#154337] text-sm">${{ item.selling_price.toLocaleString() }}</span>
                </div>
              </div>

              <!-- 手機操作按鈕列 (4 欄等寬等高規格化按鈕) -->
              <div class="grid grid-cols-4 gap-1.5 pt-1 border-t border-gray-100">
                <button 
                  @click="openProductHistoryModal(item)" 
                  class="h-8 inline-flex items-center justify-center gap-0.5 px-1.5 bg-[#154337]/10 text-[#154337] hover:bg-[#154337]/20 border border-[#154337]/20 rounded-xl text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer"
                  title="查看異動履歷"
                >
                  <Icon name="mdi:history" size="13" />
                  <span>紀錄</span>
                </button>

                <button 
                  @click="openStockModal(item)" 
                  class="h-8 inline-flex items-center justify-center gap-0.5 px-1.5 bg-[#154337] text-white hover:bg-[#0e2f27] rounded-xl text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer"
                  title="登記庫存變動"
                >
                  <Icon name="mdi:package-variant-closed-plus" size="13" />
                  <span>異動</span>
                </button>

                <button 
                  @click="openProductModal(item)" 
                  class="h-8 inline-flex items-center justify-center gap-0.5 px-1.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 transition shadow-2xs active:scale-95 cursor-pointer"
                  title="編輯產品資料"
                >
                  <Icon name="mdi:pencil-outline" size="13" />
                  <span>修改</span>
                </button>

                <button 
                  @click="promptDeleteProduct(item)" 
                  class="h-8 inline-flex items-center justify-center gap-0.5 px-1.5 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs font-bold hover:bg-rose-100 transition shadow-2xs active:scale-95 cursor-pointer"
                  title="刪除產品"
                >
                  <Icon name="mdi:trash-can-outline" size="13" />
                  <span>刪除</span>
                </button>
              </div>
            </div>
          </div>

          <!-- 💻 桌機端：傳統精緻表格 (>= 640px，按鈕完全規格化) -->
          <div class="hidden sm:block overflow-x-auto">
            <table class="w-full text-left text-sm text-gray-600">
              <thead class="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-700 uppercase">
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
                <tr v-for="item in filteredProducts" :key="item.id" class="hover:bg-[#FAF4EE]/50 transition">
                  <td class="px-6 py-4 font-mono text-gray-400">#{{ item.id }}</td>
                  <td class="px-6 py-4 font-bold text-gray-900">{{ item.name }}</td>
                  <td class="px-6 py-4 font-mono text-gray-500">${{ item.cost_price.toLocaleString() }}</td>
                  <td class="px-6 py-4 font-mono font-bold text-[#154337]">${{ item.selling_price.toLocaleString() }}</td>
                  <td class="px-6 py-4 font-mono">
                    <span :class="['px-2.5 py-1 rounded-full text-xs font-bold border font-mono shadow-2xs', item.stock_quantity > 5 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200']">
                      {{ item.stock_quantity }} 件
                    </span>
                  </td>
                  <td class="px-6 py-4 text-right">
                    <div class="inline-flex items-center justify-end gap-1.5">
                      <button 
                        @click="openProductHistoryModal(item)" 
                        class="h-7.5 inline-flex items-center justify-center gap-1 px-2.5 bg-[#154337]/10 text-[#154337] hover:bg-[#154337]/20 border border-[#154337]/20 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95"
                        title="查看異動履歷"
                      >
                        <Icon name="mdi:history" size="13" />
                        <span>紀錄</span>
                      </button>
                      <button 
                        @click="openStockModal(item)" 
                        class="h-7.5 inline-flex items-center justify-center gap-1 px-2.5 bg-[#154337] text-white hover:bg-[#0e2f27] rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95"
                        title="登記庫存變動"
                      >
                        <Icon name="mdi:package-variant-closed-plus" size="13" />
                        <span>異動</span>
                      </button>
                      <button 
                        @click="openProductModal(item)" 
                        class="h-7.5 inline-flex items-center justify-center gap-1 px-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 hover:border-gray-300 transition shadow-2xs cursor-pointer active:scale-95"
                        title="編輯產品資料"
                      >
                        <Icon name="mdi:pencil-outline" size="13" />
                        <span>修改</span>
                      </button>
                      <button 
                        @click="promptDeleteProduct(item)" 
                        class="h-7.5 inline-flex items-center justify-center gap-1 px-2.5 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs font-bold hover:bg-rose-100 transition shadow-2xs cursor-pointer active:scale-95"
                        title="刪除產品"
                      >
                        <Icon name="mdi:trash-can-outline" size="13" />
                        <span>刪除</span>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- 區塊 B: 全站異動歷史紀錄 (支援產品名、產品下拉、日期篩選與高階工具列) -->
    <div v-if="activeTab === 'transactions'" class="space-y-3.5 sm:space-y-4">
      <!-- 🌟 異動紀錄專用高階篩選工具列 -->
      <div class="bg-white p-3 sm:p-4 rounded-2xl border border-gray-200/90 shadow-2xs space-y-2.5 sm:space-y-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
        <!-- 搜尋與下拉篩選組 -->
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 flex-wrap">
          <!-- 1. 產品名稱/備註搜尋框 -->
          <div class="relative flex-1 min-w-[180px]">
            <Icon 
              name="mdi:magnify" 
              class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-base z-10" 
            />
            <input 
              type="text" 
              v-model="transactionSearchText" 
              placeholder="搜尋產品名稱或備註說明..." 
              class="w-full pl-10 pr-8 py-2 bg-gray-50/70 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-[#154337] rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-[#154337]/20 outline-none transition"
            />
            <button 
              v-if="transactionSearchText" 
              @click="transactionSearchText = ''" 
              type="button"
              class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-200 transition cursor-pointer z-10"
              title="清除關鍵字"
            >
              <Icon name="mdi:close" size="14" />
            </button>
          </div>

          <!-- 2. 產品下拉篩選 -->
          <div class="min-w-[140px]">
            <select 
              v-model="transactionProductFilter" 
              class="w-full py-2 px-3 bg-gray-50/70 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-[#154337] rounded-xl text-xs font-bold text-gray-700 focus:ring-2 focus:ring-[#154337]/20 outline-none transition cursor-pointer"
            >
              <option value="">全部產品 (All)</option>
              <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>

          <!-- 3. 日期篩選 (支援單日快速尋找) -->
          <div class="relative min-w-[140px]">
            <input 
              type="date" 
              v-model="transactionDateFilter" 
              class="w-full py-1.5 px-3 bg-gray-50/70 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-[#154337] rounded-xl text-xs font-bold font-mono text-gray-700 focus:ring-2 focus:ring-[#154337]/20 outline-none transition cursor-pointer"
              title="依發生日期篩選"
            />
            <button 
              v-if="transactionDateFilter" 
              @click="transactionDateFilter = ''" 
              type="button"
              class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-200 transition cursor-pointer"
              title="清除日期篩選"
            >
              <Icon name="mdi:close" size="14" />
            </button>
          </div>

          <!-- 4. 異動類型篩選 -->
          <div class="min-w-[110px]">
            <select 
              v-model="transactionTypeFilter" 
              class="w-full py-2 px-3 bg-gray-50/70 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-[#154337] rounded-xl text-xs font-bold text-gray-700 focus:ring-2 focus:ring-[#154337]/20 outline-none transition cursor-pointer"
            >
              <option value="">全部類型</option>
              <option value="purchase">進貨 (+)</option>
              <option value="sale">銷售 (-)</option>
              <option value="usage">領用/耗損 (-)</option>
              <option value="adjustment">盤點重置</option>
            </select>
          </div>
        </div>

        <!-- 右側操作按鈕與統計摘要 -->
        <div class="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-gray-100">
          <button 
            v-if="isTransactionFilterActive" 
            @click="clearTransactionFilters" 
            type="button"
            class="px-2.5 py-1.5 text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl font-bold transition cursor-pointer flex items-center gap-1 active:scale-95"
          >
            <Icon name="mdi:filter-remove-outline" size="13" />
            <span>重設篩選</span>
          </button>

          <div class="text-[11px] font-bold text-gray-400 border-l border-gray-200 pl-3">
            顯示 <span class="text-gray-800 font-mono">{{ filteredTransactions.length }}</span> / {{ transactions.length }} 筆
          </div>
        </div>
      </div>

      <!-- 異動紀錄容器 -->
      <div class="bg-transparent sm:bg-white rounded-2xl sm:shadow-xs sm:border sm:border-gray-200 overflow-hidden">
        <div v-if="isLoading" class="p-12 text-center text-gray-400 bg-white rounded-2xl">
          <Icon name="mdi:loading" class="animate-spin text-3xl mb-2 text-[#154337]" />
          <p class="text-xs sm:text-sm font-bold text-gray-500">載入異動紀錄中...</p>
        </div>

        <div v-else-if="filteredTransactions.length === 0" class="py-14 sm:py-16 text-center text-gray-400 text-xs sm:text-sm bg-white rounded-2xl border sm:border-0 border-gray-200">
          <Icon name="mdi:clipboard-text-search-outline" class="text-3xl text-gray-300 mx-auto mb-2" />
          <p v-if="isTransactionFilterActive" class="font-bold text-gray-600">找不到符合篩選條件的異動紀錄。</p>
          <p v-else class="font-bold text-gray-600">目前尚無庫存異動紀錄。</p>
          <button 
            v-if="isTransactionFilterActive" 
            @click="clearTransactionFilters" 
            class="mt-3 px-3.5 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 font-bold rounded-xl text-xs transition cursor-pointer inline-flex items-center gap-1"
          >
            <Icon name="mdi:filter-remove-outline" size="14" />
            <span>清除所有篩選條件</span>
          </button>
        </div>

        <div v-else>
          <!-- 📱 手機端卡片列表 (< 640px) -->
          <div class="block sm:hidden space-y-3">
            <div 
              v-for="t in filteredTransactions" 
              :key="t.id" 
              class="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-2xs space-y-2.5"
            >
              <div class="flex justify-between items-start">
                <div>
                  <span class="text-[10px] font-mono text-gray-400 block">{{ t.date }}</span>
                  <h4 class="font-bold text-gray-900 text-sm mt-0.5">{{ t.product_name }}</h4>
                </div>
                <span :class="['px-2.5 py-0.5 rounded-full text-[10px] font-bold border shadow-2xs', getTypeBadgeClass(t.type)]">
                  {{ getTypeName(t.type) }}
                </span>
              </div>

              <div class="flex justify-between items-center bg-[#FAF4EE]/70 p-2.5 rounded-xl text-xs font-mono">
                <div>異動數量: <span class="font-black text-sm" :class="getQuantityColorClass(t.type, t.quantity)">{{ formatQuantityDisplay(t.type, t.quantity) }} 件</span></div>
                <div>總金額: <span class="font-bold text-[#154337]">${{ (t.total_amount || 0).toLocaleString() }}</span></div>
              </div>

              <p v-if="t.description" class="text-xs text-gray-500 pt-0.5">備註: {{ t.description }}</p>

              <!-- 操作按鈕 (手機端等高設計) -->
              <div class="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                <button 
                  @click="openStockModal(products.find(p => p.id === t.product_id) || { id: t.product_id, name: t.product_name!, cost_price: 0, selling_price: 0, stock_quantity: 0 }, t)" 
                  class="h-8 inline-flex items-center justify-center gap-1 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer"
                >
                  <Icon name="mdi:pencil-outline" size="13" />
                  <span>編輯紀錄</span>
                </button>
                <button 
                  @click="handleDeleteTransaction(t.id!)" 
                  class="h-8 inline-flex items-center justify-center gap-1 bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 rounded-xl text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer"
                >
                  <Icon name="mdi:trash-can-outline" size="13" />
                  <span>刪除紀錄</span>
                </button>
              </div>
            </div>
          </div>

          <!-- 💻 桌機端表格 (>= 640px，按鈕完全規格化) -->
          <div class="hidden sm:block overflow-x-auto">
            <table class="w-full text-left text-sm text-gray-600">
              <thead class="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-700 uppercase">
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
                <tr v-for="t in filteredTransactions" :key="t.id" class="hover:bg-[#FAF4EE]/50 transition">
                  <td class="px-6 py-4 font-mono text-gray-500 text-xs">{{ t.date }}</td>
                  <td class="px-6 py-4 font-bold text-gray-900">{{ t.product_name }}</td>
                  <td class="px-6 py-4">
                    <span :class="['px-2.5 py-1 rounded-full text-xs font-bold border shadow-2xs', getTypeBadgeClass(t.type)]">
                      {{ getTypeName(t.type) }}
                    </span>
                  </td>
                  <td class="px-6 py-4 font-mono font-black text-sm" :class="getQuantityColorClass(t.type, t.quantity)">
                    {{ formatQuantityDisplay(t.type, t.quantity) }} 件
                  </td>
                  <td class="px-6 py-4 font-mono text-xs">
                    <span class="block font-bold text-[#154337]">${{ (t.total_amount || 0).toLocaleString() }}</span>
                    <span class="text-gray-400 text-[11px]">(單價: ${{ t.unit_price }})</span>
                  </td>
                  <td class="px-6 py-4 text-xs text-gray-500 max-w-xs truncate">{{ t.description || '-' }}</td>
                  <td class="px-6 py-4 text-right">
                    <div class="inline-flex items-center justify-end gap-1.5">
                      <button 
                        @click="openStockModal(products.find(p => p.id === t.product_id) || { id: t.product_id, name: t.product_name!, cost_price: 0, selling_price: 0, stock_quantity: 0 }, t)" 
                        class="h-7.5 inline-flex items-center justify-center gap-1 px-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 hover:border-gray-300 transition shadow-2xs cursor-pointer active:scale-95"
                        title="編輯異動紀錄"
                      >
                        <Icon name="mdi:pencil-outline" size="13" />
                        <span>編輯</span>
                      </button>
                      <button 
                        @click="handleDeleteTransaction(t.id!)" 
                        class="h-7.5 inline-flex items-center justify-center gap-1 px-2.5 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs font-bold hover:bg-rose-100 transition shadow-2xs cursor-pointer active:scale-95"
                        title="刪除此筆異動紀錄"
                      >
                        <Icon name="mdi:trash-can-outline" size="13" />
                        <span>刪除</span>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- 單一產品歷史紀錄 Modal (高奢時間軸化) -->
    <div v-if="showHistoryModal" class="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50">
      <div class="bg-white rounded-3xl shadow-2xl max-w-xl w-full max-h-[90dvh] flex flex-col relative border border-gray-100 animate-fade-in overflow-hidden">
        <div class="p-4 sm:p-5 pb-3 sm:pb-4 border-b border-gray-100 flex justify-between items-start">
          <div>
            <div class="flex items-center gap-2">
              <span class="p-1.5 rounded-xl bg-[#154337]/10 text-[#154337]">
                <Icon name="mdi:history" class="text-base sm:text-lg" />
              </span>
              <h3 class="text-base sm:text-lg font-bold text-[#154337]">產品庫存異動履歷</h3>
            </div>
            <p class="text-xs text-gray-500 mt-1">
              產品：<span class="font-bold text-gray-800">{{ selectedHistoryProduct?.name }}</span>
              <span class="mx-1.5 text-gray-300">|</span>
              售價：<span class="font-mono font-bold text-[#154337]">${{ selectedHistoryProduct?.selling_price?.toLocaleString() }}</span>
            </p>
          </div>
          <button 
            @click="showHistoryModal = false" 
            class="text-gray-400 hover:text-gray-800 bg-gray-100 rounded-full p-1.5 transition cursor-pointer shrink-0"
          >
            <Icon name="mdi:close" size="18" />
          </button>
        </div>

        <!-- 庫存狀態條 -->
        <div class="bg-[#FAF4EE]/70 p-3.5 sm:p-4 mx-3 sm:mx-5 mt-3 sm:mt-4 rounded-2xl border border-[#154337]/10 flex justify-between items-center text-xs">
          <div>
            <span class="text-gray-400 font-bold block text-[10px]">進貨成本</span>
            <span class="font-mono font-bold text-gray-700">${{ selectedHistoryProduct?.cost_price?.toLocaleString() }}</span>
          </div>
          <div class="text-center">
            <span class="text-gray-400 font-bold block text-[10px]">異動紀錄數</span>
            <span class="font-mono font-bold text-gray-700">{{ currentProductHistory.length }} 筆</span>
          </div>
          <div class="text-right">
            <span class="text-gray-400 font-bold block text-[10px]">目前在席庫存</span>
            <span :class="['font-mono font-black text-sm sm:text-base', (selectedHistoryProduct?.stock_quantity || 0) > 0 ? 'text-[#154337]' : 'text-rose-500']">
              {{ selectedHistoryProduct?.stock_quantity }} 件
            </span>
          </div>
        </div>

        <div class="p-3 sm:p-5 flex-1 overflow-y-auto max-h-[50vh] space-y-2.5">
          <div v-if="isLoadingHistory" class="py-10 text-center text-gray-400 text-xs flex items-center justify-center gap-2">
            <Icon name="mdi:loading" class="animate-spin text-lg text-[#154337]" />
            <span>載入異動履歷中...</span>
          </div>
          <div v-else-if="currentProductHistory.length === 0" class="py-10 text-center text-gray-400 text-xs bg-gray-50/70 rounded-2xl border border-dashed border-gray-200">
            <Icon name="mdi:clipboard-text-clock-outline" class="text-3xl text-gray-300 mx-auto mb-2" />
            <p class="font-bold text-gray-600">該產品尚無庫存異動紀錄</p>
          </div>
          <div v-else class="space-y-2.5">
            <div 
              v-for="h in currentProductHistory" 
              :key="h.id" 
              class="p-3 bg-white border border-gray-200/90 rounded-2xl shadow-2xs space-y-1.5 hover:border-[#154337]/30 transition"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5">
                  <span :class="['px-2 py-0.5 rounded-md text-[10px] font-bold border', getTypeBadgeClass(h.type)]">
                    {{ getTypeName(h.type) }}
                  </span>
                  <span class="font-mono text-gray-400 text-xs">{{ h.date }}</span>
                </div>

                <div class="flex items-center gap-2">
                  <div class="text-right font-mono">
                    <span :class="['font-black text-xs', getQuantityColorClass(h.type, h.quantity)]">
                      {{ formatQuantityDisplay(h.type, h.quantity) }} 件
                    </span>
                    <span v-if="h.total_amount" class="text-gray-400 text-[10px] ml-1.5">(${{ h.total_amount.toLocaleString() }})</span>
                  </div>
                  <button 
                    @click="handleDeleteTransaction(h.id!)" 
                    class="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                    title="刪除此筆紀錄"
                  >
                    <Icon name="mdi:trash-can-outline" size="14" />
                  </button>
                </div>
              </div>
              <p v-if="h.description" class="text-gray-500 text-[11px] truncate">{{ h.description }}</p>
            </div>
          </div>
        </div>

        <div class="p-3.5 sm:p-4 border-t border-gray-100 bg-gray-50/50 flex justify-end">
          <button 
            type="button" 
            @click="showHistoryModal = false" 
            class="px-5 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-100 transition shadow-2xs cursor-pointer active:scale-95"
          >
            關閉
          </button>
        </div>
      </div>
    </div>



    <!-- 產品編輯 Modal -->
    <div v-if="showProductModal" class="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 relative border border-gray-100 animate-fade-in">
        <button @click="showProductModal = false" class="absolute top-4 right-4 text-gray-400 hover:text-gray-800 bg-gray-100 rounded-full p-1 transition cursor-pointer">
          <Icon name="mdi:close" size="20" />
        </button>

        <h3 class="text-lg font-bold text-[#154337] mb-5">
          {{ isEditingProduct ? '編輯產品資料' : '新增產品建檔' }}
        </h3>

        <form @submit.prevent="handleProductSubmit" class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">產品名稱</label>
            <input type="text" v-model="productForm.name" required placeholder="如：極致修護精華液" class="w-full border border-gray-300 rounded-xl p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none" />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">進貨成本 ($)</label>
              <input type="number" v-model.number="productForm.cost_price" required min="0" class="w-full border border-gray-300 rounded-xl p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none font-mono" />
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">建議售價 ($)</label>
              <input type="number" v-model.number="productForm.selling_price" required min="0" class="w-full border border-gray-300 rounded-xl p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none font-mono" />
            </div>
          </div>

          <!-- 庫存數量說明卡片 (新建檔強制為 0，需透過產銷管理異動) -->
          <div class="bg-[#FAF4EE]/80 border border-[#154337]/15 p-3.5 rounded-2xl text-xs space-y-1">
            <div class="flex items-center gap-1.5 font-bold text-[#154337]">
              <Icon name="mdi:information-outline" size="16" />
              <span>產品庫存規範</span>
            </div>
            <p class="text-gray-600 leading-relaxed text-[11px]">
              建檔時預設庫存為 <span class="font-bold text-[#154337] font-mono">0 件</span>。如需增加進貨或調整庫存，請於產品建檔成功後在列表點擊<span class="font-bold text-[#154337]">「庫存異動」</span>按鈕登記產銷紀錄。
            </p>
          </div>

          <div class="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button type="button" @click="showProductModal = false" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-200 transition">取消</button>
            <button type="submit" class="px-4 py-2 bg-[#154337] text-white rounded-xl text-xs font-bold hover:bg-[#0e2f27] transition shadow-md">儲存</button>
          </div>
        </form>
      </div>
    </div>

    <!-- 庫存異動 Modal -->
    <div v-if="showStockModal" class="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 relative border border-gray-100 animate-fade-in">
        <button @click="showStockModal = false" class="absolute top-4 right-4 text-gray-400 hover:text-gray-800 bg-gray-100 rounded-full p-1 transition cursor-pointer">
          <Icon name="mdi:close" size="20" />
        </button>

        <h3 class="text-lg font-bold text-[#154337] mb-1">
          {{ isEditingStock ? '編輯庫存異動紀錄' : '登記庫存變動' }}
        </h3>
        <p class="text-xs font-bold text-gray-500 mb-4">產品：<span class="text-gray-800">{{ stockForm.product_name }}</span></p>

        <form @submit.prevent="handleStockSubmit" class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">異動類型</label>
            <select v-model="stockForm.type" @change="handleTypeChange(products.find(p => p.id === stockForm.product_id)!)" class="w-full border border-gray-300 rounded-xl p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none">
              <option value="purchase">進貨 (+ 庫存)</option>
              <option value="sale">銷售 (- 庫存)</option>
              <option value="usage">耗損 / 店內領用 (- 庫存)</option>
              <option value="adjustment">庫存盤點重置</option>
            </select>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">變動數量</label>
              <input 
                type="number" 
                v-model.number="stockForm.quantity" 
                required 
                class="w-full border border-gray-300 rounded-xl p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none font-mono" 
              />
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">單價 ($)</label>
              <input 
                type="number" 
                v-model.number="stockForm.unit_price" 
                required 
                min="0" 
                :disabled="stockForm.type === 'adjustment' || stockForm.type === 'usage'" 
                class="w-full border border-gray-300 rounded-xl p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none font-mono disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed" 
              />
            </div>
          </div>
          <p v-if="stockForm.type === 'adjustment'" class="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200/80 p-2.5 rounded-xl leading-relaxed">
            💡 <b>庫存盤點重置模式</b>：數量可設定為 0 或盤點調整數，單價固定為 $0 且不可編輯，100% 不影響財務報表與收支帳目。
          </p>

          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">發生日期</label>
            <input type="date" v-model="stockForm.date" required class="w-full border border-gray-300 rounded-xl p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none" />
          </div>

          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">備註說明</label>
            <textarea v-model="stockForm.description" rows="2" placeholder="如：廠商補貨、顧客購買..." class="w-full border border-gray-300 rounded-xl p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none"></textarea>
          </div>

          <div class="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button type="button" @click="showStockModal = false" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-200 transition">取消</button>
            <button type="submit" class="px-4 py-2 bg-[#154337] text-white rounded-xl text-xs font-bold hover:bg-[#0e2f27] transition shadow-md">儲存變動</button>
          </div>
        </form>
      </div>
    </div>

    <!-- 刪除產品 Warning Modal -->
    <div v-if="showDeleteWarningModal" class="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 relative border border-gray-100 animate-fade-in">
        <div class="flex items-center gap-3 text-rose-600 mb-3">
          <div class="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
            <Icon name="mdi:alert-decagram" class="text-2xl text-rose-600" />
          </div>
          <div>
            <h3 class="text-base font-bold text-gray-900">確認要刪除此產品？</h3>
            <p class="text-xs text-rose-600 font-bold">⚠️ 此操作無法復原</p>
          </div>
        </div>

        <p class="text-xs text-gray-600 leading-relaxed mb-4 bg-rose-50/50 p-3 rounded-2xl border border-rose-100">
          您即將刪除「<span class="font-bold text-gray-900">{{ targetDeleteProduct?.name }}</span>」。刪除產品將會一併移除該產品的所有庫存異動歷史紀錄。
        </p>

        <div class="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button @click="showDeleteWarningModal = false" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-200 transition">取消</button>
          <button @click="confirmDeleteProduct" :disabled="isDeleting" class="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition shadow-md flex items-center gap-1.5">
            <Icon v-if="isDeleting" name="mdi:loading" class="animate-spin" />
            <span>{{ isDeleting ? '刪除中...' : '確認刪除' }}</span>
          </button>
        </div>
      </div>
    </div>

  </div>
</template>