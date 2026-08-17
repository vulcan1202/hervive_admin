<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'

// ==========================================
// 1. 核心狀態與資料載入
// ==========================================
const config = useRuntimeConfig()
const backendUrl = config.public.backendUrl || ''

const appointments = ref<any[]>([])
const beauticians = ref<any[]>([])
const loading = ref(false)

// ==========================================
// 2. 集中管理 UI 與 Modal 狀態
// ==========================================
const showClientModal = ref(false)
const showQuestionnaireModal = ref(false)
const showTermsModal = ref(false)
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

// 取得台灣時間當前年月
const getNowTaiwanYearMonth = () => {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  return { yyyy, mm, full: `${yyyy}-${mm}` }
}

// ==========================================
// 4. 排序邏輯
// ==========================================
const sortField = ref<'date' | 'start_time'>('date')
const sortOrder = ref<'asc' | 'desc'>('desc')

const sortAppointments = () => {
  const field = sortField.value
  const order = sortOrder.value
  appointments.value.sort((a, b) => {
    let valA = a[field] || ''
    let valB = b[field] || ''
    if (field === 'date' && valA === valB) {
      valA = a.start_time || ''
      valB = b.start_time || ''
    }
    if (valA < valB) return order === 'asc' ? -1 : 1
    if (valA > valB) return order === 'asc' ? 1 : -1
    return 0
  })
}

const toggleSort = (field: 'date' | 'start_time') => {
  if (sortField.value === field) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    sortOrder.value = 'desc'
  }
  sortAppointments()
}

// ==========================================
// 5. 異動美容師與預約狀態
// ==========================================
const updateAppointmentBeautician = async (apptId: number, beauticianId: any) => {
  try {
    const res = await fetch(`${backendUrl}/api/appointments`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: apptId, beautician_id: beauticianId ? Number(beauticianId) : null })
    })
    if (!res.ok) throw new Error('指派美容師失敗')
    fetchAllCompletedAppointments()
  } catch (err: any) {
    alert(err.message || '操作失敗')
  }
}

const revertAppointmentStatus = async (id: number) => {
  const currentAppt = appointments.value.find(a => a.id === id)
  if (!confirm(`確定要將預約單號「${currentAppt?.appointment_code || id}」反向還原為「已確認 (待履約)」狀態嗎？`)) {
    return
  }

  try {
    const res = await fetch(`${backendUrl}/api/appointments`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'confirmed' })
    })
    if (!res.ok) throw new Error('狀態更新失敗')
    alert('✅ 已成功將該筆預約還原為待履約狀態！')
    fetchAllCompletedAppointments()
  } catch (err: any) {
    alert(err.message || '操作失敗')
  }
}

// ==========================================
// 6. 讀取已完成預約資料
// ==========================================
const fetchAllCompletedAppointments = async () => {
  loading.value = true
  try {
    const res = await fetch(`${backendUrl}/api/appointments`)
    if (!res.ok) throw new Error('載入預約列表失敗')
    const result = await res.json()
    // 只保留已完成 (status === 'complete') 的預約
    appointments.value = (result.data || [])
      .filter((item: any) => item.status === 'complete')
      .map((item: any) => ({
        ...item,
        editUserNotes: item.user_notes || ''
      }))
    sortAppointments()
  } catch (err: any) {
    console.error('載入已完成預約失敗:', err)
  } finally {
    loading.value = false
  }
}

const fetchBeauticians = async () => {
  try {
    const res = await fetch(`${backendUrl}/api/beauticians`)
    if (res.ok) {
      beauticians.value = (await res.json()).data || []
    }
  } catch (err) {
    console.error('載入美容師失敗:', err)
  }
}

const refreshAllData = async () => {
  await Promise.all([
    fetchAllCompletedAppointments(),
    fetchBeauticians()
  ])
}

// ==========================================
// 7. 搜尋與篩選邏輯 (時間選擇一律套用 MyCalendar)
// ==========================================
const searchQuery = ref('')
const searchCodeSuffix = ref('')
const selectedBeautician = ref('')
const startDateObj = ref<Date | null>(null)
const endDateObj = ref<Date | null>(null)
const startDateFilter = ref('')
const endDateFilter = ref('')

watch(startDateObj, (newVal) => {
  startDateFilter.value = formatDateToString(newVal)
  if (newVal && endDateObj.value && endDateObj.value < newVal) {
    endDateObj.value = new Date(newVal)
  }
})
watch(endDateObj, (newVal) => {
  endDateFilter.value = formatDateToString(newVal)
})

// 快捷月份範圍設定
const setThisMonth = () => {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  startDateObj.value = new Date(y, m, 1)
  endDateObj.value = new Date(y, m + 1, 0)
}

const setPrevMonth = () => {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() - 1
  startDateObj.value = new Date(y, m, 1)
  endDateObj.value = new Date(y, m + 1, 0)
}

const filteredAppointments = computed(() => {
  return appointments.value.filter(a => {
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.trim().toLowerCase()
      const matchName = a.client_name && a.client_name.toLowerCase().includes(q)
      const matchPhone = a.client_phone && a.client_phone.includes(q)
      if (!matchName && !matchPhone) return false
    }
    if (searchCodeSuffix.value.trim()) {
      const codeQ = searchCodeSuffix.value.trim().toUpperCase()
      const fullCode = (a.appointment_code || '').toUpperCase()
      if (!fullCode.endsWith(codeQ) && !fullCode.includes(codeQ)) return false
    }
    if (selectedBeautician.value) {
      if (String(a.beautician_id) !== String(selectedBeautician.value)) return false
    }
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

const clearAllFilters = () => {
  searchQuery.value = ''
  searchCodeSuffix.value = ''
  selectedBeautician.value = ''
  startDateObj.value = null
  endDateObj.value = null
  startDateFilter.value = ''
  endDateFilter.value = ''
}

const hasActiveFilters = computed(() => {
  return !!(searchQuery.value || searchCodeSuffix.value || selectedBeautician.value || startDateFilter.value || endDateFilter.value)
})

// KPI 統計卡片
const totalCompletedCount = computed(() => appointments.value.length)
const thisMonthCompletedCount = computed(() => {
  const ym = getNowTaiwanYearMonth().full
  return appointments.value.filter(a => (a.date || '').startsWith(ym)).length
})
const todayCompletedCount = computed(() => {
  const today = formatDateToString(new Date())
  return appointments.value.filter(a => a.date === today).length
})

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
    fetchAllCompletedAppointments()
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
    fetchAllCompletedAppointments()
  } catch (err: any) {
    alert(err.message || '操作失敗')
  }
}

// 初始化資料
onMounted(() => {
  refreshAllData()
})
</script>

<template>
  <div class="max-w-7xl mx-auto space-y-6 pb-12">
    
    <!-- 頂部標題與快速操作區 (Double-Bezel 雙層外框) -->
    <div class="p-1 bg-[#154337]/5 border border-[#154337]/10 rounded-2xl md:rounded-3xl shadow-xs">
      <div class="bg-white rounded-[calc(1rem-2px)] md:rounded-[calc(1.5rem-2px)] p-4 sm:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="px-2.5 py-0.5 rounded-full bg-[#154337]/10 text-[#154337] text-[10px] font-mono font-bold uppercase tracking-wider">
              Fulfilled Records
            </span>
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          </div>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-[#154337] tracking-tight font-serif flex items-center gap-2">
            <Icon name="mdi:calendar-check" class="text-emerald-700" size="28" />
            已完成預約管理專區
          </h1>
          <p class="text-gray-500 text-xs sm:text-sm mt-0.5">
            完整檢視歷史到店履約紀錄、服務美容師、單據備註與顧客初填問卷
          </p>
        </div>
        
        <div class="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <NuxtLink 
            to="/Appointment" 
            class="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95 shadow-xs transition duration-200 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Icon name="mdi:arrow-left" size="18" />
            <span>返回待履約預約清單</span>
          </NuxtLink>
          <button 
            @click="refreshAllData" 
            class="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#154337] text-white hover:bg-[#11352a] active:scale-95 shadow-xs transition duration-200 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Icon name="mdi:refresh" size="18" :class="{ 'animate-spin': loading }" />
            <span>重新整理</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 4 大核心 KPI 統計卡片 -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="p-1 bg-[#154337]/5 border border-[#154337]/15 rounded-2xl md:rounded-3xl shadow-xs">
        <div class="bg-white rounded-[calc(1rem-2px)] md:rounded-[calc(1.5rem-2px)] p-4 sm:p-5 flex items-center justify-between">
          <div>
            <span class="text-xs font-bold text-gray-500">累計已完成預約</span>
            <div class="text-2xl sm:text-3xl font-black text-[#154337] font-mono mt-1">
              {{ totalCompletedCount }} <span class="text-xs font-normal text-gray-400">筆</span>
            </div>
          </div>
          <div class="w-11 h-11 rounded-2xl bg-[#154337]/10 text-[#154337] flex items-center justify-center border border-[#154337]/20">
            <Icon name="mdi:check-all" class="text-2xl" />
          </div>
        </div>
      </div>

      <div class="p-1 bg-emerald-500/5 border border-emerald-500/15 rounded-2xl md:rounded-3xl shadow-xs">
        <div class="bg-white rounded-[calc(1rem-2px)] md:rounded-[calc(1.5rem-2px)] p-4 sm:p-5 flex items-center justify-between">
          <div>
            <span class="text-xs font-bold text-gray-500">當月完成履約數</span>
            <div class="text-2xl sm:text-3xl font-black text-emerald-700 font-mono mt-1">
              {{ thisMonthCompletedCount }} <span class="text-xs font-normal text-gray-400">筆</span>
            </div>
          </div>
          <div class="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
            <Icon name="mdi:calendar-month-outline" class="text-2xl" />
          </div>
        </div>
      </div>

      <div class="p-1 bg-blue-500/5 border border-blue-500/15 rounded-2xl md:rounded-3xl shadow-xs">
        <div class="bg-white rounded-[calc(1rem-2px)] md:rounded-[calc(1.5rem-2px)] p-4 sm:p-5 flex items-center justify-between">
          <div>
            <span class="text-xs font-bold text-gray-500">今日完成到店</span>
            <div class="text-2xl sm:text-3xl font-black text-blue-700 font-mono mt-1">
              {{ todayCompletedCount }} <span class="text-xs font-normal text-gray-400">筆</span>
            </div>
          </div>
          <div class="w-11 h-11 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200">
            <Icon name="mdi:clock-check-outline" class="text-2xl" />
          </div>
        </div>
      </div>

      <div class="p-1 bg-purple-500/5 border border-purple-500/15 rounded-2xl md:rounded-3xl shadow-xs">
        <div class="bg-white rounded-[calc(1rem-2px)] md:rounded-[calc(1.5rem-2px)] p-4 sm:p-5 flex items-center justify-between">
          <div>
            <span class="text-xs font-bold text-gray-500">當前篩選筆數</span>
            <div class="text-2xl sm:text-3xl font-black text-purple-700 font-mono mt-1">
              {{ filteredAppointments.length }} <span class="text-xs font-normal text-gray-400">筆</span>
            </div>
          </div>
          <div class="w-11 h-11 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-200">
            <Icon name="mdi:filter-outline" class="text-2xl" />
          </div>
        </div>
      </div>
    </div>

    <!-- 已完成預約清單主體 (Double-Bezel 雙層外框) -->
    <div class="p-1 bg-[#154337]/5 border border-[#154337]/10 rounded-2xl md:rounded-3xl shadow-xs">
      <div class="bg-white rounded-[calc(1rem-2px)] md:rounded-[calc(1.5rem-2px)] p-4 sm:p-6">
        
        <!-- 頂部與工具列 -->
        <div class="flex flex-col gap-4 mb-6 border-b border-gray-100 pb-6">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 class="text-lg sm:text-xl font-bold text-[#154337] flex items-center gap-2 font-serif">
              <Icon name="mdi:clipboard-check-multiple-outline" class="text-emerald-700" size="22" /> 
              已完成預約清單 ({{ filteredAppointments.length }} 筆)
            </h3>
            
            <div class="flex items-center gap-2">
              <!-- 快捷月份按鈕組 -->
              <div class="flex items-center gap-1 bg-[#FAF4EE] p-1 rounded-xl border border-[#154337]/10 text-xs">
                <button 
                  @click="setThisMonth" 
                  class="px-2.5 py-1 bg-white text-gray-700 hover:text-[#154337] rounded-lg font-bold transition shadow-2xs hover:bg-[#FAF4EE]"
                >
                  本月
                </button>
                <button 
                  @click="setPrevMonth" 
                  class="px-2.5 py-1 bg-white text-gray-700 hover:text-[#154337] rounded-lg font-bold transition shadow-2xs hover:bg-[#FAF4EE]"
                >
                  上月
                </button>
              </div>

              <button 
                v-if="hasActiveFilters" 
                @click="clearAllFilters" 
                class="text-xs bg-rose-50 text-rose-700 hover:bg-rose-100 px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1 cursor-pointer border border-rose-200"
              >
                <Icon name="mdi:filter-off" size="14" /> 清除篩選
              </button>
            </div>
          </div>

          <!-- 高視覺密度搜尋與篩選列 (時間選擇一律套用 MyCalendar) -->
          <div class="grid grid-cols-2 lg:grid-cols-5 gap-3 bg-[#FAF4EE]/60 p-3.5 sm:p-4 rounded-2xl border border-[#154337]/10 items-end">
            
            <!-- 搜尋名字或電話 -->
            <div class="col-span-2 lg:col-span-1">
              <label class="block text-[11px] font-bold text-gray-600 mb-1">顧客姓名 / 電話</label>
              <div class="relative">
                <Icon name="mdi:magnify" size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  v-model="searchQuery" 
                  placeholder="搜尋姓名或電話..." 
                  class="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-[#154337] bg-white h-[38px] outline-none" 
                />
              </div>
            </div>
            
            <!-- 預約單號搜尋 -->
            <div class="col-span-2 lg:col-span-1">
              <label class="block text-[11px] font-bold text-gray-600 mb-1">預約單號 (六碼)</label>
              <div class="flex items-center border border-gray-300 rounded-xl bg-white overflow-hidden focus-within:ring-2 focus-within:ring-[#154337] h-[38px]">
                <span class="h-full flex items-center bg-gray-100 text-gray-700 font-bold px-3 text-xs font-mono border-r border-gray-300 select-none shrink-0">RV-</span>
                <input type="text" v-model="searchCodeSuffix" placeholder="例如：A8X9K2" maxlength="6" class="w-full h-full px-2.5 text-xs focus:outline-none font-mono uppercase" />
              </div>
            </div>

            <!-- 美容師篩選 -->
            <div class="col-span-2 sm:col-span-1 lg:col-span-1">
              <label class="block text-[11px] font-bold text-gray-600 mb-1">服務美容師</label>
              <select v-model="selectedBeautician" class="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#154337] bg-white h-[38px] outline-none font-medium">
                <option value="">全部美容師</option>
                <option v-for="b in beauticians" :key="b.id" :value="b.id">{{ b.name }}</option>
              </select>
            </div>

            <!-- 開始日期 (套用 MyCalendar 套件) -->
            <div class="col-span-1">
              <label class="block text-[11px] font-bold text-gray-600 mb-1">履約日期 (開始)</label>
              <ClientOnly>
                <MyCalendar v-model="startDateObj" placeholder="選擇開始日期" class="compact-date-picker" />
              </ClientOnly>
            </div>
            
            <!-- 結束日期 (套用 MyCalendar 套件) -->
            <div class="col-span-1">
              <label class="block text-[11px] font-bold text-gray-600 mb-1">履約日期 (結束)</label>
              <ClientOnly>
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

        <!-- 數據為空提示 -->
        <div v-if="filteredAppointments.length === 0" class="text-center py-14 text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-xs sm:text-sm space-y-2">
          <Icon name="mdi:calendar-blank-outline" class="text-4xl text-gray-300" />
          <p>{{ hasActiveFilters ? '找不到符合篩選條件的已完成預約紀錄。' : '目前尚無已完成的預約紀錄。' }}</p>
        </div>

        <!-- 📱 手機版卡片視圖 (lg:hidden) -->
        <div v-else class="grid grid-cols-1 gap-3.5 lg:hidden">
          <div 
            v-for="appt in filteredAppointments" 
            :key="appt.id" 
            class="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs space-y-3 relative hover:border-[#154337]/30 transition"
          >
            <!-- 卡片頂部 -->
            <div class="flex justify-between items-start border-b border-gray-100 pb-2.5">
              <div>
                <div class="flex items-center gap-1.5">
                  <span class="font-bold text-gray-900 text-base font-serif">{{ appt.client_name }}</span>
                  <span class="text-xs text-gray-400">({{ appt.client_gender || '未填' }})</span>
                </div>
                <span class="font-mono text-xs text-gray-400 mt-0.5 block">單號：{{ appt.appointment_code || '-' }}</span>
              </div>
              <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <Icon name="mdi:check-circle" size="14" /> 已完成
              </span>
            </div>

            <!-- 時間與聯絡資訊 -->
            <div class="space-y-1.5 text-xs text-gray-600">
              <div class="flex items-center gap-2 font-mono">
                <Icon name="mdi:calendar-clock" class="text-[#154337]" size="16" />
                <span class="font-bold text-gray-800">{{ appt.date }}</span>
                <span>{{ appt.start_time }} - {{ appt.end_time }}</span>
              </div>
              <div class="flex items-center gap-2">
                <Icon name="mdi:phone" class="text-gray-400" size="16" />
                <span class="font-mono">{{ appt.client_phone }}</span>
                <span v-if="appt.client_location" class="text-gray-400">· {{ appt.client_location }}</span>
              </div>
            </div>

            <!-- 服務美容師 -->
            <div class="flex items-center justify-between pt-1 text-xs">
              <span class="text-gray-500 font-bold">服務美容師：</span>
              <select 
                :value="appt.beautician_id || ''" 
                @change="updateAppointmentBeautician(appt.id, ($event.target as HTMLSelectElement).value)" 
                class="border border-gray-300 rounded-lg p-1 text-xs bg-white focus:ring-1 focus:ring-[#154337] min-w-[110px]"
              >
                <option value="">未指派</option>
                <option v-for="b in beauticians" :key="b.id" :value="b.id">{{ b.name }}</option>
              </select>
            </div>

            <!-- 單筆備註預覽 -->
            <div v-if="appt.notes" class="bg-amber-50/70 p-2 rounded-xl text-xs text-amber-900 border border-amber-200/60">
              <span class="font-bold">單筆備註：</span>{{ appt.notes }}
            </div>

            <!-- 底部功能按鈕群 -->
            <div class="flex items-center gap-2 pt-2 border-t border-gray-100">
              <button 
                @click="openClientModal(appt)" 
                class="flex-1 py-1.5 text-xs font-bold bg-[#154337] text-white rounded-xl active:scale-95 transition flex items-center justify-center gap-1 shadow-xs cursor-pointer"
              >
                <Icon name="mdi:account-details" size="14" />
                <span>客戶詳情 / 問卷</span>
              </button>
              <button 
                @click="openNoteModal(appt)" 
                class="py-1.5 px-3 text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl active:scale-95 transition cursor-pointer"
              >
                備註
              </button>
              <button 
                @click="revertAppointmentStatus(appt.id)" 
                class="py-1.5 px-2.5 text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl active:scale-95 transition cursor-pointer"
                title="還原為待履約狀態"
              >
                取消完成
              </button>
            </div>
          </div>
        </div>

        <!-- 🖥️ 桌面版表格視圖 (hidden lg:block) -->
        <div v-if="filteredAppointments.length > 0" class="hidden lg:block overflow-x-auto border border-gray-200 rounded-2xl">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-[#FAF4EE] text-[#154337] border-b border-gray-200 text-[11px] font-bold">
                <th class="p-3.5 font-mono">預約單號</th>
                <th @click="toggleSort('date')" class="p-3.5 cursor-pointer hover:bg-black/5 transition select-none">
                  履約日期與時段 <Icon :name="sortField === 'date' ? (sortOrder === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down') : 'mdi:unfold-more-horizontal'" />
                </th>
                <th class="p-3.5">顧客姓名</th>
                <th class="p-3.5">聯絡電話 / 所在地</th>
                <th class="p-3.5">服務美容師</th>
                <th class="p-3.5">履約狀態</th>
                <th class="p-3.5">單筆備註</th>
                <th class="p-3.5 text-right pr-4">操作管理</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="appt in filteredAppointments" :key="appt.id" class="hover:bg-[#FAF4EE]/40 transition duration-150">
                
                <!-- 單號 -->
                <td class="p-3.5 font-mono font-bold text-gray-700">{{ appt.appointment_code || '-' }}</td>
                
                <!-- 日期時段 -->
                <td class="p-3.5 font-mono">
                  <div class="font-bold text-gray-900">{{ appt.date }}</div>
                  <div class="text-[11px] text-gray-500">{{ appt.start_time }} - {{ appt.end_time }}</div>
                </td>
                
                <!-- 姓名與性別 -->
                <td class="p-3.5">
                  <div class="font-bold text-gray-900 text-sm font-serif">{{ appt.client_name }}</div>
                  <div class="text-[11px] text-gray-400">{{ appt.client_gender || '未填' }} · {{ appt.visit_count || 0 }} 次履約</div>
                </td>
                
                <!-- 電話與所在地 -->
                <td class="p-3.5 font-mono">
                  <div class="text-gray-800 font-bold">{{ appt.client_phone }}</div>
                  <div class="text-[11px] text-gray-400 font-sans">{{ appt.client_location || '未填所在地' }}</div>
                </td>
                
                <!-- 美容師指派 -->
                <td class="p-3.5">
                  <select 
                    :value="appt.beautician_id || ''" 
                    @change="updateAppointmentBeautician(appt.id, ($event.target as HTMLSelectElement).value)" 
                    class="border border-gray-300 rounded-xl px-2 py-1 text-xs bg-white focus:ring-2 focus:ring-[#154337] outline-none"
                  >
                    <option value="">未指派</option>
                    <option v-for="b in beauticians" :key="b.id" :value="b.id">{{ b.name }}</option>
                  </select>
                </td>
                
                <!-- 狀態 -->
                <td class="p-3.5">
                  <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <Icon name="mdi:check-circle" size="14" /> 已完成
                  </span>
                </td>
                
                <!-- 單筆備註 -->
                <td class="p-3.5 max-w-[150px] truncate text-gray-500">
                  <span v-if="appt.notes" :title="appt.notes" class="text-gray-700 font-medium cursor-help">{{ appt.notes }}</span>
                  <span v-else class="text-gray-300 italic">無備註</span>
                </td>
                
                <!-- 操作按鈕群 -->
                <td class="p-3.5 text-right pr-4">
                  <div class="flex items-center justify-end gap-1.5">
                    <button 
                      @click="openClientModal(appt)" 
                      class="px-2.5 py-1.5 text-xs font-bold bg-[#154337] text-white hover:bg-[#11352a] rounded-xl transition shadow-2xs active:scale-95 flex items-center gap-1 cursor-pointer"
                      title="查看客戶詳情與初次到訪問卷"
                    >
                      <Icon name="mdi:account-details" size="14" />
                      <span>客戶詳情</span>
                    </button>
                    <button 
                      @click="openNoteModal(appt)" 
                      class="px-2.5 py-1.5 text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition active:scale-95 cursor-pointer"
                      title="編輯單筆備註"
                    >
                      備註
                    </button>
                    <button 
                      @click="revertAppointmentStatus(appt.id)" 
                      class="px-2 py-1.5 text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl transition active:scale-95 cursor-pointer"
                      title="取消已完成狀態，還原為待履約"
                    >
                      取消完成
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
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
                  name="how_to_know_comp" 
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
.compact-date-picker input {
  padding-top: 0.5rem !important;
  padding-bottom: 0.5rem !important;
  padding-left: 0.75rem !important;
  padding-right: 0.75rem !important;
  font-size: 0.75rem !important;
  height: 38px !important;
  border-radius: 0.75rem !important;
}
</style>
