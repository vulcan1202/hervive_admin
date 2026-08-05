<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const config = useRuntimeConfig()
const backendUrl = config.public.backendUrl

// 狀態宣告
const isLoading = ref(true)
const selectedPreset = ref<'month' | 'quarter' | 'year' | 'custom'>('month')

// 日期區間
const startDate = ref('')
const endDate = ref('')

// 數據統計指標
const financialSummary = ref<any>(null)
const revenueRecognitions = ref<any[]>([])
const appointments = ref<any[]>([])
const products = ref<any[]>([])

// 設定日期區間快選
const setPresetRange = (preset: 'month' | 'quarter' | 'year') => {
  selectedPreset.value = preset
  const today = new Date()
  const year = today.getFullYear()

  if (preset === 'month') {
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
const totalRecognizedRevenue = computed(() => {
  return financialSummary.value?.revenue_recognition?.total_recognized_revenue || 0
})

const courseRevenue = computed(() => {
  return financialSummary.value?.revenue_recognition?.course_recognized_revenue || 0
})

const productRevenue = computed(() => {
  return financialSummary.value?.revenue_recognition?.product_recognized_revenue || 0
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

onMounted(() => {
  setPresetRange('month')
})
</script>

<template>
  <div class="max-w-7xl mx-auto space-y-6">
    <!-- 頂部頁面標題與日期選擇器 -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-[#154337]/10 shadow-xs">
      <div>
        <div class="flex items-center gap-2">
          <span class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#154337]/10 text-[#154337] tracking-wider uppercase">Business Intelligence</span>
          <h1 class="text-2xl font-bold text-[#154337]">數據洞察與營運分析報告</h1>
        </div>
        <p class="text-xs sm:text-sm text-gray-500 mt-1">追蹤實質營收認列、現金流狀況、預約完成率與庫存資產分配</p>
      </div>

      <!-- 日期區間過濾控制項 -->
      <div class="flex flex-wrap items-center gap-2 bg-[#FAF4EE] p-1.5 rounded-2xl border border-[#154337]/10">
        <button 
          @click="setPresetRange('month')"
          :class="[
            'px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer',
            selectedPreset === 'month' ? 'bg-[#154337] text-white shadow-xs' : 'text-gray-600 hover:text-[#154337]'
          ]"
        >
          本月
        </button>
        <button 
          @click="setPresetRange('quarter')"
          :class="[
            'px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer',
            selectedPreset === 'quarter' ? 'bg-[#154337] text-white shadow-xs' : 'text-gray-600 hover:text-[#154337]'
          ]"
        >
          本季
        </button>
        <button 
          @click="setPresetRange('year')"
          :class="[
            'px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer',
            selectedPreset === 'year' ? 'bg-[#154337] text-white shadow-xs' : 'text-gray-600 hover:text-[#154337]'
          ]"
        >
          本年度
        </button>

        <div class="h-4 w-px bg-[#154337]/20 mx-1"></div>

        <div class="flex items-center gap-1.5 text-xs text-gray-600 px-2">
          <input 
            v-model="startDate"
            type="date"
            class="bg-white border border-[#154337]/20 rounded-lg px-2 py-1 text-xs outline-none focus:border-[#154337]"
            @change="selectedPreset = 'custom'; fetchAnalyticsData()"
          />
          <span>至</span>
          <input 
            v-model="endDate"
            type="date"
            class="bg-white border border-[#154337]/20 rounded-lg px-2 py-1 text-xs outline-none focus:border-[#154337]"
            @change="selectedPreset = 'custom'; fetchAnalyticsData()"
          />
        </div>
      </div>
    </div>

    <!-- 4 大核心 KPI 統計卡片 -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- 總認列營收 -->
      <div class="p-6 bg-white rounded-3xl border border-[#154337]/10 shadow-xs relative overflow-hidden group hover:border-[#154337]/30 transition duration-300">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-gray-400">當期實質履約營收</span>
          <div class="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Icon name="mdi:cash-check" class="text-xl" />
          </div>
        </div>
        <div class="mt-4">
          <div class="text-2xl lg:text-3xl font-extrabold text-[#154337] font-mono">
            NT$ {{ totalRecognizedRevenue.toLocaleString() }}
          </div>
          <p class="text-[11px] text-gray-400 mt-1">來自課程消耗與產品實際販售認列</p>
        </div>
      </div>

      <!-- 現金淨流入 -->
      <div class="p-6 bg-white rounded-3xl border border-[#154337]/10 shadow-xs relative overflow-hidden group hover:border-[#154337]/30 transition duration-300">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-gray-400">當期現金淨流入 (Net Cash)</span>
          <div class="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Icon name="mdi:swap-horizontal" class="text-xl" />
          </div>
        </div>
        <div class="mt-4">
          <div :class="['text-2xl lg:text-3xl font-extrabold font-mono', netCashFlow >= 0 ? 'text-emerald-700' : 'text-rose-600']">
            NT$ {{ netCashFlow.toLocaleString() }}
          </div>
          <div class="flex items-center gap-2 text-[11px] text-gray-500 mt-1">
            <span class="text-emerald-600">收 +{{ totalIncome.toLocaleString() }}</span>
            <span>/</span>
            <span class="text-rose-500">支 -{{ totalExpense.toLocaleString() }}</span>
          </div>
        </div>
      </div>

      <!-- 預約完成率 -->
      <div class="p-6 bg-white rounded-3xl border border-[#154337]/10 shadow-xs relative overflow-hidden group hover:border-[#154337]/30 transition duration-300">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-gray-400">預約履約完成率</span>
          <div class="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Icon name="mdi:calendar-check-outline" class="text-xl" />
          </div>
        </div>
        <div class="mt-4">
          <div class="text-2xl lg:text-3xl font-extrabold text-[#154337] font-mono">
            {{ appointmentMetrics.rate }}<span class="text-base font-normal text-gray-400">%</span>
          </div>
          <p class="text-[11px] text-gray-400 mt-1">共 {{ appointmentMetrics.total }} 組預約 (已完成 {{ appointmentMetrics.completed }} 組)</p>
        </div>
      </div>

      <!-- 庫存資產總值 -->
      <div class="p-6 bg-white rounded-3xl border border-[#154337]/10 shadow-xs relative overflow-hidden group hover:border-[#154337]/30 transition duration-300">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-gray-400">當前商品庫存成本價值</span>
          <div class="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Icon name="mdi:package-variant" class="text-xl" />
          </div>
        </div>
        <div class="mt-4">
          <div class="text-2xl lg:text-3xl font-extrabold text-[#154337] font-mono">
            NT$ {{ totalInventoryValue.toLocaleString() }}
          </div>
          <p class="text-[11px] text-gray-400 mt-1">共有 {{ products.length }} 項庫存商品品項</p>
        </div>
      </div>
    </div>

    <!-- 雙欄分析圖表區 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- 營收結構拆解 -->
      <div class="p-6 bg-white rounded-3xl border border-[#154337]/10 shadow-xs space-y-5">
        <div class="flex items-center justify-between border-b border-gray-100 pb-3">
          <div class="flex items-center gap-2">
            <Icon name="mdi:chart-pie" class="text-xl text-[#154337]" />
            <h3 class="font-bold text-gray-900 text-base">當期營收來源拆解</h3>
          </div>
          <span class="text-xs font-mono text-gray-400">Revenue Breakdown</span>
        </div>

        <div v-if="isLoading" class="h-40 flex items-center justify-center text-gray-400 animate-pulse">
          <Icon name="mdi:loading" class="animate-spin text-2xl" />
        </div>

        <div v-else class="space-y-4">
          <!-- 課程消耗營收 -->
          <div class="space-y-1.5">
            <div class="flex justify-between text-xs font-medium">
              <span class="text-gray-700 flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-[#154337]"></span>
                會員包堂與課程消耗認列
              </span>
              <span class="font-bold text-[#154337] font-mono">NT$ {{ courseRevenue.toLocaleString() }}</span>
            </div>
            <div class="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
              <div 
                class="h-full bg-[#154337] transition-all duration-500"
                :style="{ width: `${totalRecognizedRevenue > 0 ? (courseRevenue / totalRecognizedRevenue) * 100 : 0}%` }"
              ></div>
            </div>
          </div>

          <!-- 產品銷售營收 -->
          <div class="space-y-1.5">
            <div class="flex justify-between text-xs font-medium">
              <span class="text-gray-700 flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                零售產品直接銷售認列
              </span>
              <span class="font-bold text-[#154337] font-mono">NT$ {{ productRevenue.toLocaleString() }}</span>
            </div>
            <div class="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
              <div 
                class="h-full bg-emerald-500 transition-all duration-500"
                :style="{ width: `${totalRecognizedRevenue > 0 ? (productRevenue / totalRecognizedRevenue) * 100 : 0}%` }"
              ></div>
            </div>
          </div>

          <div class="pt-4 border-t border-gray-100 grid grid-cols-2 gap-4 text-center">
            <div class="p-3 rounded-2xl bg-[#FAF4EE]/60">
              <div class="text-[11px] text-gray-400">課程佔比</div>
              <div class="text-lg font-bold text-[#154337] font-mono mt-0.5">
                {{ totalRecognizedRevenue > 0 ? Math.round((courseRevenue / totalRecognizedRevenue) * 100) : 0 }}%
              </div>
            </div>
            <div class="p-3 rounded-2xl bg-emerald-50/50">
              <div class="text-[11px] text-gray-400">產品佔比</div>
              <div class="text-lg font-bold text-emerald-700 font-mono mt-0.5">
                {{ totalRecognizedRevenue > 0 ? Math.round((productRevenue / totalRecognizedRevenue) * 100) : 0 }}%
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 現金收支類別分佈 -->
      <div class="p-6 bg-white rounded-3xl border border-[#154337]/10 shadow-xs space-y-5">
        <div class="flex items-center justify-between border-b border-gray-100 pb-3">
          <div class="flex items-center gap-2">
            <Icon name="mdi:cash-fast" class="text-xl text-[#154337]" />
            <h3 class="font-bold text-gray-900 text-base">現金交易流向分析</h3>
          </div>
          <span class="text-xs font-mono text-gray-400">Cash Flow Distribution</span>
        </div>

        <div v-if="isLoading" class="h-40 flex items-center justify-center text-gray-400 animate-pulse">
          <Icon name="mdi:loading" class="animate-spin text-2xl" />
        </div>

        <div v-else class="space-y-4">
          <!-- 收入項目 -->
          <div class="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 space-y-2">
            <div class="flex justify-between items-center text-xs font-semibold text-emerald-800">
              <span class="flex items-center gap-1.5">
                <Icon name="mdi:arrow-down-bold-circle-outline" class="text-base text-emerald-600" />
                現金總收入
              </span>
              <span class="font-mono text-sm">NT$ {{ totalIncome.toLocaleString() }}</span>
            </div>
            <p class="text-[11px] text-emerald-600/80">包含門市現場現金、LINE Pay、刷卡與匯款之當期實際入帳</p>
          </div>

          <!-- 支出項目 -->
          <div class="p-4 rounded-2xl bg-rose-50/60 border border-rose-100 space-y-2">
            <div class="flex justify-between items-center text-xs font-semibold text-rose-800">
              <span class="flex items-center gap-1.5">
                <Icon name="mdi:arrow-up-bold-circle-outline" class="text-base text-rose-600" />
                現金總支出
              </span>
              <span class="font-mono text-sm">NT$ {{ totalExpense.toLocaleString() }}</span>
            </div>
            <p class="text-[11px] text-rose-600/80">包含店面租金、進貨成本、水電雜支與人員行政提撥</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 近期營收認列日誌明細表 -->
    <div class="bg-white rounded-3xl border border-[#154337]/10 p-6 shadow-xs space-y-4">
      <div class="flex items-center justify-between border-b border-gray-100 pb-4">
        <div class="flex items-center gap-2">
          <Icon name="mdi:file-document-outline" class="text-xl text-[#154337]" />
          <h3 class="font-bold text-gray-900 text-base">當期營收認列交易紀錄明細</h3>
        </div>
        <NuxtLink to="/finance" class="text-xs text-[#154337] hover:underline font-medium">查看完整財務明細 &rarr;</NuxtLink>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="bg-[#FAF4EE] text-gray-600 rounded-xl">
              <th class="py-3 px-4 rounded-l-xl">交易日期</th>
              <th class="py-3 px-4">營收來源類型</th>
              <th class="py-3 px-4">客戶編號</th>
              <th class="py-3 px-4">備註說明</th>
              <th class="py-3 px-4 text-right rounded-r-xl">認列金額</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-if="revenueRecognitions.length === 0">
              <td colspan="5" class="py-8 text-center text-gray-400">當前區間尚無營收認列紀錄</td>
            </tr>
            <tr v-for="r in revenueRecognitions.slice(0, 8)" :key="r.id" class="hover:bg-gray-50/80 transition">
              <td class="py-3 px-4 font-mono text-gray-600">{{ r.date }}</td>
              <td class="py-3 px-4">
                <span 
                  :class="[
                    'px-2.5 py-0.5 rounded-full text-[10px] font-semibold inline-block',
                    r.source_type === 'course_usage' ? 'bg-[#154337]/10 text-[#154337]' : 'bg-emerald-100 text-emerald-800'
                  ]"
                >
                  {{ r.source_type === 'course_usage' ? '課程耗用認列' : '產品銷售認列' }}
                </span>
              </td>
              <td class="py-3 px-4 font-mono text-gray-500">#{{ r.user_id }}</td>
              <td class="py-3 px-4 text-gray-700">{{ r.description || '-' }}</td>
              <td class="py-3 px-4 text-right font-bold text-[#154337] font-mono text-sm">
                NT$ {{ r.amount.toLocaleString() }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>