<script setup lang="ts">
import { ref, onMounted, computed, reactive, watch } from 'vue'

// ==========================================
// 1. 環境設定與全域共用狀態
// ==========================================
const config = useRuntimeConfig()
const backendUrl = config.public.backendUrl

const appointments = ref<any[]>([])
const beauticians = ref<any[]>([])
const loading = ref(true)
const errorMessage = ref('')

// ==========================================
// 2. 集中管理 UI 與 Modal 狀態
// ==========================================
const showBeauticianModal = ref(false)
const showClientModal = ref(false)
const showQuestionnaireModal = ref(false)
const showNoteModal = ref(false)

// ==========================================
// 3. 通用輔助函式
// ==========================================
const formatDateToString = (d: Date | null) => {
  if (!d) return ''
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// ==========================================
// 4. 排序與預約操作邏輯
// ==========================================
const sortField = ref<'date' | 'start_time'>('date')
const sortOrder = ref<'asc' | 'desc'>('asc')

const sortAppointments = () => {
  const field = sortField.value
  const order = sortOrder.value
  appointments.value.sort((a, b) => {
    let valA = a[field]
    let valB = b[field]
    if (field === 'date') {
      if (valA < valB) return order === 'asc' ? -1 : 1
      if (valA > valB) return order === 'asc' ? 1 : -1
      if (a.start_time < b.start_time) return order === 'asc' ? -1 : 1
      if (a.start_time > b.start_time) return order === 'asc' ? 1 : -1
      return 0
    } else if (field === 'start_time') {
      if (valA < valB) return order === 'asc' ? -1 : 1
      if (valA > valB) return order === 'asc' ? 1 : -1
      return 0
    }
    return 0
  })
}

const toggleSort = (field: 'date' | 'start_time') => {
  if (sortField.value === field) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    sortOrder.value = 'asc'
  }
  sortAppointments()
}

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
    sortAppointments()
  } catch (err: any) {
    errorMessage.value = err.message
  } finally {
    loading.value = false
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
    fetchBeauticians()
  ])
}

onMounted(() => {
  refreshAllData()
})

// ==========================================
// 6. 搜尋與篩選邏輯
// ==========================================
const searchQuery = ref('')
const searchCodeSuffix = ref('')
const startDateObj = ref<Date | null>(null)
const endDateObj = ref<Date | null>(null)
const startDateFilter = ref('')
const endDateFilter = ref('')
const statusFilter = ref('')

// 🌟 更新 watch 加入防呆邏輯
watch(startDateObj, (newVal) => {
  startDateFilter.value = formatDateToString(newVal)
  // 如果結束日期早於新的開始日期，自動將結束日期對齊開始日期
  if (newVal && endDateObj.value && endDateObj.value < newVal) {
    endDateObj.value = new Date(newVal)
  }
})
watch(endDateObj, (newVal) => {
  endDateFilter.value = formatDateToString(newVal)
})

const filteredAppointments = computed(() => {
  return appointments.value.filter(a => {
    // 1. 姓名或電話搜尋
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.trim().toLowerCase()
      const matchName = a.client_name && a.client_name.toLowerCase().includes(q)
      const matchPhone = a.client_phone && a.client_phone.includes(q)
      if (!matchName && !matchPhone) return false
    }
    // 2. 預約單號搜尋
    if (searchCodeSuffix.value.trim()) {
      const codeQ = searchCodeSuffix.value.trim().toUpperCase()
      const fullCode = (a.appointment_code || '').toUpperCase()
      if (!fullCode.endsWith(codeQ) && !fullCode.includes(codeQ)) return false
    }
    // 3. 日期區間篩選
    if (startDateFilter.value && endDateFilter.value) {
      if (a.date < startDateFilter.value || a.date > endDateFilter.value) return false
    } else if (startDateFilter.value) {
      if (a.date < startDateFilter.value) return false
    } else if (endDateFilter.value) {
      if (a.date > endDateFilter.value) return false
    }
    // 4. 目前狀態篩選
    if (statusFilter.value) {
      if (a.status !== statusFilter.value) return false
    }
    
    return true
  })
})

const clearAllFilters = () => {
  searchQuery.value = ''
  searchCodeSuffix.value = ''
  startDateObj.value = null
  endDateObj.value = null
  startDateFilter.value = ''
  endDateFilter.value = ''
  statusFilter.value = '' 
}

const hasActiveFilters = computed(() => {
  return !!(searchQuery.value || searchCodeSuffix.value || startDateFilter.value || endDateFilter.value || statusFilter.value)
})

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

// ==========================================
// 10. 點收與課程扣堂模組 (Complete & Course Deduction)
// ==========================================
const showCompleteModal = ref(false)
const selectedApptForComplete = ref<any>(null)
const clientActivePackages = ref<any[]>([])
const loadingPackages = ref(false)
const availableCoursesList = ref<any[]>([])

// 紀錄勾選要扣除的既有課程：[user_course_id] = use_count
const selectedCoursesToDeduct = reactive<Record<number, number>>({})

// 紀錄當下新購買並使用的課程
const newCoursesToBuy = ref<Array<{ course_id: string | number, buy_amount: number, use_count: number, payment_method: string }>>([])

const openCompleteModal = async (appt: any) => {
  selectedApptForComplete.value = appt
  showCompleteModal.value = true
  loadingPackages.value = true
  
  // 清空狀態
  for (const key in selectedCoursesToDeduct) delete selectedCoursesToDeduct[key]
  newCoursesToBuy.value = []

  try {
    // 平行抓取客戶剩餘包套 & 全店所有課程項目
    const [pkgRes, courseRes] = await Promise.all([
      fetch(`${backendUrl}/api/users-courses?user_id=${appt.user_id}&has_remaining=true`),
      fetch(`${backendUrl}/api/courses`)
    ])
    
    if (pkgRes.ok) {
      const pkgData = await pkgRes.json()
      clientActivePackages.value = pkgData.data || []
    }
    
    if (courseRes.ok) {
      const courseData = await courseRes.json()
      availableCoursesList.value = courseData.data || []
    }
  } catch (err) {
    console.error("撈取點收資料失敗", err)
  } finally {
    loadingPackages.value = false
  }
}

// 點擊既有包套卡片切換勾選狀態
const toggleCourseSelection = (userCourseId: number) => {
  if (selectedCoursesToDeduct[userCourseId] !== undefined) {
    delete selectedCoursesToDeduct[userCourseId]
  } else {
    selectedCoursesToDeduct[userCourseId] = 1 // 預設扣減 1 堂
  }
}

// 新增現場加購項目
const addNewCoursePurchase = () => {
  newCoursesToBuy.value.push({
    course_id: '',
    buy_amount: 1,
    use_count: 1,
    payment_method: 'Cash'
  })
}

// 刪除現場加購項目
const removeNewCoursePurchase = (index: number) => {
  newCoursesToBuy.value.splice(index, 1)
}

// 送出點收完成
const submitCompleteAppointment = async () => {
  if (!selectedApptForComplete.value) return

  const courses_used = Object.entries(selectedCoursesToDeduct).map(([id, count]) => ({
    user_course_id: Number(id),
    use_count: Number(count)
  }))

  const new_courses_bought = newCoursesToBuy.value
    .filter(c => c.course_id !== '') 
    .map(c => ({
      course_id: Number(c.course_id),
      buy_amount: Number(c.buy_amount),
      use_count: Number(c.use_count),
      payment_method: c.payment_method
    }))

  try {
    const res = await fetch(`${backendUrl}/api/appointments/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appointment_id: selectedApptForComplete.value.id,
        courses_used,
        new_courses_bought,
        date: selectedApptForComplete.value.date
      })
    })

    if (!res.ok) {
      const errData = await res.json()
      throw new Error(errData.error || "點收失敗")
    }

    alert("✅ 預約已完成點收，堂數扣減與營收認列已成功！")
    showCompleteModal.value = false
    refreshAllData() // 更新預約列表與狀態
  } catch (err: any) {
    alert(err.message)
  }
}
</script>

<template>
  <div class="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
    
    <!-- 頂部抬頭區 -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6 md:mb-8">
      <div>
        <h2 class="text-2xl md:text-3xl font-bold text-[#154337] title-serif mb-1 md:mb-2">預約清單管理</h2>
        <p class="text-gray-500 text-xs md:text-sm">查看與管理所有預約資料</p>
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

    <!-- 預約清單主體 -->
    <div class="bg-white rounded-2xl shadow-sm border border-[#C7CDCE] p-4 sm:p-6 md:p-8 mb-8">
      <div class="flex flex-col gap-4 mb-6 border-b border-gray-100 pb-6">
        <div class="flex justify-between items-center">
          <h3 class="text-lg md:text-xl font-bold text-[#154337] flex items-center gap-2">
            <Icon name="mdi:format-list-bulleted" size="22" /> 預約總表清單
          </h3>
          <button v-if="hasActiveFilters" @click="clearAllFilters" class="text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 px-2.5 py-1.5 rounded-lg font-bold transition flex items-center gap-1">
            <Icon name="mdi:filter-off" size="14" /> 清除篩選
          </button>
        </div>

        <!-- 搜尋工具列 -->
        <div class="grid grid-cols-2 lg:grid-cols-5 gap-3 bg-gray-50 p-3 md:p-4 rounded-xl border border-gray-200 items-end">
          <div class="col-span-2 lg:col-span-1">
            <label class="block text-xs font-bold text-gray-500 mb-1">顧客姓名 / 電話</label>
            <div class="relative">
              <Icon name="mdi:magnify" size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" v-model="searchQuery" placeholder="搜尋姓名或電話..." class="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-[#154337] bg-white h-[38px]" />
            </div>
          </div>
          
          <div class="col-span-2 lg:col-span-1">
            <label class="block text-xs font-bold text-gray-500 mb-1">預約單號 (六碼)</label>
            <div class="flex items-center border border-gray-300 rounded-lg bg-white overflow-hidden focus-within:ring-2 focus-within:ring-[#154337] h-[38px]">
              <span class="bg-gray-100 text-gray-700 font-bold px-2.5 py-2 text-xs border-r border-gray-300 select-none">RV-</span>
              <input type="text" v-model="searchCodeSuffix" placeholder="例如：A8X9K2" maxlength="6" class="w-full px-2.5 py-2 text-xs focus:outline-none font-mono uppercase" />
            </div>
          </div>
          
          <!-- 目前狀態篩選 -->
          <div class="col-span-2 sm:col-span-1 lg:col-span-1">
            <label class="block text-xs font-bold text-gray-500 mb-1">目前狀態</label>
            <select v-model="statusFilter" class="w-full border border-gray-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-[#154337] bg-white h-[38px] outline-none">
              <option value="">全部狀態</option>
              <option value="pending">審核中</option>
              <option value="confirmed">已確認</option>
              <option value="complete">已完成</option>
              <option value="cancelled">已取消</option>
            </select>
          </div>

          <div class="col-span-1">
            <label class="block text-xs font-bold text-gray-500 mb-1">日期 (開始)</label>
            <ClientOnly>
              <MyCalendar v-model="startDateObj" placeholder="選擇開始日期" class="compact-date-picker" />
            </ClientOnly>
          </div>
          
          <div class="col-span-1">
            <label class="block text-xs font-bold text-gray-500 mb-1">日期 (結束)</label>
            <ClientOnly>
              <!-- 🌟 加入 :min-date 限制 -->
              <MyCalendar 
                v-model="endDateObj" 
                placeholder="選擇結束日期" 
                :min-date="startDateObj" 
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
        <!-- 手機端卡片設計 -->
        <div class="block md:hidden space-y-4">
          <div v-for="appt in filteredAppointments" :key="appt.id" class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-3">
            <div class="flex justify-between items-start border-b border-gray-100 pb-3">
              <div class="flex flex-col gap-1">
                <span class="text-[15px] font-black text-[#154337]">{{ appt.date }} <span class="text-gray-400 mx-1">|</span> {{ appt.start_time }}</span>
                <span class="font-mono text-xs text-gray-400">預約單號：{{ appt.appointment_code || '-' }}</span>
              </div>
              <span :class="['px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 mt-0.5', appt.status === 'complete' ? 'bg-blue-100 text-blue-700' : appt.status === 'confirmed' ? 'bg-green-100 text-green-700' : appt.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800']">
                {{ appt.status === 'complete' ? '已完成' : appt.status === 'confirmed' ? '已確認' : appt.status === 'cancelled' ? '已取消' : '審核中' }}
              </span>
            </div>
            <div class="flex flex-col gap-2.5 bg-gray-50/70 p-3 rounded-lg border border-gray-100">
              <div class="flex justify-between items-center">
                <span class="text-xs text-gray-500 font-bold">客戶姓名</span>
                <button @click="openClientModal(appt)" class="text-[#154337] font-bold text-sm flex items-center gap-1">
                  <span class="underline decoration-dotted underline-offset-2">{{ appt.client_name }}</span>
                  <span v-if="appt.visit_count > 0" class="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full ml-1 font-black">{{ appt.visit_count }}次</span>
                </button>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-xs text-gray-500 font-bold">美容師指派</span>
                <select :value="appt.beautician_id || ''" @change="updateAppointmentBeautician(appt.id, ($event.target as HTMLSelectElement).value)" class="border border-gray-300 rounded p-1.5 text-xs bg-white focus:ring-1 focus:ring-[#154337] min-w-[110px] max-w-[140px]">
                  <option value="">未指派</option>
                  <option v-for="b in beauticians" :key="b.id" :value="b.id">{{ b.name }}</option>
                </select>
              </div>
            </div>
            <div class="pt-1 flex flex-col gap-2">
              <button @click="openNoteModal(appt)" class="w-full py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-xs font-bold text-[#154337] flex justify-center items-center gap-1.5 transition">
                <Icon name="mdi:note-edit-outline" size="16" />
                {{ appt.notes ? '查看 / 編輯備註' : '新增預約備註' }}
              </button>
              <div class="flex gap-2 w-full mt-1">
                <button v-if="!appt.status || appt.status === 'pending'" @click="updateAppointmentStatus(appt.id, 'confirmed')" class="flex-1 py-2.5 text-xs bg-green-600 text-white rounded-lg font-bold">核准</button>
                
                <button v-if="appt.status === 'confirmed'" @click="openCompleteModal(appt)" class="flex-1 py-2.5 text-xs bg-blue-600 text-white rounded-lg font-bold">完成</button>
                
                <button v-if="appt.status === 'complete'" @click="updateAppointmentStatus(appt.id, 'confirmed')" class="flex-1 py-2.5 text-xs bg-orange-500 text-white rounded-lg font-bold">未完成</button>
                <button v-if="appt.status !== 'cancelled' && appt.status !== 'complete'" @click="updateAppointmentStatus(appt.id, 'cancelled')" class="flex-1 py-2.5 text-xs bg-red-50 text-red-600 border border-red-100 rounded-lg font-bold">取消</button>
              </div>
            </div>
          </div>
        </div>

        <!-- 桌機表格 -->
        <div class="hidden md:block overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider bg-gray-50">
                <th class="p-3.5 font-medium rounded-tl-lg">狀態</th>
                <th class="p-3.5 font-medium">預約單號</th>
                <th class="p-3.5 font-medium cursor-pointer hover:text-[#154337] select-none" @click="toggleSort('date')">
                  預約日期 <Icon :name="sortField === 'date' ? (sortOrder === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down') : 'mdi:sort'" size="14" class="inline ml-1" />
                </th>
                <th class="p-3.5 font-medium cursor-pointer hover:text-[#154337] select-none" @click="toggleSort('start_time')">
                  時間區間 <Icon :name="sortField === 'start_time' ? (sortOrder === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down') : 'mdi:sort'" size="14" class="inline ml-1" />
                </th>
                <th class="p-3.5 font-medium">負責美容師</th>
                <th class="p-3.5 font-medium">客戶姓名</th>
                <th class="p-3.5 font-medium">聯絡電話</th>
                <th class="p-3.5 font-medium min-w-[120px]">預約單筆備註</th>
                <th class="p-3.5 font-medium text-right rounded-tr-lg">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 text-sm">
              <tr v-for="appt in filteredAppointments" :key="appt.id" class="hover:bg-gray-50 transition">
                <td class="p-3.5 whitespace-nowrap">
                  <span :class="['px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap inline-block', appt.status === 'complete' ? 'bg-blue-100 text-blue-700' : appt.status === 'confirmed' ? 'bg-green-100 text-green-700' : appt.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800']">
                    {{ appt.status === 'complete' ? '已完成' : appt.status === 'confirmed' ? '已確認' : appt.status === 'cancelled' ? '已取消' : '審核中' }}
                  </span>
                </td>
                <td class="p-3.5 font-mono text-xs font-bold text-gray-700">{{ appt.appointment_code || '-' }}</td>
                <td class="p-3.5 font-semibold text-gray-800">{{ appt.date }}</td>
                <td class="p-3.5 text-[#154337] font-bold">{{ appt.start_time }} ~ {{ appt.end_time }}</td>
                <td class="p-3.5">
                  <select :value="appt.beautician_id || ''" @change="updateAppointmentBeautician(appt.id, ($event.target as HTMLSelectElement).value)" class="border border-gray-300 rounded-lg p-1.5 text-xs bg-white focus:ring-1 focus:ring-[#154337]">
                    <option value="">未指派</option>
                    <option v-for="b in beauticians" :key="b.id" :value="b.id">{{ b.name }}</option>
                  </select>
                </td>
                <td class="p-3.5 font-medium">
                  <button @click="openClientModal(appt)" class="text-[#154337] font-bold underline decoration-dotted hover:text-black transition flex items-center gap-1">
                    {{ appt.client_name }}
                    <span v-if="appt.visit_count > 0" class="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-black">履約 {{ appt.visit_count }} 次</span>
                    <Icon name="mdi:chevron-right" size="16" class="text-gray-400" />
                  </button>
                </td>
                <td class="p-3.5 text-gray-600">{{ appt.client_phone }}</td>
                <td class="p-3.5">
                  <button @click="openNoteModal(appt)" class="text-xs text-[#154337] hover:underline font-bold px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition whitespace-nowrap flex items-center gap-1">
                    <Icon name="mdi:note-edit-outline" size="14" />
                    查看備註
                  </button>
                </td>
                <td class="p-3.5 text-right space-x-2 whitespace-nowrap">
                  <button v-if="!appt.status || appt.status === 'pending'" @click="updateAppointmentStatus(appt.id, 'confirmed')" class="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition">核准</button>
                  
                  <button v-if="appt.status === 'confirmed'" @click="openCompleteModal(appt)" class="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition">完成</button>
                  
                  <button v-if="appt.status === 'complete'" @click="updateAppointmentStatus(appt.id, 'confirmed')" class="text-xs bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600 transition">未完成</button>
                  <button v-if="appt.status !== 'cancelled' && appt.status !== 'complete'" @click="updateAppointmentStatus(appt.id, 'cancelled')" class="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-100 transition">取消</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 結帳點收 Modal -->
    <div v-if="showCompleteModal && selectedApptForComplete" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 relative max-h-[90vh] overflow-y-auto">
        <button @click="showCompleteModal = false" class="absolute top-3 right-3 text-gray-400 hover:text-gray-800 bg-gray-100 rounded-full p-1 transition">
          <Icon name="mdi:close" size="22" />
        </button>

        <h3 class="text-lg font-bold text-[#154337] mb-1 flex items-center gap-2">
          <Icon name="mdi:check-circle-outline" size="22" /> 預約完成點收
        </h3>
        <p class="text-xs text-gray-500 mb-4">
          客戶：<span class="font-bold text-gray-800">{{ selectedApptForComplete.client_name }}</span> | 
          時間：{{ selectedApptForComplete.date }} {{ selectedApptForComplete.start_time }}
        </p>

        <!-- 客戶可用包套清單 -->
        <div class="space-y-3 my-4">
          <p class="text-sm font-bold text-gray-700 border-b border-gray-100 pb-1">1. 扣減既有包套</p>
          
          <div v-if="loadingPackages" class="text-xs text-gray-400 py-2 text-center">載入客戶包套中...</div>
          <div v-else-if="clientActivePackages.length === 0" class="p-3 bg-amber-50 text-amber-800 rounded-xl text-xs border border-amber-200">
            該客戶目前沒有可用的剩餘包套。
          </div>

          <div 
            v-else 
            v-for="pkg in clientActivePackages" 
            :key="pkg.id"
            :class="['p-3 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between cursor-pointer gap-2', selectedCoursesToDeduct[pkg.id] !== undefined ? 'border-[#154337] bg-[#154337]/5' : 'border-gray-200 bg-white']"
            @click="toggleCourseSelection(pkg.id)"
          >
            <div class="flex items-center gap-3">
              <input 
                type="checkbox" 
                :checked="selectedCoursesToDeduct[pkg.id] !== undefined"
                class="w-4 h-4 text-[#154337] rounded border-gray-300"
              />
              <div>
                <p class="text-sm font-bold text-gray-800">{{ pkg.course_name }}</p>
                <p class="text-xs text-gray-500 mt-0.5">剩餘：<span class="font-bold text-[#154337]">{{ pkg.remaining_count }}</span> 堂</p>
              </div>
            </div>

            <!-- 堂數選擇 (若有勾選) -->
            <div v-if="selectedCoursesToDeduct[pkg.id] !== undefined" class="flex items-center gap-2 self-end sm:self-auto bg-white p-1 rounded-lg border border-gray-200 shadow-sm" @click.stop>
              <span class="text-xs text-gray-500 font-bold ml-1">扣除</span>
              <input 
                type="number" 
                v-model.number="selectedCoursesToDeduct[pkg.id]"
                min="1" 
                :max="pkg.remaining_count"
                class="w-12 border border-gray-300 rounded p-1 text-center text-xs font-bold focus:ring-1 focus:ring-[#154337]"
              />
              <span class="text-xs text-gray-500 mr-1">堂</span>
            </div>
          </div>
        </div>

        <!-- 當下新購買並使用 -->
        <div class="space-y-3 mt-6">
          <div class="flex justify-between items-center border-b border-gray-100 pb-1">
            <p class="text-sm font-bold text-gray-700">2. 現場加購 / 當下購買即使用</p>
            <button type="button" @click="addNewCoursePurchase" class="text-xs text-[#154337] font-bold hover:underline bg-gray-50 px-2 py-1 rounded border border-gray-200">
              + 新增項目
            </button>
          </div>

          <div v-if="newCoursesToBuy.length === 0" class="text-xs text-gray-400 italic py-2">
            無現場加購項目。
          </div>

          <div v-for="(newCourse, index) in newCoursesToBuy" :key="index" class="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-2 relative">
            <button @click="removeNewCoursePurchase(index)" class="absolute top-2 right-2 text-red-400 hover:text-red-600 bg-white rounded-full p-0.5 shadow-sm">
              <Icon name="mdi:close" size="16" />
            </button>
            
            <div>
              <label class="block text-xs font-bold text-gray-600 mb-1">選擇課程</label>
              <select v-model="newCourse.course_id" class="w-full border border-gray-300 rounded p-1.5 text-xs bg-white focus:ring-1 focus:ring-[#154337]">
                <option value="" disabled>請選擇課程...</option>
                <option v-for="c in availableCoursesList" :key="c.id" :value="c.id">{{ c.name }} (單價 ${{ c.price }})</option>
              </select>
            </div>
            
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-[10px] font-bold text-gray-600 mb-1">購買總堂數</label>
                <input type="number" v-model.number="newCourse.buy_amount" min="1" class="w-full border border-gray-300 rounded p-1.5 text-xs focus:ring-1 focus:ring-[#154337]" />
              </div>
              <div>
                <label class="block text-[10px] font-bold text-gray-600 mb-1">本次消耗堂數</label>
                <input type="number" v-model.number="newCourse.use_count" min="1" :max="newCourse.buy_amount" class="w-full border border-gray-300 rounded p-1.5 text-xs focus:ring-1 focus:ring-[#154337]" />
              </div>
            </div>

            <div>
              <label class="block text-[10px] font-bold text-gray-600 mb-1">付款方式</label>
              <select v-model="newCourse.payment_method" class="w-full border border-gray-300 rounded p-1.5 text-xs bg-white focus:ring-1 focus:ring-[#154337]">
                <option value="Cash">現金 (Cash)</option>
                <option value="Line Pay">Line Pay</option>
                <option value="Credit Card">信用卡</option>
                <option value="Transfer">匯款</option>
              </select>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
          <button @click="showCompleteModal = false" class="px-4 py-2 text-xs font-bold bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300">取消</button>
          <button @click="submitCompleteAppointment" class="px-4 py-2 text-xs font-bold bg-[#154337] text-white rounded-xl hover:bg-opacity-90">
            確定完成並點收
          </button>
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
.compact-date-picker input {
  padding-top: 0.5rem !important;
  padding-bottom: 0.5rem !important;
  padding-left: 0.75rem !important;
  padding-right: 0.75rem !important;
  font-size: 0.75rem !important;
  height: 38px !important;
}
</style>