<script setup lang="ts">
import { ref, onMounted, computed, reactive, watch } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const config = useRuntimeConfig()
const backendUrl = config.public.backendUrl

const appointments = ref<any[]>([])
const holidays = ref<any[]>([])
const beauticians = ref<any[]>([])
const loading = ref(true)
const errorMessage = ref('')

const showList = ref(false)
const showBeauticianModal = ref(false)
const editingNotesId = ref<number | null>(null)
const expandedClientId = ref<number | null>(null)

// 🌟 手機端 Modal 切換頁籤 (預約 / 休假)
const mobileModalTab = ref<'appts' | 'holidays'>('appts')

// 🌟 搜尋與篩選條件
const searchQuery = ref('')         // 顧客姓名或電話
const searchCodeSuffix = ref('')    // 預約單號後六碼

// 🌟 日期選擇器專用 Date 物件與字串同步
const startDateObj = ref<Date | null>(null)
const endDateObj = ref<Date | null>(null)
const startDateFilter = ref('')     // 篩選開始日期 YYYY-MM-DD
const endDateFilter = ref('')       // 篩選結束日期 YYYY-MM-DD

// 將 Date 物件轉為 YYYY-MM-DD 字串 (考慮當地時區)
const formatDateToString = (d: Date | null) => {
  if (!d) return ''
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

watch(startDateObj, (newVal) => {
  startDateFilter.value = formatDateToString(newVal)
})

watch(endDateObj, (newVal) => {
  endDateFilter.value = formatDateToString(newVal)
})

// 美容師管理表單狀態
const newBeauticianName = ref('')
const editingBeauticianId = ref<number | null>(null)
const editingBeauticianName = ref('')

// 取得台灣時間的 YYYY-MM-DD
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
};

const refreshAllData = async () => {
  await Promise.all([
    fetchAllAppointments(),
    fetchHolidays(),
    fetchBeauticians()
  ])
}

onMounted(() => {
  const isAdmin = localStorage.getItem('hervive_admin')
  if (!isAdmin) {
    const password = prompt('請輸入商家管理密碼：')
    if (password === 'hervive520') {
      localStorage.setItem('hervive_admin', 'true')
      refreshAllData()
    } else {
      alert('密碼錯誤！')
      router.push('/')
    }
  } else {
    refreshAllData()
  }
})

const fetchAllAppointments = async () => {
  loading.value = true
  try {
    const res = await fetch(`${backendUrl}/api/appointments`)
    if (!res.ok) throw new Error('讀取預約清單失敗')
    const data = await res.json()
    appointments.value = data.map((item: any) => ({
      ...item,
      editNotes: item.notes || '',
      editUserNotes: item.user_notes || ''
    }))
  } catch (err: any) {
    errorMessage.value = err.message
  } finally {
    loading.value = false
  }
}

const fetchHolidays = async () => {
  try {
    const res = await fetch(`${backendUrl}/api/holidays`)
    if (res.ok) holidays.value = await res.json()
  } catch (err) {
    console.error('讀取休假設定失敗', err)
  }
}

const fetchBeauticians = async () => {
  try {
    const res = await fetch(`${backendUrl}/api/beauticians`)
    if (res.ok) beauticians.value = await res.json()
  } catch (err) {
    console.error('讀取美容師清單失敗', err)
  }
}

// 指派/修改預約的美容師
const updateAppointmentBeautician = async (apptId: number, beauticianId: any) => {
  try {
    const res = await fetch(`${backendUrl}/api/appointments`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        id: apptId, 
        beautician_id: beauticianId ? Number(beauticianId) : null 
      })
    })
    if (!res.ok) throw new Error('指派美容師失敗')
    fetchAllAppointments()
  } catch (err: any) {
    alert(err.message || '操作失敗')
  }
}

const addBeautician = async () => {
  if (!newBeauticianName.value.trim()) return alert('請輸入美容師姓名！')
  try {
    const res = await fetch(`${backendUrl}/api/beauticians`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newBeauticianName.value.trim() })
    })
    if (!res.ok) throw new Error('新增美容師失敗')
    newBeauticianName.value = ''
    fetchBeauticians()
  } catch (err: any) {
    alert(err.message || '操作失敗')
  }
}

const startEditBeautician = (b: any) => {
  editingBeauticianId.value = b.id
  editingBeauticianName.value = b.name
}

const saveEditBeautician = async (id: number) => {
  if (!editingBeauticianName.value.trim()) return alert('名稱不可為空！')
  try {
    const res = await fetch(`${backendUrl}/api/beauticians`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: editingBeauticianName.value.trim() })
    })
    if (!res.ok) throw new Error('修改失敗')
    editingBeauticianId.value = null
    fetchBeauticians()
  } catch (err: any) {
    alert(err.message || '操作失敗')
  }
}

const deleteBeautician = async (id: number, name: string) => {
  if (!confirm(`確定要刪除美容師「${name}」嗎？`)) return
  try {
    const res = await fetch(`${backendUrl}/api/beauticians?id=${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('刪除失敗')
    fetchBeauticians()
  } catch (err: any) {
    alert(err.message || '操作失敗')
  }
}

const getClientHistory = (userId: number) => {
  return appointments.value.filter(a => a.user_id === userId && a.status === 'complete')
}

const saveAppointmentNotes = async (appt: any) => {
  try {
    const res = await fetch(`${backendUrl}/api/appointments`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: appt.id, notes: appt.editNotes })
    })
    if (!res.ok) throw new Error('備註儲存失敗')
    alert('✅ 預約備註已成功儲存！')
    editingNotesId.value = null
    fetchAllAppointments()
  } catch (err: any) {
    alert(err.message || '操作失敗')
  }
}

const saveUserNotes = async (appt: any) => {
  try {
    const res = await fetch(`${backendUrl}/api/appointments`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: appt.id, user_id: appt.user_id, user_notes: appt.editUserNotes })
    })
    if (!res.ok) throw new Error('會員備註儲存失敗')
    alert('✅ 客戶會員備註已成功儲存！')
    fetchAllAppointments()
  } catch (err: any) {
    alert(err.message || '操作失敗')
  }
}

const currentDate = ref(new Date())
const weekdays = ['日', '一', '二', '三', '四', '五', '六']

const currentYearMonth = computed(() => {
  return `${currentDate.value.getFullYear()} 年 ${currentDate.value.getMonth() + 1} 月`
})

const changeMonth = (offset: number) => {
  currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + offset, 1)
}

// 行事曆網格資料
const calendarDays = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayTaiwanStr = getTaiwanDateString()

  const days = []
  for (let i = 0; i < firstDay; i++) {
    days.push(null)
  }
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    const dayOfWeek = new Date(year, month, i).getDay()
    
    const dayAppts = appointments.value.filter(a => a.date === dateStr && a.status !== 'complete')
    const isWeeklyOff = holidays.value.some(h => h.type === 'weekly' && h.day_of_week === dayOfWeek)
    const isFullDayOff = holidays.value.some(h => h.type === 'full_day' && h.date === dateStr)
    const hasTimeOff = holidays.value.some(h => h.type === 'time_range' && h.date === dateStr)

    days.push({
      date: i,
      fullDate: dateStr,
      dayOfWeek,
      dayAppts,
      isOff: isWeeklyOff || isFullDayOff,
      hasTimeOff: hasTimeOff && !isWeeklyOff && !isFullDayOff,
      isToday: dateStr === todayTaiwanStr
    })
  }
  return days
})

// 🌟 核心過濾邏輯：多維度組合搜尋（姓名/電話 + 單號後六碼 + 日期/日期範圍）
const filteredAppointments = computed(() => {
  return appointments.value.filter(a => {
    // 1. 搜尋姓名或電話
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.trim().toLowerCase()
      const matchName = a.client_name && a.client_name.toLowerCase().includes(q)
      const matchPhone = a.client_phone && a.client_phone.includes(q)
      if (!matchName && !matchPhone) return false
    }

    // 2. 搜尋預約單號後六碼 (固定 RV-)
    if (searchCodeSuffix.value.trim()) {
      const codeQ = searchCodeSuffix.value.trim().toUpperCase()
      const fullCode = (a.appointment_code || '').toUpperCase()
      if (!fullCode.endsWith(codeQ) && !fullCode.includes(codeQ)) {
        return false
      }
    }

    // 3. 日期與日期範圍過濾
    if (startDateFilter.value && endDateFilter.value) {
      if (a.date < startDateFilter.value || a.date > endDateFilter.value) return false
    } else if (startDateFilter.value) {
      if (a.date < startDateFilter.value) return false
    } else if (endDateFilter.value) {
      if (a.date > endDateFilter.value) return false
    }

    return true
  })
})

// 🌟 一鍵清空所有搜尋條件
const clearAllFilters = () => {
  searchQuery.value = ''
  searchCodeSuffix.value = ''
  startDateObj.value = null
  endDateObj.value = null
  startDateFilter.value = ''
  endDateFilter.value = ''
}

const hasActiveFilters = computed(() => {
  return !!(searchQuery.value || searchCodeSuffix.value || startDateFilter.value || endDateFilter.value)
})

const showModal = ref(false)
const selectedDay = ref<any>(null)

const timeOptions = computed(() => {
  const times = []
  for (let h = 8; h <= 23; h++) {
    times.push(`${String(h).padStart(2, '0')}:00`)
    times.push(`${String(h).padStart(2, '0')}:30`)
  }
  return times
})

const timeOffForm = reactive({ start: '12:00', end: '13:00' })

const openDayModal = (day: any) => {
  if (!day) return
  selectedDay.value = day
  expandedClientId.value = null
  mobileModalTab.value = 'appts' // 手機預設切到預約分頁
  showModal.value = true
}

const selectedDayAppointments = computed(() => {
  if (!selectedDay.value) return []
  return appointments.value.filter(a => a.date === selectedDay.value.fullDate)
})

const selectedDayTimeOffs = computed(() => {
  if (!selectedDay.value) return []
  return holidays.value.filter(h => h.type === 'time_range' && h.date === selectedDay.value.fullDate)
})

const selectedDayFullOff = computed(() => {
  if (!selectedDay.value) return null
  return holidays.value.find(h => h.type === 'full_day' && h.date === selectedDay.value.fullDate)
})

const isSelectedDayWeeklyOff = computed(() => {
  if (!selectedDay.value) return false
  return holidays.value.some(h => h.type === 'weekly' && h.day_of_week === selectedDay.value.dayOfWeek)
})

const toggleFullDayOff = async () => {
  if (isSelectedDayWeeklyOff.value) return alert('此日已是每週固定公休！')
  try {
    if (selectedDayFullOff.value) {
      await fetch(`${backendUrl}/api/holidays?id=${selectedDayFullOff.value.id}`, { method: 'DELETE' })
    } else {
      await fetch(`${backendUrl}/api/holidays`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'full_day', date: selectedDay.value.fullDate })
      })
    }
    await fetchHolidays()
  } catch (err) {
    alert('設定失敗')
  }
}

const addTimeOff = async () => {
  if (timeOffForm.start >= timeOffForm.end) return alert('結束時間必須大於開始時間！')
  try {
    await fetch(`${backendUrl}/api/holidays`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'time_range',
        date: selectedDay.value.fullDate,
        start_time: timeOffForm.start,
        end_time: timeOffForm.end
      })
    })
    await fetchHolidays()
  } catch (err) {
    alert('設定失敗')
  }
}

const deleteHoliday = async (id: number) => {
  try {
    await fetch(`${backendUrl}/api/holidays?id=${id}`, { method: 'DELETE' })
    await fetchHolidays()
  } catch (err) {
    alert('刪除失敗')
  }
}

const toggleWeeklyOff = async (dayIndex: number) => {
  const existing = holidays.value.find(h => h.type === 'weekly' && h.day_of_week === dayIndex)
  try {
    if (existing) {
      await fetch(`${backendUrl}/api/holidays?id=${existing.id}`, { method: 'DELETE' })
    } else {
      await fetch(`${backendUrl}/api/holidays`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'weekly', day_of_week: dayIndex })
      })
    }
    await fetchHolidays()
  } catch (err) {
    alert('設定失敗')
  }
}

const isWeeklyOff = (dayIndex: number) => {
  return holidays.value.some(h => h.type === 'weekly' && h.day_of_week === dayIndex)
}

const updateAppointmentStatus = async (id: number, newStatus: string) => {
  const actionName = newStatus === 'confirmed' ? '核准' : newStatus === 'complete' ? '標記為已完成' : '取消'
  if (!confirm(`確定要將此預約${actionName}嗎？`)) return
  try {
    await fetch(`${backendUrl}/api/appointments`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus })
    })
    fetchAllAppointments()
  } catch (err) {
    alert('操作失敗')
  }
}
</script>

<template>
  <div class="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
    
    <!-- 🌟 頂部抬頭區：手機端適應排版 -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6 md:mb-8">
      <div>
        <h2 class="text-2xl md:text-3xl font-bold text-[#154337] title-serif mb-1 md:mb-2">排程管理中心</h2>
        <p class="text-gray-500 text-xs md:text-sm">點擊日曆管理每日預約與休假，也可隨時展開預約總表</p>
      </div>

      <!-- 手機端按鈕改為 2x2 或全寬並排 -->
      <div class="grid grid-cols-2 sm:flex items-center gap-2 w-full md:w-auto">
        <button 
          @click="showBeauticianModal = true"
          class="px-3 py-2.5 md:px-4 md:py-2 rounded-xl text-xs md:text-sm font-bold bg-[#154337] text-white hover:bg-opacity-90 shadow-sm transition flex items-center justify-center gap-1.5"
        >
          <Icon name="mdi:account-group" size="18" />
          美容師 ({{ beauticians.length }})
        </button>

        <button 
          @click="refreshAllData"
          class="px-3 py-2.5 md:px-4 md:py-2 rounded-xl text-xs md:text-sm font-bold bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 shadow-sm transition flex items-center justify-center gap-1.5"
        >
          <Icon name="mdi:refresh" size="18" :class="{ 'animate-spin': loading }" />
          重新整理
        </button>

        <button 
          @click="showList = !showList"
          :class="['col-span-2 sm:col-span-1 px-4 py-2.5 md:px-6 md:py-2 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm', showList ? 'bg-[#154337] text-white' : 'text-gray-700 bg-white border border-gray-200 hover:bg-gray-50']"
        >
          <Icon :name="showList ? 'mdi:eye-off' : 'mdi:eye'" size="18" />
          {{ showList ? '隱藏預約總表' : '展開預約總表' }}
        </button>
      </div>
    </div>

    <!-- 模組 A：行事曆模式 -->
    <div class="space-y-4 md:space-y-6 mb-8">
      <!-- 固定公休設定區 -->
      <div class="bg-white rounded-2xl shadow-sm border border-[#C7CDCE] p-4 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h3 class="font-bold text-[#154337] text-sm md:text-base">每週固定公休設定</h3>
          <p class="text-[11px] md:text-xs text-gray-500 mt-0.5">勾選的日子將自動套用至行事曆全天公休</p>
        </div>
        <div class="flex flex-wrap gap-1.5 md:gap-2 w-full md:w-auto justify-between md:justify-start">
          <label v-for="(day, index) in weekdays" :key="index" class="cursor-pointer relative">
            <input type="checkbox" class="peer sr-only" :checked="isWeeklyOff(index)" @change="toggleWeeklyOff(index)" />
            <div class="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full text-xs md:text-sm font-bold border-2 transition-all peer-checked:bg-[#154337] peer-checked:border-[#154337] peer-checked:text-white border-gray-200 text-gray-400 hover:border-[#154337]">
              {{ day }}
            </div>
          </label>
        </div>
      </div>

      <!-- 日曆本體 -->
      <div class="bg-white rounded-2xl shadow-sm border border-[#C7CDCE] overflow-hidden">
        <!-- 切換月份 -->
        <div class="flex justify-between items-center bg-gray-50 px-4 md:px-6 py-3 md:py-4 border-b border-gray-200">
          <button @click="changeMonth(-1)" class="p-1.5 md:p-2 text-gray-500 hover:text-[#154337] hover:bg-white rounded-lg transition shadow-sm border border-transparent hover:border-gray-200">
            <Icon name="mdi:chevron-left" size="22" />
          </button>
          <h3 class="text-base md:text-xl font-bold text-gray-800 tracking-wider">{{ currentYearMonth }}</h3>
          <button @click="changeMonth(1)" class="p-1.5 md:p-2 text-gray-500 hover:text-[#154337] hover:bg-white rounded-lg transition shadow-sm border border-transparent hover:border-gray-200">
            <Icon name="mdi:chevron-right" size="22" />
          </button>
        </div>

        <!-- 星期標頭 -->
        <div class="grid grid-cols-7 border-b border-gray-200 text-center bg-white">
          <div v-for="day in weekdays" :key="day" class="py-2 md:py-3 text-[11px] md:text-xs font-bold text-gray-500 uppercase tracking-wider">
            {{ day }}
          </div>
        </div>

        <!-- 網格日期內容 -->
        <div class="grid grid-cols-7 bg-gray-100 gap-px p-px">
          <div 
            v-for="(day, index) in calendarDays" 
            :key="index"
            @click="openDayModal(day)"
            :class="[
              'min-h-[70px] sm:min-h-[90px] md:min-h-[130px] bg-white p-1 md:p-2 transition relative group overflow-hidden',
              !day ? 'bg-gray-50/40 cursor-default pointer-events-none' : 'cursor-pointer hover:bg-gray-50/80',
              day && day.isOff ? 'bg-red-50/30' : ''
            ]"
          >
            <template v-if="day">
              <div class="flex justify-between items-center mb-1">
                <div :class="['text-xs md:text-xs font-bold w-5 h-5 md:w-6 md:h-6 flex items-center justify-center rounded-full', day.isToday ? 'bg-[#154337] text-white shadow-sm' : 'text-gray-700']">
                  {{ day.date }}
                </div>
                <!-- 狀態標籤 (桌機) -->
                <span v-if="day.isOff" class="hidden sm:inline-block text-[9px] bg-red-100 text-red-600 px-1 py-0.5 rounded font-bold">全天公休</span>
                <span v-else-if="day.hasTimeOff" class="hidden sm:inline-block text-[9px] bg-orange-100 text-orange-700 px-1 py-0.5 rounded font-bold">時段休息</span>
              </div>

              <!-- 🌟 手機端精簡標籤 (少於 sm 尺寸時顯示點數/簡標) -->
              <div class="block sm:hidden mt-0.5">
                <div v-if="day.isOff" class="text-[9px] text-red-600 font-bold bg-red-100/80 px-1 py-0.5 rounded text-center">公休</div>
                <div v-else-if="day.hasTimeOff" class="text-[9px] text-orange-700 font-bold bg-orange-100/80 px-1 py-0.5 rounded text-center">休息</div>
                <div v-if="day.dayAppts && day.dayAppts.length > 0" class="mt-1 flex justify-center">
                  <span class="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full leading-none">
                    {{ day.dayAppts.length }} 筆
                  </span>
                </div>
              </div>

              <!-- 🌟 桌機端詳細卡片預覽 (sm 尺寸以上顯示) -->
              <div v-if="day.dayAppts && day.dayAppts.length > 0" class="hidden sm:block space-y-1 mt-1 max-h-[90px] overflow-y-auto">
                <div 
                  v-for="appt in day.dayAppts" 
                  :key="appt.id"
                  :class="[
                    'text-[10px] p-1.5 rounded border leading-tight flex flex-col gap-0.5 shadow-2xs',
                    appt.status === 'confirmed' ? 'bg-green-50 border-green-200 text-green-900' :
                    appt.status === 'pending' ? 'bg-amber-50 border-amber-200 text-amber-900' :
                    'bg-red-50 border-red-200 text-red-800 opacity-75'
                  ]"
                >
                  <div class="font-bold truncate flex justify-between items-center">
                    <span>{{ appt.start_time }} {{ appt.client_name }}</span>
                  </div>
                  <div class="text-[9px] opacity-80 truncate flex items-center justify-between">
                    <span>✂️ {{ appt.beautician_name || '未指派' }}</span>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- 模組 B：清單模式 (進階搜尋與日期範圍篩選) -->
    <div v-if="showList" class="bg-white rounded-2xl shadow-sm border border-[#C7CDCE] p-4 sm:p-6 md:p-8 animate-fade-in mb-8">
      <div class="flex flex-col gap-4 mb-6 border-b border-gray-100 pb-6">
        <div class="flex justify-between items-center">
          <h3 class="text-lg md:text-xl font-bold text-[#154337] flex items-center gap-2">
            <Icon name="mdi:format-list-bulleted" size="22" /> 預約總表清單
          </h3>
          <button 
            v-if="hasActiveFilters" 
            @click="clearAllFilters"
            class="text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 px-2.5 py-1.5 rounded-lg font-bold transition flex items-center gap-1"
          >
            <Icon name="mdi:filter-off" size="14" /> 清除篩選
          </button>
        </div>

        <!-- 🌟 進階搜尋工具列 -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-gray-50 p-3 md:p-4 rounded-xl border border-gray-200 items-end">
          
          <!-- 1. 顧客姓名/電話 -->
          <div>
            <label class="block text-xs font-bold text-gray-500 mb-1">顧客姓名 / 電話</label>
            <div class="relative">
              <Icon name="mdi:magnify" size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                v-model="searchQuery" 
                placeholder="搜尋姓名或電話..." 
                class="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-[#154337] bg-white h-[38px]"
              />
            </div>
          </div>

          <!-- 2. 固定 RV- 輸入後六碼 -->
          <div>
            <label class="block text-xs font-bold text-gray-500 mb-1">預約單號 (六碼)</label>
            <div class="flex items-center border border-gray-300 rounded-lg bg-white overflow-hidden focus-within:ring-2 focus-within:ring-[#154337] h-[38px]">
              <span class="bg-gray-100 text-gray-700 font-bold px-2.5 py-2 text-xs border-r border-gray-300 select-none">
                RV-
              </span>
              <input 
                type="text" 
                v-model="searchCodeSuffix" 
                placeholder="例如：A8X9K2" 
                maxlength="6"
                class="w-full px-2.5 py-2 text-xs focus:outline-none font-mono uppercase"
              />
            </div>
          </div>

          <!-- 3. 日期範圍 (開始) -->
          <div>
            <label class="block text-xs font-bold text-gray-500 mb-1">日期 (開始)</label>
            <ClientOnly>
              <MyCalendar 
                v-model="startDateObj" 
                placeholder="選擇開始日期" 
                class="compact-date-picker"
              />
            </ClientOnly>
          </div>

          <!-- 4. 日期範圍 (結束) -->
          <div>
            <label class="block text-xs font-bold text-gray-500 mb-1">日期 (結束)</label>
            <ClientOnly>
              <MyCalendar 
                v-model="endDateObj" 
                placeholder="選擇結束日期" 
                class="compact-date-picker"
              />
            </ClientOnly>
          </div>

        </div>
      </div>
      
      <div v-if="filteredAppointments.length === 0" class="text-center py-12 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-xs md:text-sm">
        {{ hasActiveFilters ? '找不到符合條件的預約紀錄。' : '目前沒有預約紀錄。' }}
      </div>
      
      <div v-else>
        <!-- 🌟 手機端專屬：卡片化列表 (手機上直覺操作，免左右橫滾) -->
        <div class="block md:hidden space-y-3">
          <div 
            v-for="appt in filteredAppointments" 
            :key="appt.id"
            class="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3"
          >
            <!-- 頂部：狀態 + 單號 + 日期時間 -->
            <div class="flex justify-between items-center border-b border-gray-100 pb-2">
              <div class="flex items-center gap-2">
                <span :class="[
                  'px-2 py-0.5 rounded-full text-[11px] font-bold',
                  appt.status === 'complete' ? 'bg-blue-100 text-blue-700' :
                  appt.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                  appt.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                  'bg-amber-100 text-amber-800'
                ]">
                  {{ appt.status === 'complete' ? '已完成' : appt.status === 'confirmed' ? '已確認' : appt.status === 'cancelled' ? '已取消' : '審核中' }}
                </span>
                <span class="font-mono text-xs font-bold text-gray-600">{{ appt.appointment_code || '-' }}</span>
              </div>
              <span class="text-xs font-bold text-[#154337]">{{ appt.date }} {{ appt.start_time }}</span>
            </div>

            <!-- 中間：客戶資訊與美容師 -->
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span class="text-gray-400 block text-[10px]">客戶姓名</span>
                <button 
                  @click="expandedClientId = expandedClientId === appt.id ? null : appt.id"
                  class="text-[#154337] font-bold underline decoration-dotted mt-0.5 flex items-center gap-1"
                >
                  {{ appt.client_name }}
                  <span v-if="appt.visit_count > 0" class="text-[9px] bg-blue-100 text-blue-700 px-1 rounded-full font-bold">
                    {{ appt.visit_count }}次
                  </span>
                </button>
              </div>

              <div>
                <span class="text-gray-400 block text-[10px]">美容師</span>
                <select 
                  :value="appt.beautician_id || ''"
                  @change="updateAppointmentBeautician(appt.id, ($event.target as HTMLSelectElement).value)"
                  class="mt-0.5 w-full border border-gray-300 rounded p-1 text-xs bg-white"
                >
                  <option value="">未指派</option>
                  <option v-for="b in beauticians" :key="b.id" :value="b.id">{{ b.name }}</option>
                </select>
              </div>
            </div>

            <!-- 顧客會員展開資訊 (手機端) -->
            <div v-if="expandedClientId === appt.id" class="p-3 bg-blue-50/60 rounded-lg border border-blue-100 text-xs text-gray-600 space-y-2">
              <p class="font-bold text-[#154337]">📱 電話：{{ appt.client_phone }}</p>
              <p>📧 信箱：{{ appt.client_email || '未填寫' }}</p>
              <p>👤 性別：{{ appt.client_gender || '未填寫' }}</p>

              <!-- 歷史紀錄 -->
              <div class="bg-white p-2 rounded border border-blue-100">
                <p class="font-bold text-gray-700 mb-1">顧客歷史紀錄：</p>
                <div v-if="getClientHistory(appt.user_id).length === 0" class="text-gray-400 italic text-[11px]">無到店紀錄</div>
                <ul v-else class="space-y-1 max-h-24 overflow-y-auto">
                  <li v-for="history in getClientHistory(appt.user_id)" :key="history.id" class="text-[11px] text-gray-700">
                    • {{ history.date }} - {{ history.notes || '無單筆備註' }}
                  </li>
                </ul>
              </div>

              <!-- 常駐備註 -->
              <div class="bg-white p-2 rounded border border-blue-200">
                <div class="flex items-center justify-between mb-1">
                  <span class="font-bold text-[#154337] text-[11px]">會員備註：</span>
                  <button @click="saveUserNotes(appt)" class="text-[10px] bg-[#154337] text-white px-2 py-0.5 rounded font-bold">
                    儲存
                  </button>
                </div>
                <input 
                  type="text" 
                  v-model="appt.editUserNotes" 
                  class="w-full border border-gray-300 rounded px-2 py-1 text-xs" 
                  placeholder="修改該會員常駐備註..." 
                />
              </div>
            </div>

            <!-- 單筆預約備註與操作按鈕 -->
            <div class="pt-2 border-t border-gray-100 flex flex-col gap-2">
              <div class="flex items-center justify-between bg-gray-50 p-2 rounded border border-gray-200 text-xs">
                <input 
                  type="text" 
                  v-model="appt.editNotes" 
                  class="bg-transparent text-xs w-full focus:outline-none" 
                  placeholder="新增/修改此筆備註..." 
                />
                <button @click="saveAppointmentNotes(appt)" class="text-[11px] text-[#154337] font-bold whitespace-nowrap ml-2">
                  儲存
                </button>
              </div>

              <div class="flex gap-2 justify-end">
                <button v-if="!appt.status || appt.status === 'pending'" @click="updateAppointmentStatus(appt.id, 'confirmed')" class="flex-1 py-1.5 text-xs bg-green-600 text-white rounded-lg font-bold">核准</button>
                <button v-if="appt.status === 'confirmed'" @click="updateAppointmentStatus(appt.id, 'complete')" class="flex-1 py-1.5 text-xs bg-blue-600 text-white rounded-lg font-bold">標記完成</button>
                <button v-if="appt.status !== 'cancelled'" @click="updateAppointmentStatus(appt.id, 'cancelled')" class="px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg font-bold">取消</button>
              </div>
            </div>
          </div>
        </div>

        <!-- 🌟 桌機端專屬：完整 9 欄式資料表格 (標準寬螢幕體驗) -->
        <div class="hidden md:block overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider bg-gray-50">
                <th class="p-3.5 font-medium rounded-tl-lg">狀態</th>
                <th class="p-3.5 font-medium">預約單號</th>
                <th class="p-3.5 font-medium">預約日期</th>
                <th class="p-3.5 font-medium">時間區間</th>
                <th class="p-3.5 font-medium">負責美容師</th>
                <th class="p-3.5 font-medium">客戶姓名</th>
                <th class="p-3.5 font-medium">聯絡電話</th>
                <th class="p-3.5 font-medium min-w-[150px]">預約單筆備註</th>
                <th class="p-3.5 font-medium text-right rounded-tr-lg">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 text-sm">
              <template v-for="appt in filteredAppointments" :key="appt.id">
                <tr class="hover:bg-gray-50 transition">
                  <!-- 修正後的 狀態 欄位 -->
                  <td class="p-3.5 whitespace-nowrap">
                    <span :class="[
                      'px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap inline-block',
                      appt.status === 'complete' ? 'bg-blue-100 text-blue-700' :
                      appt.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                      appt.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-800'
                    ]">
                      {{ appt.status === 'complete' ? '已完成' : appt.status === 'confirmed' ? '已確認' : appt.status === 'cancelled' ? '已取消' : '審核中' }}
                    </span>
                  </td>
                  
                  <td class="p-3.5 font-mono text-xs font-bold text-gray-700">
                    {{ appt.appointment_code || '-' }}
                  </td>

                  <td class="p-3.5 font-semibold text-gray-800">{{ appt.date }}</td>
                  <td class="p-3.5 text-[#154337] font-bold">{{ appt.start_time }} ~ {{ appt.end_time }}</td>
                  
                  <td class="p-3.5">
                    <select 
                      :value="appt.beautician_id || ''"
                      @change="updateAppointmentBeautician(appt.id, ($event.target as HTMLSelectElement).value)"
                      class="border border-gray-300 rounded-lg p-1.5 text-xs bg-white focus:ring-1 focus:ring-[#154337]"
                    >
                      <option value="">未指派</option>
                      <option v-for="b in beauticians" :key="b.id" :value="b.id">{{ b.name }}</option>
                    </select>
                  </td>

                  <td class="p-3.5 font-medium">
                    <button 
                      @click="expandedClientId = expandedClientId === appt.id ? null : appt.id"
                      class="text-[#154337] font-bold underline decoration-dotted hover:text-black transition flex items-center gap-1"
                    >
                      {{ appt.client_name }}
                      <span v-if="appt.visit_count > 0" class="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-black">
                        履約 {{ appt.visit_count }} 次
                      </span>
                      <Icon :name="expandedClientId === appt.id ? 'mdi:chevron-up' : 'mdi:chevron-down'" size="16" class="text-gray-400" />
                    </button>
                  </td>

                  <td class="p-3.5 text-gray-600">{{ appt.client_phone }}</td>
                  
                  <td class="p-3.5">
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-gray-700 bg-gray-50 px-2 py-1 rounded border border-gray-200 max-w-[120px] truncate" :title="appt.notes">
                        {{ appt.notes || '無備註' }}
                      </span>
                      <button 
                        @click="editingNotesId = editingNotesId === appt.id ? null : appt.id"
                        class="text-xs text-[#154337] hover:underline whitespace-nowrap font-bold"
                      >
                        {{ editingNotesId === appt.id ? '收起' : '修改' }}
                      </button>
                    </div>
                  </td>

                  <td class="p-3.5 text-right space-x-2">
                    <button v-if="!appt.status || appt.status === 'pending'" @click="updateAppointmentStatus(appt.id, 'confirmed')" class="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition">核准</button>
                    <button v-if="appt.status === 'confirmed'" @click="updateAppointmentStatus(appt.id, 'complete')" class="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition">完成</button>
                    <button v-if="appt.status !== 'cancelled'" @click="updateAppointmentStatus(appt.id, 'cancelled')" class="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-100 transition">取消</button>
                  </td>
                </tr>

                <!-- 桌機展開詳情 -->
                <tr v-if="expandedClientId === appt.id" class="bg-blue-50/40">
                  <td colspan="9" class="p-4">
                    <div class="p-4 bg-white rounded-xl border border-blue-100 text-xs text-gray-600 space-y-3 animate-fade-in shadow-sm">
                      <div class="flex justify-between items-center border-b border-gray-100 pb-2">
                        <p class="font-bold text-[#154337] flex items-center gap-1 text-sm">
                          <Icon name="mdi:account-details" size="16" /> {{ appt.client_name }} 的會員帳號詳細資料
                        </p>
                        <span class="text-xs font-bold bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full">
                          已成功到店履約 {{ appt.visit_count || 0 }} 次
                        </span>
                      </div>

                      <div class="grid grid-cols-2 md:grid-cols-3 gap-2 py-1">
                        <p>信箱：<span class="text-gray-800 font-medium">{{ appt.client_email || '未填寫' }}</span></p>
                        <p>性別：<span class="text-gray-800 font-medium">{{ appt.client_gender || '未填寫' }}</span></p>
                        <p>電話：<span class="text-gray-800 font-medium">{{ appt.client_phone }}</span></p>
                      </div>

                      <div class="bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <p class="font-bold text-gray-700 mb-2 flex items-center gap-1">
                          <Icon name="mdi:history" size="16" /> 顧客到店歷史紀錄：
                        </p>
                        <div v-if="getClientHistory(appt.user_id).length === 0" class="text-gray-400 italic">無到店紀錄</div>
                        <ul v-else class="space-y-1.5 max-h-32 overflow-y-auto">
                          <li v-for="history in getClientHistory(appt.user_id)" :key="history.id" class="flex justify-between items-center text-xs bg-white p-2 rounded border border-gray-100">
                            <span class="font-bold text-gray-800">📅 {{ history.date }} ({{ history.start_time }} ~ {{ history.end_time }})</span>
                            <span class="text-gray-500 italic">{{ history.notes ? `備註: ${history.notes}` : '無單筆備註' }}</span>
                          </li>
                        </ul>
                      </div>
                      
                      <div class="bg-blue-50/80 p-2.5 rounded-lg border border-blue-200">
                        <div class="flex items-center justify-between mb-1">
                          <span class="font-bold text-[#154337] text-[11px]">會員備註 ：</span>
                          <button @click="saveUserNotes(appt)" class="text-[11px] bg-[#154337] text-white px-2 py-0.5 rounded hover:bg-opacity-90 transition font-bold">
                            儲存會員備註
                          </button>
                        </div>
                        <input 
                          type="text" 
                          v-model="appt.editUserNotes" 
                          class="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#154337]" 
                          placeholder="修改該會員帳號的常駐備註..." 
                        />
                      </div>
                    </div>
                  </td>
                </tr>

                <tr v-if="editingNotesId === appt.id" class="bg-gray-50/80">
                  <td colspan="9" class="p-4">
                    <div class="flex items-center gap-3 bg-white p-3 rounded-xl border border-gray-200 shadow-inner">
                      <span class="text-xs font-bold text-gray-500 whitespace-nowrap">修改此筆預約備註：</span>
                      <input 
                        type="text" 
                        v-model="appt.editNotes" 
                        class="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full focus:ring-2 focus:ring-[#154337]" 
                        placeholder="請輸入這筆預約的備註..." 
                      />
                      <button @click="saveAppointmentNotes(appt)" class="text-xs bg-[#154337] text-white px-4 py-2 rounded-lg hover:bg-opacity-90 transition shrink-0 font-bold">
                        儲存預約備註
                      </button>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 🌟 彈出視窗：特定日期排程管理 (支援手機 Tab 頁籤切換) -->
    <div v-if="showModal && selectedDay" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 sm:p-4 z-50">
      <div class="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col md:flex-row overflow-hidden max-h-[90vh] relative">
        
        <!-- 手機端頂部關閉按鈕與頁籤列 -->
        <button @click="showModal = false" class="absolute top-3 right-3 z-20 text-gray-400 hover:text-gray-800 bg-gray-100 rounded-full p-1 transition">
          <Icon name="mdi:close" size="22" />
        </button>

        <div class="flex border-b border-gray-200 md:hidden bg-white sticky top-0 z-10 pr-10">
          <button 
            @click="mobileModalTab = 'appts'" 
            :class="['flex-1 py-3 text-xs font-bold border-b-2 transition text-center', mobileModalTab === 'appts' ? 'border-[#154337] text-[#154337]' : 'border-transparent text-gray-400']"
          >
            📅 當日預約 ({{ selectedDayAppointments.length }})
          </button>
          <button 
            @click="mobileModalTab = 'holidays'" 
            :class="['flex-1 py-3 text-xs font-bold border-b-2 transition text-center', mobileModalTab === 'holidays' ? 'border-[#154337] text-[#154337]' : 'border-transparent text-gray-400']"
          >
            🏖️ 休假設定
          </button>
        </div>

        <!-- 左側：當日預約清單 -->
        <div 
          :class="[
            'w-full md:w-1/2 bg-gray-50 p-4 sm:p-6 overflow-y-auto border-r border-gray-200',
            mobileModalTab === 'appts' ? 'block' : 'hidden md:block'
          ]"
        >
          <div class="flex items-center justify-between mb-4 md:mb-6">
            <h3 class="text-xl md:text-2xl font-black text-[#154337] tracking-wider">{{ selectedDay.fullDate }}</h3>
            <span class="text-xs md:text-sm font-bold text-gray-500 bg-gray-200 px-2.5 py-1 rounded-full">星期{{ weekdays[selectedDay.dayOfWeek] }}</span>
          </div>
          
          <h4 class="font-bold text-gray-700 mb-3 flex items-center gap-2 text-sm md:text-base">
            <Icon name="mdi:calendar-check" size="18"/> 當日預約名單
          </h4>
          
          <div v-if="selectedDayAppointments.length === 0" class="bg-white rounded-xl p-6 text-center text-gray-400 border border-dashed border-gray-300 text-xs md:text-sm">
            當日無預約
          </div>
          
          <div v-else class="space-y-3">
            <div v-for="appt in selectedDayAppointments" :key="appt.id" class="bg-white p-3.5 md:p-4 rounded-xl shadow-sm border border-gray-200 border-l-4" :class="appt.status === 'complete' ? 'border-l-blue-500' : appt.status === 'cancelled' ? 'border-l-red-500 opacity-60' : 'border-l-[#154337]'">
              <div class="flex justify-between items-start mb-2">
                <span class="font-black text-base md:text-lg text-gray-800">{{ appt.start_time }} - {{ appt.end_time }}</span>
                <span class="text-[10px] md:text-xs font-bold px-2 py-0.5 rounded" :class="appt.status === 'complete' ? 'bg-blue-100 text-blue-700' : appt.status === 'confirmed' ? 'bg-green-100 text-green-700' : appt.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'">
                  {{ appt.status === 'complete' ? '已完成' : appt.status === 'confirmed' ? '已確認' : appt.status === 'cancelled' ? '已取消' : '審核中' }}
                </span>
              </div>
              
              <div class="mb-2.5 flex items-center gap-2 text-xs">
                <span class="font-bold text-gray-500">美容師：</span>
                <select 
                  :value="appt.beautician_id || ''"
                  @change="updateAppointmentBeautician(appt.id, ($event.target as HTMLSelectElement).value)"
                  class="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                >
                  <option value="">未指派</option>
                  <option v-for="b in beauticians" :key="b.id" :value="b.id">{{ b.name }}</option>
                </select>
              </div>

              <div class="mb-2.5">
                <button 
                  @click="expandedClientId = expandedClientId === appt.id ? null : appt.id"
                  class="font-bold text-xs md:text-sm text-gray-800 hover:text-[#154337] flex items-center gap-1.5 text-left transition"
                >
                  <span class="underline decoration-dotted underline-offset-4">{{ appt.client_name }}</span>
                  <span v-if="appt.visit_count > 0" class="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-black">
                    履約 {{ appt.visit_count }} 次
                  </span>
                  <Icon :name="expandedClientId === appt.id ? 'mdi:chevron-up' : 'mdi:chevron-down'" size="16" class="text-gray-400" />
                </button>

                <div v-if="expandedClientId === appt.id" class="mt-2 p-2.5 bg-blue-50/60 rounded-lg border border-blue-100 text-xs text-gray-600 space-y-1.5 animate-fade-in">
                  <p class="font-bold text-[#154337] flex items-center gap-1 text-[11px]">
                    <Icon name="mdi:account-details" size="14" /> 客戶帳號資訊 (到店 {{ appt.visit_count || 0 }} 次)
                  </p>
                  <p class="text-[11px]">信箱：{{ appt.client_email || '未填寫' }}</p>
                  <p class="text-[11px]">性別：{{ appt.client_gender || '未填寫' }}</p>

                  <div class="bg-white p-2 rounded border border-blue-100">
                    <p class="font-bold text-gray-700 mb-1 text-[11px]">顧客歷史紀錄：</p>
                    <div v-if="getClientHistory(appt.user_id).length === 0" class="text-gray-400 italic text-[10px]">無歷史紀錄</div>
                    <ul v-else class="space-y-1 max-h-24 overflow-y-auto">
                      <li v-for="history in getClientHistory(appt.user_id)" :key="history.id" class="text-[10px] text-gray-600">
                        • {{ history.date }} - {{ history.notes || '無備註' }}
                      </li>
                    </ul>
                  </div>
                  
                  <div class="bg-white p-2 rounded-lg border border-blue-200 mt-2">
                    <div class="flex items-center justify-between mb-1">
                      <span class="font-bold text-[#154337] text-[10px]">會員帳號常駐備註：</span>
                      <button @click="saveUserNotes(appt)" class="text-[10px] bg-[#154337] text-white px-2 py-0.5 rounded font-bold">
                        儲存
                      </button>
                    </div>
                    <input 
                      type="text" 
                      v-model="appt.editUserNotes" 
                      class="w-full border border-gray-300 rounded px-2 py-1 text-xs" 
                      placeholder="修改會員常駐備註..." 
                    />
                  </div>
                </div>
              </div>

              <div class="bg-gray-50 p-2 rounded-lg border border-gray-200">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-[10px] font-bold text-gray-500 flex items-center gap-1">
                    <Icon name="mdi:note-edit-outline" size="14" /> 預約單筆備註
                  </span>
                  <button @click="saveAppointmentNotes(appt)" class="text-[10px] text-[#154337] font-bold hover:underline">
                    儲存
                  </button>
                </div>
                <input 
                  type="text" 
                  v-model="appt.editNotes" 
                  class="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs" 
                  placeholder="點此直接新增或修改單筆備註..." 
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 右側：當日休假設定 -->
        <div 
          :class="[
            'w-full md:w-1/2 bg-white p-4 sm:p-6 overflow-y-auto relative',
            mobileModalTab === 'holidays' ? 'block' : 'hidden md:block'
          ]"
        >
          <h4 class="font-bold text-gray-700 mb-4 md:mb-6 flex items-center gap-2 text-sm md:text-base">
            <Icon name="mdi:beach" size="18"/> 休假排程設定
          </h4>

          <div class="bg-red-50 rounded-xl p-4 mb-5 border border-red-100">
            <div class="flex items-center justify-between">
              <div>
                <p class="font-bold text-red-800 text-xs md:text-sm">整日公休</p>
                <p class="text-[10px] md:text-xs text-red-600 mt-0.5" v-if="isSelectedDayWeeklyOff">此日為每週固定公休，不可在此取消。</p>
                <p class="text-[10px] md:text-xs text-red-600 mt-0.5" v-else>開啟後，今日將無法被預約。</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer" :class="{ 'opacity-50 pointer-events-none': isSelectedDayWeeklyOff }">
                <input type="checkbox" class="sr-only peer" :checked="!!selectedDayFullOff || isSelectedDayWeeklyOff" @change="toggleFullDayOff">
                <div class="w-10 h-5 md:w-11 md:h-6 bg-gray-300 rounded-full peer peer-checked:bg-red-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 md:after:h-5 md:after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
            </div>
          </div>

          <div v-if="!selectedDayFullOff && !isSelectedDayWeeklyOff">
            <div class="mb-4">
              <label class="block text-xs md:text-sm font-bold text-gray-700 mb-2">新增時段性休息 (30分鐘為單位)</label>
              <div class="flex gap-2 items-center">
                <select v-model="timeOffForm.start" class="flex-1 border border-gray-300 rounded-lg p-2 text-xs md:text-sm">
                  <option v-for="time in timeOptions" :key="time" :value="time">{{ time }}</option>
                </select>
                <span class="text-xs text-gray-400">至</span>
                <select v-model="timeOffForm.end" class="flex-1 border border-gray-300 rounded-lg p-2 text-xs md:text-sm">
                  <option v-for="time in timeOptions" :key="time" :value="time">{{ time }}</option>
                </select>
                <button @click="addTimeOff" class="bg-[#154337] text-white px-3 py-2 rounded-lg text-xs md:text-sm font-bold hover:bg-opacity-90 transition whitespace-nowrap">新增</button>
              </div>
            </div>

            <div class="space-y-2 mt-4">
              <p class="text-xs font-bold text-gray-500 mb-1">已設定的休息時段：</p>
              <div v-if="selectedDayTimeOffs.length === 0" class="text-xs text-gray-400 italic">無設定</div>
              <div v-for="off in selectedDayTimeOffs" :key="off.id" class="flex justify-between items-center bg-gray-50 p-2.5 rounded-lg border border-gray-200 text-xs">
                <span class="font-bold text-gray-700">{{ off.start_time }} - {{ off.end_time }}</span>
                <button @click="deleteHoliday(off.id)" class="text-red-500 hover:bg-red-100 p-1 rounded transition">
                  <Icon name="mdi:delete" size="16" />
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>

    <!-- 🌟 美容師管理彈出視窗 (手機端自適應) -->
    <div v-if="showBeauticianModal" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
      <div class="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-lg w-full p-5 md:p-6 relative">
        <button @click="showBeauticianModal = false" class="absolute top-4 right-4 text-gray-400 hover:text-gray-800 bg-gray-100 rounded-full p-1 transition">
          <Icon name="mdi:close" size="22" />
        </button>

        <h3 class="text-lg md:text-xl font-bold text-[#154337] mb-4 flex items-center gap-2">
          <Icon name="mdi:account-group" size="22" /> 美容師團隊管理
        </h3>

        <div class="flex gap-2 mb-4 md:mb-6">
          <input 
            type="text" 
            v-model="newBeauticianName" 
            placeholder="請輸入新美容師姓名"
            class="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-xs md:text-sm focus:ring-2 focus:ring-[#154337]"
            @keyup.enter="addBeautician"
          />
          <button @click="addBeautician" class="bg-[#154337] text-white px-3 md:px-4 py-2 rounded-xl text-xs md:text-sm font-bold hover:bg-opacity-90 transition whitespace-nowrap">
            新增
          </button>
        </div>

        <div class="space-y-2 max-h-64 sm:max-h-80 overflow-y-auto">
          <div v-if="beauticians.length === 0" class="text-center text-gray-400 py-6 border border-dashed rounded-xl text-xs">
            目前尚未建立美容師資料
          </div>
          <div 
            v-for="b in beauticians" 
            :key="b.id" 
            class="flex justify-between items-center p-2.5 md:p-3 bg-gray-50 rounded-xl border border-gray-200"
          >
            <template v-if="editingBeauticianId === b.id">
              <input 
                type="text" 
                v-model="editingBeauticianName" 
                class="border border-gray-300 rounded-lg px-2 py-1 text-xs md:text-sm flex-1 mr-2"
                @keyup.enter="saveEditBeautician(b.id)"
              />
              <div class="flex gap-1">
                <button @click="saveEditBeautician(b.id)" class="text-xs bg-green-600 text-white px-2 py-1 rounded-lg">
                  儲存
                </button>
                <button @click="editingBeauticianId = null" class="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-lg">
                  取消
                </button>
              </div>
            </template>

            <template v-else>
              <span class="font-bold text-gray-800 text-xs md:text-sm">👤 {{ b.name }}</span>
              <div class="flex items-center gap-1">
                <button @click="startEditBeautician(b)" class="text-xs bg-white text-gray-700 border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-100">
                  編輯
                </button>
                <button @click="deleteBeautician(b.id, b.name)" class="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-lg hover:bg-red-100">
                  刪除
                </button>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style>
.animate-fade-in {
  animation: fadeIn 0.25s ease-in-out;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 🌟 管理端專用：微調日期選擇器輸入框尺寸以符合搜尋列高度 */
.compact-date-picker input {
  padding-top: 0.5rem !important;
  padding-bottom: 0.5rem !important;
  padding-left: 0.75rem !important;
  padding-right: 0.75rem !important;
  font-size: 0.75rem !important; /* text-xs */
  height: 38px !important;
}
</style>