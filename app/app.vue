<template>
  <div class="min-h-screen w-full bg-[#FAF4EE] font-sans text-gray-800">
    <ClientOnly>
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
      <template #fallback>
        <div class="min-h-screen w-full bg-[#FAF4EE] flex items-center justify-center">
          <div class="w-8 h-8 border-3 border-[#154337]/20 border-t-[#154337] rounded-full animate-spin"></div>
        </div>
      </template>
    </ClientOnly>
  </div>
</template>