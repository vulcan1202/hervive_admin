<script setup lang="ts">
import { ref, onMounted, reactive, watch } from 'vue'

const config = useRuntimeConfig()
const backendUrl = config.public.backendUrl

// --- 1. 狀態與篩選 ---
const currentTab = ref<'cash_flow' | 'revenue'>('cash_flow')

const today = new Date()

const startDateObj = ref<Date | null>(today)
const endDateObj = ref<Date | null>(today)

const startDateStr = ref(startDateObj.value?.toISOString().slice(0, 10) || '')
const endDateStr = ref(endDateObj.value?.toISOString().slice(0, 10) || '')

watch(startDateObj, (newStart) => {
  if (newStart) {
    startDateStr.value = new Date(newStart.getTime() - newStart.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
    if (endDateObj.value && endDateObj.value < newStart) {
      endDateObj.value = new Date(newStart)
    }
  } else {
    startDateStr.value = ''
  }
})

watch(endDateObj, (newEnd) => {
  if (newEnd) {
    endDateStr.value = new Date(newEnd.getTime() - newEnd.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
  } else {
    endDateStr.value = ''
  }
})

// 🌟 快速月份切換邏輯 (本月、上個月、下個月)
const setThisMonth = () => {
  const now = new Date()
  startDateObj.value = new Date(now.getFullYear(), now.getMonth(), 1)
  endDateObj.value = new Date(now.getFullYear(), now.getMonth() + 1, 0)
}

const setPrevMonth = () => {
  const refDate = startDateObj.value ? new Date(startDateObj.value) : new Date()
  const year = refDate.getFullYear()
  const month = refDate.getMonth()
  startDateObj.value = new Date(year, month - 1, 1)
  endDateObj.value = new Date(year, month, 0)
}

const setNextMonth = () => {
  const refDate = startDateObj.value ? new Date(startDateObj.value) : new Date()
  const year = refDate.getFullYear()
  const month = refDate.getMonth()
  startDateObj.value = new Date(year, month + 1, 1)
  endDateObj.value = new Date(year, month + 2, 0)
}

const summary = reactive({
  total_income: 0,
  total_expense: 0,
  net_cash_flow: 0,
  total_recognized_revenue: 0,
  estimated_cost: 0
})

const cashList = ref<any[]>([])
const revenueList = ref<any[]>([])
const loading = ref(false)

// Modal 控制狀態
const showCashModal = ref(false)
const showEditCashModal = ref(false)

const cashForm = reactive({
  type: 'expense',
  category: '店面雜支',
  amount: 0,
  payment_method: 'Cash',
  date: new Date().toISOString().slice(0, 10),
  description: ''
})

const editCashForm = reactive({
  id: null as number | null,
  type: 'expense',
  category: '',
  amount: 0,
  payment_method: 'Cash',
  date: '',
  description: ''
})

// --- 2. API 資料載入 ---
const fetchFinancialData = async () => {
  if (!startDateStr.value || !endDateStr.value) return 
  
  loading.value = true
  try {
    const query = `start_date=${startDateStr.value}&end_date=${endDateStr.value}`
    
    const [resSummary, resCash, resRevenue] = await Promise.all([
      fetch(`${backendUrl}/api/financial-summary?${query}`).then(r => r.json()),
      fetch(`${backendUrl}/api/cash-transactions?${query}`).then(r => r.json()),
      fetch(`${backendUrl}/api/revenue-recognitions?${query}`).then(r => r.json())
    ])

    const summaryData = resSummary.data || resSummary

    if (summaryData && summaryData.cash_flow) {
      summary.total_income = summaryData.cash_flow.total_income || 0
      summary.total_expense = summaryData.cash_flow.total_expense || 0
      summary.net_cash_flow = summaryData.cash_flow.net_cash_flow || 0
      summary.total_recognized_revenue = summaryData.revenue_recognition?.total_recognized_revenue || 0
      summary.estimated_cost = summaryData.revenue_recognition?.estimated_cost || 0
    }
    
    cashList.value = resCash.data || resCash || []
    revenueList.value = resRevenue.data || resRevenue || []
  } catch (err) {
    console.error('讀取財務報表失敗', err)
  } finally {
    loading.value = false
  }
}

watch([startDateStr, endDateStr], () => {
  if (startDateStr.value && endDateStr.value) {
    fetchFinancialData()
  }
})

// 手動新增收支
const handleAddCashTransaction = async () => {
  if (cashForm.amount <= 0) return alert('請輸入有效金額！')
  try {
    const res = await fetch(`${backendUrl}/api/cash-transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cashForm)
    })
    if (!res.ok) throw new Error('新增失敗')
    alert('✅ 收支紀錄已成功建立！')
    showCashModal.value = false
    fetchFinancialData()
  } catch (err: any) {
    alert(err.message)
  }
}

// 開啟編輯收支 Modal
const openEditCashModal = (item: any) => {
  editCashForm.id = item.id
  editCashForm.type = item.type
  editCashForm.category = item.category
  editCashForm.amount = item.amount
  editCashForm.payment_method = item.payment_method || 'Cash'
  editCashForm.date = item.date
  editCashForm.description = item.description || ''
  showEditCashModal.value = true
}

// 儲存編輯收支
const handleUpdateCashTransaction = async () => {
  if (editCashForm.amount <= 0) return alert('請輸入有效金額！')
  try {
    const res = await fetch(`${backendUrl}/api/cash-transactions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editCashForm)
    })
    if (!res.ok) throw new Error('更新失敗')
    alert('✅ 收支紀錄已更新！')
    showEditCashModal.value = false
    fetchFinancialData()
  } catch (err: any) {
    alert(err.message)
  }
}

// 刪除收支紀錄
const handleDeleteCashTransaction = async (item: any) => {
  let confirmMsg = `確定要刪除這筆${item.type === 'income' ? '收入' : '支出'}紀錄嗎？`
  if (item.category === '課程退款') {
    confirmMsg = `⚠️ 注意：此筆為「課程退款」紀錄！刪除後系統將會自動把當初退還的堂數「加回會員包套中」。確定要刪除嗎？`
  }
  if (!confirm(confirmMsg)) return

  try {
    const res = await fetch(`${backendUrl}/api/cash-transactions?id=${item.id}`, {
      method: 'DELETE'
    })
    if (!res.ok) throw new Error('刪除失敗')
    alert('✅ 紀錄已刪除，相關帳務與堂數已同步！')
    fetchFinancialData()
  } catch (err: any) {
    alert(err.message)
  }
}

onMounted(() => fetchFinancialData())
</script>

<template>
  <div class="space-y-4 sm:space-y-6">
    <!-- 頂部列：抬頭與快速日期控制區 (Double-Bezel 7/5/8 高奢與跨端適配) -->
    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-gray-200 shadow-xs">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <span class="px-2.5 py-0.5 rounded-full bg-[#154337]/10 text-[#154337] text-[10px] font-mono font-bold uppercase tracking-wider">
            Accounting & Revenue
          </span>
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
        </div>
        <h1 class="text-xl sm:text-2xl font-black text-[#154337] tracking-tight font-serif">財務與營收管理</h1>
        <p class="text-xs text-gray-500 mt-0.5">追蹤門市每日實際現金流與到店履約營收認列</p>
      </div>
      
      <!-- 日期篩選與按鈕區 (針對手機版與桌面版進行響應式排列) -->
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
        
        <!-- 日期範圍選擇與月份快選按鈕組 -->
        <div class="flex flex-wrap items-center gap-2 bg-[#FAF4EE]/70 p-2 rounded-2xl border border-[#154337]/10">
          <ClientOnly>
            <div class="flex items-center gap-1.5 flex-1 min-w-[210px]">
              <div class="flex-1">
                <MyCalendar v-model="startDateObj" placeholder="開始日期" class="compact-date-picker bg-white" />
              </div>
              <span class="text-xs text-gray-400 font-bold px-0.5 shrink-0">至</span>
              <div class="flex-1">
                <MyCalendar 
                  v-model="endDateObj" 
                  placeholder="結束日期" 
                  :min-date="startDateObj" 
                  class="compact-date-picker bg-white" 
                />
              </div>
            </div>
          </ClientOnly>

          <div class="hidden sm:block w-px h-6 bg-[#154337]/15 mx-0.5"></div>

          <!-- 🌟 上個月 / 本月 / 下個月 快速切換按鈕群 -->
          <div class="flex items-center gap-1 w-full sm:w-auto justify-between sm:justify-start pt-1 sm:pt-0 border-t sm:border-t-0 border-[#154337]/10">
            <button 
              @click="setPrevMonth" 
              class="flex-1 sm:flex-initial px-2.5 py-1.5 bg-white border border-gray-200 text-gray-700 hover:text-[#154337] hover:border-[#154337] rounded-xl text-xs font-bold transition shadow-2xs hover:bg-[#FAF4EE] flex items-center justify-center gap-0.5 active:scale-95 cursor-pointer"
              title="切換至上個月日期範圍"
            >
              <Icon name="mdi:chevron-left" class="text-sm" />
              <span>上個月</span>
            </button>

            <button 
              @click="setThisMonth" 
              class="flex-1 sm:flex-initial px-3 py-1.5 bg-[#154337] text-white rounded-xl text-xs font-bold hover:bg-[#0e2f27] transition shadow-2xs flex items-center justify-center active:scale-95 cursor-pointer"
              title="快速重置為本月起訖日期"
            >
              本月
            </button>

            <button 
              @click="setNextMonth" 
              class="flex-1 sm:flex-initial px-2.5 py-1.5 bg-white border border-gray-200 text-gray-700 hover:text-[#154337] hover:border-[#154337] rounded-xl text-xs font-bold transition shadow-2xs hover:bg-[#FAF4EE] flex items-center justify-center gap-0.5 active:scale-95 cursor-pointer"
              title="切換至下個月日期範圍"
            >
              <span>下個月</span>
              <Icon name="mdi:chevron-right" class="text-sm" />
            </button>
          </div>
        </div>
        
        <!-- 新增收支按鈕 -->
        <button 
          @click="showCashModal = true" 
          class="w-full sm:w-auto px-5 py-2.5 bg-[#154337] text-white rounded-xl text-xs font-bold hover:bg-[#0e2f27] transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
        >
          <Icon name="mdi:plus-circle" class="text-base" />
          <span>記一筆收支</span>
        </button>
      </div>
    </div>

    <!-- KPI 數據指標卡片 (手機端 2 欄，平板 3 欄，電腦 5 欄 Double-Bezel 升級) -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-4">
      <div class="p-1 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 shadow-xs hover:-translate-y-0.5 transition duration-200">
        <div class="bg-white rounded-[calc(1rem-2px)] p-3.5 sm:p-4 h-full flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="text-[11px] sm:text-xs font-bold text-gray-400">現金總收入</span>
            <div class="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
              <Icon name="mdi:arrow-down-bold" class="text-xs" />
            </div>
          </div>
          <span class="text-lg sm:text-2xl font-black text-emerald-600 mt-2 block font-mono tracking-tight">${{ summary.total_income.toLocaleString() }}</span>
        </div>
      </div>

      <div class="p-1 rounded-2xl bg-rose-500/5 border border-rose-500/10 shadow-xs hover:-translate-y-0.5 transition duration-200">
        <div class="bg-white rounded-[calc(1rem-2px)] p-3.5 sm:p-4 h-full flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="text-[11px] sm:text-xs font-bold text-gray-400">現金總支出</span>
            <div class="w-6 h-6 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200">
              <Icon name="mdi:arrow-up-bold" class="text-xs" />
            </div>
          </div>
          <span class="text-lg sm:text-2xl font-black text-rose-500 mt-2 block font-mono tracking-tight">${{ summary.total_expense.toLocaleString() }}</span>
        </div>
      </div>

      <div class="p-1 rounded-2xl bg-gray-500/5 border border-gray-500/10 shadow-xs hover:-translate-y-0.5 transition duration-200">
        <div class="bg-white rounded-[calc(1rem-2px)] p-3.5 sm:p-4 h-full flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="text-[11px] sm:text-xs font-bold text-gray-400">淨現金流 (淨額)</span>
            <div class="w-6 h-6 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center border border-gray-200">
              <Icon name="mdi:swap-horizontal" class="text-xs" />
            </div>
          </div>
          <span :class="['text-lg sm:text-2xl font-black mt-2 block font-mono tracking-tight', summary.net_cash_flow >= 0 ? 'text-gray-900' : 'text-rose-600']">
            ${{ summary.net_cash_flow.toLocaleString() }}
          </span>
        </div>
      </div>

      <div class="p-1 rounded-2xl bg-[#154337]/10 border border-[#154337]/20 shadow-xs hover:-translate-y-0.5 transition duration-200 col-span-2 sm:col-span-1">
        <div class="bg-[#154337] text-white rounded-[calc(1rem-2px)] p-3.5 sm:p-4 h-full flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="text-[11px] sm:text-xs font-bold text-emerald-200">實質履約總營收</span>
            <div class="w-6 h-6 rounded-lg bg-white/20 text-white flex items-center justify-center">
              <Icon name="mdi:cash-check" class="text-xs" />
            </div>
          </div>
          <span class="text-lg sm:text-2xl font-black mt-2 block font-mono tracking-tight">${{ summary.total_recognized_revenue.toLocaleString() }}</span>
        </div>
      </div>

      <div class="p-1 rounded-2xl bg-amber-500/5 border border-amber-500/10 shadow-xs hover:-translate-y-0.5 transition duration-200 col-span-2 sm:col-span-1">
        <div class="bg-amber-50/80 rounded-[calc(1rem-2px)] p-3.5 sm:p-4 h-full flex flex-col justify-between border border-amber-200/80">
          <div class="flex items-center justify-between">
            <span class="text-[11px] sm:text-xs font-bold text-amber-800">預估履約成本</span>
            <div class="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center border border-amber-300">
              <Icon name="mdi:tag-outline" class="text-xs" />
            </div>
          </div>
          <span class="text-lg sm:text-2xl font-black text-amber-700 mt-2 block font-mono tracking-tight">${{ summary.estimated_cost.toLocaleString() }}</span>
        </div>
      </div>
    </div>

    <!-- 頁籤與數據明細 (針對手機端進行優化) -->
    <div class="bg-white rounded-2xl border border-gray-200 p-3.5 sm:p-6 shadow-xs min-h-[400px]">
      <div class="flex border-b border-gray-100 pb-3 mb-4 gap-3 sm:gap-6 overflow-x-auto">
        <button 
          @click="currentTab = 'cash_flow'" 
          :class="['font-bold text-xs sm:text-sm pb-2 border-b-2 transition whitespace-nowrap cursor-pointer flex items-center gap-1.5', currentTab === 'cash_flow' ? 'border-[#154337] text-[#154337]' : 'border-transparent text-gray-400 hover:text-gray-600']"
        >
          <Icon name="mdi:cash-multiple" size="16" />
          <span>現金流明細 ({{ cashList.length }})</span>
        </button>
        <button 
          @click="currentTab = 'revenue'" 
          :class="['font-bold text-xs sm:text-sm pb-2 border-b-2 transition whitespace-nowrap cursor-pointer flex items-center gap-1.5', currentTab === 'revenue' ? 'border-[#154337] text-[#154337]' : 'border-transparent text-gray-400 hover:text-gray-600']"
        >
          <Icon name="mdi:chart-timeline-variant" size="16" />
          <span>實質營收認列紀錄 ({{ revenueList.length }})</span>
        </button>
      </div>

      <div v-if="loading" class="py-12 text-center text-gray-400 text-xs sm:text-sm flex items-center justify-center gap-2">
        <Icon name="mdi:loading" class="animate-spin text-lg text-[#154337]" /> 讀取財務資料中...
      </div>
      
      <div v-else>
        <!-- 頁籤 1: 現金流明細列表 -->
        <div v-if="currentTab === 'cash_flow'" class="space-y-2.5">
          <div v-if="cashList.length === 0" class="text-center py-12 text-gray-400 text-xs border border-dashed rounded-2xl bg-gray-50/50">
            該時間區間內尚無現金流紀錄。
          </div>
          
          <div 
            v-for="item in cashList" 
            :key="item.id" 
            class="p-3.5 sm:p-4 bg-gray-50/70 hover:bg-gray-100/80 rounded-2xl border border-gray-100 transition space-y-2"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2 flex-wrap">
                <span :class="['px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0', item.type === 'income' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200']">
                  {{ item.type === 'income' ? '收入' : '支出' }}
                </span>
                <span class="font-bold text-xs sm:text-sm text-gray-800">{{ item.category }}</span>
                <span v-if="item.client_name" class="text-xs text-gray-500 font-medium">({{ item.client_name }})</span>
              </div>
              
              <span :class="['font-mono font-bold text-sm sm:text-base shrink-0', item.type === 'income' ? 'text-emerald-600' : 'text-rose-600']">
                {{ item.type === 'income' ? '+' : '-' }}${{ item.amount.toLocaleString() }}
              </span>
            </div>

            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-gray-200/50 text-xs text-gray-500">
              <p class="truncate text-[11px] sm:text-xs">
                {{ item.description || '無備註說明' }} • <span class="font-mono text-gray-400">{{ item.date }}</span>
              </p>
              
              <!-- 編輯與刪除規格化操作按鈕 -->
              <div class="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                <button 
                  @click="openEditCashModal(item)" 
                  class="h-7.5 inline-flex items-center justify-center gap-1 px-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 hover:border-gray-300 transition shadow-2xs cursor-pointer active:scale-95"
                  title="編輯收支"
                >
                  <Icon name="mdi:pencil-outline" size="13" />
                  <span>編輯</span>
                </button>
                <button 
                  @click="handleDeleteCashTransaction(item)" 
                  class="h-7.5 inline-flex items-center justify-center gap-1 px-2.5 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs font-bold hover:bg-rose-100 transition shadow-2xs cursor-pointer active:scale-95"
                  title="刪除收支"
                >
                  <Icon name="mdi:trash-can-outline" size="13" />
                  <span>刪除</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 頁籤 2: 實質營收認列紀錄 -->
        <div v-if="currentTab === 'revenue'" class="space-y-2.5">
          <div v-if="revenueList.length === 0" class="text-center py-12 text-gray-400 text-xs border border-dashed rounded-2xl bg-gray-50/50">
            該時間區間內尚無實質營收認列紀錄。
          </div>
          
          <div 
            v-for="item in revenueList" 
            :key="item.id" 
            class="p-3.5 sm:p-4 bg-gray-50/70 hover:bg-gray-100/80 rounded-2xl border border-gray-100 transition flex items-center justify-between gap-3"
          >
            <div class="space-y-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span :class="['px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0', item.source_type === 'course_usage' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200']">
                  {{ item.source_type === 'course_usage' ? '課程履約' : '產品銷售' }}
                </span>
                <span class="font-bold text-xs sm:text-sm text-gray-800 truncate">{{ item.client_name }}</span>
                <span v-if="item.appointment_code" class="text-[10px] font-mono text-gray-400 bg-gray-200/60 px-1.5 py-0.5 rounded">
                  單號: {{ item.appointment_code }}
                </span>
              </div>
              <p class="text-xs text-gray-500 truncate">
                {{ item.description || item.course_name || '無備註' }} • <span class="font-mono text-gray-400">{{ item.date }}</span>
              </p>
            </div>

            <span class="font-mono font-black text-sm sm:text-base text-[#154337] shrink-0">
              +${{ item.amount.toLocaleString() }}
            </span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 新增收支 Modal -->
    <div v-if="showCashModal" class="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 relative border border-gray-100 animate-fade-in">
        <button @click="showCashModal = false" class="absolute top-4 right-4 text-gray-400 hover:text-gray-800 bg-gray-100 rounded-full p-1 transition cursor-pointer">
          <Icon name="mdi:close" size="20" />
        </button>
        <h3 class="text-lg font-bold text-[#154337] mb-5 flex items-center gap-2">新增收支紀錄</h3>
        <form @submit.prevent="handleAddCashTransaction" class="space-y-4">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">類型</label>
              <select v-model="cashForm.type" class="w-full border border-gray-300 rounded-xl p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none">
                <option value="expense">支出 (Expense)</option>
                <option value="income">收入 (Income)</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">分類</label>
              <input type="text" v-model="cashForm.category" required placeholder="如：店租、進貨" class="w-full border border-gray-300 rounded-xl p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">金額 ($)</label>
              <input type="number" v-model.number="cashForm.amount" required min="1" class="w-full border border-gray-300 rounded-xl p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none font-mono" />
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">日期</label>
              <input type="date" v-model="cashForm.date" required class="w-full border border-gray-300 rounded-xl p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">備註說明</label>
            <textarea v-model="cashForm.description" rows="2" class="w-full border border-gray-300 rounded-xl p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none"></textarea>
          </div>
          <div class="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button type="button" @click="showCashModal = false" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-200 transition">取消</button>
            <button type="submit" class="px-4 py-2 bg-[#154337] text-white rounded-xl text-xs font-bold hover:bg-[#0e2f27] transition shadow-md">確定儲存</button>
          </div>
        </form>
      </div>
    </div>

    <!-- 編輯收支 Modal -->
    <div v-if="showEditCashModal" class="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 relative border border-gray-100 animate-fade-in">
        <button @click="showEditCashModal = false" class="absolute top-4 right-4 text-gray-400 hover:text-gray-800 bg-gray-100 rounded-full p-1 transition cursor-pointer">
          <Icon name="mdi:close" size="20" />
        </button>
        <h3 class="text-lg font-bold text-[#154337] mb-5 flex items-center gap-2">編輯收支紀錄</h3>
        <form @submit.prevent="handleUpdateCashTransaction" class="space-y-4">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">類型</label>
              <select v-model="editCashForm.type" class="w-full border border-gray-300 rounded-xl p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none">
                <option value="expense">支出 (Expense)</option>
                <option value="income">收入 (Income)</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">分類</label>
              <input type="text" v-model="editCashForm.category" required class="w-full border border-gray-300 rounded-xl p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">金額 ($)</label>
              <input type="number" v-model.number="editCashForm.amount" required min="1" class="w-full border border-gray-300 rounded-xl p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none font-mono" />
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">日期</label>
              <input type="date" v-model="editCashForm.date" required class="w-full border border-gray-300 rounded-xl p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">備註說明</label>
            <textarea v-model="editCashForm.description" rows="2" class="w-full border border-gray-300 rounded-xl p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none"></textarea>
          </div>
          <div class="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button type="button" @click="showEditCashModal = false" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-200 transition">取消</button>
            <button type="submit" class="px-4 py-2 bg-[#154337] text-white rounded-xl text-xs font-bold hover:bg-[#0e2f27] transition shadow-md">儲存修改</button>
          </div>
        </form>
      </div>
    </div>

  </div>
</template>

<style>
.compact-date-picker :deep(input) {
  padding: 0.25rem 0.5rem !important;
  font-size: 0.75rem !important;
  height: 30px !important;
  min-height: 30px !important;
  border: none !important;
  box-shadow: none !important;
  background-color: transparent !important;
}
.compact-date-picker :deep(.dp__input_icon) {
  display: none !important;
}
.compact-date-picker :deep(.dp__input_icon_pad) {
  padding-left: 0.5rem !important; 
}
.compact-date-picker {
  --dp-font-size: 0.75rem;
  --dp-menu-min-width: 230px;
  --dp-cell-size: 26px;
  --dp-cell-padding: 2px;
  --dp-row-margin: 2px 0;
  --dp-button-height: 28px;
  --dp-month-year-row-height: 30px;
  --dp-button-icon-height: 16px;
}
</style>