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
const inventoryTransactions = ref<any[]>([])
const cashTransactions = ref<any[]>([])

// 圖表懸停探針狀態
const activeHoverIndex = ref<number | null>(null)

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
    const [finRes, revRes, apptRes, prodRes, invRes, cashRes] = await Promise.all([
      fetch(`${backendUrl}/api/financial-summary?start_date=${startDate.value}&end_date=${endDate.value}`),
      fetch(`${backendUrl}/api/revenue-recognitions`),
      fetch(`${backendUrl}/api/appointments`),
      fetch(`${backendUrl}/api/products`),
      fetch(`${backendUrl}/api/inventory-transactions`),
      fetch(`${backendUrl}/api/cash-transactions?start_date=${startDate.value}&end_date=${endDate.value}`)
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

    if (invRes.ok) {
      const data = await invRes.json()
      inventoryTransactions.value = (data.data || []).filter((t: any) => t.date >= startDate.value && t.date <= endDate.value)
    }

    if (cashRes.ok) {
      const data = await cashRes.json()
      cashTransactions.value = data.data || []
    }
  } catch (e) {
    console.error('Fetch analytics data error:', e)
  } finally {
    isLoading.value = false
  }
}

// 🌟 依日期的時序趨勢資料點 (X 軸為時間，數值包含課程實質營收與產品銷售)
const dailyChartData = computed(() => {
  if (!startDate.value || !endDate.value) return []
  
  const start = new Date(startDate.value)
  const end = new Date(endDate.value)
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return []

  const points: {
    date: string
    label: string
    course: number
    product: number
    total: number
  }[] = []

  // 1. 整理課程履約數據映射 (date -> amount)
  const courseMap: Record<string, number> = {}
  revenueRecognitions.value.forEach(r => {
    if (r.source_type === 'course_usage' && r.date) {
      courseMap[r.date] = (courseMap[r.date] || 0) + (Number(r.amount) || 0)
    }
  })

  // 2. 整理產品銷售數據映射 (date -> amount)
  // 優先整合 inventory_transactions (type='sale')、revenue_recognitions (source_type='product_sale') 與 cash_transactions
  const productMap: Record<string, number> = {}
  
  inventoryTransactions.value.forEach(it => {
    if (it.type === 'sale' && it.date) {
      productMap[it.date] = (productMap[it.date] || 0) + (Number(it.total_amount) || 0)
    }
  })
  
  revenueRecognitions.value.forEach(r => {
    if (r.source_type === 'product_sale' && r.date) {
      productMap[r.date] = Math.max(productMap[r.date] || 0, (Number(r.amount) || 0))
    }
  })

  cashTransactions.value.forEach(ct => {
    if (ct.type === 'income' && (ct.category?.includes('產品') || ct.category?.includes('銷售')) && ct.date) {
      productMap[ct.date] = Math.max(productMap[ct.date] || 0, (Number(ct.amount) || 0))
    }
  })

  const cur = new Date(start)
  while (cur <= end) {
    const dStr = formatDate(cur)
    const parts = dStr.split('-')
    const shortLabel = `${parts[1]}/${parts[2]}`
    const courseVal = courseMap[dStr] || 0
    const productVal = productMap[dStr] || 0
    points.push({
      date: dStr,
      label: shortLabel,
      course: courseVal,
      product: productVal,
      total: courseVal + productVal
    })
    cur.setDate(cur.getDate() + 1)
  }

  return points
})

// 課程實質營收 (總計)
const courseRevenue = computed(() => {
  const sumFromDaily = dailyChartData.value.reduce((sum, p) => sum + p.course, 0)
  const fromSummary = financialSummary.value?.revenue_recognition?.course_revenue ?? 
                      financialSummary.value?.revenue_recognition?.course_recognized_revenue ?? 0
  return Math.max(sumFromDaily, fromSummary)
})

// 產品銷售價格 (總計 - 全面撈取)
const productRevenue = computed(() => {
  const sumFromDaily = dailyChartData.value.reduce((sum, p) => sum + p.product, 0)
  const fromSummary = financialSummary.value?.revenue_recognition?.product_revenue ?? 
                      financialSummary.value?.revenue_recognition?.product_sales ?? 0
  return Math.max(sumFromDaily, fromSummary)
})

// 🌟 實質認列營收只有課程（不包含產品）
const totalRecognizedRevenue = computed(() => {
  return courseRevenue.value
})

// 🌟 課程實質營收 + 產品銷售總額 (業務綜合規模)
const combinedBusinessTotal = computed(() => {
  return courseRevenue.value + productRevenue.value
})

// 圓餅圖各項目佔比百分比
const coursePercent = computed(() => {
  if (combinedBusinessTotal.value <= 0) return 0
  return Math.round((courseRevenue.value / combinedBusinessTotal.value) * 100)
})

const productPercent = computed(() => {
  if (combinedBusinessTotal.value <= 0) return 0
  return 100 - coursePercent.value
})

// 圓餅圖 SVG 圓周長與偏移 (半徑 r = 40, C = 2 * PI * 40 = 251.327)
const pieCircumference = 2 * Math.PI * 40
const courseStrokeDasharray = computed(() => {
  if (combinedBusinessTotal.value <= 0) return `0 ${pieCircumference}`
  const strokeLen = (courseRevenue.value / combinedBusinessTotal.value) * pieCircumference
  return `${strokeLen} ${pieCircumference}`
})
const productStrokeDasharray = computed(() => {
  if (combinedBusinessTotal.value <= 0) return `0 ${pieCircumference}`
  const strokeLen = (productRevenue.value / combinedBusinessTotal.value) * pieCircumference
  return `${strokeLen} ${pieCircumference}`
})
const productStrokeDashoffset = computed(() => {
  if (combinedBusinessTotal.value <= 0) return 0
  const courseStrokeLen = (courseRevenue.value / combinedBusinessTotal.value) * pieCircumference
  return -courseStrokeLen
})

// 時序圖 Y 軸刻度最大值
const chartMaxVal = computed(() => {
  const maxInPoints = Math.max(...dailyChartData.value.map(p => Math.max(p.course, p.product)), 0)
  if (maxInPoints <= 0) return 1000
  // 取向上整數 (例如 1200 -> 1500, 3800 -> 4000)
  const step = maxInPoints > 5000 ? 1000 : maxInPoints > 2000 ? 500 : 200
  return Math.ceil((maxInPoints * 1.2) / step) * step
})

// SVG 折線圖座標計算 (寬 720, 高 200, 內縮 padding)
const chartPadding = { left: 45, right: 20, top: 25, bottom: 30 }
const chartWidth = 720
const chartHeight = 200
const plotWidth = chartWidth - chartPadding.left - chartPadding.right
const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom

const getX = (index: number) => {
  const len = dailyChartData.value.length
  if (len <= 1) return chartPadding.left + plotWidth / 2
  return chartPadding.left + (index / (len - 1)) * plotWidth
}

const getY = (val: number) => {
  const max = chartMaxVal.value || 1000
  const normalized = Math.min(Math.max(val / max, 0), 1)
  return chartHeight - chartPadding.bottom - normalized * plotHeight
}

// 產生 SVG 折線 points 字串
const coursePointsString = computed(() => {
  return dailyChartData.value.map((p, i) => `${getX(i)},${getY(p.course)}`).join(' ')
})

const productPointsString = computed(() => {
  return dailyChartData.value.map((p, i) => `${getX(i)},${getY(p.product)}`).join(' ')
})

// 產生 SVG 漸層封閉區域 Path
const courseAreaPath = computed(() => {
  const len = dailyChartData.value.length
  if (len === 0) return ''
  const bottomY = chartHeight - chartPadding.bottom
  const points = dailyChartData.value.map((p, i) => `${getX(i)},${getY(p.course)}`)
  return `M ${getX(0)},${bottomY} L ${points.join(' L ')} L ${getX(len - 1)},${bottomY} Z`
})

const productAreaPath = computed(() => {
  const len = dailyChartData.value.length
  if (len === 0) return ''
  const bottomY = chartHeight - chartPadding.bottom
  const points = dailyChartData.value.map((p, i) => `${getX(i)},${getY(p.product)}`)
  return `M ${getX(0)},${bottomY} L ${points.join(' L ')} L ${getX(len - 1)},${bottomY} Z`
})

// 現金流與預約
const netCashFlow = computed(() => {
  return financialSummary.value?.cash_flow?.net_cash_flow || 0
})

const totalIncome = computed(() => {
  return financialSummary.value?.cash_flow?.total_income || 0
})

const totalExpense = computed(() => {
  return financialSummary.value?.cash_flow?.total_expense || 0
})

const appointmentMetrics = computed(() => {
  const total = appointments.value.length
  if (total === 0) return { total: 0, completed: 0, rate: 0, cancelled: 0 }
  const completed = appointments.value.filter(a => a.status === 'complete').length
  const cancelled = appointments.value.filter(a => a.status === 'cancelled').length
  const rate = Math.round((completed / total) * 100)
  return { total, completed, rate, cancelled }
})

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
            追蹤實質營收認列、產品銷售時序趨勢、現金流狀況與資產分配
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
      <!-- 1. 課程實質履約營收 (僅課程) -->
      <div class="p-1 bg-[#154337]/5 border border-[#154337]/15 rounded-2xl md:rounded-3xl shadow-xs hover:-translate-y-0.5 transition duration-200 group">
        <div class="bg-white rounded-[calc(1rem-2px)] md:rounded-[calc(1.5rem-2px)] p-4 sm:p-5 h-full flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-gray-500">當期課程實質履約營收</span>
            <div class="w-9 h-9 rounded-xl bg-[#154337]/10 text-[#154337] flex items-center justify-center border border-[#154337]/20 group-hover:scale-105 transition">
              <Icon name="mdi:cash-check" class="text-xl" />
            </div>
          </div>
          <div class="mt-3 sm:mt-4">
            <div class="text-xl sm:text-2xl lg:text-3xl font-black text-[#154337] font-mono tracking-tight">
              NT$ {{ courseRevenue.toLocaleString() }}
            </div>
            <p class="text-[11px] text-gray-400 mt-1">來自會員包堂與到店課程消耗履約認列</p>
          </div>
        </div>
      </div>

      <!-- 2. 產品銷售總額 -->
      <div class="p-1 bg-emerald-500/5 border border-emerald-500/15 rounded-2xl md:rounded-3xl shadow-xs hover:-translate-y-0.5 transition duration-200 group">
        <div class="bg-white rounded-[calc(1rem-2px)] md:rounded-[calc(1.5rem-2px)] p-4 sm:p-5 h-full flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-gray-500">當期產品銷售總額</span>
            <div class="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 group-hover:scale-105 transition">
              <Icon name="mdi:shopping" class="text-xl" />
            </div>
          </div>
          <div class="mt-3 sm:mt-4">
            <div class="text-xl sm:text-2xl lg:text-3xl font-black text-emerald-700 font-mono tracking-tight">
              NT$ {{ productRevenue.toLocaleString() }}
            </div>
            <p class="text-[11px] text-gray-400 mt-1">門市現場與預約加購之零售商品總額</p>
          </div>
        </div>
      </div>

      <!-- 3. 現金淨流入 -->
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

      <!-- 4. 預約完成率與庫存 -->
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
    </div>

    <!-- 3. 🌟 核心時序圖表與圓餅圖區 (X軸為時間、Y軸為價格、圓餅圖佔比) -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
      
      <!-- 📈 左欄 (8 cols): 營收與銷售時序趨勢圖 (X軸: 時間 / Y軸: 金額) -->
      <div class="lg:col-span-8 p-1 bg-[#154337]/5 border border-[#154337]/10 rounded-2xl md:rounded-3xl shadow-xs">
        <div class="bg-white rounded-[calc(1rem-2px)] md:rounded-[calc(1.5rem-2px)] p-4 sm:p-6 space-y-4">
          <!-- 頂部指標圖例說明 -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3.5">
            <div>
              <div class="flex items-center gap-2">
                <Icon name="mdi:chart-timeline-variant" class="text-xl text-[#154337]" />
                <h3 class="font-bold text-gray-900 text-base font-serif">營收與銷售時序趨勢圖</h3>
              </div>
              <p class="text-[11px] text-gray-400 mt-0.5">X 軸為時間日期 ｜ Y 軸為當日金額 (NT$)</p>
            </div>

            <!-- 圖例標籤 -->
            <div class="flex items-center gap-4 text-xs font-bold">
              <div class="flex items-center gap-1.5">
                <span class="w-3 h-3 rounded-full bg-[#154337]"></span>
                <span class="text-gray-700">課程實質營收</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="w-3 h-3 rounded-full bg-emerald-500"></span>
                <span class="text-emerald-700">產品銷售價格</span>
              </div>
            </div>
          </div>

          <div v-if="isLoading" class="h-64 flex items-center justify-center text-gray-400 animate-pulse">
            <Icon name="mdi:loading" class="animate-spin text-3xl text-[#154337]" />
          </div>

          <!-- 互動式 SVG 折線/區域時序圖 -->
          <div v-else class="relative w-full overflow-hidden">
            <!-- 懸停數值探針浮動卡片 -->
            <div 
              v-if="activeHoverIndex !== null && dailyChartData[activeHoverIndex]"
              class="absolute z-20 top-2 right-2 bg-[#154337] text-white p-2.5 rounded-xl shadow-lg text-xs space-y-1 border border-white/10 pointer-events-none transition-all duration-150"
            >
              <div class="font-mono text-[11px] text-emerald-200 font-bold border-b border-white/15 pb-1">
                📅 {{ dailyChartData[activeHoverIndex].date }}
              </div>
              <div class="flex justify-between gap-3 text-[11px]">
                <span class="text-emerald-100">課程實質營收:</span>
                <span class="font-mono font-bold">NT$ {{ dailyChartData[activeHoverIndex].course.toLocaleString() }}</span>
              </div>
              <div class="flex justify-between gap-3 text-[11px]">
                <span class="text-emerald-300">產品銷售價格:</span>
                <span class="font-mono font-bold">NT$ {{ dailyChartData[activeHoverIndex].product.toLocaleString() }}</span>
              </div>
              <div class="flex justify-between gap-3 text-[11px] font-bold border-t border-white/15 pt-1 text-white">
                <span>當日合計:</span>
                <span class="font-mono">NT$ {{ dailyChartData[activeHoverIndex].total.toLocaleString() }}</span>
              </div>
            </div>

            <!-- SVG 畫布 -->
            <div class="w-full overflow-x-auto">
              <svg 
                :viewBox="`0 0 ${chartWidth} ${chartHeight}`" 
                class="w-full h-56 sm:h-64 select-none"
                preserveAspectRatio="none"
              >
                <defs>
                  <!-- 課程營收漸層 -->
                  <linearGradient id="courseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#154337" stop-opacity="0.25" />
                    <stop offset="100%" stop-color="#154337" stop-opacity="0.0" />
                  </linearGradient>
                  <!-- 產品銷售漸層 -->
                  <linearGradient id="prodGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#10B981" stop-opacity="0.25" />
                    <stop offset="100%" stop-color="#10B981" stop-opacity="0.0" />
                  </linearGradient>
                </defs>

                <!-- Y 軸刻度參考線 (0%, 50%, 100%) -->
                <g class="text-gray-300">
                  <line 
                    :x1="chartPadding.left" 
                    :y1="getY(chartMaxVal)" 
                    :x2="chartWidth - chartPadding.right" 
                    :y2="getY(chartMaxVal)" 
                    stroke="currentColor" 
                    stroke-dasharray="3 3" 
                    stroke-width="1" 
                  />
                  <text :x="chartPadding.left - 6" :y="getY(chartMaxVal) + 4" text-anchor="end" font-size="10" fill="#9CA3AF" font-family="monospace">
                    ${{ chartMaxVal.toLocaleString() }}
                  </text>

                  <line 
                    :x1="chartPadding.left" 
                    :y1="getY(chartMaxVal / 2)" 
                    :x2="chartWidth - chartPadding.right" 
                    :y2="getY(chartMaxVal / 2)" 
                    stroke="currentColor" 
                    stroke-dasharray="3 3" 
                    stroke-width="1" 
                  />
                  <text :x="chartPadding.left - 6" :y="getY(chartMaxVal / 2) + 4" text-anchor="end" font-size="10" fill="#9CA3AF" font-family="monospace">
                    ${{ Math.round(chartMaxVal / 2).toLocaleString() }}
                  </text>

                  <line 
                    :x1="chartPadding.left" 
                    :y1="getY(0)" 
                    :x2="chartWidth - chartPadding.right" 
                    :y2="getY(0)" 
                    stroke="#E5E7EB" 
                    stroke-width="1.5" 
                  />
                  <text :x="chartPadding.left - 6" :y="getY(0) + 4" text-anchor="end" font-size="10" fill="#9CA3AF" font-family="monospace">
                    $0
                  </text>
                </g>

                <!-- 漸層填滿區域 -->
                <path v-if="courseAreaPath" :d="courseAreaPath" fill="url(#courseGrad)" />
                <path v-if="productAreaPath" :d="productAreaPath" fill="url(#prodGrad)" />

                <!-- 實體折線 -->
                <polyline 
                  v-if="coursePointsString" 
                  :points="coursePointsString" 
                  fill="none" 
                  stroke="#154337" 
                  stroke-width="2.5" 
                  stroke-linecap="round" 
                  stroke-linejoin="round" 
                />
                <polyline 
                  v-if="productPointsString" 
                  :points="productPointsString" 
                  fill="none" 
                  stroke="#10B981" 
                  stroke-width="2.5" 
                  stroke-linecap="round" 
                  stroke-linejoin="round" 
                />

                <!-- 資料點圓圈與互動觸發區塊 -->
                <g v-for="(point, i) in dailyChartData" :key="point.date">
                  <!-- 課程節點 -->
                  <circle 
                    v-if="point.course > 0"
                    :cx="getX(i)" 
                    :cy="getY(point.course)" 
                    r="3.5" 
                    fill="#154337" 
                    stroke="#FFFFFF" 
                    stroke-width="1.5" 
                  />
                  <!-- 產品節點 -->
                  <circle 
                    v-if="point.product > 0"
                    :cx="getX(i)" 
                    :cy="getY(point.product)" 
                    r="3.5" 
                    fill="#10B981" 
                    stroke="#FFFFFF" 
                    stroke-width="1.5" 
                  />

                  <!-- X 軸標籤 (依密度間隔顯示) -->
                  <text 
                    v-if="dailyChartData.length <= 10 || i % Math.ceil(dailyChartData.length / 8) === 0 || i === dailyChartData.length - 1"
                    :x="getX(i)" 
                    :y="chartHeight - 8" 
                    text-anchor="middle" 
                    font-size="10" 
                    fill="#6B7280" 
                    font-family="monospace"
                    font-weight="bold"
                  >
                    {{ point.label }}
                  </text>

                  <!-- 懸停互動感應熱區 -->
                  <rect 
                    :x="getX(i) - (plotWidth / Math.max(dailyChartData.length, 1)) / 2"
                    :y="chartPadding.top"
                    :width="plotWidth / Math.max(dailyChartData.length, 1)"
                    :height="plotHeight"
                    fill="transparent"
                    class="cursor-pointer"
                    @mouseenter="activeHoverIndex = i"
                    @mouseleave="activeHoverIndex = null"
                    @touchstart.passive="activeHoverIndex = i"
                  />
                  
                  <!-- 懸停垂直探針線 -->
                  <line 
                    v-if="activeHoverIndex === i"
                    :x1="getX(i)" 
                    :y1="chartPadding.top" 
                    :x2="getX(i)" 
                    :y2="chartHeight - chartPadding.bottom" 
                    stroke="#154337" 
                    stroke-width="1.5" 
                    stroke-dasharray="2 2" 
                    pointer-events="none"
                  />
                </g>
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- 🍰 右欄 (4 cols): 簡單圓餅圖佔比 (課程實質營收 vs 產品銷售價格) -->
      <div class="lg:col-span-4 p-1 bg-[#154337]/5 border border-[#154337]/10 rounded-2xl md:rounded-3xl shadow-xs flex flex-col">
        <div class="bg-white rounded-[calc(1rem-2px)] md:rounded-[calc(1.5rem-2px)] p-4 sm:p-6 flex-1 flex flex-col justify-between space-y-4">
          <div class="flex items-center justify-between border-b border-gray-100 pb-3.5">
            <div class="flex items-center gap-2">
              <Icon name="mdi:chart-pie" class="text-xl text-[#154337]" />
              <h3 class="font-bold text-gray-900 text-base font-serif">當期營運佔比</h3>
            </div>
            <span class="text-xs font-mono text-gray-400">Pie Breakdown</span>
          </div>

          <div v-if="isLoading" class="h-48 flex items-center justify-center text-gray-400 animate-pulse">
            <Icon name="mdi:loading" class="animate-spin text-2xl text-[#154337]" />
          </div>

          <!-- 精緻 SVG 環形圓餅圖 -->
          <div v-else class="flex flex-col items-center justify-center py-2">
            <div class="relative w-44 h-44 flex items-center justify-center">
              <svg viewBox="0 0 100 100" class="w-full h-full -rotate-90">
                <!-- 背景圓環 -->
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#F3F4F6"
                  stroke-width="16"
                />

                <!-- 課程實質營收環段 (深墨綠) -->
                <circle
                  v-if="coursePercent > 0"
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#154337"
                  stroke-width="16"
                  :stroke-dasharray="courseStrokeDasharray"
                  stroke-dashoffset="0"
                  class="transition-all duration-700 ease-out"
                />

                <!-- 產品銷售價格環段 (翡翠綠) -->
                <circle
                  v-if="productPercent > 0"
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#10B981"
                  stroke-width="16"
                  :stroke-dasharray="productStrokeDasharray"
                  :stroke-dashoffset="productStrokeDashoffset"
                  class="transition-all duration-700 ease-out"
                />
              </svg>

              <!-- 圓餅圖中心資訊 -->
              <div class="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">總營業規模</span>
                <span class="text-base sm:text-lg font-black text-[#154337] font-mono leading-tight">
                  NT$ {{ combinedBusinessTotal.toLocaleString() }}
                </span>
              </div>
            </div>

            <!-- 圓餅圖圖例與百分比明細 -->
            <div class="w-full grid grid-cols-2 gap-2.5 mt-5">
              <!-- 課程實質營收 -->
              <div class="p-3 rounded-2xl bg-[#FAF4EE]/80 border border-[#154337]/10 flex flex-col justify-between">
                <div class="flex items-center gap-1.5 text-[11px] font-bold text-gray-600">
                  <span class="w-2.5 h-2.5 rounded-full bg-[#154337]"></span>
                  <span>課程實質營收</span>
                </div>
                <div class="mt-2">
                  <div class="text-sm sm:text-base font-black text-[#154337] font-mono">
                    NT$ {{ courseRevenue.toLocaleString() }}
                  </div>
                  <div class="text-[11px] font-bold text-emerald-800 font-mono mt-0.5">
                    佔比 {{ coursePercent }}%
                  </div>
                </div>
              </div>

              <!-- 產品銷售金額 -->
              <div class="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex flex-col justify-between">
                <div class="flex items-center gap-1.5 text-[11px] font-bold text-emerald-900">
                  <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <span>產品銷售價格</span>
                </div>
                <div class="mt-2">
                  <div class="text-sm sm:text-base font-black text-emerald-700 font-mono">
                    NT$ {{ productRevenue.toLocaleString() }}
                  </div>
                  <div class="text-[11px] font-bold text-emerald-600 font-mono mt-0.5">
                    佔比 {{ productPercent }}%
                  </div>
                </div>
              </div>
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

        <div v-if="isLoading" class="py-12 flex justify-center text-gray-400 animate-pulse">
          <Icon name="mdi:loading" class="animate-spin text-3xl text-[#154337]" />
        </div>

        <div v-else-if="revenueRecognitions.length === 0" class="py-12 text-center text-gray-400">
          <Icon name="mdi:text-box-remove-outline" class="text-4xl mx-auto mb-2 text-gray-300" />
          <p class="text-sm">此區間內尚無營收認列明細紀錄</p>
        </div>

        <div v-else>
          <!-- 桌機版表格 -->
          <div class="hidden md:block overflow-x-auto">
            <table class="w-full text-left text-xs text-gray-600">
              <thead class="bg-[#FAF4EE]/70 text-[#154337] font-bold uppercase tracking-wider border-y border-[#154337]/10">
                <tr>
                  <th class="py-3 px-4">認列日期</th>
                  <th class="py-3 px-4">來源類型</th>
                  <th class="py-3 px-4">項目說明</th>
                  <th class="py-3 px-4">客戶編號</th>
                  <th class="py-3 px-4 text-right">實質營收金額</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr v-for="item in revenueRecognitions" :key="item.id" class="hover:bg-gray-50/80 transition">
                  <td class="py-3 px-4 font-mono font-medium text-gray-900">{{ item.date }}</td>
                  <td class="py-3 px-4">
                    <span 
                      :class="[
                        'px-2.5 py-0.5 rounded-md text-[10px] font-bold inline-block',
                        item.source_type === 'course_usage' ? 'bg-[#154337]/10 text-[#154337]' : 'bg-emerald-100 text-emerald-800'
                      ]"
                    >
                      {{ item.source_type === 'course_usage' ? '課程消耗履約' : '零售產品銷售' }}
                    </span>
                  </td>
                  <td class="py-3 px-4 text-gray-800 font-medium">{{ item.description || '—' }}</td>
                  <td class="py-3 px-4 font-mono text-gray-500">{{ item.user_id ? `#${item.user_id}` : '散客 / 現場' }}</td>
                  <td class="py-3 px-4 text-right font-mono font-bold text-[#154337]">
                    NT$ {{ Number(item.amount).toLocaleString() }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- 手機版卡片列表 -->
          <div class="md:hidden space-y-2.5">
            <div 
              v-for="item in revenueRecognitions" 
              :key="item.id" 
              class="p-3.5 rounded-2xl bg-[#FAF4EE]/40 border border-[#154337]/10 space-y-2"
            >
              <div class="flex justify-between items-center text-xs">
                <span class="font-mono text-gray-500">{{ item.date }}</span>
                <span 
                  :class="[
                    'px-2 py-0.5 rounded-md text-[10px] font-bold',
                    item.source_type === 'course_usage' ? 'bg-[#154337]/10 text-[#154337]' : 'bg-emerald-100 text-emerald-800'
                  ]"
                >
                  {{ item.source_type === 'course_usage' ? '課程消耗' : '產品銷售' }}
                </span>
              </div>
              <div class="flex justify-between items-end">
                <div class="text-xs font-bold text-gray-800">{{ item.description || '—' }}</div>
                <div class="font-mono font-black text-sm text-[#154337]">
                  NT$ {{ Number(item.amount).toLocaleString() }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>