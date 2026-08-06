<script setup lang="ts">
import { computed } from 'vue'
import { VueDatePicker } from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'
import { zhTW } from 'date-fns/locale'

const props = defineProps<{
  minDate?: Date | string | null
  disabledDates?: (Date | string)[]
  disabledWeekDays?: (number | string)[]
  placeholder?: string
  inputClass?: string
}>()

// 支援 Date 物件、日期字串或 null 之 v-model
const selectedDate = defineModel<Date | string | null>()

// 轉化給 VueDatePicker 使用之標準 Date | null
const internalDate = computed<Date | null>({
  get: () => {
    if (!selectedDate.value) return null
    if (selectedDate.value instanceof Date) {
      return isNaN(selectedDate.value.getTime()) ? null : selectedDate.value
    }
    const d = new Date(selectedDate.value)
    return isNaN(d.getTime()) ? null : d
  },
  set: (val: Date | null) => {
    selectedDate.value = val
  }
})

// 解析 minDate
const computedMinDate = computed<Date | undefined>(() => {
  if (!props.minDate) return undefined
  if (props.minDate instanceof Date) {
    return isNaN(props.minDate.getTime()) ? undefined : props.minDate
  }
  const d = new Date(props.minDate)
  return isNaN(d.getTime()) ? undefined : d
})

// 嚴謹日點停用判斷 (支援星期幾與特定日期)
const isDateDisabled = (date: Date) => {
  const d = date instanceof Date ? date : new Date(date)
  if (isNaN(d.getTime())) return false

  const dayOfWeek = d.getDay()

  if (props.disabledWeekDays?.length) {
    const weekDaysNum = props.disabledWeekDays.map(n => Number(n))
    if (weekDaysNum.includes(dayOfWeek)) {
      return true
    }
  }

  if (props.disabledDates?.length) {
    const year = d.getFullYear()
    const month = d.getMonth()
    const day = d.getDate()

    return props.disabledDates.some(disabledItem => {
      const dd = disabledItem instanceof Date ? disabledItem : new Date(disabledItem)
      if (isNaN(dd.getTime())) return false
      return dd.getFullYear() === year && dd.getMonth() === month && dd.getDate() === day
    })
  }

  return false
}

// 格式化顯示選中日期 (YYYY-MM-DD)
const displayDate = computed(() => {
  if (!selectedDate.value) return ''
  const d = selectedDate.value instanceof Date ? selectedDate.value : new Date(selectedDate.value)
  if (isNaN(d.getTime())) return ''
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
})
</script>

<template>
  <VueDatePicker
    v-model="internalDate"
    v-bind="$attrs"
    :locale="zhTW"
    :min-date="computedMinDate"
    :disabled-dates="isDateDisabled"
    :enable-time-picker="false"
    :auto-apply="true"
    :teleport="true"
  >
    <template #dp-input="{ onClick }">
      <div class="relative w-full">
        <input
          :class="[
            'w-full border border-gray-200 rounded-xl p-3 pr-10 text-sm focus:ring-2 focus:ring-[#154337] focus:border-[#154337] cursor-pointer bg-[#FAF4EE]/40 focus:bg-white transition relative z-10 font-sans text-gray-800',
            inputClass || ''
          ]"
          :value="displayDate"
          @click="onClick"
          :placeholder="placeholder || '請點擊選擇日期'"
          readonly
        />
        <Icon 
          name="mdi:calendar-month-outline" 
          class="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg pointer-events-none z-20" 
        />
      </div>
    </template>
  </VueDatePicker>
</template>

<style>
.dp__theme_light {
  --dp-primary-color: #154337;
  --dp-primary-text-color: #ffffff;
}
.dp__menu {
  z-index: 99999 !important;
  border-radius: 1rem !important;
  border: 1px solid rgba(197, 168, 128, 0.4) !important;
  box-shadow: 0 10px 30px rgba(21, 67, 55, 0.12) !important;
  font-family: inherit !important;
}
.dp__outer_menu_wrap {
  z-index: 99999 !important;
}
</style>