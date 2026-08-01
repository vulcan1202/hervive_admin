<script setup lang="ts">
import { ref, onMounted, computed, reactive } from 'vue'

// ==========================================
// 1. 環境設定與全域共用狀態
// ==========================================
const config = useRuntimeConfig()
const backendUrl = config.public.backendUrl

const appointments = ref<any[]>([])
const holidays = ref<any[]>([])
const beauticians = ref<any[]>([])
const loading = ref(true)

// ==========================================
// 2. 集中管理 UI 與 Modal 狀態
// ==========================================
const showBeauticianModal = ref(false)
const showClientModal = ref(false)
const showQuestionnaireModal = ref(false)
const showNoteModal = ref(false)
const showModal = ref(false)
const mobileModalTab = ref<'appts' | 'holidays'>('appts')

// ==========================================
// 3. 通用輔助函式
// ==========================================
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

const getDayTimeOffDisplayText = (dayTimeOffs: any[]) => {
  if (!dayTimeOffs || dayTimeOffs.length === 0) return '';
  const firstWithReason = dayTimeOffs.find(t => t.reason && String(t.reason).trim() !== '');
  const text = firstWithReason ? String(firstWithReason.reason).trim() : '休息';
  return dayTimeOffs.length > 1 ? `${text}+${dayTimeOffs.length}` : text;
}

// ==========================================
// 4. 預約狀態操作
// ==========================================
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

const updateAppointmentStatus = async (id: number, newStatus: string) => {
  let actionName = ''
  if (newStatus === 'confirmed') actionName = '核准'
  else if (newStatus === 'complete') actionName = '標記為已完成'
  else if (newStatus === 'cancelled') actionName = '取消'
  else if (newStatus === 'pending') actionName = '改為待審核'
  
  if (!confirm(`確定要將此預約${actionName}嗎？`)) return
  
  try {
    const res = await fetch(`${backendUrl}/api/appointments`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus })
    })
    if (!res.ok) throw new Error('操作失敗')
    fetchAllAppointments()
  } catch (err: any) {
    alert(err.message || '操作失敗')
  }
}

// ==========================================
// 5. 核心 API 請求與初始化
// ==========================================
const fetchAllAppointments = async () => {
  loading.value = true
  try {
    const res = await fetch(`${backendUrl}/api/appointments`)
    if (!res.ok) throw new Error('讀取預約清單失敗')
    const result = await res.json()
    appointments.value = result.data.map((item: any) => ({
      ...item,
      editNotes: item.notes || '',
      editUserNotes: item.user_notes || ''
    }))
  } catch (err: any) {
    console.error(err.message)
  } finally {
    loading.value = false
  }
}

const fetchHolidays = async () => {
  try {
    const res = await fetch(`${backendUrl}/api/holidays`)
    if (res.ok) holidays.value = (await res.json()).data
  } catch (err) {
    console.error('讀取休假設定失敗', err)
  }
}

const fetchBeauticians = async () => {
  try {
    const res = await fetch(`${backendUrl}/api/beauticians`)
    if (res.ok) beauticians.value = (await res.json()).data
  } catch (err) {
    console.error('讀取美容師清單失敗', err)
  }
}

const refreshAllData = async () => {
  await Promise.all([
    fetchAllAppointments(),
    fetchHolidays(),
    fetchBeauticians()
  ])
}

onMounted(() => {
  refreshAllData()
})

// ==========================================
// 6. 行事曆與休假管理模組
// ==========================================
const currentDate = ref(new Date())
const weekdays = ['日', '一', '二', '三', '四', '五', '六']
const selectedDay = ref<any>(null)
const timeOffForm = reactive({ start: '12:00', end: '13:00', reason: '' })

const currentYearMonth = computed(() => `${currentDate.value.getFullYear()} 年 ${currentDate.value.getMonth() + 1} 月`)

const timeOptions = computed(() => {
  const times = []
  for (let h = 8; h <= 23; h++) {
    times.push(`${String(h).padStart(2, '0')}:00`)
    times.push(`${String(h).padStart(2, '0')}:30`)
  }
  return times
})

const changeMonth = (offset: number) => {
  currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + offset, 1)
}

const calendarDays = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayTaiwanStr = getTaiwanDateString()

  const days = []
  for (let i = 0; i < firstDay; i++) days.push(null)
  
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    const dayOfWeek = new Date(year, month, i).getDay()
    
    const dayAppts = appointments.value.filter(a => a.date === dateStr && a.status !== 'complete')
    const isWeeklyOff = holidays.value.some(h => h.type === 'weekly' && h.day_of_week === dayOfWeek)
    const isFullDayOff = holidays.value.some(h => h.type === 'full_day' && h.date === dateStr)
    const dayTimeOffs = holidays.value.filter(h => h.type === 'time_range' && h.date === dateStr)

    days.push({
      date: i,
      fullDate: dateStr,
      dayOfWeek,
      dayAppts,
      isOff: isWeeklyOff || isFullDayOff,
      hasTimeOff: dayTimeOffs.length > 0 && !isWeeklyOff && !isFullDayOff,
      dayTimeOffs,
      isToday: dateStr === todayTaiwanStr
    })
  }
  return days
})

const openDayModal = (day: any) => {
  if (!day) return
  selectedDay.value = day
  mobileModalTab.value = 'appts'
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
  } catch (err: any) {
    alert('設定失敗')
  }
}

const addTimeOff = async () => {
  if (timeOffForm.start >= timeOffForm.end) return alert('結束時間必須大於開始時間！')
  
  const isOverlap = selectedDayTimeOffs.value.some(off => {
    return timeOffForm.start < off.end_time && timeOffForm.end > off.start_time;
  });

  if (isOverlap) {
    return alert('⛔ 新增的休息時段與現有時段重疊，請重新調整時間！');
  }

  try {
    const res = await fetch(`${backendUrl}/api/holidays`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'time_range',
        date: selectedDay.value.fullDate,
        start_time: timeOffForm.start,
        end_time: timeOffForm.end,
        reason: timeOffForm.reason.trim() || null
      })
    })
    if (!res.ok) throw new Error('設定失敗')
    timeOffForm.reason = ''
    await fetchHolidays()
  } catch (err: any) {
    alert(err.message || '設定失敗')
  }
}

const deleteHoliday = async (id: number) => {
  try {
    await fetch(`${backendUrl}/api/holidays?id=${id}`, { method: 'DELETE' })
    await fetchHolidays()
  } catch (err: any) {
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
  } catch (err: any) {
    alert('設定失敗')
  }
}

const isWeeklyOff = (dayIndex: number) => {
  return holidays.value.some(h => h.type === 'weekly' && h.day_of_week === dayIndex)
}

// ==========================================
// 7. 美容師團隊管理模組
// ==========================================
const newBeauticianName = ref('')
const editingBeauticianId = ref<number | null>(null)
const editingBeauticianName = ref('')

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

// ==========================================
// 8. 客戶詳情與問卷管理模組
// ==========================================
const selectedClient = ref<any>(null)
const questionnaireData = ref<any>(null)
const loadingQuestionnaire = ref(false)
const questionnaireSaving = ref(false)

const howToKnowMap: Record<string, string> = {
  'instagram': 'Instagram',
  'friend': '朋友推薦',
  'search': '搜尋引擎',
  'other': '其他'
}

const questionnaireForm = reactive({
  how_to_know: '', history_of_treatments: '', allergies: '', medical_history: '',
  skin_type: '', concerns: '', Habit: '', notes: '', agreed_to_terms: false
})

const getClientHistory = (userId: number) => {
  return appointments.value.filter(a => a.user_id === userId && a.status === 'complete')
}

const fetchQuestionnaire = async (userId: number) => {
  loadingQuestionnaire.value = true
  try {
    const res = await fetch(`${backendUrl}/api/questionnaires?user_id=${userId}`)
    if (res.ok) {
      questionnaireData.value = (await res.json()).data
    } else {
      questionnaireData.value = null
    }
  } catch (error) {
    questionnaireData.value = null
  } finally {
    loadingQuestionnaire.value = false
  }
}

const openClientModal = async (appt: any) => {
  selectedClient.value = appt
  showClientModal.value = true
  await fetchQuestionnaire(appt.user_id)
}

const openQuestionnaireModal = () => {
  if (questionnaireData.value) {
    Object.assign(questionnaireForm, questionnaireData.value)
    questionnaireForm.agreed_to_terms = !!questionnaireData.value.agreed_to_terms
  } else {
    Object.assign(questionnaireForm, {
      how_to_know: '', history_of_treatments: '', allergies: '', medical_history: '',
      skin_type: '', concerns: '', Habit: '', notes: '', agreed_to_terms: false
    })
  }
  showQuestionnaireModal.value = true
}

const saveQuestionnaire = async () => {
  const isNew = !questionnaireData.value || !questionnaireData.value.agreed_to_terms;
  if (isNew && !questionnaireForm.agreed_to_terms) {
    return alert('請先閱讀並同意「課程同意書」內容！');
  }
  
  questionnaireSaving.value = true
  try {
    const payload = {
      user_id: selectedClient.value.user_id,
      how_to_know: questionnaireForm.how_to_know || 'other',
      history_of_treatments: questionnaireForm.history_of_treatments || null,
      allergies: questionnaireForm.allergies || null,
      medical_history: questionnaireForm.medical_history || null,
      skin_type: questionnaireForm.skin_type || null,
      concerns: questionnaireForm.concerns || null,
      Habit: questionnaireForm.Habit || null,
      notes: questionnaireForm.notes || null,
      agreed_to_terms: questionnaireForm.agreed_to_terms
    }
    const res = await fetch(`${backendUrl}/api/questionnaires`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!res.ok) throw new Error('儲存失敗')
    
    alert('✅ 問卷儲存成功！')
    showQuestionnaireModal.value = false
    await fetchQuestionnaire(selectedClient.value.user_id)
  } catch (err: any) {
    alert(err.message || '儲存失敗，請稍後再試')
  } finally {
    questionnaireSaving.value = false
  }
}

// ==========================================
// 9. 備註管理模組
// ==========================================
const editingNoteAppt = ref<any>(null)
const noteInput = ref('')

const openNoteModal = (appt: any) => {
  editingNoteAppt.value = appt
  noteInput.value = appt.notes || ''
  showNoteModal.value = true
}

const saveNote = async () => {
  if (!editingNoteAppt.value) return
  try {
    const res = await fetch(`${backendUrl}/api/appointments`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingNoteAppt.value.id, notes: noteInput.value })
    })
    if (!res.ok) throw new Error('備註儲存失敗')
    
    alert('✅ 預約備註已成功儲存！')
    showNoteModal.value = false
    editingNoteAppt.value = null
    noteInput.value = ''
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
</script>

<template>
  <div class="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
    
    <!-- 頂部抬頭區 -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6 md:mb-8">
      <div>
        <h2 class="text-2xl md:text-3xl font-bold text-[#154337] title-serif mb-1 md:mb-2">行事曆排程管理</h2>
        <p class="text-gray-500 text-xs md:text-sm">點擊日曆管理每日預約名單與休假設定</p>
      </div>
      <div class="grid grid-cols-2 sm:flex items-center gap-2 w-full md:w-auto">
        <button @click="showBeauticianModal = true" class="px-3 py-2.5 md:px-4 md:py-2 rounded-xl text-xs md:text-sm font-bold bg-[#154337] text-white hover:bg-opacity-90 shadow-sm transition flex items-center justify-center gap-1.5">
          <Icon name="mdi:account-group" size="18" />
          美容師 ({{ beauticians.length }})
        </button>
        <button @click="refreshAllData" class="px-3 py-2.5 md:px-4 md:py-2 rounded-xl text-xs md:text-sm font-bold bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 shadow-sm transition flex items-center justify-center gap-1.5">
          <Icon name="mdi:refresh" size="18" :class="{ 'animate-spin': loading }" />
          重新整理
        </button>
      </div>
    </div>

    <!-- 行事曆主體 -->
    <div class="space-y-4 md:space-y-6 mb-8">
      <!-- 固定公休設定 -->
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

      <!-- 日曆 -->
      <div class="bg-white rounded-2xl shadow-sm border border-[#C7CDCE] overflow-hidden">
        <div class="flex justify-between items-center bg-gray-50 px-4 md:px-6 py-3 md:py-4 border-b border-gray-200">
          <button @click="changeMonth(-1)" class="p-1.5 md:p-2 text-gray-500 hover:text-[#154337] hover:bg-white rounded-lg transition shadow-sm border border-transparent hover:border-gray-200">
            <Icon name="mdi:chevron-left" size="22" />
          </button>
          <h3 class="text-base md:text-xl font-bold text-gray-800 tracking-wider">{{ currentYearMonth }}</h3>
          <button @click="changeMonth(1)" class="p-1.5 md:p-2 text-gray-500 hover:text-[#154337] hover:bg-white rounded-lg transition shadow-sm border border-transparent hover:border-gray-200">
            <Icon name="mdi:chevron-right" size="22" />
          </button>
        </div>
        <div class="grid grid-cols-7 border-b border-gray-200 text-center bg-white">
          <div v-for="day in weekdays" :key="day" class="py-2 md:py-3 text-[11px] md:text-xs font-bold text-gray-500 uppercase tracking-wider">{{ day }}</div>
        </div>
        <div class="grid grid-cols-7 bg-gray-100 gap-px p-px">
          <div v-for="(day, index) in calendarDays" :key="index" @click="openDayModal(day)" :class="['min-h-[70px] sm:min-h-[90px] md:min-h-[130px] bg-white p-1 md:p-2 transition relative group overflow-hidden', !day ? 'bg-gray-50/40 cursor-default pointer-events-none' : 'cursor-pointer hover:bg-gray-50/80', day && day.isOff ? 'bg-red-50/30' : '']">
            <template v-if="day">
              <div class="flex justify-between items-center mb-1">
                <div :class="['text-xs md:text-xs font-bold w-5 h-5 md:w-6 md:h-6 flex items-center justify-center rounded-full', day.isToday ? 'bg-[#154337] text-white shadow-sm' : 'text-gray-700']">{{ day.date }}</div>
                <span v-if="day.isOff" class="hidden sm:inline-block text-[9px] bg-red-100 text-red-600 px-1 py-0.5 rounded font-bold truncate max-w-[65px] md:max-w-[80px]">全天公休</span>
                <!-- 桌機版顯示 -->
                <span v-else-if="day.hasTimeOff" class="hidden sm:inline-block text-[9px] bg-orange-100 text-orange-700 px-1 py-0.5 rounded font-bold truncate max-w-[65px] md:max-w-[80px]">
                  {{ getDayTimeOffDisplayText(day.dayTimeOffs) }}
                </span>
              </div>
              <div class="block sm:hidden mt-0.5">
                <div v-if="day.isOff" class="text-[9px] text-red-600 font-bold bg-red-100/80 px-1 py-0.5 rounded text-center">公休</div>
                <!-- 手機版顯示 -->
                <div v-else-if="day.hasTimeOff" class="text-[9px] text-orange-700 font-bold bg-orange-100/80 px-1 py-0.5 rounded text-center truncate w-full">
                  {{ getDayTimeOffDisplayText(day.dayTimeOffs) }}
                </div>
                <div v-if="day.dayAppts && day.dayAppts.length > 0" class="mt-1 flex justify-center">
                  <span class="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full leading-none">{{ day.dayAppts.length }} 筆</span>
                </div>
              </div>
              <div v-if="day.dayAppts && day.dayAppts.length > 0" class="hidden sm:block space-y-1 mt-1 max-h-[90px] overflow-y-auto">
                <div v-for="appt in day.dayAppts" :key="appt.id" :class="['text-[10px] p-1.5 rounded border leading-tight flex flex-col gap-0.5 shadow-2xs', appt.status === 'confirmed' ? 'bg-green-50 border-green-200 text-green-900' : appt.status === 'pending' ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-red-50 border-red-200 text-red-800 opacity-75']">
                  <div class="font-bold truncate flex justify-between items-center"><span>{{ appt.start_time }} {{ appt.client_name }}</span></div>
                  <div class="text-[9px] opacity-80 truncate flex items-center justify-between"><span>✂️ {{ appt.beautician_name || '未指派' }}</span></div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- 行事曆彈窗 -->
    <div v-if="showModal && selectedDay" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 sm:p-4 z-50">
      <div class="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col md:flex-row overflow-hidden max-h-[90vh] relative">
        <button @click="showModal = false" class="absolute top-3 right-3 z-20 text-gray-400 hover:text-gray-800 bg-gray-100 rounded-full p-1 transition">
          <Icon name="mdi:close" size="22" />
        </button>
        <div class="flex border-b border-gray-200 md:hidden bg-white sticky top-0 z-10 pr-10">
          <button @click="mobileModalTab = 'appts'" :class="['flex-1 py-3 text-xs font-bold border-b-2 transition text-center', mobileModalTab === 'appts' ? 'border-[#154337] text-[#154337]' : 'border-transparent text-gray-400']">📅 當日預約 ({{ selectedDayAppointments.length }})</button>
          <button @click="mobileModalTab = 'holidays'" :class="['flex-1 py-3 text-xs font-bold border-b-2 transition text-center', mobileModalTab === 'holidays' ? 'border-[#154337] text-[#154337]' : 'border-transparent text-gray-400']">🏖️ 休假設定</button>
        </div>

        <div :class="['w-full md:w-1/2 bg-gray-50 p-4 sm:p-6 overflow-y-auto border-r border-gray-200', mobileModalTab === 'appts' ? 'block' : 'hidden md:block']">
          <div class="flex items-center justify-between mb-4 md:mb-6">
            <h3 class="text-xl md:text-2xl font-black text-[#154337] tracking-wider">{{ selectedDay.fullDate }}</h3>
            <span class="text-xs md:text-sm font-bold text-gray-500 bg-gray-200 px-2.5 py-1 rounded-full">星期{{ weekdays[selectedDay.dayOfWeek] }}</span>
          </div>
          <h4 class="font-bold text-gray-700 mb-3 flex items-center gap-2 text-sm md:text-base"><Icon name="mdi:calendar-check" size="18"/> 當日預約名單</h4>
          <div v-if="selectedDayAppointments.length === 0" class="bg-white rounded-xl p-6 text-center text-gray-400 border border-dashed border-gray-300 text-xs md:text-sm">當日無預約</div>
          <div v-else class="space-y-3">
            <div v-for="appt in selectedDayAppointments" :key="appt.id" class="bg-white p-3.5 md:p-4 rounded-xl shadow-sm border border-gray-200 border-l-4" :class="appt.status === 'complete' ? 'border-l-blue-500' : appt.status === 'cancelled' ? 'border-l-red-500 opacity-60' : 'border-l-[#154337]'">
              <div class="flex justify-between items-start mb-2">
                <span class="font-black text-base md:text-lg text-gray-800">{{ appt.start_time }} - {{ appt.end_time }}</span>
                <span :class="['text-[10px] md:text-xs font-bold px-2 py-0.5 rounded', appt.status === 'complete' ? 'bg-blue-100 text-blue-700' : appt.status === 'confirmed' ? 'bg-green-100 text-green-700' : appt.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800']">
                  {{ appt.status === 'complete' ? '已完成' : appt.status === 'confirmed' ? '已確認' : appt.status === 'cancelled' ? '已取消' : '審核中' }}
                </span>
              </div>
              <div class="mb-2.5 flex items-center gap-2 text-xs">
                <span class="font-bold text-gray-500">美容師：</span>
                <select :value="appt.beautician_id || ''" @change="updateAppointmentBeautician(appt.id, ($event.target as HTMLSelectElement).value)" class="border border-gray-300 rounded px-2 py-1 text-xs bg-white">
                  <option value="">未指派</option>
                  <option v-for="b in beauticians" :key="b.id" :value="b.id">{{ b.name }}</option>
                </select>
              </div>
              <div class="mb-2.5">
                <button @click="openClientModal(appt)" class="font-bold text-xs md:text-sm text-gray-800 hover:text-[#154337] flex items-center gap-1.5 text-left transition">
                  <span class="underline decoration-dotted underline-offset-4">{{ appt.client_name }}</span>
                  <span v-if="appt.visit_count > 0" class="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-black">履約 {{ appt.visit_count }} 次</span>
                  <Icon name="mdi:chevron-right" size="16" class="text-gray-400" />
                </button>
              </div>
              <div class="bg-gray-50 p-2 rounded-lg border border-gray-200">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-[10px] font-bold text-gray-500 flex items-center gap-1"><Icon name="mdi:note-edit-outline" size="14" /> 預約單筆備註</span>
                  <button @click="openNoteModal(appt)" class="text-[10px] text-[#154337] font-bold hover:underline">查看/編輯</button>
                </div>
                <p class="text-xs text-gray-600 truncate">{{ appt.notes || '無備註' }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- 休假設定 -->
        <div :class="['w-full md:w-1/2 bg-white p-4 sm:p-6 overflow-y-auto relative', mobileModalTab === 'holidays' ? 'block' : 'hidden md:block']">
          <h4 class="font-bold text-gray-700 mb-4 md:mb-6 flex items-center gap-2 text-sm md:text-base"><Icon name="mdi:beach" size="18"/> 休假排程設定</h4>
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
              
              <div class="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
                <div class="flex gap-2 items-center flex-1">
                  <select v-model="timeOffForm.start" class="flex-1 border border-gray-300 rounded-lg p-2.5 sm:p-2 text-xs md:text-sm bg-white focus:ring-1 focus:ring-[#154337] outline-none">
                    <option v-for="time in timeOptions" :key="time" :value="time">{{ time }}</option>
                  </select>
                  <span class="text-xs text-gray-400 font-bold">至</span>
                  <select v-model="timeOffForm.end" class="flex-1 border border-gray-300 rounded-lg p-2.5 sm:p-2 text-xs md:text-sm bg-white focus:ring-1 focus:ring-[#154337] outline-none">
                    <option v-for="time in timeOptions" :key="time" :value="time">{{ time }}</option>
                  </select>
                </div>
                
                <div class="flex gap-2 items-center flex-1">
                  <input type="text" v-model="timeOffForm.reason" placeholder="事由 (選填，預設為休息)" class="flex-1 border border-gray-300 rounded-lg p-2.5 sm:p-2 text-xs md:text-sm bg-white focus:ring-1 focus:ring-[#154337] outline-none" @keyup.enter="addTimeOff" />
                  <button @click="addTimeOff" class="bg-[#154337] text-white px-4 py-2.5 sm:py-2 rounded-lg text-xs md:text-sm font-bold hover:bg-opacity-90 transition whitespace-nowrap shadow-sm">新增</button>
                </div>
              </div>
            </div>
            
            <div class="space-y-2 mt-4">
              <p class="text-xs font-bold text-gray-500 mb-1">已設定的休息時段：</p>
              <div v-if="selectedDayTimeOffs.length === 0" class="text-xs text-gray-400 italic">無設定</div>
              <div v-for="off in selectedDayTimeOffs" :key="off.id" class="flex justify-between items-center bg-gray-50 p-2.5 rounded-lg border border-gray-200 text-xs hover:bg-gray-100 transition">
                <div class="flex items-center gap-2">
                  <span class="font-bold text-gray-700">{{ off.start_time }} - {{ off.end_time }}</span>
                  <span class="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] font-bold">{{ off.reason || '休息' }}</span>
                </div>
                <button @click="deleteHoliday(off.id)" class="text-red-500 hover:bg-red-100 p-1.5 rounded transition"><Icon name="mdi:delete" size="16" /></button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 客戶詳情彈窗（含問卷狀態與編輯功能） -->
    <div v-if="showClientModal && selectedClient" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative max-h-[90vh] overflow-y-auto">
        <button @click="showClientModal = false" class="absolute top-3 right-3 text-gray-400 hover:text-gray-800 bg-gray-100 rounded-full p-1 transition">
          <Icon name="mdi:close" size="22" />
        </button>
        <h3 class="text-lg font-bold text-[#154337] mb-4 flex items-center gap-2">
          <Icon name="mdi:account-details" size="22" /> 客戶詳細資料
        </h3>
        <div class="space-y-3 text-sm">
          <div class="grid grid-cols-2 gap-2">
            <div><span class="text-gray-500">姓名：</span><span class="font-semibold">{{ selectedClient.client_name }}</span></div>
            <div><span class="text-gray-500">性別：</span><span class="font-semibold">{{ selectedClient.client_gender || '未填寫' }}</span></div>
          </div>
          <div><span class="text-gray-500">電話：</span><span class="font-semibold">{{ selectedClient.client_phone }}</span></div>
          <div><span class="text-gray-500">信箱：</span><span class="font-semibold">{{ selectedClient.client_email || '未填寫' }}</span></div>
          <div><span class="text-gray-500">生日：</span><span class="font-semibold">{{ selectedClient.client_date_of_birth || '未填寫' }}</span></div>
          <div><span class="text-gray-500">年齡：</span><span class="font-semibold">{{ selectedClient.age !== null ? selectedClient.age + ' 歲' : '無法計算' }}</span></div>
          <div><span class="text-gray-500">所在地：</span><span class="font-semibold">{{ selectedClient.client_location || '未填寫' }}</span></div>
          <div><span class="text-gray-500">到店履約次數：</span><span class="font-semibold">{{ selectedClient.visit_count || 0 }}</span></div>
          
          <!-- 問卷狀態區塊 -->
          <div class="border-t border-gray-200 pt-3 mt-2">
            <div class="flex items-center justify-between mb-2">
              <span class="font-bold text-gray-700 text-sm">📋 初填問卷</span>
              <button 
                @click="openQuestionnaireModal" 
                class="text-xs bg-[#154337] text-white px-3 py-1 rounded-lg hover:bg-opacity-90 transition font-bold"
              >
                {{ questionnaireData ? '編輯問卷' : '填寫問卷' }}
              </button>
            </div>
            <div v-if="loadingQuestionnaire" class="text-xs text-gray-400">載入中...</div>
            <div v-else-if="questionnaireData" class="bg-gray-50 p-2 rounded-lg border border-gray-200 text-xs space-y-1">
              <p><span class="text-gray-500">如何得知：</span>{{ howToKnowMap[questionnaireData.how_to_know] || questionnaireData.how_to_know || '未填' }}</p>
              <p><span class="text-gray-500">膚質：</span>{{ questionnaireData.skin_type || '未填' }}</p>
              <p><span class="text-gray-500">主要困擾：</span>{{ questionnaireData.concerns || '未填' }}</p>
              <p v-if="questionnaireData.notes"><span class="text-gray-500">備註：</span>{{ questionnaireData.notes }}</p>
            </div>
            <div v-else class="text-xs text-gray-400 italic">尚未填寫初次到店問卷</div>
          </div>

          <div class="border-t border-gray-200 pt-3 mt-2">
            <div class="flex items-center justify-between mb-1">
              <span class="text-gray-500">會員備註：</span>
              <button @click="saveUserNotes(selectedClient)" class="text-xs bg-[#154337] text-white px-2 py-0.5 rounded font-bold">儲存</button>
            </div>
            <input type="text" v-model="selectedClient.editUserNotes" class="w-full border border-gray-300 rounded px-2 py-1 text-sm" placeholder="修改會員備註..." />
          </div>
          <div class="mt-2 bg-gray-50 p-3 rounded-lg">
            <p class="font-bold text-gray-600 text-xs mb-1">歷史到店紀錄：</p>
            <div v-if="getClientHistory(selectedClient.user_id).length === 0" class="text-gray-400 italic text-xs">無紀錄</div>
            <ul v-else class="space-y-1 max-h-32 overflow-y-auto text-xs">
              <li v-for="history in getClientHistory(selectedClient.user_id)" :key="history.id" class="flex justify-between items-center border-b border-gray-100 py-1">
                <span>{{ history.date }} {{ history.start_time }}</span>
                <span class="text-gray-500">{{ history.notes || '無備註' }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- 問卷編輯彈窗 -->
    <div v-if="showQuestionnaireModal" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
      <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 relative max-h-[90vh] overflow-y-auto">
        <button @click="showQuestionnaireModal = false" class="absolute top-3 right-3 text-gray-400 hover:text-gray-800 bg-gray-100 rounded-full p-1 transition">
          <Icon name="mdi:close" size="22" />
        </button>
        <h3 class="text-lg font-bold text-[#154337] mb-4 flex items-center gap-2">
          <Icon name="mdi:clipboard-text" size="22" /> {{ questionnaireData ? '編輯初填問卷' : '填寫初填問卷' }}
        </h3>
        <form @submit.prevent="saveQuestionnaire" class="space-y-4">
          <div>
            <label class="text-sm font-bold text-gray-700 block mb-1">如何得知本店</label>
            <select v-model="questionnaireForm.how_to_know" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#154337]">
              <option value="instagram">Instagram</option>
              <option value="friend">朋友推薦</option>
              <option value="search">搜尋引擎</option>
              <option value="other">其他</option>
            </select>
          </div>

          <div>
            <label class="text-sm font-bold text-gray-700 block mb-1">以往護膚經驗</label>
            <input v-model="questionnaireForm.history_of_treatments" type="text" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#154337]" placeholder="請簡述過去護膚經驗" />
          </div>

          <div>
            <label class="text-sm font-bold text-gray-700 block mb-1">過敏原 / 藥物過敏</label>
            <input v-model="questionnaireForm.allergies" type="text" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#154337]" placeholder="若有過敏請註明" />
          </div>

          <div>
            <label class="text-sm font-bold text-gray-700 block mb-1">特殊病史 / 近期醫美狀況</label>
            <input v-model="questionnaireForm.medical_history" type="text" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#154337]" placeholder="若有特殊狀況請註明" />
          </div>

          <div>
            <label class="text-sm font-bold text-gray-700 block mb-1">肌膚類型</label>
            <input v-model="questionnaireForm.skin_type" type="text" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#154337]" placeholder="例如：乾性、油性、混合肌" />
          </div>

          <div>
            <label class="text-sm font-bold text-gray-700 block mb-1">主要肌膚困擾</label>
            <input v-model="questionnaireForm.concerns" type="text" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#154337]" placeholder="例如：粉刺、毛孔粗大、細紋" />
          </div>

          <div>
            <label class="text-sm font-bold text-gray-700 block mb-1">日常保養習慣</label>
            <input v-model="questionnaireForm.Habit" type="text" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#154337]" placeholder="請簡述日常保養步驟" />
          </div>

          <div>
            <label class="text-sm font-bold text-gray-700 block mb-1">其他備註</label>
            <textarea v-model="questionnaireForm.notes" rows="3" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#154337]" placeholder="其他想補充的事項..."></textarea>
          </div>
          <!-- 課程同意書 -->
          <div class="border border-gray-200 rounded-lg p-4 bg-gray-50/60">
            <details class="group">
              <summary class="cursor-pointer text-sm font-bold text-[#154337] flex items-center gap-2">
                <Icon name="mdi:file-document-outline" size="18" />
                赫琟美學｜FACIAL 臉部肌膚管理課程 同意書
                <Icon name="mdi:chevron-down" class="group-open:rotate-180 transition-transform ml-auto" size="20" />
              </summary>
              <div class="mt-3 text-xs text-gray-700 space-y-1.5 leading-relaxed bg-white p-3 rounded-lg border border-gray-200">
                <p>本人已了解並同意以下事項：</p>
                <ol class="list-decimal list-inside space-y-1 ml-2">
                  <li>肌膚更新週期約28天，效果依個人體質不同。</li>
                  <li>課程後可能出現短暫泛紅、乾燥、代謝反應，屬正常現象。</li>
                  <li>本課程非醫療行為，無法保證立即改善。</li>
                  <li>術後須加強保濕與防曬。</li>
                  <li>已主動告知懷孕、服藥、皮膚疾病等狀況。</li>
                  <li>如有不適將立即聯繫。</li>
                </ol>
                <p class="mt-2 font-semibold">本人確認資料屬實並同意接受課程。</p>
              </div>
            </details>

            <div class="mt-3 flex items-start gap-2">
              <input 
                type="checkbox" 
                v-model="questionnaireForm.agreed_to_terms" 
                :disabled="questionnaireData && questionnaireData.agreed_to_terms === 1"
                class="mt-1 w-4 h-4 text-[#154337] focus:ring-[#154337] rounded border-gray-300"
              />
              <label class="text-[13px] text-gray-700 font-medium">
                {{ questionnaireData && questionnaireData.agreed_to_terms === 1 ? '✅ 已同意課程同意書' : '本人確認資料屬實並同意接受課程（初次填寫需勾選）' }}
              </label>
            </div>
          </div>
          <div class="flex justify-end gap-2 mt-4">
            <button type="button" @click="showQuestionnaireModal = false" class="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition">取消</button>
            <button type="submit" :disabled="questionnaireSaving" class="px-4 py-2 text-sm bg-[#154337] text-white rounded-lg hover:bg-opacity-90 transition font-bold disabled:opacity-50">
              {{ questionnaireSaving ? '儲存中...' : '儲存問卷' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- 備註編輯彈窗 -->
    <div v-if="showNoteModal && editingNoteAppt" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
        <button @click="showNoteModal = false" class="absolute top-3 right-3 text-gray-400 hover:text-gray-800 bg-gray-100 rounded-full p-1 transition">
          <Icon name="mdi:close" size="22" />
        </button>
        <h3 class="text-lg font-bold text-[#154337] mb-2">編輯預約備註</h3>
        <p class="text-xs text-gray-500 mb-4">預約編號：{{ editingNoteAppt.appointment_code }}</p>
        <textarea v-model="noteInput" rows="4" class="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#154337]" placeholder="請輸入備註內容..."></textarea>
        <div class="flex justify-end gap-2 mt-4">
          <button @click="showNoteModal = false" class="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition">取消</button>
          <button @click="saveNote" class="px-4 py-2 text-sm bg-[#154337] text-white rounded-lg hover:bg-opacity-90 transition font-bold">儲存</button>
        </div>
      </div>
    </div>

    <!-- 美容師管理彈窗 -->
    <div v-if="showBeauticianModal" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
      <div class="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-lg w-full p-5 md:p-6 relative">
        <button @click="showBeauticianModal = false" class="absolute top-4 right-4 text-gray-400 hover:text-gray-800 bg-gray-100 rounded-full p-1 transition">
          <Icon name="mdi:close" size="22" />
        </button>
        <h3 class="text-lg md:text-xl font-bold text-[#154337] mb-4 flex items-center gap-2"><Icon name="mdi:account-group" size="22" /> 美容師團隊管理</h3>
        <div class="flex gap-2 mb-4 md:mb-6">
          <input type="text" v-model="newBeauticianName" placeholder="請輸入新美容師姓名" class="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-xs md:text-sm focus:ring-2 focus:ring-[#154337]" @keyup.enter="addBeautician" />
          <button @click="addBeautician" class="bg-[#154337] text-white px-3 md:px-4 py-2 rounded-xl text-xs md:text-sm font-bold hover:bg-opacity-90 transition whitespace-nowrap">新增</button>
        </div>
        <div class="space-y-2 max-h-64 sm:max-h-80 overflow-y-auto">
          <div v-if="beauticians.length === 0" class="text-center text-gray-400 py-6 border border-dashed rounded-xl text-xs">目前尚未建立美容師資料</div>
          <div v-for="b in beauticians" :key="b.id" class="flex justify-between items-center p-2.5 md:p-3 bg-gray-50 rounded-xl border border-gray-200">
            <template v-if="editingBeauticianId === b.id">
              <input type="text" v-model="editingBeauticianName" class="border border-gray-300 rounded-lg px-2 py-1 text-xs md:text-sm flex-1 mr-2" @keyup.enter="saveEditBeautician(b.id)" />
              <div class="flex gap-1">
                <button @click="saveEditBeautician(b.id)" class="text-xs bg-green-600 text-white px-2 py-1 rounded-lg">儲存</button>
                <button @click="editingBeauticianId = null" class="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-lg">取消</button>
              </div>
            </template>
            <template v-else>
              <span class="font-bold text-gray-800 text-xs md:text-sm">👤 {{ b.name }}</span>
              <div class="flex items-center gap-1">
                <button @click="startEditBeautician(b)" class="text-xs bg-white text-gray-700 border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-100">編輯</button>
                <button @click="deleteBeautician(b.id, b.name)" class="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-lg hover:bg-red-100">刪除</button>
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
</style>