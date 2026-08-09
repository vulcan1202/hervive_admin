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
  <div class="max-w-6xl mx-auto space-y-8">
    
    <!-- 頂部歡迎區塊 (Variance 6: 雙色非對稱裝飾標籤) -->
    <div class="bg-white p-6 sm:p-8 rounded-3xl border border-[#154337]/10 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
      <div class="space-y-1 relative z-10">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#154337]/10 text-[#154337] text-xs font-semibold tracking-wide">
          <span class="w-2 h-2 rounded-full bg-[#154337] animate-ping"></span>
          即時控制台
        </div>
        <h1 class="text-2xl sm:text-3xl font-extrabold text-[#154337]">早安，系統管理員</h1>
      </div>

      <div class="hidden lg:flex items-center gap-3 shrink-0">
        <NuxtLink to="/Appointment" class="px-5 py-2.5 rounded-2xl bg-[#154337] text-white text-xs font-bold hover:bg-[#0e2f27] transition shadow-xs flex items-center gap-2 cursor-pointer active:scale-95">
          <Icon name="mdi:calendar-plus" class="text-base" />
          <span>查看預約清單</span>
        </NuxtLink>
      </div>
    </div>

    <!-- 雙欄 Layout (Density 7: 高效雙欄) -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      
      <!-- 左側：卡片夾互動區塊 (Variance 6 / Motion 5) -->
      <div class="lg:col-span-7 bg-white p-6 rounded-3xl border border-[#154337]/10 shadow-xs flex flex-col items-center justify-center min-h-[380px] relative">
        <div class="w-full flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
          <span class="text-xs font-bold text-gray-400 uppercase tracking-wider">營運指標切換卡片</span>
          <span class="text-xs text-[#154337] font-mono font-semibold">點擊卡片洗牌 &rarr;</span>
        </div>

        <div class="card-stack my-4" @click="nextCard">
          <div 
            v-for="(card, index) in cards" 
            :key="card.id" 
            class="stat-card border border-[#154337]/20 p-1 bg-[#154337]/5" 
            :style="getCardStyle(index)"
          >
            <div class="card-inner bg-white rounded-[calc(1.25rem-0.25rem)] p-6 flex flex-col justify-between h-full shadow-xs">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-gray-500">{{ card.title }}</span>
                <span :class="['px-2.5 py-0.5 rounded-full text-[10px] font-bold border', card.badgeColor]">
                  {{ card.badge }}
                </span>
              </div>
              
              <div class="my-3">
                <div v-if="isLoading" class="flex items-center gap-2 text-gray-400">
                  <Icon name="mdi:loading" class="animate-spin text-2xl" />
                  <span class="text-xs">數據計算中...</span>
                </div>
                <div v-else class="text-3xl font-extrabold text-[#154337] font-mono tracking-tight">
                  {{ card.value }}
                </div>
              </div>
              
              <div class="text-xs text-gray-400 flex items-center justify-between border-t border-gray-100 pt-3">
                <span>{{ card.sub }}</span>
                <Icon name="mdi:chevron-right" class="text-base text-gray-300" />
              </div>
            </div>
          </div>
        </div>

        <div class="text-xs text-gray-400 mt-6 flex items-center gap-1.5 font-medium">
          <Icon name="mdi:gesture-tap" class="animate-bounce text-[#154337] text-base" />
          <span>點擊卡片體感洗牌切換指標</span>
        </div>
      </div>

      <!-- 右側：快捷操作面板 (Motion 5: hover translate physics) -->
      <div class="lg:col-span-5 bg-white p-6 rounded-3xl border border-[#154337]/10 shadow-xs space-y-4">
        <div class="flex items-center justify-between border-b border-gray-100 pb-3">
          <h3 class="font-bold text-[#154337] text-base">門市快捷導覽功能</h3>
          <span class="text-xs text-gray-400 font-mono">Quick Actions</span>
        </div>

        <div class="space-y-3">
          <NuxtLink 
            to="/Appointment" 
            class="flex items-center justify-between p-4 rounded-2xl bg-[#FAF4EE]/70 border border-[#154337]/10 hover:border-[#154337]/40 hover:bg-white hover:-translate-y-0.5 transition duration-200 group cursor-pointer"
          >
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-[#154337] text-white flex items-center justify-center shadow-xs">
                <Icon name="mdi:clipboard-text-clock-outline" class="text-xl" />
              </div>
              <div>
                <div class="text-sm font-bold text-gray-900 group-hover:text-[#154337] transition">預約點收與簽到</div>
                <div class="text-xs text-gray-400">處理到店顧客預約與課程扣堂</div>
              </div>
            </div>
            <div class="w-7 h-7 rounded-full bg-white border border-gray-200 group-hover:border-[#154337] flex items-center justify-center text-gray-400 group-hover:text-[#154337] transition">
              <Icon name="mdi:arrow-right" class="text-sm group-hover:translate-x-0.5 transition" />
            </div>
          </NuxtLink>

          <NuxtLink 
            to="/settings" 
            class="flex items-center justify-between p-4 rounded-2xl bg-[#FAF4EE]/70 border border-[#154337]/10 hover:border-[#154337]/40 hover:bg-white hover:-translate-y-0.5 transition duration-200 group cursor-pointer"
          >
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
                <Icon name="mdi:account-group-outline" class="text-xl" />
              </div>
              <div>
                <div class="text-sm font-bold text-gray-900 group-hover:text-purple-700 transition">美容師團隊管理</div>
                <div class="text-xs text-gray-400">新增、編輯或維護駐店美容師清單</div>
              </div>
            </div>
            <div class="w-7 h-7 rounded-full bg-white border border-gray-200 group-hover:border-purple-600 flex items-center justify-center text-gray-400 group-hover:text-purple-600 transition">
              <Icon name="mdi:arrow-right" class="text-sm group-hover:translate-x-0.5 transition" />
            </div>
          </NuxtLink>

          <NuxtLink 
            to="/analytics" 
            class="flex items-center justify-between p-4 rounded-2xl bg-[#FAF4EE]/70 border border-[#154337]/10 hover:border-[#154337]/40 hover:bg-white hover:-translate-y-0.5 transition duration-200 group cursor-pointer"
          >
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                <Icon name="mdi:chart-timeline-variant-shimmer" class="text-xl" />
              </div>
              <div>
                <div class="text-sm font-bold text-gray-900 group-hover:text-emerald-700 transition">數據洞察與營收報告</div>
                <div class="text-xs text-gray-400">檢視實質履約營收與現金流量報告</div>
              </div>
            </div>
            <div class="w-7 h-7 rounded-full bg-white border border-gray-200 group-hover:border-emerald-600 flex items-center justify-center text-gray-400 group-hover:text-emerald-600 transition">
              <Icon name="mdi:arrow-right" class="text-sm group-hover:translate-x-0.5 transition" />
            </div>
          </NuxtLink>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.card-stack {
  position: relative;
  width: 100%;
  max-width: 360px;
  height: 200px;
  cursor: pointer;
  perspective: 1000px;
  user-select: none;
}

.stat-card {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  border-radius: 20px;
}
</style>
