<script setup lang="ts">
import { computed } from 'vue' // 🌟 記得引入 computed
import { VueDatePicker } from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'
import { zhTW } from 'date-fns/locale'

const props = defineProps<{
  minDate?: Date | null
  disabledDates?: Date[]
  disabledWeekDays?: number[]
  placeholder?: string
}>()

const selectedDate = defineModel<Date | null>()

const isDateDisabled = (date: Date) => {
  if (props.disabledWeekDays?.length) {
    if (props.disabledWeekDays.includes(date.getDay())) {
      return true
    }
  }

  if (props.disabledDates?.length) {
    return props.disabledDates.some(d => 
      d.getFullYear() === date.getFullYear() &&
      d.getMonth() === date.getMonth() &&
      d.getDate() === date.getDate()
    )
  }

  return false
}

// 🌟 暴力破解：我們自己監聽選中的日期，並強制轉為 YYYY-MM-DD
const displayDate = computed(() => {
  if (!selectedDate.value) return '';
  const d = new Date(selectedDate.value);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
})
</script>

<template>
  <VueDatePicker
    v-model="selectedDate"
    v-bind="$attrs"
    :locale="zhTW"
    :min-date="minDate"
    :disabled-dates="isDateDisabled"
    :enable-time-picker="false"
    :auto-apply="true"
    :teleport="false"
  >
    <!-- 🌟 重點：不再使用套件插槽給的 value，改綁定我們自己寫的 displayDate -->
    <template #dp-input="{ onClick }">
      <input
        class="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-[#154337] cursor-pointer bg-white relative z-10"
        :value="displayDate"
        @click="onClick"
        :placeholder="placeholder || '請點擊選擇日期'"
        readonly
      />
    </template>
  </VueDatePicker>
</template>

<style>
.dp__theme_light {
  --dp-primary-color: #154337;
  --dp-primary-text-color: #ffffff;
}
.dp__menu {
  z-index: 9999 !important;
}
</style>