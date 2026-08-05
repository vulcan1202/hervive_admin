<template>
  <div class="flex h-screen w-full bg-[#FAF4EE] font-sans text-gray-800 overflow-hidden box-border relative">
    
    <!-- 手機版：側邊欄展開時的半透明深色遮罩 -->
    <div 
      v-if="!isCollapsed" 
      class="fixed inset-0 bg-black/50 z-20 md:hidden transition-opacity backdrop-blur-xs"
      @click="isCollapsed = true"
    ></div>

    <!-- 側邊欄 (Hervive 品牌翡翠綠 #154337) -->
    <aside 
      :class="[
        'bg-[#154337] flex flex-col transition-all duration-300 shadow-[4px_0_20px_rgba(21,67,55,0.1)] z-30 shrink-0 h-full border-r border-white/10 text-white',
        'absolute md:relative', // 手機版絕對定位覆蓋，電腦版彈性排版
        isCollapsed ? '-translate-x-full md:translate-x-0 md:w-[52px]' : 'translate-x-0 w-[250px] md:w-[230px]' 
      ]"
    >
      <!-- 側邊欄頂部 Logo 區 (保留奶茶色背景 #FAF4EE) -->
      <div 
        :class="[
          'h-[64px] md:h-[72px] flex items-center justify-between border-b border-[#154337]/15 bg-[#FAF4EE] relative box-border transition-all',
          isCollapsed ? 'px-1 justify-center' : 'px-4'
        ]"
      >
        <!-- 品牌 Logo -->
        <NuxtLink to="/" class="flex items-center justify-center overflow-hidden group">
          <img
            v-if="!isCollapsed"
            src="/hervive.png"
            alt="Hervive 品牌標誌"
            class="h-7 md:h-8 w-auto max-w-[135px] object-contain group-hover:scale-102 transition duration-200"
          />
          <div 
            v-else 
            class="hidden md:flex w-8 h-8 min-w-[32px] bg-[#154337] rounded-xl items-center justify-center text-white shadow-xs"
          >
            <Icon name="mdi:spa" class="text-[18px]" />
          </div>
        </NuxtLink>
        
        <!-- 電腦版：縮放切換按鈕 -->
        <button 
          class="absolute -right-[12px] top-1/2 -translate-y-1/2 w-6 h-6 bg-white border border-[#154337]/20 rounded-full hidden md:flex items-center justify-center cursor-pointer text-[#154337] shadow-sm transition-all hover:scale-110 hover:bg-[#FAF4EE] z-10" 
          @click="isCollapsed = !isCollapsed"
          :title="isCollapsed ? '展開側邊欄' : '收合側邊欄'"
        >
          <Icon :name="isCollapsed ? 'mdi:chevron-right' : 'mdi:chevron-left'" class="text-xs" />
        </button>
      </div>
      
      <!-- 導航選單區塊 -->
      <nav class="p-3 px-2 flex flex-col gap-1 flex-1 overflow-y-auto custom-scrollbar">
        
        <!-- 分組 1：核心營運 -->
        <div v-if="!isCollapsed" class="text-[10px] uppercase font-mono tracking-widest text-white/45 px-3.5 pt-3 pb-1 font-semibold">
          核心營運 · CORE
        </div>

        <NuxtLink to="/" :class="getNavLinkClass('/')" @click="closeSidebarOnMobile">
          <div :class="getIconWrapperClass('/')">
            <Icon name="mdi:view-dashboard-outline" class="text-[19px]" />
          </div>
          <div v-if="!isCollapsed" class="flex-1 flex items-center justify-between overflow-hidden">
            <span class="text-sm font-medium leading-tight">智能儀表盤</span>
            <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 font-semibold">LIVE</span>
          </div>
        </NuxtLink>
        
        <NuxtLink to="/calendar" :class="getNavLinkClass('/calendar')" @click="closeSidebarOnMobile">
          <div :class="getIconWrapperClass('/calendar')">
            <Icon name="mdi:calendar-month-outline" class="text-[19px]" />
          </div>
          <span v-if="!isCollapsed" class="text-sm font-medium">休假與行事曆</span>
        </NuxtLink>
        
        <NuxtLink to="/Appointment" :class="getNavLinkClass('/Appointment')" @click="closeSidebarOnMobile">
          <div :class="getIconWrapperClass('/Appointment')">
            <Icon name="mdi:clipboard-text-clock-outline" class="text-[19px]" />
          </div>
          <span v-if="!isCollapsed" class="text-sm font-medium">預約管理</span>
        </NuxtLink>

        <!-- 分組 2：業務與財務 -->
        <div v-if="!isCollapsed" class="text-[10px] uppercase font-mono tracking-widest text-white/45 px-3.5 pt-4 pb-1 font-semibold">
          業務與財務 · FINANCE
        </div>
        <div v-else class="h-px bg-white/10 my-2"></div>

        <NuxtLink to="/products" :class="getNavLinkClass('/products')" @click="closeSidebarOnMobile">
          <div :class="getIconWrapperClass('/products')">
            <Icon name="mdi:package-variant-closed" class="text-[19px]" />
          </div>
          <span v-if="!isCollapsed" class="text-sm font-medium">產品與進銷存</span>
        </NuxtLink>
        
        <NuxtLink to="/courses" :class="getNavLinkClass('/courses')" @click="closeSidebarOnMobile">
          <div :class="getIconWrapperClass('/courses')">
            <Icon name="mdi:spa-outline" class="text-[19px]" />
          </div>
          <span v-if="!isCollapsed" class="text-sm font-medium">課程方案管理</span>
        </NuxtLink>

        <NuxtLink to="/finance" :class="getNavLinkClass('/finance')" @click="closeSidebarOnMobile">
          <div :class="getIconWrapperClass('/finance')">
            <Icon name="mdi:cash-register" class="text-[19px]" />
          </div>
          <span v-if="!isCollapsed" class="text-sm font-medium">財務收支明細</span>
        </NuxtLink>

        <NuxtLink to="/analytics" :class="getNavLinkClass('/analytics')" @click="closeSidebarOnMobile">
          <div :class="getIconWrapperClass('/analytics')">
            <Icon name="mdi:chart-timeline-variant-shimmer" class="text-[19px]" />
          </div>
          <span v-if="!isCollapsed" class="text-sm font-medium">數據洞察報告</span>
        </NuxtLink>

        <!-- 分組 3：系統設定 -->
        <div v-if="!isCollapsed" class="text-[10px] uppercase font-mono tracking-widest text-white/45 px-3.5 pt-4 pb-1 font-semibold">
          系統與團隊 · SETTINGS
        </div>
        <div v-else class="h-px bg-white/10 my-2"></div>

        <NuxtLink to="/settings" :class="getNavLinkClass('/settings')" @click="closeSidebarOnMobile">
          <div :class="getIconWrapperClass('/settings')">
            <Icon name="mdi:account-group-outline" class="text-[19px]" />
          </div>
          <span v-if="!isCollapsed" class="text-sm font-medium">美容師團隊管理</span>
        </NuxtLink>
      </nav>

      <!-- 側邊欄底部：系統版本與在線狀態卡片 -->
      <div v-if="!isCollapsed" class="p-3.5 bg-black/20 border-t border-white/10 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse"></span>
          <div class="flex flex-col text-left">
            <span class="text-xs font-semibold text-emerald-200">Hervive Cloud D1</span>
            <span class="text-[10px] font-mono text-white/40">系統已連線 v2.4</span>
          </div>
        </div>
        <div class="text-[10px] font-mono text-white/30 bg-white/5 px-2 py-0.5 rounded border border-white/10">
          PRO
        </div>
      </div>
    </aside>

    <!-- 主內容區 -->
    <div class="flex-1 flex flex-col overflow-hidden bg-[#FAF4EE] min-w-0 relative z-10">
      <!-- 頂部列 (Frosted Glass 質感浮動頂欄) -->
      <header class="bg-white/90 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 md:px-8 h-[64px] md:h-[72px] shrink-0 box-border border-b border-[#154337]/10 shadow-xs">
        <div class="flex items-center gap-3 text-gray-500 text-sm">
          <!-- 手機版：漢堡選單按鈕 -->
          <button 
            class="md:hidden flex items-center justify-center p-2 text-gray-700 hover:bg-[#FAF4EE] rounded-xl transition cursor-pointer"
            @click="isCollapsed = !isCollapsed"
          >
            <Icon name="mdi:menu" size="22" />
          </button>

          <!-- 動態麵包屑導航與頁面徽章 -->
          <div class="flex items-center gap-2 text-xs sm:text-sm">
            <span class="text-gray-400 hidden sm:inline-flex items-center gap-1 font-medium">
              <Icon name="mdi:spa" class="text-[#154337]" />
              Hervive 後台
            </span>
            <Icon name="mdi:chevron-right" class="text-gray-300 hidden sm:inline" />
            <span class="inline-flex items-center gap-1.5 font-bold text-[#154337] bg-[#154337]/5 px-3 py-1 rounded-full border border-[#154337]/10">
              <Icon name="mdi:circle" class="text-[8px] text-emerald-500" />
              {{ currentPageTitle }}
            </span>
          </div>
        </div>
        
        <div class="flex items-center gap-3 sm:gap-4">
          <!-- 全域搜尋列 (含 ⌘K 快捷鍵視覺標籤) -->
          <div class="relative flex items-center hidden md:flex">
            <Icon name="mdi:magnify" class="absolute left-3.5 text-gray-400 text-base" />
            <input 
              type="text" 
              placeholder="搜尋預約、會員或產品..." 
              class="bg-[#FAF4EE]/70 border border-[#154337]/10 py-1.5 pr-12 pl-10 rounded-full text-gray-800 outline-none transition-all duration-200 focus:border-[#154337] focus:ring-2 focus:ring-[#154337]/10 focus:bg-white text-xs sm:text-sm w-[220px] lg:w-[280px]" 
            />
            <div class="absolute right-3 px-1.5 py-0.5 text-[10px] font-mono bg-white text-gray-400 rounded-md border border-gray-200 pointer-events-none shadow-2xs">
              ⌘K
            </div>
          </div>

          <!-- 通知按鈕 -->
          <button 
            class="relative p-2.5 rounded-full text-gray-500 hover:text-[#154337] hover:bg-[#FAF4EE] transition cursor-pointer active:scale-95"
            title="通知中心"
          >
            <Icon name="mdi:bell-outline" class="text-xl" />
            <span class="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white animate-pulse"></span>
          </button>

          <!-- 管理員 Avatar -->
          <div class="flex items-center gap-2.5 py-1 pr-3 pl-1.5 bg-[#FAF4EE] border border-[#154337]/10 rounded-full cursor-pointer hover:border-[#154337]/30 transition group">
            <div class="w-7 h-7 bg-[#154337] text-white rounded-full flex items-center justify-center text-xs font-bold shadow-xs group-hover:scale-105 transition">
              H
            </div>
            <div class="hidden sm:flex flex-col text-left">
              <span class="text-xs font-semibold text-gray-800 leading-tight">系統管理員</span>
              <span class="text-[10px] text-emerald-700 font-mono">Store Admin</span>
            </div>
          </div>
        </div>
      </header>

      <!-- 主要內容區 -->
      <main class="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
        <NuxtPage />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const isCollapsed = ref(false)

const routeTitleMap = {
  '/': '智能儀表盤',
  '/calendar': '休假與行事曆一覽',
  '/Appointment': '預約管理列表',
  '/products': '產品與進銷存管理',
  '/courses': '課程方案與會員包堂',
  '/finance': '財務收支與營收認列',
  '/analytics': '數據洞察商業報告',
  '/settings': '系統與美容師團隊管理'
}

const currentPageTitle = computed(() => {
  return routeTitleMap[route.path] || '管理控制台'
})

onMounted(() => {
  if (window.innerWidth < 768) {
    isCollapsed.value = true
  }
})

const closeSidebarOnMobile = () => {
  if (window.innerWidth < 768) {
    isCollapsed.value = true
  }
}

const getNavLinkClass = (path) => {
  const isActive = route.path === path
  const baseClass = 'flex items-center transition-all duration-200 whitespace-nowrap overflow-hidden relative group'
  const paddingClass = isCollapsed.value ? 'justify-center px-1 py-2 gap-0' : 'px-3 py-2 gap-3'
  
  const activeClass = isActive
    ? 'text-white bg-white/15 font-semibold ring-1 ring-white/20 shadow-xs before:content-[\'\'] before:absolute before:left-0 before:top-2.5 before:bottom-2.5 before:w-1 before:bg-emerald-400 before:rounded-r-full'
    : 'text-white/70 hover:text-white hover:bg-white/10'

  return `${baseClass} ${paddingClass} ${activeClass}`
}

const getIconWrapperClass = (path) => {
  const isActive = route.path === path
  const sizeClass = isCollapsed.value ? 'w-7 h-7 rounded-lg text-sm' : 'w-8 h-8 rounded-xl text-[19px]'
  return isActive
    ? `${sizeClass} bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center justify-center shrink-0 shadow-inner scale-105 transition duration-200`
    : `${sizeClass} bg-transparent text-white/70 flex items-center justify-center shrink-0 group-hover:text-white group-hover:scale-105 transition duration-200`
}
</script>

<style>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>