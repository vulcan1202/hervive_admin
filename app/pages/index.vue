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

// 卡片夾互動狀態
const activeIndex = ref(0)
const nextCard = () => {
  // 點擊後，切換下一張成為最上層
  activeIndex.value = (activeIndex.value + 1) % cards.value.length
}

// 將 4 張卡片結構化，綁定即時資料
const cards = computed(() => [
  {
    id: 'revenue',
    title: '本月實質履約營收',
    value: `NT$ ${currentMonthRevenue.value.toLocaleString()}`,
    sub: '已扣除耗用與退款',
    icon: 'mdi:cash-check',
    color: 'green'
  },
  {
    id: 'pending',
    title: '本月未完成預約',
    value: `${pendingAppointmentsCount.value} 組`,
    sub: '本月內待服務與待點收',
    icon: 'mdi:calendar-clock',
    color: 'purple'
  },
  {
    id: 'today',
    title: '本日新增預約筆數',
    value: `${todayAppointmentsCount.value} 筆`,
    sub: '今日排程數量',
    icon: 'mdi:calendar-plus',
    color: 'pink'
  },
  {
    id: 'inventory',
    title: '產品庫存總價值',
    value: `NT$ ${totalInventoryValue.value.toLocaleString()}`,
    sub: '現有商品庫存成本總額',
    icon: 'mdi:package-variant-closed',
    color: 'dark'
  }
])

// 動態計算每張卡片在「卡片夾」中的層級與視覺偏移
const getCardStyle = (originalIndex: number) => {
  const total = cards.value.length
  // 計算相對偏移量：0 為最上層，1 為第二層... 3 為被洗去後面的那層
  const offset = (originalIndex - activeIndex.value + total) % total
  
  if (offset === total - 1) {
    // 特效：剛被點擊換掉的最上層卡片，向上飛出並淡出
    return {
      zIndex: 0,
      transform: `translateY(-40px) scale(1.05)`,
      opacity: 0,
      transition: 'all 0.4s ease'
    }
  }

  return {
    zIndex: total - offset, // 最上層 z-index 最大
    transform: `translateY(${offset * 18}px) scale(${1 - offset * 0.04})`, // 越下層越低、越小
    opacity: 1 - (offset * 0.15), // 越下層越透明
    boxShadow: offset === 0 ? '0 12px 32px rgba(0,0,0,0.12)' : '0 4px 10px rgba(0,0,0,0.05)',
    transition: 'all 0.5s cubic-bezier(0.25, 0.8, 0.25, 1)'
  }
}

onMounted(async () => {
  // 精準計算台灣時間 (UTC+8) 的今天與本月區間
  const today = new Date()
  const tzOffset = 8 * 60
  const localToday = new Date(today.getTime() + tzOffset * 60000)
  const todayStr = localToday.toISOString().split('T')[0]
  
  const year = localToday.getFullYear()
  const month = String(localToday.getMonth() + 1).padStart(2, '0')
  const monthStart = `${year}-${month}-01`
  
  const nextMonth = new Date(year, localToday.getMonth() + 1, 1)
  const lastDayObj = new Date(nextMonth.getTime() - 86400000)
  const monthEnd = lastDayObj.toISOString().split('T')[0]

  try {
    // 平行發送三大 API 請求
    const [finRes, apptRes, prodRes] = await Promise.all([
      fetch(`${backendUrl}/api/financial-summary?start_date=${monthStart}&end_date=${monthEnd}`),
      fetch(`${backendUrl}/api/appointments`),
      fetch(`${backendUrl}/api/products`)
    ])

    // 1. 處理營收資料
    if (finRes.ok) {
      const finData = await finRes.json()
      currentMonthRevenue.value = finData.data?.revenue_recognition?.total_recognized_revenue || 0
    }

    // 2. 處理預約資料
    if (apptRes.ok) {
      const apptData = await apptRes.json()
      const appts = apptData.data || []
      
      pendingAppointmentsCount.value = appts.filter((a: any) => 
        a.date >= monthStart && a.date <= monthEnd && 
        (a.status === 'pending' || a.status === 'confirmed')
      ).length

      todayAppointmentsCount.value = appts.filter((a: any) => a.date === todayStr).length
    }

    // 3. 處理產品庫存資料
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
  <div class="dashboard-content">
    
    <!-- 頂部歡迎區塊 (已移除新增按鈕) -->
    <div class="welcome-banner">
      <div>
        <h1>早安，Ava</h1>
        <p>這裡是您目前的營運數據概覽。點擊卡片夾即可切換不同指標。</p>
      </div>
    </div>

    <!-- 儀表板雙欄網格 -->
    <div class="dashboard-grid">
      
      <!-- 左側：資料卡片夾 -->
      <div class="stack-section">
        <div class="card-stack" @click="nextCard">
          <div 
            v-for="(card, index) in cards" 
            :key="card.id" 
            class="stat-card border-gradient" 
            :style="getCardStyle(index)"
          >
            <div class="card-inner">
              <div class="stat-header">
                <span>{{ card.title }}</span>
                <div :class="['icon-badge', card.color]">
                  <Icon :name="card.icon" />
                </div>
              </div>
              
              <div class="stat-value">
                <Icon v-if="isLoading" name="mdi:loading" class="animate-spin text-3xl text-[#154337]/50" />
                <span v-else>{{ card.value }}</span>
              </div>
              
              <div class="stat-sub">{{ card.sub }}</div>
            </div>
          </div>
        </div>
        
        <p class="stack-hint">
          <Icon name="mdi:gesture-tap" class="animate-pulse" /> 
          點擊卡片洗牌切換
        </p>
      </div>

      <!-- 右側：快捷操作 (保持不變) -->
      <div class="quick-panel">
        <h3>快捷操作</h3>
        <div class="action-group">
          <button class="action-btn ghost">
            <Icon name="mdi:face-woman-shimmer-outline" />
            客戶畫像分析
          </button>
          <button class="action-btn ghost">
            <Icon name="mdi:chart-bell-curve-cumulative" />
            療程效果對比
          </button>
          <button class="action-btn ghost">
            <Icon name="mdi:robot-outline" />
            AI 排程建議
          </button>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.dashboard-content {
  max-width: 1200px;
}

.welcome-banner {
  margin-bottom: 40px;
}

.welcome-banner h1 {
  font-size: 28px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: #154337;
}

.welcome-banner p {
  margin: 0;
  color: #64748b;
  font-size: 14px;
}

/* 雙欄排版設定 */
.dashboard-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 40px;
  align-items: start;
}

@media (max-width: 860px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
    gap: 32px;
  }
}

/* 卡片夾外層容器設定 */
.stack-section {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.card-stack {
  position: relative;
  width: 100%;
  max-width: 380px;
  height: 200px; /* 預留卡片層疊展開的高度 */
  cursor: pointer;
  perspective: 1000px;
  /* 防止點擊時出現選取高光 */
  -webkit-tap-highlight-color: transparent;
  user-select: none; 
}

.stack-hint {
  margin-top: 24px;
  font-size: 12px;
  color: #94a3b8;
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}

/* 單張卡片設定 */
.stat-card {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  border-radius: 16px;
  padding: 2px; /* 漸層邊框厚度 */
  background: linear-gradient(135deg, rgba(168, 85, 247, 0.4), rgba(236, 72, 153, 0.4));
}

.card-inner {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 14px;
  padding: 28px 24px;
  height: 100%;
}

.stat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  color: #64748b;
  font-size: 14px;
  font-weight: 600;
}

.icon-badge {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.icon-badge.green { background: #dcfce7; color: #16a34a; }
.icon-badge.purple { background: #f3e8ff; color: #9333ea; }
.icon-badge.pink { background: #fce7f3; color: #db2777; }
.icon-badge.dark { background: #e2e8f0; color: #154337; }

.stat-value {
  font-size: 28px;
  font-weight: 800;
  color: #154337;
  margin-bottom: 8px;
  letter-spacing: -0.5px;
}

.stat-sub {
  font-size: 13px;
  color: #94a3b8;
}

/* 快捷操作面板 (延續原本風格) */
.quick-panel {
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 16px;
  padding: 24px;
  backdrop-filter: blur(8px);
}

.quick-panel h3 {
  margin: 0 0 20px 0;
  color: #154337;
  font-weight: 600;
  font-size: 16px;
}

.action-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  border-radius: 12px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
  border: none;
  font-weight: 600;
}

.action-btn.ghost {
  background: #ffffff;
  color: #475569;
  border: 1px solid #e2e8f0;
}

.action-btn.ghost:hover {
  border-color: #154337;
  color: #154337;
  background: #f8fafc;
  transform: translateX(4px);
}
</style>