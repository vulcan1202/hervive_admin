<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'

const config = useRuntimeConfig()
const backendUrl = config.public.backendUrl
const route = useRoute()

// 狀態宣告
const isLoading = ref(true)
const selectedPreset = ref<'week' | 'month' | 'quarter' | 'year' | 'custom'>('month')

// 日期區間
const startDate = ref('')
const endDate = ref('')

// 數據統計指標
const financialSummary = ref<any>(null)
const revenueRecognitions = ref<any[]>([])
const appointments = ref<any[]>([])
const products = ref<any[]>([])

// 格式化 YYYY-MM-DD
const formatDate = (d: Date) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 設定日期區間快選
const setPresetRange = (preset: 'week' | 'month' | 'quarter' | 'year') => {
  selectedPreset.value = preset
  const today = new Date()
  const year = today.getFullYear()

  if (preset === 'week') {
    // 🌟 週報精準計算：本週一至本週日
    const dayOfWeek = today.getDay() // 0 是週日, 1 是週一...
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(today)
    monday.setDate(today.getDate() + diffToMonday)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    
    startDate.value = formatDate(monday)
    endDate.value = formatDate(sunday)
  } else if (preset === 'month') {
    const month = String(today.getMonth() + 1).padStart(2, '0')
    startDate.value = `${year}-${month}-01`
    const lastDay = new Date(year, today.getMonth() + 1, 0).getDate()
    endDate.value = `${year}-${month}-${String(lastDay).padStart(2, '0')}`
  } else if (preset === 'quarter') {
    const qMonth = Math.floor(today.getMonth() / 3) * 3
    const startM = String(qMonth + 1).padStart(2, '0')
    startDate.value = `${year}-${startM}-01`
    const endM = qMonth + 3
    const lastDay = new Date(year, endM, 0).getDate()
    endDate.value = `${year}-${String(endM).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  } else if (preset === 'year') {
    startDate.value = `${year}-01-01`
    endDate.value = `${year}-12-31`
  }
  fetchAnalyticsData()
}

// 載入所有分析數據
const fetchAnalyticsData = async () => {
  if (!startDate.value || !endDate.value) return

  isLoading.value = true
  try {
    const [finRes, revRes, apptRes, prodRes] = await Promise.all([
      fetch(`${backendUrl}/api/financial-summary?start_date=${startDate.value}&end_date=${endDate.value}`),
      fetch(`${backendUrl}/api/revenue-recognitions`),
      fetch(`${backendUrl}/api/appointments`),
      fetch(`${backendUrl}/api/products`)
    ])

    if (finRes.ok) {
      const data = await finRes.json()
      financialSummary.value = data.data || {}
    }

    if (revRes.ok) {
      const data = await revRes.json()
      revenueRecognitions.value = (data.data || []).filter((r: any) => r.date >= startDate.value && r.date <= endDate.value)
    }

    if (apptRes.ok) {
      const data = await apptRes.json()
      appointments.value = (data.data || []).filter((a: any) => a.date >= startDate.value && a.date <= endDate.value)
    }

    if (prodRes.ok) {
      const data = await prodRes.json()
      products.value = data.data || []
    }
  } catch (e) {
    console.error('Fetch analytics data error:', e)
  } finally {
    isLoading.value = false
  }
}

// 計算指標
const courseRevenue = computed(() => {
  const fromSummary = financialSummary.value?.revenue_recognition?.course_revenue ?? 
                      financialSummary.value?.revenue_recognition?.course_recognized_revenue
  if (fromSummary !== undefined && fromSummary !== null && fromSummary > 0) return fromSummary
  return revenueRecognitions.value
    .filter(r => r.source_type === 'course_usage')
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
})

const productRevenue = computed(() => {
  const fromSummary = financialSummary.value?.revenue_recognition?.product_revenue ?? 
                      financialSummary.value?.revenue_recognition?.product_recognized_revenue ??
                      financialSummary.value?.revenue_recognition?.product_sales
  if (fromSummary !== undefined && fromSummary !== null && fromSummary > 0) return fromSummary
  return revenueRecognitions.value
    .filter(r => r.source_type === 'product_sale')
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
})

// 🌟 實質認列營收只有課程（不包含產品）
const totalRecognizedRevenue = computed(() => {
  return courseRevenue.value
})

// 🌟 課程實質營收 + 產品銷售總額 (業務綜合規模，用於分布佔比)
const combinedBusinessTotal = computed(() => {
  return courseRevenue.value + productRevenue.value
})

const netCashFlow = computed(() => {
  return financialSummary.value?.cash_flow?.net_cash_flow || 0
})

const totalIncome = computed(() => {
  return financialSummary.value?.cash_flow?.total_income || 0
})

const totalExpense = computed(() => {
  return financialSummary.value?.cash_flow?.total_expense || 0
})

// 預約統計
const appointmentMetrics = computed(() => {
  const total = appointments.value.length
  if (total === 0) return { total: 0, completed: 0, rate: 0, cancelled: 0 }
  const completed = appointments.value.filter(a => a.status === 'complete').length
  const cancelled = appointments.value.filter(a => a.status === 'cancelled').length
  const rate = Math.round((completed / total) * 100)
  return { total, completed, rate, cancelled }
})

// 庫存價值
const totalInventoryValue = computed(() => {
  return products.value.reduce((acc, p) => acc + (p.cost_price * p.stock_quantity), 0)
})

// 🌟 解析 URL 查詢參數以支援週報與通知點擊直接加載當週報表
const applyRouteParams = () => {
  const q = route.query
  if (q.start_date && q.end_date) {
    startDate.value = String(q.start_date)
    endDate.value = String(q.end_date)
    selectedPreset.value = (q.preset as any) || 'custom'
    fetchAnalyticsData()
    return
  }

  if (q.preset === 'week' || q.preset === 'month' || q.preset === 'quarter' || q.preset === 'year') {
    setPresetRange(q.preset as any)
    return
  }

  // 預設為本月
  setPresetRange('month')
}

onMounted(() => {
  applyRouteParams()
})

watch(() => route.fullPath, () => {
  applyRouteParams()
})
</script>

<template>
  <div class="max-w-7xl mx-auto space-y-5 sm:space-y-6 pb-12">
    
    <!-- 1. 頂部抬頭與日期選擇器 (Double-Bezel 7/5/8 高奢與跨端適配) -->
    <div class="p-1 bg-[#154337]/5 border border-[#154337]/10 rounded-2xl md:rounded-3xl shadow-xs">
      <div class="bg-white rounded-[calc(1rem-2px)] md:rounded-[calc(1.5rem-2px)] p-4 sm:p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="px-2.5 py-0.5 rounded-full bg-[#154337]/10 text-[#154337] text-[10px] font-mono font-bold uppercase tracking-wider">
              Business Intelligence & Analytics
            </span>
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <h1 class="text-2xl sm:text-3xl font-black text-[#154337] tracking-tight font-serif">
            數據洞察與營運分析報告
          </h1>
          <p class="text-gray-500 text-xs sm:text-sm mt-0.5">
            追蹤實質營收認列、現金流狀況、預約完成率與庫存資產分配
          </p>
        </div>

        <!-- 響應式日期區間選擇器 (支援本週/本月/本季/本年度) -->
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-[#FAF4EE]/70 p-2 sm:p-1.5 rounded-2xl border border-[#154337]/10 w-full xl:w-auto">
          <!-- 快捷天數切換按鈕組 -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:flex sm:items-center">
            <button 
              @click="setPresetRange('week')"
              :class="[
                'px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer text-center active:scale-95',
                selectedPreset === 'week' ? 'bg-[#154337] text-white shadow-xs' : 'text-gray-600 hover:text-[#154337] hover:bg-white'
              ]"
            >
              本週
            </button>
            <button 
              @click="setPresetRange('month')"
              :class="[
                'px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer text-center active:scale-95',
                selectedPreset === 'month' ? 'bg-[#154337] text-white shadow-xs' : 'text-gray-600 hover:text-[#154337] hover:bg-white'
              ]"
            >
              本月
            </button>
            <button 
              @click="setPresetRange('quarter')"
              :class="[
                'px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer text-center active:scale-95',
                selectedPreset === 'quarter' ? 'bg-[#154337] text-white shadow-xs' : 'text-gray-600 hover:text-[#154337] hover:bg-white'
              ]"
            >
              本季
            </button>
            <button 
              @click="setPresetRange('year')"
              :class="[
                'px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer text-center active:scale-95',
                selectedPreset === 'year' ? 'bg-[#154337] text-white shadow-xs' : 'text-gray-600 hover:text-[#154337] hover:bg-white'
              ]"
            >
              本年度
            </button>
          </div>

          <div class="hidden sm:block h-4 w-px bg-[#154337]/20 mx-1"></div>

          <!-- 自訂起訖日期選擇框 -->
          <div class="flex items-center gap-1.5 text-xs text-gray-600 px-1 sm:px-2">
            <input 
              v-model="startDate"
              type="date"
              class="flex-1 sm:flex-none bg-white border border-[#154337]/20 rounded-xl px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-[#154337] font-mono text-gray-800"
              @change="selectedPreset = 'custom'; fetchAnalyticsData()"
            />
            <span class="text-xs text-gray-400 font-bold">至</span>
            <input 
              v-model="endDate"
              type="date"
              class="flex-1 sm:flex-none bg-white border border-[#154337]/20 rounded-xl px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-[#154337] font-mono text-gray-800"
              @change="selectedPreset = 'custom'; fetchAnalyticsData()"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 2. 4 大核心 KPI 統計卡片 (Double-Bezel 7/5/8 高視覺密度) -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- 總認列營收 (僅課程) -->
      <div class="p-1 bg-emerald-500/5 border border-emerald-500/15 rounded-2xl md:rounded-3xl shadow-xs hover:-translate-y-0.5 transition duration-200 group">
        <div class="bg-white rounded-[calc(1rem-2px)] md:rounded-[calc(1.5rem-2px)] p-4 sm:p-5 h-full flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-gray-500">當期實質履約營收</span>
            <div class="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 group-hover:scale-105 transition">
              <Icon name="mdi:cash-check" class="text-xl" />
            </div>
          </div>
          <div class="mt-3 sm:mt-4">
            <div class="text-xl sm:text-2xl lg:text-3xl font-black text-[#154337] font-mono tracking-tight">
              NT$ {{ totalRecognizedRevenue.toLocaleString() }}
            </div>
            <p class="text-[11px] text-gray-400 mt-1">來自會員包堂與到店課程消耗履約認列</p>
          </div>
        </div>
      </div>

      <!-- 現金淨流入 -->
      <div class="p-1 bg-blue-500/5 border border-blue-500/15 rounded-2xl md:rounded-3xl shadow-xs hover:-translate-y-0.5 transition duration-200 group">
        <div class="bg-white rounded-[calc(1rem-2px)] md:rounded-[calc(1.5rem-2px)] p-4 sm:p-5 h-full flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-gray-500">當期現金淨流入 (Net Cash)</span>
            <div class="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200 group-hover:scale-105 transition">
              <Icon name="mdi:swap-horizontal" class="text-xl" />
            </div>
          </div>
          <div class="mt-3 sm:mt-4">
            <div :class="['text-xl sm:text-2xl lg:text-3xl font-black font-mono tracking-tight', netCashFlow >= 0 ? 'text-emerald-700' : 'text-rose-600']">
              NT$ {{ netCashFlow.toLocaleString() }}
            </div>
            <div class="flex items-center gap-2 text-[11px] font-mono mt-1">
              <span class="text-emerald-700 font-bold">收 +{{ totalIncome.toLocaleString() }}</span>
              <span class="text-gray-300">/</span>
              <span class="text-rose-600 font-bold">支 -{{ totalExpense.toLocaleString() }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 預約完成率 -->
      <div class="p-1 bg-purple-500/5 border border-purple-500/15 rounded-2xl md:rounded-3xl shadow-xs hover:-translate-y-0.5 transition duration-200 group">
        <div class="bg-white rounded-[calc(1rem-2px)] md:rounded-[calc(1.5rem-2px)] p-4 sm:p-5 h-full flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-gray-500">預約履約完成率</span>
            <div class="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-200 group-hover:scale-105 transition">
              <Icon name="mdi:calendar-check-outline" class="text-xl" />
            </div>
          </div>
          <div class="mt-3 sm:mt-4">
            <div class="text-xl sm:text-2xl lg:text-3xl font-black text-[#154337] font-mono tracking-tight">
              {{ appointmentMetrics.rate }}<span class="text-base font-normal text-gray-400">%</span>
            </div>
            <p class="text-[11px] text-gray-400 mt-1">共 {{ appointmentMetrics.total }} 組預約 (已完成 {{ appointmentMetrics.completed }} 組)</p>
          </div>
        </div>
      </div>

      <!-- 庫存資產總值 -->
      <div class="p-1 bg-amber-500/5 border border-amber-500/15 rounded-2xl md:rounded-3xl shadow-xs hover:-translate-y-0.5 transition duration-200 group">
        <div class="bg-white rounded-[calc(1rem-2px)] md:rounded-[calc(1.5rem-2px)] p-4 sm:p-5 h-full flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-gray-500">當前商品庫存成本價值</span>
            <div class="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200 group-hover:scale-105 transition">
              <Icon name="mdi:package-variant" class="text-xl" />
            </div>
          </div>
          <div class="mt-3 sm:mt-4">
            <div class="text-xl sm:text-2xl lg:text-3xl font-black text-[#154337] font-mono tracking-tight">
              NT$ {{ totalInventoryValue.toLocaleString() }}
            </div>
            <p class="text-[11px] text-gray-400 mt-1">共有 {{ products.length }} 項庫存商品品項</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 3. 雙欄分析圖表區 (Double-Bezel 響應式雙欄) -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
      <!-- 🌟 課程實質營收與產品銷售分佈圖 -->
      <div class="p-1 bg-[#154337]/5 border border-[#154337]/10 rounded-2xl md:rounded-3xl shadow-xs">
        <div class="bg-white rounded-[calc(1rem-2px)] md:rounded-[calc(1.5rem-2px)] p-4 sm:p-6 space-y-5">
          <div class="flex items-center justify-between border-b border-gray-100 pb-3">
            <div class="flex items-center gap-2">
              <Icon name="mdi:chart-pie" class="text-xl text-[#154337]" />
              <h3 class="font-bold text-gray-900 text-base font-serif">課程實質營收與產品銷售分佈</h3>
            </div>
            <span class="text-xs font-mono text-gray-400">Revenue & Sales Distribution</span>
          </div>

          <div v-if="isLoading" class="h-40 flex items-center justify-center text-gray-400 animate-pulse">
            <Icon name="mdi:loading" class="animate-spin text-2xl text-[#154337]" />
          </div>

          <div v-else class="space-y-4">
            <!-- 課程實質營收條 -->
            <div class="space-y-1.5">
              <div class="flex flex-wrap justify-between text-xs font-medium gap-1">
                <span class="text-gray-700 flex items-center gap-1.5 font-bold">
                  <span class="w-2.5 h-2.5 rounded-full bg-[#154337]"></span>
                  會員包堂與課程消耗實質營收
                </span>
                <span class="font-bold text-[#154337] font-mono">NT$ {{ courseRevenue.toLocaleString() }}</span>
              </div>
              <div class="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                <div 
                  class="h-full bg-[#154337] transition-all duration-500 rounded-full"
                  :style="{ width: `${combinedBusinessTotal > 0 ? (courseRevenue / combinedBusinessTotal) * 100 : 0}%` }"
                ></div>
              </div>
            </div>

            <!-- 產品零售銷售條 -->
            <div class="space-y-1.5">
              <div class="flex flex-wrap justify-between text-xs font-medium gap-1">
                <span class="text-gray-700 flex items-center gap-1.5 font-bold">
                  <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  零售產品直接銷售總額
                </span>
                <span class="font-bold text-emerald-700 font-mono">NT$ {{ productRevenue.toLocaleString() }}</span>
              </div>
              <div class="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                <div 
                  class="h-full bg-emerald-500 transition-all duration-500 rounded-full"
                  :style="{ width: `${combinedBusinessTotal > 0 ? (productRevenue / combinedBusinessTotal) * 100 : 0}%` }"
                ></div>
              </div>
            </div>

            <!-- 佔比分析格 -->
            <div class="pt-4 border-t border-gray-100 grid grid-cols-2 gap-3 sm:gap-4 text-center">
              <div class="p-3.5 rounded-2xl bg-[#FAF4EE]/70 border border-[#154337]/10">
                <div class="text-[11px] text-gray-500 font-bold">課程實質營收佔比</div>
                <div class="text-lg sm:text-xl font-black text-[#154337] font-mono mt-0.5">
                  {{ combinedBusinessTotal > 0 ? Math.round((courseRevenue / combinedBusinessTotal) * 100) : 0 }}%
                </div>
              </div>
              <div class="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80">
                <div class="text-[11px] text-emerald-800 font-bold">產品銷售額佔比</div>
                <div class="text-lg sm:text-xl font-black text-emerald-700 font-mono mt-0.5">
                  {{ combinedBusinessTotal > 0 ? Math.round((productRevenue / combinedBusinessTotal) * 100) : 0 }}%
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 現金交易流向分析 -->
      <div class="p-1 bg-[#154337]/5 border border-[#154337]/10 rounded-2xl md:rounded-3xl shadow-xs">
        <div class="bg-white rounded-[calc(1rem-2px)] md:rounded-[calc(1.5rem-2px)] p-4 sm:p-6 space-y-5">
          <div class="flex items-center justify-between border-b border-gray-100 pb-3">
            <div class="flex items-center gap-2">
              <Icon name="mdi:cash-fast" class="text-xl text-[#154337]" />
              <h3 class="font-bold text-gray-900 text-base font-serif">現金交易流向分析</h3>
            </div>
            <span class="text-xs font-mono text-gray-400">Cash Flow Distribution</span>
          </div>

          <div v-if="isLoading" class="h-40 flex items-center justify-center text-gray-400 animate-pulse">
            <Icon name="mdi:loading" class="animate-spin text-2xl text-[#154337]" />
          </div>

          <div v-else class="space-y-4">
            <!-- 收入項目 -->
            <div class="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 space-y-1.5">
              <div class="flex justify-between items-center text-xs sm:text-sm font-bold text-emerald-900">
                <span class="flex items-center gap-1.5">
                  <Icon name="mdi:arrow-down-bold-circle" class="text-lg text-emerald-600" />
                  現金總收入
                </span>
                <span class="font-mono text-base sm:text-lg font-black">NT$ {{ totalIncome.toLocaleString() }}</span>
              </div>
              <p class="text-[11px] text-emerald-700">包含門市現場現金、LINE Pay、刷卡與匯款之當期實際入帳</p>
            </div>

            <!-- 支出項目 -->
            <div class="p-4 rounded-2xl bg-rose-50/60 border border-rose-200/80 space-y-1.5">
              <div class="flex justify-between items-center text-xs sm:text-sm font-bold text-rose-900">
                <span class="flex items-center gap-1.5">
                  <Icon name="mdi:arrow-up-bold-circle" class="text-lg text-rose-600" />
                  現金總支出
                </span>
                <span class="font-mono text-base sm:text-lg font-black">NT$ {{ totalExpense.toLocaleString() }}</span>
              </div>
              <p class="text-[11px] text-rose-700">包含店面租金、進貨成本、水電雜支與人員行政提撥</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 4. 當期營收認列交易紀錄明細 (Web 表格 / 手機卡片列表) -->
    <div class="p-1 bg-[#154337]/5 border border-[#154337]/10 rounded-2xl md:rounded-3xl shadow-xs">
      <div class="bg-white rounded-[calc(1rem-2px)] md:rounded-[calc(1.5rem-2px)] p-4 sm:p-6 space-y-4">
        <div class="flex items-center justify-between border-b border-gray-100 pb-4">
          <div class="flex items-center gap-2">
            <Icon name="mdi:file-document-outline" class="text-xl text-[#154337]" />
            <h3 class="font-bold text-gray-900 text-base font-serif">當期營收認列交易紀錄明細</h3>
          </div>
          <NuxtLink to="/finance" class="text-xs text-[#154337] hover:underline font-bold flex items-center gap-1">
            <span>完整財務明細</span>
            <Icon name="mdi:chevron-right" size="14" />
          </NuxtLink>
        </div>

        <!-- 手機版卡片列表 (Block on mobile) -->
        <div class="block md:hidden space-y-3">
          <div v-if="revenueRecognitions.length === 0" class="py-8 text-center text-gray-400 text-xs">
            當前區間尚無營收認列紀錄
          </div>
          <div 
            v-for="r in revenueRecognitions.slice(0, 8)" 
            :key="r.id" 
            class="bg-[#FAF4EE]/50 p-3.5 rounded-2xl border border-gray-200/80 flex flex-col gap-2"
          >
            <div class="flex justify-between items-start">
              <span class="font-mono text-xs font-bold text-gray-500">{{ r.date }}</span>
              <span 
                :class="[
                  'px-2.5 py-0.5 rounded-full text-[10px] font-bold border',
                  r.source_type === 'course_usage' ? 'bg-[#154337]/10 text-[#154337] border-[#154337]/20' : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                ]"
              >
                {{ r.source_type === 'course_usage' ? '課程耗用認列' : '產品銷售認列' }}
              </span>
            </div>
            <div class="flex justify-between items-center text-xs">
              <span class="text-gray-500 font-mono">客戶編號：#{{ r.user_id }}</span>
              <span class="font-bold text-[#154337] font-mono text-sm">NT$ {{ r.amount.toLocaleString() }}</span>
            </div>
            <p v-if="r.description" class="text-[11px] text-gray-600 bg-white p-2 rounded-xl border border-gray-100">
              {{ r.description }}
            </p>
          </div>
        </div>

        <!-- 桌機版數據表格 (Hidden on mobile) -->
        <div class="hidden md:block overflow-x-auto rounded-2xl border border-gray-200">
          <table class="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr class="bg-[#FAF4EE]/70 text-gray-600 font-mono uppercase">
                <th class="py-3 px-4 font-bold">交易日期</th>
                <th class="py-3 px-4 font-bold">營收來源類型</th>
                <th class="py-3 px-4 font-bold">客戶編號</th>
                <th class="py-3 px-4 font-bold">備註說明</th>
                <th class="py-3 px-4 text-right font-bold">認列金額</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 bg-white">
              <tr v-if="revenueRecognitions.length === 0">
                <td colspan="5" class="py-8 text-center text-gray-400">當前區間尚無營收認列紀錄</td>
              </tr>
              <tr v-for="r in revenueRecognitions.slice(0, 8)" :key="r.id" class="hover:bg-[#FAF4EE]/40 transition">
                <td class="py-3.5 px-4 font-mono text-gray-600">{{ r.date }}</td>
                <td class="py-3.5 px-4">
                  <span 
                    :class="[
                      'px-2.5 py-0.5 rounded-full text-[10px] font-bold border inline-block',
                      r.source_type === 'course_usage' ? 'bg-[#154337]/10 text-[#154337] border-[#154337]/20' : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    ]"
                  >
                    {{ r.source_type === 'course_usage' ? '課程耗用認列' : '產品銷售認列' }}
                  </span>
                </td>
                <td class="py-3.5 px-4 font-mono text-gray-500">#{{ r.user_id }}</td>
                <td class="py-3.5 px-4 text-gray-700">{{ r.description || '-' }}</td>
                <td class="py-3.5 px-4 text-right font-black text-[#154337] font-mono text-sm">
                  NT$ {{ r.amount.toLocaleString() }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

  </div>
</template>