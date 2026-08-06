<template>
  <div class="min-h-screen w-full bg-[#FAF4EE] font-sans text-gray-800 antialiased selection:bg-[#154337] selection:text-white">
    <ClientOnly>
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
      <template #fallback>
        <div class="min-h-screen w-full bg-[#FAF4EE] flex flex-col items-center justify-center gap-3">
          <div class="w-9 h-9 border-3 border-[#154337]/20 border-t-[#154337] rounded-full animate-spin"></div>
          <span class="text-xs font-bold text-[#154337] tracking-wider">Hervive Cloud 系統載入中...</span>
        </div>
      </template>
    </ClientOnly>
  </div>
</template>

<style>
/* 手機端與響應式系統全域 Touch 與動畫優化 */
html, body {
  background-color: #FAF4EE;
  margin: 0;
  padding: 0;
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;
  overscroll-behavior-y: none;
}

/* 消除 Safari/Mobile Chrome 預設按鈕外框 */
button, input, select, textarea {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
}

/* 柔和微漸變淡入動畫 */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>