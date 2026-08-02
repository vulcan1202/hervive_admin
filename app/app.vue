<template>
  <div class="flex h-screen w-full bg-[#FAF4EE] font-sans text-gray-800 overflow-hidden box-border relative">
    
    <!-- 手機版：側邊欄展開時的深色遮罩 -->
    <div 
      v-if="!isCollapsed" 
      class="fixed inset-0 bg-black/40 z-20 md:hidden transition-opacity"
      @click="isCollapsed = true"
    ></div>

    <!-- 側邊欄 -->
    <aside 
      :class="[
        'bg-[#faf4ee] flex flex-col transition-all duration-300 shadow-[4px_0_15px_rgba(0,0,0,0.05)] z-30 shrink-0 h-full',
        'absolute md:relative', // 手機版採絕對定位覆蓋，電腦版維持排版
        isCollapsed ? '-translate-x-full md:translate-x-0 md:w-[72px]' : 'translate-x-0 w-[240px] md:w-[200px]' 
      ]"
    >
      <!-- 側邊欄頂部：手機版高度 60px，電腦版 72px -->
      <div 
        :class="[
          'h-[60px] md:h-[72px] flex items-center justify-center gap-3 border-b border-black/10 bg-[#faf4ee] relative box-border',
          isCollapsed ? 'px-2' : 'px-4'
        ]"
      >
        <!-- 品牌 Logo：手機版只要展開就顯示，電腦版依據 isCollapsed 顯示 -->
        <img
          v-if="!isCollapsed"
          src="/hervive.png"
          alt="Hervive 品牌標誌"
          class="h-7 md:h-8 w-auto max-w-[120px] object-contain"
        />
        <div 
          v-else 
          class="hidden md:flex w-10 h-10 min-w-[40px] bg-[#154337]/5 rounded-lg items-center justify-center backdrop-blur-sm border border-[#154337]/10"
        >
          <Icon name="mdi:spa" class="text-[22px] text-[#154337]" />
        </div>
        
        <!-- 電腦版：縮放切換按鈕 (手機版已改由 Topbar 控制) -->
        <button 
          class="absolute -right-[15px] top-1/2 -translate-y-1/2 w-[30px] h-[30px] bg-white border border-gray-200 rounded-full hidden md:flex items-center justify-center cursor-pointer text-[#154337] shadow-sm transition-all hover:scale-110 hover:bg-gray-50 z-10" 
          @click="isCollapsed = !isCollapsed"
        >
          <Icon :name="isCollapsed ? 'mdi:chevron-right' : 'mdi:chevron-left'" />
        </button>
      </div>
      
      <!-- 導航區 -->
      <nav class="p-3 md:p-4 px-2 flex flex-col gap-1 bg-[#154337] flex-1 overflow-y-auto">
        <NuxtLink to="/" :class="getNavLinkClass('/')" @click="closeSidebarOnMobile">
          <Icon name="mdi:view-dashboard-outline" class="text-[20px] min-w-[20px]" />
          <span v-if="!isCollapsed" class="text-sm font-medium">智能儀表盤</span>
        </NuxtLink>
        <NuxtLink to="/calendar" :class="getNavLinkClass('/calendar')" @click="closeSidebarOnMobile">
          <Icon name="mdi:clipboard-flow-outline" class="text-[20px] min-w-[20px]" />
          <span v-if="!isCollapsed" class="text-sm font-medium">休假與行事曆一覽</span>
        </NuxtLink>
        <NuxtLink to="/Appointment" :class="getNavLinkClass('/Appointment')" @click="closeSidebarOnMobile">
          <Icon name="mdi:clipboard-flow-outline" class="text-[20px] min-w-[20px]" />
          <span v-if="!isCollapsed" class="text-sm font-medium">預約管理</span>
        </NuxtLink>
        <NuxtLink to="/products" :class="getNavLinkClass('/products')" @click="closeSidebarOnMobile">
          <Icon name="mdi:flask-outline" class="text-[20px] min-w-[20px]" />
          <span v-if="!isCollapsed" class="text-sm font-medium">產品管理</span>
        </NuxtLink>
        <NuxtLink to="/courses" :class="getNavLinkClass('/courses')" @click="closeSidebarOnMobile">
          <Icon name="mdi:account-group-outline" class="text-[20px] min-w-[20px]" />
          <span v-if="!isCollapsed" class="text-sm font-medium">課程設定</span>
        </NuxtLink>
        <NuxtLink to="/finance" :class="getNavLinkClass('/finance')" @click="closeSidebarOnMobile">
          <Icon name="mdi:account-cash" class="text-[20px] min-w-[20px]" />
          <span v-if="!isCollapsed" class="text-sm font-medium">財務管理</span>
        </NuxtLink>
        <NuxtLink to="/analytics" :class="getNavLinkClass('/analytics')" @click="closeSidebarOnMobile">
          <Icon name="mdi:chart-timeline-variant-shimmer" class="text-[20px] min-w-[20px]" />
          <span v-if="!isCollapsed" class="text-sm font-medium">數據洞察</span>
        </NuxtLink>
        
        <div v-if="!isCollapsed" class="h-px bg-white/10 my-2 mx-1"></div>
        
        <NuxtLink to="/settings" :class="getNavLinkClass('/settings')" @click="closeSidebarOnMobile">
          <Icon name="mdi:cog-outline" class="text-[20px] min-w-[20px]" />
          <span v-if="!isCollapsed" class="text-sm font-medium">系統設定</span>
        </NuxtLink>
      </nav>
    </aside>

    <!-- 主內容區 -->
    <div class="flex-1 flex flex-col overflow-hidden bg-[#FAF4EE] min-w-0 relative z-10">
      <!-- 頂部欄：手機版高度 60px 節省空間 -->
      <header class="bg-white flex items-center justify-between px-3 sm:px-6 md:px-8 h-[60px] md:h-[72px] shrink-0 box-border border-b border-black/10">
        <div class="flex items-center gap-2 sm:gap-3 text-gray-500 text-sm">
          
          <!-- 手機版：漢堡選單按鈕 -->
          <button 
            class="md:hidden flex items-center justify-center p-1.5 -ml-1 text-gray-700 hover:bg-gray-100 rounded-lg transition"
            @click="isCollapsed = !isCollapsed"
          >
            <Icon name="mdi:menu" size="24" />
          </button>

          <!-- 麵包屑導航：極小螢幕隱藏 -->
          <div class="hidden sm:flex items-center gap-2">
            <Icon name="mdi:chevron-right" />
            <span>首頁</span>
            <Icon name="mdi:chevron-right" />
            <span class="font-bold text-gray-700">智能儀表盤</span>
          </div>
        </div>
        
        <div class="flex items-center gap-3 sm:gap-5">
          <div class="relative flex items-center hidden sm:flex">
            <Icon name="mdi:magnify" class="absolute left-3 text-gray-400" />
            <input 
              type="text" 
              placeholder="搜尋療程、客戶..." 
              class="bg-gray-100 border border-transparent py-1.5 pr-4 pl-9 rounded-md text-gray-800 outline-none transition-all duration-300 focus:border-purple-500 focus:ring-[3px] focus:ring-purple-500/10 focus:bg-white text-sm" 
            />
          </div>
          
          <button class="relative bg-transparent border-none text-gray-500 cursor-pointer text-[22px] transition-colors hover:text-[#154337]">
            <Icon name="mdi:bell-outline" />
            <span class="absolute top-0.5 right-0.5 w-2 h-2 bg-pink-500 rounded-full shadow-[0_0_8px_#ec4899]"></span>
          </button>
          
          <div class="flex items-center gap-2 py-1 pr-2 sm:pr-3 pl-1 sm:pl-1.5 bg-gray-100 rounded-full cursor-pointer transition-colors hover:bg-gray-200">
            <div class="w-6 h-6 sm:w-7 sm:h-7 bg-[#154337] rounded-full flex items-center justify-center text-xs font-bold text-white">A</div>
            <span class="text-xs sm:text-sm font-medium hidden sm:block">Ava</span>
            <Icon name="mdi:chevron-down" class="text-gray-500 hidden sm:block" />
          </div>
        </div>
      </header>

      <main class="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
        <NuxtPage />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const route = useRoute()
const isCollapsed = ref(false)

// 生命週期：如果是手機螢幕載入，預設將側邊欄收起
onMounted(() => {
  if (window.innerWidth < 768) {
    isCollapsed.value = true
  }
})

// 當手機版點擊導航連結時，自動關閉側邊欄
const closeSidebarOnMobile = () => {
  if (window.innerWidth < 768) {
    isCollapsed.value = true
  }
}

const getNavLinkClass = (path) => {
  const isActive = route.path === path
  const baseClass = 'flex items-center gap-3 py-2.5 rounded-lg transition-all duration-200 whitespace-nowrap overflow-hidden relative'
  const paddingClass = isCollapsed.value ? 'justify-center px-2' : 'px-3'
  
  const activeClass = isActive
    ? 'text-white bg-gradient-to-r from-white/15 to-white/5 before:content-[\'\'] before:absolute before:left-0 before:top-1/4 before:bottom-1/4 before:w-[3px] before:bg-white before:rounded-r-sm before:shadow-[0_0_8px_rgba(255,255,255,0.4)]'
    : 'text-white/60 hover:text-white hover:bg-white/10'

  return `${baseClass} ${paddingClass} ${activeClass}`
}
</script>