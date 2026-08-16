<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const config = useRuntimeConfig()
const backendUrl = config.public.backendUrl

// 實質資料變數
const currentMonthRevenue = ref(0)
const pendingAppointmentsCount = ref(0)
const todayAppointmentsCount = ref(0)
const totalInventoryValue = ref(0)
const isLoading = ref(true)

// 卡片夾互動狀態 (Motion Intensity 5: 增強 3D 層疊彈性體感)
const activeIndex = ref(0)
const nextCard = () => {
  activeIndex.value = (activeIndex.value + 1) % cards.value.length
}

// 4 張數據卡片結構
const cards = computed(() => [
  {
    id: 'revenue',
    title: '本月實質履約營收',
    value: `NT$ ${currentMonthRevenue.value.toLocaleString()}`,
    sub: '已扣除耗用與退款認列',
    icon: 'mdi:cash-check',
    badge: '營收亮點',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  },
  {
    id: 'pending',
    title: '本月未完成預約',
    value: `${pendingAppointmentsCount.value} 組`,
    sub: '本月內待服務與待點收',
    icon: 'mdi:calendar-clock',
    badge: '待處理',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200'
  },
  {
    id: 'today',
    title: '本日新增預約筆數',
    value: `${todayAppointmentsCount.value} 筆`,
    sub: '今日排程門市服務總數',
    icon: 'mdi:calendar-plus',
    badge: '今日動態',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200'
  },
  {
    id: 'inventory',
    title: '產品庫存總成本價值',
    value: `NT$ ${totalInventoryValue.value.toLocaleString()}`,
    sub: '現有商品庫存資產總額',
    icon: 'mdi:package-variant-closed',
    badge: '資產庫存',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200'
  }
])

// 動態計算每張卡片在「卡片夾」中的層級與 3D 視覺偏移 (Variance 6 / Motion 5 彈簧物理)
const getCardStyle = (originalIndex: number) => {
  const total = cards.value.length
  const offset = (originalIndex - activeIndex.value + total) % total
  
  if (offset === total - 1) {
    return {
      zIndex: 0,
      transform: `translateY(-55px) rotate(-4deg) scale(0.96)`,
      opacity: 0,
      transition: 'all 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)'
    }
  }

  return {
    zIndex: total - offset,
    transform: `translateY(${offset * 22}px) rotate(${offset * -1.5}deg) scale(${1 - offset * 0.05})`,
    opacity: 1 - (offset * 0.18),
    boxShadow: offset === 0 ? '0 16px 36px -8px rgba(21, 67, 55, 0.18)' : '0 4px 12px rgba(0,0,0,0.04)',
    transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
  }
}

const getTaiwanDateString = (dateObj: Date = new Date()) => {
  const formatter = new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(dateObj);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

onMounted(async () => {
  const todayStr = getTaiwanDateString()
  const todayParts = todayStr.split('-')
  const year = todayParts[0]
  const month = todayParts[1]
  const monthStart = `${year}-${month}-01`
  
  const lastDayNum = new Date(Number(year), Number(month), 0).getDate()
  const monthEnd = `${year}-${month}-${String(lastDayNum).padStart(2, '0')}`

  try {
    const [finRes, apptRes, prodRes] = await Promise.all([
      fetch(`${backendUrl}/api/financial-summary?start_date=${monthStart}&end_date=${monthEnd}`),
      fetch(`${backendUrl}/api/appointments`),
      fetch(`${backendUrl}/api/products`)
    ])

    if (finRes.ok) {
      const finData = await finRes.json()
      currentMonthRevenue.value = finData.data?.revenue_recognition?.total_recognized_revenue || 0
    }

    if (apptRes.ok) {
      const apptData = await apptRes.json()
      const appts = apptData.data || []
      
      pendingAppointmentsCount.value = appts.filter((a: any) => 
        a.date >= monthStart && a.date <= monthEnd && 
        (a.status === 'pending' || a.status === 'confirmed')
      ).length

      todayAppointmentsCount.value = appts.filter((a: any) => {
        if (a.status === 'cancelled' || a.status === 'cancel') return false
        if (!a.created_at) return false
        const rawDateStr = a.created_at.includes('T') ? a.created_at : a.created_at.replace(' ', 'T')
        const createdDate = getTaiwanDateString(new Date(rawDateStr))
        return createdDate === todayStr
      }).length
    }

    if (prodRes.ok) {
      const prodData = await prodRes.json()
      const prods = prodData.data || []
      totalInventoryValue.value = prods.reduce((acc: number, p: any) => acc + (p.cost_price * p.stock_quantity), 0)
    }
  } catch (e) {
    console.error('獲取儀表板數據失敗', e)
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="max-w-6xl mx-auto py-2 sm:py-4 px-2 sm:px-4 space-y-5 sm:space-y-6">
    
    <!-- 頂部歡迎與即時狀態區塊 -->
    <div class="bg-white p-5 sm:p-7 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
      <div class="space-y-1.5 relative z-10">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#154337]/10 text-[#154337] text-xs font-bold tracking-wide">
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>即時營運管理中心</span>
        </div>
        <h1 class="text-2xl sm:text-3xl font-black text-[#154337] tracking-tight font-serif">早安，系統管理員</h1>
        <p class="text-xs sm:text-sm text-gray-500">掌握門市每日排程、實質履約營收認列與庫存資產總覽</p>
      </div>

      <div class="flex items-center gap-2.5 flex-wrap shrink-0">
        <NuxtLink 
          to="/Appointment" 
          class="px-4 py-2.5 rounded-xl bg-[#154337] text-white text-xs font-bold hover:bg-[#0e2f27] transition shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
        >
          <Icon name="mdi:calendar-check" class="text-base" />
          <span>預約點收清單</span>
        </NuxtLink>
        <NuxtLink 
          to="/finance" 
          class="px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 text-xs font-bold hover:bg-gray-50 transition shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95"
        >
          <Icon name="mdi:chart-line" class="text-base text-[#154337]" />
          <span>財務報表</span>
        </NuxtLink>
      </div>
    </div>

    <!-- 4 大核心營運指標網格 (4 欄高奢 Double-Bezel 卡片架構) -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
      <!-- 1. 本月實質履約營收 -->
      <div class="p-1 rounded-2xl bg-[#154337]/5 border border-[#154337]/10 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition duration-200 group">
        <div class="bg-white rounded-[calc(1rem-2px)] p-4 sm:p-5 h-full flex flex-col justify-between space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-gray-500">本月實質履約營收</span>
            <div class="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 group-hover:scale-105 transition">
              <Icon name="mdi:cash-check" class="text-xl" />
            </div>
          </div>
          <div>
            <div v-if="isLoading" class="flex items-center gap-2 text-gray-400 py-1">
              <Icon name="mdi:loading" class="animate-spin text-xl text-[#154337]" />
              <span class="text-xs">計算中...</span>
            </div>
            <div v-else class="text-2xl sm:text-3xl font-black text-[#154337] font-mono tracking-tight">
              NT$ {{ currentMonthRevenue.toLocaleString() }}
            </div>
            <p class="text-[11px] text-gray-400 mt-1">已扣除耗用與退款認列</p>
          </div>
          <div class="pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px] font-bold">
            <NuxtLink to="/finance" class="text-[#154337] hover:underline inline-flex items-center gap-0.5">
              <span>查看財務明細</span>
              <Icon name="mdi:chevron-right" size="13" />
            </NuxtLink>
            <span class="px-2 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200">
              營收亮點
            </span>
          </div>
        </div>
      </div>

      <!-- 2. 本月未完成預約 -->
      <div class="p-1 rounded-2xl bg-purple-500/5 border border-purple-500/10 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition duration-200 group">
        <div class="bg-white rounded-[calc(1rem-2px)] p-4 sm:p-5 h-full flex flex-col justify-between space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-gray-500">本月未完成預約</span>
            <div class="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-200 group-hover:scale-105 transition">
              <Icon name="mdi:calendar-clock" class="text-xl" />
            </div>
          </div>
          <div>
            <div v-if="isLoading" class="flex items-center gap-2 text-gray-400 py-1">
              <Icon name="mdi:loading" class="animate-spin text-xl text-purple-600" />
              <span class="text-xs">計算中...</span>
            </div>
            <div v-else class="text-2xl sm:text-3xl font-black text-purple-900 font-mono tracking-tight">
              {{ pendingAppointmentsCount }} <span class="text-sm font-bold text-gray-500">組</span>
            </div>
            <p class="text-[11px] text-gray-400 mt-1">本月內待服務與待點收</p>
          </div>
          <div class="pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px] font-bold">
            <NuxtLink to="/Appointment" class="text-purple-700 hover:underline inline-flex items-center gap-0.5">
              <span>處理預約排程</span>
              <Icon name="mdi:chevron-right" size="13" />
            </NuxtLink>
            <span class="px-2 py-0.5 rounded-full text-[10px] bg-purple-50 text-purple-700 border border-purple-200">
              待排班服務
            </span>
          </div>
        </div>
      </div>

      <!-- 3. 本日新增預約筆數 -->
      <div class="p-1 rounded-2xl bg-rose-500/5 border border-rose-500/10 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition duration-200 group">
        <div class="bg-white rounded-[calc(1rem-2px)] p-4 sm:p-5 h-full flex flex-col justify-between space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-gray-500">本日新增預約</span>
            <div class="w-9 h-9 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-200 group-hover:scale-105 transition">
              <Icon name="mdi:calendar-today" class="text-xl" />
            </div>
          </div>
          <div>
            <div v-if="isLoading" class="flex items-center gap-2 text-gray-400 py-1">
              <Icon name="mdi:loading" class="animate-spin text-xl text-rose-600" />
              <span class="text-xs">計算中...</span>
            </div>
            <div v-else class="text-2xl sm:text-3xl font-black text-rose-800 font-mono tracking-tight">
              {{ todayAppointmentsCount }} <span class="text-sm font-bold text-gray-500">筆</span>
            </div>
            <p class="text-[11px] text-gray-400 mt-1">今日門市新增預約筆數</p>
          </div>
          <div class="pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px] font-bold">
            <NuxtLink to="/calendar" class="text-rose-700 hover:underline inline-flex items-center gap-0.5">
              <span>瀏覽今日行事曆</span>
              <Icon name="mdi:chevron-right" size="13" />
            </NuxtLink>
            <span class="px-2 py-0.5 rounded-full text-[10px] bg-rose-50 text-rose-700 border border-rose-200">
              今日動態
            </span>
          </div>
        </div>
      </div>

      <!-- 4. 產品庫存總成本價值 -->
      <div class="p-1 rounded-2xl bg-amber-500/5 border border-amber-500/10 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition duration-200 group">
        <div class="bg-white rounded-[calc(1rem-2px)] p-4 sm:p-5 h-full flex flex-col justify-between space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-gray-500">產品庫存成本總值</span>
            <div class="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200 group-hover:scale-105 transition">
              <Icon name="mdi:package-variant-closed" class="text-xl" />
            </div>
          </div>
          <div>
            <div v-if="isLoading" class="flex items-center gap-2 text-gray-400 py-1">
              <Icon name="mdi:loading" class="animate-spin text-xl text-amber-600" />
              <span class="text-xs">計算中...</span>
            </div>
            <div v-else class="text-2xl sm:text-3xl font-black text-amber-900 font-mono tracking-tight">
              NT$ {{ totalInventoryValue.toLocaleString() }}
            </div>
            <p class="text-[11px] text-gray-400 mt-1">現有商品庫存資產總額</p>
          </div>
          <div class="pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px] font-bold">
            <NuxtLink to="/products" class="text-amber-800 hover:underline inline-flex items-center gap-0.5">
              <span>管理庫存商品</span>
              <Icon name="mdi:chevron-right" size="13" />
            </NuxtLink>
            <span class="px-2 py-0.5 rounded-full text-[10px] bg-amber-50 text-amber-700 border border-amber-200">
              資產庫存
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 營運摘要與重點指南卡片 (寬幅尊榮設計) -->
    <div class="p-1 rounded-3xl bg-[#154337]/5 border border-[#154337]/10 shadow-xs">
      <div class="bg-white rounded-[calc(1.5rem-2px)] p-5 sm:p-7 space-y-5">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-[#154337]/10 flex items-center justify-center text-[#154337] shrink-0">
              <Icon name="mdi:chart-timeline-variant-shimmer" class="text-xl" />
            </div>
            <div>
              <h2 class="text-base sm:text-lg font-bold text-[#154337]">系統營運與會計原則重點提示</h2>
              <p class="text-xs text-gray-500">門市營收認列與庫存盤點管理規範</p>
            </div>
          </div>

          <NuxtLink 
            to="/analytics" 
            class="inline-flex items-center gap-1.5 text-xs font-bold text-[#154337] hover:underline"
          >
            <span>前往數據洞察報告</span>
            <Icon name="mdi:arrow-right" class="text-sm" />
          </NuxtLink>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="p-4 rounded-2xl bg-[#FAF4EE]/70 border border-[#154337]/10 space-y-2">
            <div class="flex items-center gap-2 text-xs font-bold text-gray-900">
              <Icon name="mdi:cash-multiple" class="text-emerald-700 text-base" />
              <span>實質履約營收認列</span>
            </div>
            <p class="text-[11px] text-gray-600 leading-relaxed">
              顧客購買包套時列入現金流收入，直到顧客到店實際扣堂消費或購買產品時，系統才正式認列為門市營收。
            </p>
          </div>

          <div class="p-4 rounded-2xl bg-[#FAF4EE]/70 border border-[#154337]/10 space-y-2">
            <div class="flex items-center gap-2 text-xs font-bold text-gray-900">
              <Icon name="mdi:account-clock" class="text-purple-700 text-base" />
              <span>預約與扣堂點收</span>
            </div>
            <p class="text-[11px] text-gray-600 leading-relaxed">
              在預約點收頁面確認完成服務後，系統將自動核銷顧客包套並產生異動履歷，確保會員堂數即時同步。
            </p>
          </div>

          <div class="p-4 rounded-2xl bg-[#FAF4EE]/70 border border-[#154337]/10 space-y-2">
            <div class="flex items-center gap-2 text-xs font-bold text-gray-900">
              <Icon name="mdi:package-variant-closed-check" class="text-amber-700 text-base" />
              <span>進銷存庫存防護</span>
            </div>
            <p class="text-[11px] text-gray-600 leading-relaxed">
              所有產品進出庫皆有完整審計履歷，盤點調整不影響財務帳目，且庫存扣減受到防負數嚴格檢驗。
            </p>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>
