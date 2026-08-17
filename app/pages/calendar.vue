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
const showClientModal = ref(false)
const showQuestionnaireModal = ref(false)
const showTermsModal = ref(false)
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

const formatDateToString = (d: Date | null) => {
  if (!d) return ''
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const showEditTimeModal = ref(false)
const selectedApptForEditTime = ref<any>(null)
const editTimeDateObj = ref<Date | null>(null)
const editTimeStartStr = ref<string>('12:00')
const editTimeSaving = ref(false)

const openEditTimeModal = (appt: any) => {
  selectedApptForEditTime.value = appt
  if (appt.date) {
    const [y, m, d] = appt.date.split('-').map(Number)
    editTimeDateObj.value = new Date(y, m - 1, d)
  } else {
    editTimeDateObj.value = new Date()
  }
  editTimeStartStr.value = appt.start_time || '12:00'
  showEditTimeModal.value = true
}

const submitEditTime = async () => {
  if (!selectedApptForEditTime.value || !editTimeDateObj.value) return
  const formattedDate = formatDateToString(editTimeDateObj.value)
  if (!formattedDate) {
    alert('請選擇有效的預約日期')
    return
  }

  editTimeSaving.value = true
  try {
    const res = await fetch(`${backendUrl}/api/appointments`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selectedApptForEditTime.value.id,
        date: formattedDate,
        start_time: editTimeStartStr.value
      })
    })

    const resData = await res.json()
    if (!res.ok) {
      throw new Error(resData.error || '調整時間失敗')
    }

    alert('✅ 預約時間已成功變更，連動資料與日曆已同步更新！')
    showEditTimeModal.value = false
    selectedApptForEditTime.value = null
    refreshAllData()
  } catch (err: any) {
    alert(err.message || '操作失敗')
  } finally {
    editTimeSaving.value = false
  }
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
// 6.5 休假多選項與排程模組 (單週 / 單月 / 固定公休)
// ==========================================
const holidayModeTab = ref<'weekly' | 'single_week' | 'monthly_range'>('weekly')

// 🌟 計算當月在月曆上的完整跨月週次 (自動涵蓋頭尾跨月天數，100% 無縫銜接前後月份)
const calendarWeeksList = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  
  const firstDay = new Date(year, month, 1)
  const dayOfWeek = firstDay.getDay() // 0 (Sun) ~ 6 (Sat)
  
  // 計算第一週的星期一 (若 1 號是週日=0，往前推 6 天；若週一=1，往前推 0 天；若週二=2，往前推 1 天...)
  const offsetToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const startMonday = new Date(year, month, 1 - offsetToMonday)
  
  const lastDayOfMonth = new Date(year, month + 1, 0)
  
  const weeks = []
  let currMonday = new Date(startMonday)
  let weekIndex = 1

  while (currMonday <= lastDayOfMonth || weekIndex <= 4) {
    const currSunday = new Date(currMonday)
    currSunday.setDate(currSunday.getDate() + 6)
    
    weeks.push({
      weekIndex,
      label: `第 ${weekIndex} 週`,
      startDateStr: formatDateToString(currMonday),
      endDateStr: formatDateToString(currSunday),
      displayRange: `${formatDateToString(currMonday)} (一) ~ ${formatDateToString(currSunday)} (日)`
    })
    
    currMonday = new Date(currMonday)
    currMonday.setDate(currMonday.getDate() + 7)
    weekIndex++
    if (weekIndex > 6) break;
  }
  return weeks
})

// 單週公休：選擇第 N 週（僅顯示日期範圍，不開放編輯輸入）
const selectedWeekIndex = ref<number>(1)

const currentSelectedWeek = computed(() => {
  if (calendarWeeksList.value.length === 0) return null
  const found = calendarWeeksList.value.find(w => w.weekIndex === selectedWeekIndex.value)
  return found || calendarWeeksList.value[0]
})

const applySelectedWeekOff = async () => {
  if (!currentSelectedWeek.value) return
  await batchCreateFullDayOff(
    currentSelectedWeek.value.startDateStr, 
    currentSelectedWeek.value.endDateStr, 
    `${currentDate.value.getFullYear()}年${currentDate.value.getMonth() + 1}月 ${currentSelectedWeek.value.label}門市公休`
  )
}

const clearSelectedWeekOff = async () => {
  if (!currentSelectedWeek.value) return
  await batchClearFullDayOff(
    currentSelectedWeek.value.startDateStr, 
    currentSelectedWeek.value.endDateStr
  )
}

// 單月 / 連假區間公休：使用 MyCalendar 選擇起訖日期
const rangeStartDateObj = ref<Date | string | null>(null)
const rangeEndDateObj = ref<Date | string | null>(null)
const rangeReason = ref('連假門市公休')

// 快捷選擇「當月全月」
const setQuickFullMonth = () => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  rangeStartDateObj.value = firstDay
  rangeEndDateObj.value = lastDay
  rangeReason.value = `${currentDate.value.getFullYear()}年${month + 1}月份全月店休`
}

const applyCustomRangeOff = async () => {
  const sObj = rangeStartDateObj.value instanceof Date ? rangeStartDateObj.value : (rangeStartDateObj.value ? new Date(rangeStartDateObj.value) : null)
  const eObj = rangeEndDateObj.value instanceof Date ? rangeEndDateObj.value : (rangeEndDateObj.value ? new Date(rangeEndDateObj.value) : null)
  
  const startStr = formatDateToString(sObj)
  const endStr = formatDateToString(eObj)

  if (!startStr || !endStr) {
    alert('請使用日曆選擇有效的開始與結束日期！')
    return
  }
  await batchCreateFullDayOff(startStr, endStr, rangeReason.value)
}

const clearCustomRangeOff = async () => {
  const sObj = rangeStartDateObj.value instanceof Date ? rangeStartDateObj.value : (rangeStartDateObj.value ? new Date(rangeStartDateObj.value) : null)
  const eObj = rangeEndDateObj.value instanceof Date ? rangeEndDateObj.value : (rangeEndDateObj.value ? new Date(rangeEndDateObj.value) : null)

  const startStr = formatDateToString(sObj)
  const endStr = formatDateToString(eObj)

  if (!startStr || !endStr) {
    alert('請使用日曆選擇有效的開始與結束日期！')
    return
  }
  await batchClearFullDayOff(startStr, endStr)
}

// 批量寫入全天公休 (全天 / 連假 / 單週 / 單月)
const batchCreateFullDayOff = async (startDateStr: string, endDateStr: string, reasonText: string) => {
  if (!startDateStr || !endDateStr) {
    alert('請選擇有效的起訖日期！')
    return
  }
  const start = new Date(startDateStr)
  const end = new Date(endDateStr)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    alert('無效的日期格式')
    return
  }
  if (start > end) {
    alert('開始日期不可晚於結束日期！')
    return
  }

  const dateList: string[] = []
  const curr = new Date(start)
  while (curr <= end) {
    dateList.push(formatDateToString(curr))
    curr.setDate(curr.getDate() + 1)
  }

  if (dateList.length > 60) {
    alert('單次批量排休不可超過 60 天！')
    return
  }

  if (!confirm(`確定要將 ${startDateStr} 至 ${endDateStr}（共 ${dateList.length} 天）設定為全天公休嗎？`)) return

  try {
    for (const dStr of dateList) {
      const exists = holidays.value.some(h => h.type === 'full_day' && h.date === dStr)
      if (!exists) {
        await fetch(`${backendUrl}/api/holidays`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'full_day', date: dStr, reason: reasonText || '門市公休' })
        })
      }
    }
    alert(`✅ 已成功為 ${startDateStr} ~ ${endDateStr} 批次標註公休！`)
    await fetchHolidays()
  } catch (err: any) {
    alert('批量排休設定失敗：' + err.message)
  }
}

// 批量清除公休
const batchClearFullDayOff = async (startDateStr: string, endDateStr: string) => {
  if (!startDateStr || !endDateStr) return alert('請選擇有效的起訖日期')
  const toDelete = holidays.value.filter(h => h.type === 'full_day' && h.date >= startDateStr && h.date <= endDateStr)
  if (toDelete.length === 0) return alert('該區間內無單天公休紀錄可供取消。')
  if (!confirm(`確定要清除 ${startDateStr} 至 ${endDateStr} 之間的 ${toDelete.length} 筆公休設定嗎？`)) return

  try {
    for (const h of toDelete) {
      await fetch(`${backendUrl}/api/holidays?id=${h.id}`, { method: 'DELETE' })
    }
    alert('✅ 已成功清除該區間之公休紀錄！')
    await fetchHolidays()
  } catch (e: any) {
    alert('清除失敗：' + e.message)
  }
}

// ==========================================
// 7. 客戶詳情與問卷管理模組
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

const skinTypeOptions = ['乾性肌', '中性肌', '油性肌', '混合偏乾', '混合偏油', '敏感脆弱肌']
const concernOptions = ['粉刺毛孔', '痘痘發炎', '暗沉斑點', '乾燥脫屑', '細紋鬆弛', '泛紅過敏', '膚色不均', '眼周暗沉']

const selectSkinType = (type: string) => {
  questionnaireForm.skin_type = type
}

const toggleConcernTag = (tag: string) => {
  const current = questionnaireForm.concerns 
    ? questionnaireForm.concerns.split(/[,，、 ]+/).map((s: string) => s.trim()).filter(Boolean)
    : []
  const idx = current.indexOf(tag)
  if (idx > -1) {
    current.splice(idx, 1)
  } else {
    current.push(tag)
  }
  questionnaireForm.concerns = current.join('、')
}

const getClientHistory = (userId: number) => {
  return appointments.value.filter(a => a.user_id === userId && a.status === 'complete')
}

const fetchQuestionnaire = async (userId: number) => {
  if (!userId) {
    questionnaireData.value = null
    return
  }
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
      how_to_know: 'other', history_of_treatments: '', allergies: '', medical_history: '',
      skin_type: '', concerns: '', Habit: '', notes: '', agreed_to_terms: false
    })
  }
  showQuestionnaireModal.value = true
}

const agreeTermsAndClose = () => {
  questionnaireForm.agreed_to_terms = true
  showTermsModal.value = false
}

const saveQuestionnaire = async () => {
  if (!selectedClient.value?.user_id) {
    return alert('缺少客戶會員編號，無法儲存問卷！')
  }

  if (!questionnaireForm.agreed_to_terms) {
    showTermsModal.value = true
    return alert('請先點擊開啟規定確認事項彈窗並打勾同意後，方可送出問卷！')
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
      agreed_to_terms: !!questionnaireForm.agreed_to_terms
    }
    const res = await fetch(`${backendUrl}/api/questionnaires`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '問卷儲存失敗')
    
    alert('✅ 初次來訪顧客諮詢問卷儲存成功！')
    showQuestionnaireModal.value = false
    await fetchQuestionnaire(selectedClient.value.user_id)
  } catch (err: any) {
    alert(err.message || '儲存失敗，請稍後再試')
  } finally {
    questionnaireSaving.value = false
  }
}

// ==========================================
// 8. 備註管理模組
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
  <div class="max-w-7xl mx-auto space-y-6 pb-12">
    
    <!-- 頂部抬頭區 (Double-Bezel 7/5/8 高奢氛圍) -->
    <div class="p-1 bg-[#154337]/5 border border-[#154337]/10 rounded-2xl md:rounded-3xl shadow-xs">
      <div class="bg-white rounded-[calc(1rem-2px)] md:rounded-[calc(1.5rem-2px)] p-4 sm:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="px-2.5 py-0.5 rounded-full bg-[#154337]/10 text-[#154337] text-[10px] font-mono font-bold uppercase tracking-wider">
              Calendar & Schedules
            </span>
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-[#154337] tracking-tight font-serif">
            休假與行事曆排程
          </h1>
          <p class="text-gray-500 text-xs sm:text-sm mt-0.5">
            點擊日曆管理每日預約名單、設定店家公休日與時段性休息
          </p>
        </div>
        
        <div class="flex items-center gap-3 w-full md:w-auto">
          <button 
            @click="refreshAllData" 
            class="w-full md:w-auto px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#154337] text-white hover:bg-[#11352a] active:scale-95 shadow-xs transition duration-200 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Icon name="mdi:refresh" size="18" :class="{ 'animate-spin': loading }" />
            <span>重新整理資料</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 行事曆主體 (Double-Bezel 容器) -->
    <div class="space-y-6">
      <!-- 1. 休假與公休多元配置面板 (支援 每週固定 / 單週特例 / 單月與連假) -->
      <div class="p-1 bg-[#154337]/5 border border-[#154337]/10 rounded-2xl shadow-xs">
        <div class="bg-white rounded-[calc(1rem-2px)] p-4 sm:p-5 space-y-4">
          
          <!-- 頁籤導覽 (Tabs Header) -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
            <div>
              <h3 class="font-bold text-[#154337] text-sm sm:text-base flex items-center gap-2">
                <Icon name="mdi:calendar-multiselect" class="text-emerald-600 text-lg" />
                <span>休假與公休多元配置中心</span>
              </h3>
              <p class="text-[11px] sm:text-xs text-gray-500 mt-0.5">
                提供每週固定公休、單週特例休假、與單月/連假批量設定，滿足店家彈性排班
              </p>
            </div>

            <!-- Tab Buttons -->
            <div class="flex items-center p-1 bg-[#FAF4EE] rounded-xl border border-[#154337]/10 text-xs font-bold shrink-0">
              <button 
                type="button"
                @click="holidayModeTab = 'weekly'"
                :class="['px-3 py-1.5 rounded-lg transition cursor-pointer', holidayModeTab === 'weekly' ? 'bg-[#154337] text-white shadow-2xs' : 'text-gray-600 hover:text-[#154337]']"
              >
                每週固定公休
              </button>
              <button 
                type="button"
                @click="holidayModeTab = 'single_week'"
                :class="['px-3 py-1.5 rounded-lg transition cursor-pointer', holidayModeTab === 'single_week' ? 'bg-[#154337] text-white shadow-2xs' : 'text-gray-600 hover:text-[#154337]']"
              >
                單週特例公休
              </button>
              <button 
                type="button"
                @click="holidayModeTab = 'monthly_range'"
                :class="['px-3 py-1.5 rounded-lg transition cursor-pointer', holidayModeTab === 'monthly_range' ? 'bg-[#154337] text-white shadow-2xs' : 'text-gray-600 hover:text-[#154337]']"
              >
                單月/連假區間公休
              </button>
            </div>
          </div>

          <!-- Tab Content 1: 每週固定公休 -->
          <div v-if="holidayModeTab === 'weekly'" class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-in">
            <div class="text-xs text-gray-600">
              <span class="font-bold text-[#154337]">每週常態公休：</span>勾選的星期將固定標註為全天公休（例如每週一全店休息）。
            </div>
            <div class="flex flex-wrap gap-2 w-full md:w-auto justify-between md:justify-start">
              <label v-for="(day, index) in weekdays" :key="index" class="cursor-pointer relative">
                <input type="checkbox" class="peer sr-only" :checked="isWeeklyOff(index)" @change="toggleWeeklyOff(index)" />
                <div class="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl text-xs sm:text-sm font-bold border-2 transition-all duration-200 peer-checked:bg-[#154337] peer-checked:border-[#154337] peer-checked:text-white peer-checked:shadow-sm border-gray-200 text-gray-400 hover:border-[#154337] hover:text-[#154337] active:scale-95">
                  {{ day }}
                </div>
              </label>
            </div>
          </div>

          <!-- Tab Content 2: 單週特例公休 (自動涵蓋前後月份頭尾天數，僅展示日期不開放修改) -->
          <div v-else-if="holidayModeTab === 'single_week'" class="space-y-4 animate-fade-in">
            <div class="flex flex-wrap items-center gap-2 text-xs">
              <span class="font-bold text-[#154337]">選擇週別 ({{ currentDate.getFullYear() }}年{{ currentDate.getMonth() + 1 }}月月曆)：</span>
              <button 
                v-for="w in calendarWeeksList" 
                :key="w.weekIndex"
                type="button" 
                @click="selectedWeekIndex = w.weekIndex" 
                :class="[
                  'px-3 py-1.5 rounded-xl font-bold transition cursor-pointer border shadow-2xs', 
                  selectedWeekIndex === w.weekIndex ? 'bg-[#154337] text-white border-[#154337]' : 'bg-amber-50/80 text-amber-900 border-amber-200/80 hover:bg-amber-100'
                ]"
              >
                {{ w.label }}
              </button>
            </div>

            <!-- 單週時間展示卡片 (只顯示日期，禁止隨意修改以確保完整一週) -->
            <div v-if="currentSelectedWeek" class="bg-[#FAF4EE]/70 p-4 rounded-2xl border border-[#154337]/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div class="space-y-1">
                <div class="text-xs font-bold text-[#154337] flex items-center gap-1.5">
                  <Icon name="mdi:calendar-week-begin" class="text-emerald-600 text-base" />
                  <span>{{ currentSelectedWeek.label }} 起訖時間：</span>
                </div>
                <div class="text-sm font-mono font-bold text-gray-800 bg-white px-3 py-1.5 rounded-xl border border-gray-200 inline-block shadow-2xs">
                  📅 {{ currentSelectedWeek.displayRange }}
                </div>
                <p class="text-[11px] text-gray-500">此選區自動涵蓋跨月頭尾日期，確保全週時間無縫銜接。</p>
              </div>

              <div class="flex items-center gap-2 w-full sm:w-auto">
                <button 
                  type="button"
                  @click="applySelectedWeekOff" 
                  class="flex-1 sm:flex-none py-2.5 px-4 bg-[#154337] text-white text-xs font-bold rounded-xl hover:bg-[#0e2f27] transition shadow-xs cursor-pointer flex items-center justify-center gap-1 active:scale-95"
                >
                  <Icon name="mdi:check-circle-outline" class="text-sm" />
                  <span>套用此週公休</span>
                </button>
                <button 
                  type="button"
                  @click="clearSelectedWeekOff" 
                  class="py-2.5 px-4 bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl hover:bg-rose-100 transition cursor-pointer flex items-center justify-center gap-1 active:scale-95"
                >
                  <Icon name="mdi:close-circle-outline" class="text-sm" />
                  <span>取消此週公休</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Tab Content 3: 單月 / 連假區間公休 (套用 MyCalendar 日曆選擇器，可自由定製日期) -->
          <div v-else-if="holidayModeTab === 'monthly_range'" class="space-y-4 animate-fade-in">
            <div class="flex items-center justify-between text-xs">
              <div class="text-gray-600">
                <span class="font-bold text-[#154337]">連假特休指定區間：</span>可自行使用日曆定製特定連假、全月店休或特定活動休假。
              </div>
              <button type="button" @click="setQuickFullMonth" class="px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl font-bold hover:bg-emerald-100 transition cursor-pointer shadow-2xs">
                快捷選擇當月全月 ({{ currentDate.getMonth() + 1 }}月)
              </button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end bg-[#FAF4EE]/50 p-3.5 rounded-2xl border border-[#154337]/10">
              <div>
                <label class="block text-[11px] font-bold text-gray-700 mb-1">開始日期 (MyCalendar)</label>
                <MyCalendar v-model="rangeStartDateObj" placeholder="選擇連假開始日期" />
              </div>
              <div>
                <label class="block text-[11px] font-bold text-gray-700 mb-1">結束日期 (MyCalendar)</label>
                <MyCalendar v-model="rangeEndDateObj" placeholder="選擇連假結束日期" />
              </div>
              <div>
                <label class="block text-[11px] font-bold text-gray-700 mb-1">公休說明/備註</label>
                <input type="text" v-model="rangeReason" placeholder="例如：春節年假店休" class="w-full border border-gray-200 rounded-xl p-3 text-xs bg-white outline-none focus:ring-2 focus:ring-[#154337]" />
              </div>
              <div class="flex items-center gap-2">
                <button 
                  type="button"
                  @click="applyCustomRangeOff" 
                  class="flex-1 py-3 px-3 bg-[#154337] text-white text-xs font-bold rounded-xl hover:bg-[#0e2f27] transition shadow-xs cursor-pointer active:scale-95"
                >
                  套用連假區間
                </button>
                <button 
                  type="button"
                  @click="clearCustomRangeOff" 
                  class="py-3 px-3 bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl hover:bg-rose-100 transition cursor-pointer active:scale-95"
                >
                  清除
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- 2. 月曆主體表格 -->
      <div class="p-1 bg-[#154337]/5 border border-[#154337]/10 rounded-2xl md:rounded-3xl shadow-xs overflow-hidden">
        <div class="bg-white rounded-[calc(1rem-2px)] md:rounded-[calc(1.5rem-2px)] overflow-hidden">
          
          <!-- 月曆頂部月份導覽切換 -->
          <div class="flex justify-between items-center bg-[#FAF4EE] px-4 sm:px-6 py-3.5 border-b border-[#154337]/10">
            <button 
              @click="changeMonth(-1)" 
              class="p-2 text-[#154337] hover:bg-white rounded-xl transition duration-200 shadow-2xs border border-transparent hover:border-[#154337]/20 active:scale-95 cursor-pointer"
            >
              <Icon name="mdi:chevron-left" size="22" />
            </button>
            <div class="flex items-center gap-2">
              <Icon name="mdi:calendar-month-outline" class="text-[#154337] text-xl" />
              <h3 class="text-base sm:text-xl font-bold text-[#154337] tracking-wider font-serif">
                {{ currentYearMonth }}
              </h3>
            </div>
            <button 
              @click="changeMonth(1)" 
              class="p-2 text-[#154337] hover:bg-white rounded-xl transition duration-200 shadow-2xs border border-transparent hover:border-[#154337]/20 active:scale-95 cursor-pointer"
            >
              <Icon name="mdi:chevron-right" size="22" />
            </button>
          </div>

          <!-- 星期欄頭 -->
          <div class="grid grid-cols-7 border-b border-[#154337]/10 text-center bg-[#FAF4EE]/50">
            <div v-for="day in weekdays" :key="day" class="py-2.5 text-xs font-bold text-[#154337]/70 uppercase tracking-wider">
              星期{{ day }}
            </div>
          </div>

          <!-- 日期網格 (Visual Density 8 密集高清晰排版) -->
          <div class="grid grid-cols-7 bg-gray-200/60 gap-px">
            <div 
              v-for="(day, index) in calendarDays" 
              :key="index" 
              @click="openDayModal(day)" 
              :class="[
                'min-h-[75px] sm:min-h-[100px] md:min-h-[135px] bg-white p-1.5 sm:p-2 transition-all duration-200 relative group overflow-hidden', 
                !day ? 'bg-gray-50/40 cursor-default pointer-events-none' : 'cursor-pointer hover:bg-[#FAF4EE]/60', 
                day && day.isOff ? 'bg-rose-50/40' : ''
              ]"
            >
              <template v-if="day">
                <div class="flex justify-between items-center mb-1">
                  <!-- 日期數字圓圈 -->
                  <div 
                    :class="[
                      'text-xs font-bold w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-xl transition duration-200', 
                      day.isToday ? 'bg-[#154337] text-white shadow-xs scale-105 font-black ring-2 ring-[#154337]/20' : 'text-gray-800 group-hover:text-[#154337]'
                    ]"
                  >
                    {{ day.date }}
                  </div>

                  <!-- 狀態 Chip -->
                  <span v-if="day.isOff" class="hidden sm:inline-block text-[10px] bg-rose-100 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded-md font-bold truncate max-w-[80px]">
                    全天公休
                  </span>
                  <span v-else-if="day.hasTimeOff" class="hidden sm:inline-block text-[10px] bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded-md font-bold truncate max-w-[80px]">
                    {{ getDayTimeOffDisplayText(day.dayTimeOffs) }}
                  </span>
                </div>

                <!-- 手機版微型狀態標籤 -->
                <div class="block sm:hidden mt-1">
                  <div v-if="day.isOff" class="text-[9px] text-rose-700 font-bold bg-rose-100/90 px-1 py-0.5 rounded text-center">公休</div>
                  <div v-else-if="day.hasTimeOff" class="text-[9px] text-amber-800 font-bold bg-amber-100/90 px-1 py-0.5 rounded text-center truncate">
                    {{ getDayTimeOffDisplayText(day.dayTimeOffs) }}
                  </div>
                  <div v-if="day.dayAppts && day.dayAppts.length > 0" class="mt-1 flex justify-center">
                    <span class="text-[9px] font-extrabold bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded-full border border-emerald-200 leading-none">
                      {{ day.dayAppts.length }} 筆
                    </span>
                  </div>
                </div>

                <!-- 桌機版當日預約清單小卡片 (高視覺密度 8) -->
                <div v-if="day.dayAppts && day.dayAppts.length > 0" class="hidden sm:block space-y-1 mt-1 max-h-[95px] overflow-y-auto custom-scrollbar">
                  <div 
                    v-for="appt in day.dayAppts" 
                    :key="appt.id" 
                    :class="[
                      'text-[10px] p-1.5 rounded-xl border leading-tight flex flex-col gap-0.5 transition-all duration-150', 
                      appt.status === 'confirmed' ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950 font-medium' : 
                      appt.status === 'pending' ? 'bg-amber-50/80 border-amber-200 text-amber-950 font-medium' : 
                      'bg-rose-50/70 border-rose-200 text-rose-900 opacity-80'
                    ]"
                  >
                    <div class="font-bold truncate flex justify-between items-center">
                      <span>{{ appt.start_time }} {{ appt.client_name }}</span>
                    </div>
                    <div class="text-[9px] opacity-75 truncate flex items-center justify-between">
                      <span>美容師：{{ appt.beautician_name || '未指派' }}</span>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 行事曆每日詳情彈窗 (Frosted Glass 奢華彈窗) -->
    <div v-if="showModal && selectedDay" class="fixed inset-0 bg-black/60 backdrop-blur-md flex items-end md:items-center justify-center p-0 sm:p-4 z-50 animate-fade-in">
      <div class="bg-white rounded-t-3xl md:rounded-3xl shadow-2xl max-w-4xl w-full flex flex-col md:flex-row overflow-hidden max-h-[90vh] relative border border-white/20">
        <!-- 關閉按鈕 -->
        <button 
          @click="showModal = false" 
          class="absolute top-3.5 right-3.5 z-20 text-gray-400 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-full p-1.5 transition cursor-pointer"
        >
          <Icon name="mdi:close" size="20" />
        </button>

        <!-- 手機版 Tab 切換槓 -->
        <div class="flex border-b border-gray-200 md:hidden bg-white sticky top-0 z-10 pr-12">
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
            🏖️ 休假排程
          </button>
        </div>

        <!-- 左側：當日預約名單 -->
        <div :class="['w-full md:w-1/2 bg-[#FAF4EE]/40 p-4 sm:p-6 overflow-y-auto border-r border-gray-200', mobileModalTab === 'appts' ? 'block' : 'hidden md:block']">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-xl md:text-2xl font-black text-[#154337] tracking-wider font-serif">
              {{ selectedDay.fullDate }}
            </h3>
            <span class="text-xs font-bold text-[#154337] bg-[#154337]/10 px-3 py-1 rounded-full border border-[#154337]/15">
              星期{{ weekdays[selectedDay.dayOfWeek] }}
            </span>
          </div>
          
          <h4 class="font-bold text-gray-800 mb-3 flex items-center gap-2 text-sm md:text-base">
            <Icon name="mdi:calendar-check" class="text-emerald-700" size="18"/> 
            當日預約名單
          </h4>

          <div v-if="selectedDayAppointments.length === 0" class="bg-white rounded-2xl p-6 text-center text-gray-400 border border-dashed border-gray-300 text-xs md:text-sm">
            當日暫無預約資料
          </div>
          
          <div v-else class="space-y-3">
            <div 
              v-for="appt in selectedDayAppointments" 
              :key="appt.id" 
              class="bg-white p-4 rounded-2xl shadow-xs border border-gray-200/80 border-l-4 transition hover:shadow-md"
              :class="appt.status === 'complete' ? 'border-l-blue-600' : appt.status === 'cancelled' ? 'border-l-rose-500 opacity-60' : 'border-l-[#154337]'"
            >
              <div class="flex justify-between items-center mb-2">
                <span class="font-black text-base md:text-lg text-gray-900 font-mono">
                  {{ appt.start_time }} - {{ appt.end_time }}
                </span>
                <div class="flex items-center gap-1.5">
                  <button v-if="!appt.status || appt.status === 'pending' || appt.status === 'confirmed'" @click="openEditTimeModal(appt)" class="text-[11px] bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-full font-bold hover:bg-amber-100 transition cursor-pointer flex items-center gap-1">
                    <Icon name="mdi:clock-edit-outline" size="13" /> 改時間
                  </button>
                  <span :class="['text-[11px] font-bold px-2.5 py-0.5 rounded-full border', appt.status === 'complete' ? 'bg-blue-50 text-blue-700 border-blue-200' : appt.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : appt.status === 'cancelled' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-800 border-amber-200']">
                    {{ appt.status === 'complete' ? '已完成' : appt.status === 'confirmed' ? '已確認' : appt.status === 'cancelled' ? '已取消' : '審核中' }}
                  </span>
                </div>
              </div>

              <!-- 美容師指派下拉框 -->
              <div class="mb-3 flex items-center gap-2 text-xs">
                <span class="font-bold text-gray-500">美容師：</span>
                <select 
                  :value="appt.beautician_id || ''" 
                  @change="updateAppointmentBeautician(appt.id, ($event.target as HTMLSelectElement).value)" 
                  class="border border-gray-300 rounded-lg px-2.5 py-1 text-xs bg-white focus:ring-2 focus:ring-[#154337] outline-none"
                >
                  <option value="">未指派</option>
                  <option v-for="b in beauticians" :key="b.id" :value="b.id">{{ b.name }}</option>
                </select>
              </div>

              <!-- 客戶姓名 -->
              <div class="mb-3">
                <button @click="openClientModal(appt)" class="font-bold text-sm text-gray-900 hover:text-[#154337] flex items-center gap-1.5 text-left transition group">
                  <span class="underline decoration-dotted underline-offset-4 group-hover:text-[#154337]">{{ appt.client_name }}</span>
                  <span v-if="appt.visit_count > 0" class="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-black">
                    履約 {{ appt.visit_count }} 次
                  </span>
                  <Icon name="mdi:chevron-right" size="16" class="text-gray-400 group-hover:translate-x-0.5 transition" />
                </button>
              </div>

              <!-- 預約備註 preview -->
              <div class="bg-[#FAF4EE]/60 p-2.5 rounded-xl border border-[#154337]/10">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-[11px] font-bold text-gray-600 flex items-center gap-1">
                    <Icon name="mdi:note-edit-outline" size="14" class="text-[#154337]" /> 預約備註
                  </span>
                  <button @click="openNoteModal(appt)" class="text-[11px] text-[#154337] font-bold hover:underline cursor-pointer">
                    查看/編輯
                  </button>
                </div>
                <p class="text-xs text-gray-600 truncate">{{ appt.notes || '無備註' }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- 右側：休假與休息時段設定 -->
        <div :class="['w-full md:w-1/2 bg-white p-4 sm:p-6 overflow-y-auto relative', mobileModalTab === 'holidays' ? 'block' : 'hidden md:block']">
          <h4 class="font-bold text-gray-800 mb-4 sm:mb-6 flex items-center gap-2 text-sm md:text-base">
            <Icon name="mdi:beach" class="text-amber-600" size="18"/> 
            休假與公休設定
          </h4>

          <!-- 整日公休切換卡片 -->
          <div class="bg-rose-50/60 rounded-2xl p-4 mb-5 border border-rose-200/80">
            <div class="flex items-center justify-between">
              <div>
                <p class="font-bold text-rose-900 text-sm">全天公休設定</p>
                <p class="text-[11px] text-rose-600 mt-0.5" v-if="isSelectedDayWeeklyOff">此日為每週固定公休，需至頁面上方取消勾選。</p>
                <p class="text-[11px] text-rose-600 mt-0.5" v-else>開啟後今日將關閉預約，並於月曆標示公休。</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer" :class="{ 'opacity-50 pointer-events-none': isSelectedDayWeeklyOff }">
                <input type="checkbox" class="sr-only peer" :checked="!!selectedDayFullOff || isSelectedDayWeeklyOff" @change="toggleFullDayOff">
                <div class="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-rose-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
            </div>
          </div>

          <!-- 時段性休息 -->
          <div v-if="!selectedDayFullOff && !isSelectedDayWeeklyOff">
            <div class="mb-4">
              <label class="block text-xs sm:text-sm font-bold text-gray-800 mb-2">新增時段性休息 (30分鐘為單位)</label>
              
              <div class="flex flex-col gap-2.5">
                <div class="flex gap-2 items-center">
                  <select v-model="timeOffForm.start" class="flex-1 border border-gray-300 rounded-xl p-2 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-[#154337] outline-none">
                    <option v-for="time in timeOptions" :key="time" :value="time">{{ time }}</option>
                  </select>
                  <span class="text-xs text-gray-400 font-bold">至</span>
                  <select v-model="timeOffForm.end" class="flex-1 border border-gray-300 rounded-xl p-2 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-[#154337] outline-none">
                    <option v-for="time in timeOptions" :key="time" :value="time">{{ time }}</option>
                  </select>
                </div>
                
                <div class="flex gap-2 items-center">
                  <input type="text" v-model="timeOffForm.reason" placeholder="事由 (選填，預設為休息)" class="flex-1 border border-gray-300 rounded-xl p-2 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-[#154337] outline-none" @keyup.enter="addTimeOff" />
                  <button @click="addTimeOff" class="bg-[#154337] text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold hover:bg-[#11352a] active:scale-95 transition whitespace-nowrap shadow-xs cursor-pointer">
                    新增時段
                  </button>
                </div>
              </div>
            </div>
            
            <!-- 已設定的休息時段清單 -->
            <div class="space-y-2 mt-5">
              <p class="text-xs font-bold text-gray-600 mb-1">已設定的休息時段：</p>
              <div v-if="selectedDayTimeOffs.length === 0" class="text-xs text-gray-400 italic py-2">目前無時段性休息</div>
              <div 
                v-for="off in selectedDayTimeOffs" 
                :key="off.id" 
                class="flex justify-between items-center bg-[#FAF4EE]/60 p-3 rounded-xl border border-gray-200 text-xs hover:bg-[#FAF4EE] transition"
              >
                <div class="flex items-center gap-2">
                  <span class="font-bold text-gray-800 font-mono">{{ off.start_time }} - {{ off.end_time }}</span>
                  <span class="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md text-[10px] font-bold border border-amber-200">
                    {{ off.reason || '休息' }}
                  </span>
                </div>
                <button @click="deleteHoliday(off.id)" class="text-rose-500 hover:bg-rose-100 p-1.5 rounded-lg transition cursor-pointer" title="刪除時段">
                  <Icon name="mdi:delete" size="16" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 客戶詳情彈窗 -->
    <div v-if="showClientModal && selectedClient" class="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
      <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 relative max-h-[90vh] overflow-y-auto border border-white/20">
        <button @click="showClientModal = false" class="absolute top-4 right-4 text-gray-400 hover:text-gray-800 bg-gray-100 rounded-full p-1.5 transition cursor-pointer">
          <Icon name="mdi:close" size="20" />
        </button>
        <h3 class="text-lg font-bold text-[#154337] mb-4 flex items-center gap-2 font-serif">
          <Icon name="mdi:account-details" class="text-emerald-700" size="22" /> 客戶詳細資料
        </h3>
        <div class="space-y-3 text-sm">
          <div class="grid grid-cols-2 gap-2 bg-[#FAF4EE]/50 p-3 rounded-xl border border-[#154337]/10">
            <div><span class="text-gray-500 text-xs">姓名：</span><span class="font-bold text-gray-900">{{ selectedClient.client_name }}</span></div>
            <div><span class="text-gray-500 text-xs">性別：</span><span class="font-semibold text-gray-800">{{ selectedClient.client_gender || '未填寫' }}</span></div>
          </div>
          <div><span class="text-gray-500">電話：</span><span class="font-semibold text-gray-800 font-mono">{{ selectedClient.client_phone }}</span></div>
          <div><span class="text-gray-500">信箱：</span><span class="font-semibold text-gray-800">{{ selectedClient.client_email || '未填寫' }}</span></div>
          <div><span class="text-gray-500">所在地：</span><span class="font-semibold text-gray-800">{{ selectedClient.client_location || '未填寫' }}</span></div>
          <div><span class="text-gray-500">履約次數：</span><span class="font-bold text-[#154337]">{{ selectedClient.visit_count || 0 }} 次</span></div>
          
          <!-- 問卷區 -->
          <div class="border-t border-gray-200 pt-3 mt-2">
            <div class="flex items-center justify-between mb-2">
              <span class="font-bold text-gray-800 text-xs sm:text-sm">📋 初填問卷狀態</span>
              <button 
                @click="openQuestionnaireModal" 
                class="text-xs bg-[#154337] text-white px-3 py-1 rounded-xl hover:bg-[#11352a] active:scale-95 transition font-bold cursor-pointer"
              >
                {{ questionnaireData ? '編輯問卷' : '填寫問卷' }}
              </button>
            </div>
            <div v-if="loadingQuestionnaire" class="text-xs text-gray-400 py-1">載入中...</div>
            <div v-else-if="questionnaireData" class="bg-[#FAF4EE]/70 p-3.5 rounded-2xl border border-[#154337]/15 text-xs space-y-1.5">
              <div class="grid grid-cols-2 gap-2 pb-1.5 border-b border-[#154337]/10">
                <p><span class="text-gray-500">如何得知：</span><span class="font-bold text-gray-800">{{ howToKnowMap[questionnaireData.how_to_know] || questionnaireData.how_to_know || '未填' }}</span></p>
                <p><span class="text-gray-500">膚質：</span><span class="font-bold text-emerald-800">{{ questionnaireData.skin_type || '未填' }}</span></p>
              </div>
              <p><span class="text-gray-500">主要困擾：</span><span class="font-semibold text-gray-800">{{ questionnaireData.concerns || '未填' }}</span></p>
              <p v-if="questionnaireData.Habit"><span class="text-gray-500">保養習慣：</span><span class="text-gray-800">{{ questionnaireData.Habit }}</span></p>
              <p v-if="questionnaireData.allergies"><span class="text-gray-500">過敏原：</span><span class="text-rose-700 font-medium">{{ questionnaireData.allergies }}</span></p>
              <p v-if="questionnaireData.history_of_treatments"><span class="text-gray-500">醫美經驗：</span><span class="text-gray-800">{{ questionnaireData.history_of_treatments }}</span></p>
              <p v-if="questionnaireData.medical_history"><span class="text-gray-500">特殊病史：</span><span class="text-amber-800">{{ questionnaireData.medical_history }}</span></p>
              <p v-if="questionnaireData.notes"><span class="text-gray-500">補充備註：</span><span class="text-gray-800">{{ questionnaireData.notes }}</span></p>
            </div>
            <div v-else class="text-xs text-gray-400 italic py-1">尚未填寫初次到店問卷</div>
          </div>

          <div class="border-t border-gray-200 pt-3 mt-2">
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-xs text-gray-500 font-bold">會員備註：</span>
              <button @click="saveUserNotes(selectedClient)" class="text-xs bg-[#154337] text-white px-2.5 py-0.5 rounded-lg font-bold cursor-pointer">儲存</button>
            </div>
            <input type="text" v-model="selectedClient.editUserNotes" class="w-full border border-gray-300 rounded-xl px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-[#154337]" placeholder="修改會員備註..." />
          </div>
        </div>
      </div>
    </div>

    <!-- 備註編輯彈窗 -->
    <div v-if="showNoteModal && editingNoteAppt" class="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
      <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 relative">
        <button @click="showNoteModal = false" class="absolute top-4 right-4 text-gray-400 hover:text-gray-800 bg-gray-100 rounded-full p-1.5 transition cursor-pointer">
          <Icon name="mdi:close" size="20" />
        </button>
        <h3 class="text-lg font-bold text-[#154337] mb-2 font-serif">編輯預約單筆備註</h3>
        <p class="text-xs text-gray-400 mb-4 font-mono">預約單號：{{ editingNoteAppt.appointment_code }}</p>
        <textarea v-model="noteInput" rows="4" class="w-full border border-gray-300 rounded-xl p-3 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-[#154337]" placeholder="請輸入備註內容..."></textarea>
        <div class="flex justify-end gap-2 mt-4">
          <button @click="showNoteModal = false" class="px-4 py-2 text-xs font-bold bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition cursor-pointer">取消</button>
          <button @click="saveNote" class="px-4 py-2 text-xs font-bold bg-[#154337] text-white rounded-xl hover:bg-[#11352a] active:scale-95 transition shadow-xs cursor-pointer">儲存</button>
        </div>
      </div>
    </div>

    <!-- 變更預約時間 Modal -->
    <div v-if="showEditTimeModal && selectedApptForEditTime" class="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
      <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 relative border border-white/20">
        <button @click="showEditTimeModal = false" class="absolute top-4 right-4 text-gray-400 hover:text-gray-800 bg-gray-100 rounded-full p-1.5 transition cursor-pointer">
          <Icon name="mdi:close" size="20" />
        </button>

        <h3 class="text-lg font-bold text-[#154337] mb-1 flex items-center gap-2 font-serif">
          <Icon name="mdi:clock-edit-outline" class="text-emerald-700" size="22" /> 調整預約時間
        </h3>
        <p class="text-xs text-gray-500 mb-4 font-mono">
          客戶：<span class="font-bold text-gray-900">{{ selectedApptForEditTime.client_name }}</span> | 
          單號：<span class="font-bold text-[#154337]">{{ selectedApptForEditTime.appointment_code || '-' }}</span>
        </p>

        <div class="space-y-4 my-4">
          <!-- 選擇新日期 -->
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1.5">選擇新的預約日期</label>
            <ClientOnly>
              <MyCalendar v-model="editTimeDateObj" placeholder="選擇日期" class="w-full" />
            </ClientOnly>
          </div>

          <!-- 選擇新時段 -->
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1.5">選擇新的開始時段</label>
            <select v-model="editTimeStartStr" class="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#154337] bg-white h-[42px] outline-none font-mono">
              <option v-for="t in timeOptions" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>

          <div class="p-3 bg-amber-50 rounded-xl border border-amber-200/60 text-[11px] text-amber-800 flex items-start gap-2">
            <Icon name="mdi:information-outline" class="shrink-0 mt-0.5" size="16" />
            <span>變更時間將自動校驗店家公休與行程衝突，並同步更動營收帳目與 Google 日曆行程。</span>
          </div>
        </div>

        <div class="flex gap-3 pt-2">
          <button @click="showEditTimeModal = false" class="flex-1 py-2.5 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition cursor-pointer">取消</button>
          <button @click="submitEditTime" :disabled="editTimeSaving" class="flex-1 py-2.5 text-xs font-bold text-white bg-[#154337] hover:bg-[#11352a] rounded-xl transition cursor-pointer flex items-center justify-center gap-1 active:scale-95 shadow-xs">
            <Icon v-if="editTimeSaving" name="mdi:loading" class="animate-spin" size="16" />
            <span>{{ editTimeSaving ? '更新中...' : '確認變更時間' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 📋 初次來訪顧客諮詢問卷彈窗 (First Visit Consultation Modal) -->
    <div v-if="showQuestionnaireModal && selectedClient" class="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 animate-fade-in">
      <div class="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-5 sm:p-7 relative max-h-[90vh] overflow-y-auto border border-white/20 space-y-5">
        <!-- 關閉按鈕 -->
        <button 
          @click="showQuestionnaireModal = false" 
          class="absolute top-4 right-4 text-gray-400 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-full p-1.5 transition cursor-pointer"
        >
          <Icon name="mdi:close" size="20" />
        </button>

        <!-- 抬頭 -->
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="px-2.5 py-0.5 rounded-full bg-[#154337]/10 text-[#154337] text-[10px] font-mono font-bold uppercase tracking-wider">
              Client Consultation Record
            </span>
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          </div>
          <h3 class="text-xl sm:text-2xl font-black text-[#154337] tracking-tight font-serif flex items-center gap-2">
            <Icon name="mdi:clipboard-text-outline" class="text-emerald-700" size="26" />
            初次來訪顧客諮詢表
          </h3>
          <p class="text-xs text-gray-500 mt-1 flex items-center gap-2">
            <span>客戶姓名：<strong class="text-gray-900">{{ selectedClient.client_name }}</strong></span>
            <span class="text-gray-300">|</span>
            <span>電話：<strong class="text-gray-900 font-mono">{{ selectedClient.client_phone || '未填寫' }}</strong></span>
          </p>
        </div>

        <form @submit.prevent="saveQuestionnaire" class="space-y-4 text-xs sm:text-sm">
          
          <!-- 1. 認識途徑 -->
          <div class="p-4 rounded-2xl bg-[#FAF4EE]/60 border border-[#154337]/10 space-y-2">
            <label class="block font-bold text-gray-800">
              1. 請問您是如何得知本店的？ <span class="text-rose-500">*</span>
            </label>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <label 
                v-for="(label, key) in howToKnowMap" 
                :key="key"
                :class="[
                  'flex items-center justify-center p-2.5 rounded-xl border font-bold cursor-pointer transition text-xs select-none text-center',
                  questionnaireForm.how_to_know === key 
                    ? 'bg-[#154337] text-white border-[#154337] shadow-xs' 
                    : 'bg-white text-gray-700 border-gray-200 hover:border-[#154337]/40'
                ]"
              >
                <input 
                  type="radio" 
                  name="how_to_know_cal" 
                  :value="key" 
                  v-model="questionnaireForm.how_to_know" 
                  class="sr-only"
                />
                <span>{{ label }}</span>
              </label>
            </div>
          </div>

          <!-- 2. 肌膚類型與主要困擾 -->
          <div class="p-4 rounded-2xl bg-white border border-gray-200 shadow-xs space-y-3.5">
            <div class="font-bold text-[#154337] text-sm flex items-center gap-1.5 border-b border-gray-100 pb-2">
              <Icon name="mdi:face-woman-shimmer-outline" class="text-emerald-700" size="18" />
              <span>肌膚狀況與保養習慣</span>
            </div>

            <!-- 肌膚類型 -->
            <div>
              <label class="block font-bold text-gray-700 mb-1.5">肌膚自我評估類型</label>
              <div class="flex flex-wrap gap-1.5 mb-2">
                <button
                  type="button"
                  v-for="st in skinTypeOptions"
                  :key="st"
                  @click="selectSkinType(st)"
                  :class="[
                    'px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer',
                    questionnaireForm.skin_type === st 
                      ? 'bg-emerald-800 text-white' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  ]"
                >
                  {{ st }}
                </button>
              </div>
              <input 
                v-model="questionnaireForm.skin_type" 
                type="text" 
                placeholder="例如：混合偏乾、外油內乾、敏感肌..." 
                class="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#154337] outline-none"
              />
            </div>

            <!-- 主要困擾 -->
            <div>
              <label class="block font-bold text-gray-700 mb-1.5">主要肌膚困擾（可點選或自訂）</label>
              <div class="flex flex-wrap gap-1.5 mb-2">
                <button
                  type="button"
                  v-for="con in concernOptions"
                  :key="con"
                  @click="toggleConcernTag(con)"
                  :class="[
                    'px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer',
                    (questionnaireForm.concerns || '').includes(con)
                      ? 'bg-[#154337] text-white' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  ]"
                >
                  + {{ con }}
                </button>
              </div>
              <input 
                v-model="questionnaireForm.concerns" 
                type="text" 
                placeholder="例如：粉刺毛孔、兩頰暗沉、生理痘..." 
                class="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#154337] outline-none"
              />
            </div>

            <!-- 保養習慣 -->
            <div>
              <label class="block font-bold text-gray-700 mb-1.5">日常保養與清潔習慣</label>
              <input 
                v-model="questionnaireForm.Habit" 
                type="text" 
                placeholder="例如：早晚洗面乳、每日防曬、每週敷面膜兩次、目前有使用A醇..." 
                class="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#154337] outline-none"
              />
            </div>
          </div>

          <!-- 3. 美容經歷與健康評估 -->
          <div class="p-4 rounded-2xl bg-white border border-gray-200 shadow-xs space-y-3.5">
            <div class="font-bold text-[#154337] text-sm flex items-center gap-1.5 border-b border-gray-100 pb-2">
              <Icon name="mdi:medical-bag" class="text-rose-600" size="18" />
              <span>美容護膚歷史與健康評估</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-gray-700 mb-1">過往做臉或醫美經驗</label>
                <input 
                  v-model="questionnaireForm.history_of_treatments" 
                  type="text" 
                  placeholder="近半年雷射、酸類換膚或定期做臉（無則填無）" 
                  class="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#154337] outline-none"
                />
              </div>
              <div>
                <label class="block font-bold text-gray-700 mb-1">過敏原 / 藥物保養品過敏</label>
                <input 
                  v-model="questionnaireForm.allergies" 
                  type="text" 
                  placeholder="例如：酒精、香精、特定成分過敏（無則填無）" 
                  class="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#154337] outline-none"
                />
              </div>
            </div>

            <div>
              <label class="block font-bold text-gray-700 mb-1">特殊健康狀況 / 病史</label>
              <input 
                v-model="questionnaireForm.medical_history" 
                type="text" 
                placeholder="例如：懷孕中、哺乳期、心血管疾病、服用口服A酸（無則填無）" 
                class="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#154337] outline-none"
              />
            </div>
          </div>

          <!-- 4. 其他備註與同意書條款 -->
          <div class="p-4 rounded-2xl bg-white border border-gray-200 shadow-xs space-y-3.5">
            <div>
              <label class="block font-bold text-gray-700 mb-1">其他補充備註 / 美容師註記</label>
              <textarea 
                v-model="questionnaireForm.notes" 
                rows="2" 
                placeholder="例如：顧客偏好力道輕柔、對特定香氛喜好..." 
                class="w-full border border-gray-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-[#154337] outline-none"
              ></textarea>
            </div>

            <!-- 規定確認事項提示與開窗按鈕 -->
            <div :class="[
              'p-3.5 sm:p-4 rounded-2xl border transition space-y-2.5',
              questionnaireForm.agreed_to_terms ? 'bg-emerald-50/80 border-emerald-300' : 'bg-amber-50/80 border-amber-300'
            ]">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <Icon 
                    :name="questionnaireForm.agreed_to_terms ? 'mdi:check-decagram' : 'mdi:alert-circle-outline'" 
                    :class="['text-xl shrink-0', questionnaireForm.agreed_to_terms ? 'text-emerald-700' : 'text-amber-700']" 
                  />
                  <div>
                    <h4 :class="['font-bold text-xs sm:text-sm', questionnaireForm.agreed_to_terms ? 'text-emerald-950' : 'text-amber-950']">
                      課程服務約定確認事項 (共 7 項規範)
                    </h4>
                    <p :class="['text-[11px]', questionnaireForm.agreed_to_terms ? 'text-emerald-700' : 'text-amber-700']">
                      {{ questionnaireForm.agreed_to_terms ? '已詳閱並打勾同意所有規定事項' : '送出前須開啟彈窗閱讀 7 項規定並打勾同意' }}
                    </p>
                  </div>
                </div>

                <button 
                  type="button" 
                  @click="showTermsModal = true"
                  :class="[
                    'px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer shrink-0 shadow-xs active:scale-95',
                    questionnaireForm.agreed_to_terms 
                      ? 'bg-emerald-800 hover:bg-emerald-900 text-white' 
                      : 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse'
                  ]"
                >
                  <Icon name="mdi:file-document-outline" size="16" />
                  <span>{{ questionnaireForm.agreed_to_terms ? '重新檢視規定彈窗' : '開啟規定確認彈窗' }}</span>
                </button>
              </div>

              <!-- 同意勾選框 -->
              <label class="flex items-start gap-2.5 pt-1.5 border-t border-black/5 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  v-model="questionnaireForm.agreed_to_terms" 
                  class="mt-0.5 w-4 h-4 rounded text-[#154337] focus:ring-[#154337] cursor-pointer"
                />
                <span :class="['text-xs leading-relaxed font-bold', questionnaireForm.agreed_to_terms ? 'text-emerald-900' : 'text-amber-900']">
                  本人已了解並同意以上 7 項事項，確認資料屬實並同意接受課程。 <span class="text-rose-500 font-bold">*</span>
                </span>
              </label>
            </div>
          </div>

          <!-- 底部操作按鈕 -->
          <div class="flex justify-end gap-3 pt-2">
            <button 
              type="button" 
              @click="showQuestionnaireModal = false" 
              class="px-5 py-2.5 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition cursor-pointer"
            >
              取消
            </button>
            <button 
              type="submit" 
              :disabled="questionnaireSaving" 
              class="px-6 py-2.5 text-xs font-bold text-white bg-[#154337] hover:bg-[#11352a] rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 shadow-xs disabled:opacity-50"
            >
              <Icon v-if="questionnaireSaving" name="mdi:loading" class="animate-spin" size="16" />
              <span>{{ questionnaireSaving ? '儲存中...' : '確認儲存問卷' }}</span>
            </button>
          </div>

        </form>
      </div>
    </div>

    <!-- 📜 課程服務約定確認事項彈窗 (Terms Modal) -->
    <div v-if="showTermsModal" class="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-60 animate-fade-in">
      <div class="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-5 sm:p-7 relative max-h-[90vh] overflow-y-auto border border-[#154337]/15 space-y-4">
        <!-- 關閉按鈕 -->
        <button 
          @click="showTermsModal = false" 
          class="absolute top-4 right-4 text-gray-400 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-full p-1.5 transition cursor-pointer"
        >
          <Icon name="mdi:close" size="20" />
        </button>

        <!-- 抬頭 -->
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="px-2.5 py-0.5 rounded-full bg-[#154337]/10 text-[#154337] text-[10px] font-mono font-bold uppercase tracking-wider">
              Terms & Service Agreement
            </span>
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          </div>
          <h3 class="text-xl sm:text-2xl font-black text-[#154337] tracking-tight font-serif flex items-center gap-2">
            <Icon name="mdi:file-document-check-outline" class="text-emerald-700" size="26" />
            課程服務約定事項
          </h3>
          <p class="text-xs text-gray-500 mt-1">
            請仔細閱讀以下所有規範，確認後請於下方打勾同意：
          </p>
        </div>

        <!-- 條款清單 -->
        <div class="bg-[#FAF4EE]/80 rounded-2xl p-4 sm:p-5 border border-[#154337]/10 space-y-3 text-xs sm:text-sm text-gray-800 leading-relaxed">
          <div class="font-bold text-[#154337] border-b border-[#154337]/15 pb-2 flex items-center gap-1.5">
            <Icon name="mdi:information-outline" class="text-emerald-700" size="18" />
            <span>本人已了解並同意以下事項：</span>
          </div>

          <ol class="space-y-2.5 pl-1 text-gray-700">
            <li class="flex items-start gap-2.5">
              <span class="w-5 h-5 rounded-full bg-[#154337] text-white flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 font-mono">1</span>
              <span><strong>肌膚更新週期</strong>約 28 天，效果依個人體質不同。</span>
            </li>
            <li class="flex items-start gap-2.5">
              <span class="w-5 h-5 rounded-full bg-[#154337] text-white flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 font-mono">2</span>
              <span>課程後可能出現短暫<strong>泛紅、乾燥、代謝反應</strong>，屬正常現象。</span>
            </li>
            <li class="flex items-start gap-2.5">
              <span class="w-5 h-5 rounded-full bg-[#154337] text-white flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 font-mono">3</span>
              <span>本課程<strong>非醫療行為</strong>，無法保證立即改善。</span>
            </li>
            <li class="flex items-start gap-2.5">
              <span class="w-5 h-5 rounded-full bg-[#154337] text-white flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 font-mono">4</span>
              <span>術後請務必<strong>加強保濕與防曬</strong>。</span>
            </li>
            <li class="flex items-start gap-2.5">
              <span class="w-5 h-5 rounded-full bg-[#154337] text-white flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 font-mono">5</span>
              <span>已主動告知<strong>懷孕、服藥、皮膚疾病</strong>等狀況。</span>
            </li>
            <li class="flex items-start gap-2.5">
              <span class="w-5 h-5 rounded-full bg-[#154337] text-white flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 font-mono">6</span>
              <span>如有不適將立即聯繫<strong>赫璀美學</strong>。</span>
            </li>
            <li class="flex items-start gap-2.5">
              <span class="w-5 h-5 rounded-full bg-[#154337] text-white flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 font-mono">7</span>
              <span>當月活動方案皆為優惠價格，故若需退費按<strong>原價</strong>計算。</span>
            </li>
          </ol>
        </div>

        <!-- 打勾同意卡片 -->
        <label class="flex items-start gap-3 p-3.5 sm:p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-500/50 hover:border-emerald-600 transition cursor-pointer select-none">
          <input 
            type="checkbox" 
            v-model="questionnaireForm.agreed_to_terms" 
            class="mt-0.5 w-5 h-5 rounded text-[#154337] focus:ring-[#154337] cursor-pointer"
          />
          <div class="text-xs sm:text-sm text-emerald-950 font-bold leading-relaxed">
            本人確認資料屬實並同意接受課程
          </div>
        </label>

        <!-- 彈窗底部按鈕 -->
        <div class="flex gap-3 pt-1">
          <button 
            type="button" 
            @click="showTermsModal = false" 
            class="flex-1 py-2.5 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition cursor-pointer"
          >
            返回
          </button>
          <button 
            type="button" 
            @click="agreeTermsAndClose" 
            :disabled="!questionnaireForm.agreed_to_terms"
            class="flex-1 py-2.5 text-xs font-bold text-white bg-[#154337] hover:bg-[#11352a] rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Icon name="mdi:check" size="18" />
            <span>我已了解並同意</span>
          </button>
        </div>

      </div>
    </div>

  </div>
</template>

<style>
.animate-fade-in {
  animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.98) translateY(6px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
.custom-scrollbar::-webkit-scrollbar {
  width: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(21, 67, 55, 0.2);
  border-radius: 3px;
}
</style>