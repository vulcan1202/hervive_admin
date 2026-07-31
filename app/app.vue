<template>
  <div class="flex h-screen w-full bg-[#FAF4EE] font-sans text-gray-800 overflow-hidden box-border">
    <!-- 側邊欄 -->
    <aside 
      :class="[
        'bg-[#faf4ee] flex flex-col transition-all duration-300 relative shadow-[4px_0_15px_rgba(0,0,0,0.05)] z-20 shrink-0',
        isCollapsed ? 'w-[50px]' : 'w-[200px]' 
      ]"
    >
      <!-- 側邊欄頂部：精準高度 72px，box-border 避免 border 增加高度 -->
      <div 
        :class="[
          'h-[72px] flex items-center justify-center gap-3 border-b border-black/10 bg-[#faf4ee] relative box-border',
          isCollapsed ? 'px-2' : 'px-4'
        ]"
      >
        <img
          v-if="!isCollapsed"
          src="/hervive.png"
          alt="Hervive 品牌標誌"
          class="h-8 w-auto max-w-[120px] object-contain"
        />
        <div 
          v-else 
          class="w-10 h-10 min-w-[40px] bg-[#154337]/5 rounded-lg flex items-center justify-center backdrop-blur-sm border border-[#154337]/10"
        >
          <Icon name="mdi:spa" class="text-[22px] text-[#154337]" />
        </div>
        
        <button 
          class="absolute -right-[15px] top-1/2 -translate-y-1/2 w-[20px] h-[30px] bg-white border border-gray-200 rounded-full flex items-center justify-center cursor-pointer text-[#154337] shadow-sm transition-all hover:scale-110 hover:bg-gray-50 z-10" 
          @click="isCollapsed = !isCollapsed"
        >
          <Icon :name="isCollapsed ? 'mdi:chevron-right' : 'mdi:chevron-left'" />
        </button>
      </div>
      
      <!-- 導航區 -->
      <nav class="p-4 px-2 flex flex-col gap-1 bg-[#154337] flex-1">
        <NuxtLink to="/" :class="getNavLinkClass('/')">
          <Icon name="mdi:view-dashboard-outline" class="text-[20px] min-w-[20px]" />
          <span v-if="!isCollapsed" class="text-sm font-medium">智能儀表盤</span>
        </NuxtLink>
        <NuxtLink to="/admin" :class="getNavLinkClass('/admin')">
          <Icon name="mdi:clipboard-flow-outline" class="text-[20px] min-w-[20px]" />
          <span v-if="!isCollapsed" class="text-sm font-medium">預約與訂單</span>
        </NuxtLink>
        <NuxtLink to="/products" :class="getNavLinkClass('/products')">
          <Icon name="mdi:flask-outline" class="text-[20px] min-w-[20px]" />
          <span v-if="!isCollapsed" class="text-sm font-medium">療程與產品</span>
        </NuxtLink>
        <NuxtLink to="/clients" :class="getNavLinkClass('/clients')">
          <Icon name="mdi:account-group-outline" class="text-[20px] min-w-[20px]" />
          <span v-if="!isCollapsed" class="text-sm font-medium">客戶畫像</span>
        </NuxtLink>
        <NuxtLink to="/analytics" :class="getNavLinkClass('/analytics')">
          <Icon name="mdi:chart-timeline-variant-shimmer" class="text-[20px] min-w-[20px]" />
          <span v-if="!isCollapsed" class="text-sm font-medium">數據洞察</span>
        </NuxtLink>
        
        <div v-if="!isCollapsed" class="h-px bg-white/10 my-2 mx-1"></div>
        
        <NuxtLink to="/settings" :class="getNavLinkClass('/settings')">
          <Icon name="mdi:cog-outline" class="text-[20px] min-w-[20px]" />
          <span v-if="!isCollapsed" class="text-sm font-medium">系統設定</span>
        </NuxtLink>
      </nav>
    </aside>

    <!-- 主內容區 -->
    <div class="flex-1 flex flex-col overflow-y-auto bg-[#FAF4EE] min-w-0">
      <!-- 頂部欄：精準高度 72px，box-border 確保高度計算一致 -->
      <header class="bg-white sticky top-0 z-10 flex items-center justify-between px-8 h-[72px] shrink-0 box-border border-b border-black/10">
        <div class="flex items-center gap-2 text-gray-500 text-sm">
          <Icon name="mdi:chevron-right" />
          <span>首頁</span>
          <Icon name="mdi:chevron-right" />
          <span>智能儀表盤</span>
        </div>
        
        <div class="flex items-center gap-5">
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
          
          <div class="flex items-center gap-2 py-1 pr-3 pl-1.5 bg-gray-100 rounded-full cursor-pointer transition-colors hover:bg-gray-200">
            <div class="w-7 h-7 bg-[#154337] rounded-full flex items-center justify-center text-xs font-bold text-white">A</div>
            <span class="text-sm font-medium">Ava</span>
            <Icon name="mdi:chevron-down" class="text-gray-500" />
          </div>
        </div>
      </header>

      <main class="p-6">
        <NuxtPage />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const route = useRoute()
const isCollapsed = ref(false)

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