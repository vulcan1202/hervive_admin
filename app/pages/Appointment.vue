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
const showClientModal = ref(false)
const showQuestionnaireModal = ref(false)
const showTermsModal = ref(false)
const tempAgreedInModal = ref(false)
const showNoteModal = ref(false)

// 🌟 手動代客預約 / 幽靈客戶狀態
const showManualBookingModal = ref(false)
const manualBookingSaving = ref(false)
const manualBookingMode = ref<'new_ghost' | 'existing_user'>('new_ghost')
const usersList = ref<any[]>([])
const loadingUsersList = ref(false)
const manualUserSearchQuery = ref('')

const manualBookingForm = reactive({
  last_name: '',
  first_name: '',
  phone: '',
  selected_user_id: null as number | null,
  dateObj: null as Date | null,
  start_time: '14:00',
  beautician_id: '' as any,
  notes: ''
})

const filteredUsersList = computed(() => {
  if (!manualUserSearchQuery.value.trim()) return usersList.value
  const q = manualUserSearchQuery.value.trim().toLowerCase()
  return usersList.value.filter(u => 
    `${u.last_name || ''}${u.first_name || ''}`.toLowerCase().includes(q) ||
    (u.phone && u.phone.includes(q))
  )
})

const fetchUsersList = async () => {
  loadingUsersList.value = true
  try {
    const res = await fetch(`${backendUrl}/api/users`)
    if (res.ok) {
      const data = await res.json()
      usersList.value = data.data || []
    }
  } catch (err) {
    console.error('讀取會員清單失敗', err)
  } finally {
    loadingUsersList.value = false
  }
}

const openManualBookingModal = async (initialDate?: string) => {
  manualBookingMode.value = 'new_ghost'
  manualUserSearchQuery.value = ''
  if (initialDate) {
    const [y, m, d] = initialDate.split('-').map(Number)
    manualBookingForm.dateObj = new Date(y, m - 1, d)
  } else {
    manualBookingForm.dateObj = new Date()
  }
  manualBookingForm.last_name = ''
  manualBookingForm.first_name = ''
  manualBookingForm.phone = ''
  manualBookingForm.selected_user_id = null
  manualBookingForm.start_time = '14:00'
  manualBookingForm.beautician_id = ''
  manualBookingForm.notes = ''
  showManualBookingModal.value = true
  await fetchUsersList()
}

const selectExistingUser = (u: any) => {
  manualBookingForm.selected_user_id = u.id
}

const submitManualBooking = async () => {
  if (!manualBookingForm.dateObj) return alert('請選擇預約日期！')
  const dateStr = formatDateToString(manualBookingForm.dateObj)
  if (!dateStr) return alert('請選擇有效的預約日期！')
  if (!manualBookingForm.start_time) return alert('請選擇預約時間！')

  const payload: any = {
    date: dateStr,
    start_time: manualBookingForm.start_time,
    beautician_id: manualBookingForm.beautician_id ? Number(manualBookingForm.beautician_id) : null,
    status: 'confirmed',
    notes: manualBookingForm.notes.trim() || null
  }

  if (manualBookingMode.value === 'new_ghost') {
    if (!manualBookingForm.last_name.trim() || !manualBookingForm.first_name.trim()) {
      return alert('請填寫客戶姓氏與名字！')
    }
    if (!manualBookingForm.phone.trim()) {
      return alert('請填寫客戶手機號碼（作為日後轉正對帳憑證）！')
    }
    payload.ghost_user = {
      last_name: manualBookingForm.last_name.trim(),
      first_name: manualBookingForm.first_name.trim(),
      phone: manualBookingForm.phone.trim(),
      notes: manualBookingForm.notes.trim() || null
    }
  } else {
    if (!manualBookingForm.selected_user_id) {
      return alert('請在清單中選取預約會員！')
    }
    payload.user_id = manualBookingForm.selected_user_id
  }

  manualBookingSaving.value = true
  try {
    const res = await fetch(`${backendUrl}/api/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const resData = await res.json()
    if (!res.ok) throw new Error(resData.error || '手動預約失敗')

    alert('✅ 手動代客預約成功！時段已鎖定並確認。')
    showManualBookingModal.value = false
    await refreshAllData()
  } catch (err: any) {
    alert(err.message || '預約失敗，請重試')
  } finally {
    manualBookingSaving.value = false
  }
}

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
  const currentAppt = appointments.value.find(a => a.id === id)
  let confirmMessage = ''
  
  if (newStatus === 'confirmed') {
    if (currentAppt && currentAppt.status === 'complete') {
      confirmMessage = '確定要取消點收完成（將預約狀態恢復為已確認）嗎？'
    } else {
      confirmMessage = '確定要將此預約核准嗎？'
    }
  } else if (newStatus === 'complete') {
    confirmMessage = '確定要將此預約標記為已完成嗎？'
  } else if (newStatus === 'cancelled') {
    confirmMessage = '確定要將此預約取消嗎？'
  } else if (newStatus === 'pending') {
    confirmMessage = '確定要將此預約改為待審核嗎？'
  } else {
    confirmMessage = '確定要更新此預約狀態嗎？'
  }
  
  if (!confirm(confirmMessage)) return
  
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
const statusFilter = ref('active')

watch(startDateObj, (newVal) => {
  startDateFilter.value = formatDateToString(newVal)
  if (newVal && endDateObj.value && endDateObj.value < newVal) {
    endDateObj.value = new Date(newVal)
  }
})
watch(endDateObj, (newVal) => {
  endDateFilter.value = formatDateToString(newVal)
})

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
    if (startDateFilter.value && endDateFilter.value) {
      if (a.date < startDateFilter.value || a.date > endDateFilter.value) return false
    } else if (startDateFilter.value) {
      if (a.date < startDateFilter.value) return false
    } else if (endDateFilter.value) {
      if (a.date > endDateFilter.value) return false
    }
    if (statusFilter.value === 'active') {
      if (a.status === 'complete') return false
    } else if (statusFilter.value) {
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
  statusFilter.value = 'active'
}

const hasActiveFilters = computed(() => {
  return !!(searchQuery.value || searchCodeSuffix.value || startDateFilter.value || endDateFilter.value || (statusFilter.value && statusFilter.value !== 'active'))
})

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
  tempAgreedInModal.value = !!questionnaireForm.agreed_to_terms
  showQuestionnaireModal.value = true
}

const openTermsModal = () => {
  tempAgreedInModal.value = !!questionnaireForm.agreed_to_terms
  showTermsModal.value = true
}

const confirmTermsInModal = () => {
  if (!tempAgreedInModal.value) {
    return alert('請在彈窗內打勾「本人確認資料屬實並同意接受課程」！')
  }
  questionnaireForm.agreed_to_terms = true
  showTermsModal.value = false
}

const saveQuestionnaire = async () => {
  if (!selectedClient.value?.user_id) {
    return alert('缺少客戶會員編號，無法儲存問卷！')
  }

  if (!questionnaireForm.agreed_to_terms) {
    openTermsModal()
    return alert('請先開啟規定確認事項彈窗，並在視窗內打勾同意後方可送出！')
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

// ==========================================
// 8.5 變更預約時間模組 (Edit Appointment Time)
// ==========================================
const showEditTimeModal = ref(false)
const selectedApptForEditTime = ref<any>(null)
const editTimeDateObj = ref<Date | null>(null)
const editTimeStartStr = ref<string>('12:00')
const editTimeSaving = ref(false)

const timeOptions = [
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
  '19:00', '19:30', '20:00'
]

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

// ==========================================
// 9. 點收與課程扣堂模組 (Complete & Course Deduction)
// ==========================================
const showCompleteModal = ref(false)
const selectedApptForComplete = ref<any>(null)
const clientActivePackages = ref<any[]>([])
const loadingPackages = ref(false)
const availableCoursesList = ref<any[]>([])

const selectedCoursesToDeduct = reactive<Record<number, number>>({})
const newCoursesToBuy = ref<Array<{ course_id: string | number, buy_amount: number, use_count: number, payment_method: string, custom_total_price?: number }>>([])

const onNewCourseChange = (newCourse: any) => {
  const c = availableCoursesList.value.find(item => item.id === Number(newCourse.course_id))
  if (c && typeof c.price === 'number') {
    newCourse.custom_total_price = c.price * (newCourse.buy_amount || 1)
  }
}

const availableProductsList = ref<any[]>([])
const productsToSell = ref<Array<{ product_id: string | number, quantity: number, payment_method: string, custom_unit_price?: number }>>([])

const addProductSale = () => {
  productsToSell.value.push({
    product_id: '',
    quantity: 1,
    payment_method: 'Cash',
    custom_unit_price: undefined
  })
}

const removeProductSale = (index: number) => {
  productsToSell.value.splice(index, 1)
}

const onProductSaleChange = (item: any) => {
  const p = availableProductsList.value.find(prod => prod.id === Number(item.product_id))
  if (p && typeof p.selling_price === 'number') {
    item.custom_unit_price = p.selling_price
  }
}

const openCompleteModal = async (appt: any) => {
  selectedApptForComplete.value = appt
  showCompleteModal.value = true
  loadingPackages.value = true
  
  for (const key in selectedCoursesToDeduct) delete selectedCoursesToDeduct[key]
  newCoursesToBuy.value = []
  productsToSell.value = []

  try {
    const [pkgRes, courseRes, prodRes] = await Promise.all([
      fetch(`${backendUrl}/api/users-courses?user_id=${appt.user_id}&has_remaining=true`),
      fetch(`${backendUrl}/api/courses`),
      fetch(`${backendUrl}/api/products`)
    ])
    
    if (pkgRes.ok) {
      const pkgData = await pkgRes.json()
      clientActivePackages.value = pkgData.data || []
    }
    
    if (courseRes.ok) {
      const courseData = await courseRes.json()
      availableCoursesList.value = courseData.data || []
    }

    if (prodRes.ok) {
      const prodData = await prodRes.json()
      availableProductsList.value = prodData.data || []
    }
  } catch (err) {
    console.error("撈取點收資料失敗", err)
  } finally {
    loadingPackages.value = false
  }
}

const toggleCourseSelection = (userCourseId: number) => {
  if (selectedCoursesToDeduct[userCourseId] !== undefined) {
    delete selectedCoursesToDeduct[userCourseId]
  } else {
    selectedCoursesToDeduct[userCourseId] = 1
  }
}

const addNewCoursePurchase = () => {
  newCoursesToBuy.value.push({
    course_id: '',
    buy_amount: 1,
    use_count: 1,
    payment_method: 'Cash',
    custom_total_price: undefined
  })
}

const removeNewCoursePurchase = (index: number) => {
  newCoursesToBuy.value.splice(index, 1)
}

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
      payment_method: c.payment_method,
      custom_total_price: c.custom_total_price !== undefined && c.custom_total_price !== null ? Number(c.custom_total_price) : undefined
    }))

  const products_sold = productsToSell.value
    .filter(p => p.product_id !== '')
    .map(p => ({
      product_id: Number(p.product_id),
      quantity: Number(p.quantity),
      payment_method: p.payment_method,
      custom_unit_price: p.custom_unit_price !== undefined && p.custom_unit_price !== null ? Number(p.custom_unit_price) : undefined
    }))

  try {
    const res = await fetch(`${backendUrl}/api/appointments/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appointment_id: selectedApptForComplete.value.id,
        courses_used,
        new_courses_bought,
        products_sold,
        date: selectedApptForComplete.value.date
      })
    })

    if (!res.ok) {
      const errData = await res.json()
      throw new Error(errData.error || "點收失敗")
    }

    alert("✅ 預約已完成點收，堂數扣減與營收認列已成功！")
    showCompleteModal.value = false
    refreshAllData()
  } catch (err: any) {
    alert(err.message)
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
              Appointments Management
            </span>
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-[#154337] tracking-tight font-serif">
            預約總表與點收管理
          </h1>
          <p class="text-gray-500 text-xs sm:text-sm mt-0.5">
            即時檢視待履約預約、指派美容師、完成課程點收與客戶初填問卷
          </p>
        </div>
        
        <div class="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button 
            @click="openManualBookingModal()" 
            class="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#876D5A] text-white hover:bg-[#725a49] active:scale-95 shadow-xs transition duration-200 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Icon name="mdi:calendar-plus" size="18" />
            <span>＋ 手動新增預約 (代約)</span>
          </button>
          <NuxtLink 
            to="/completed" 
            class="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 active:scale-95 shadow-xs transition duration-200 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Icon name="mdi:calendar-check" size="18" class="text-emerald-700" />
            <span>查看已完成預約專區 👉</span>
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

    <!-- 預約清單主體 (Double-Bezel 雙層外框) -->
    <div class="p-1 bg-[#154337]/5 border border-[#154337]/10 rounded-2xl md:rounded-3xl shadow-xs">
      <div class="bg-white rounded-[calc(1rem-2px)] md:rounded-[calc(1.5rem-2px)] p-4 sm:p-6">
        
        <!-- 頂部與工具列 -->
        <div class="flex flex-col gap-4 mb-6 border-b border-gray-100 pb-6">
          <div class="flex justify-between items-center">
            <h3 class="text-lg sm:text-xl font-bold text-[#154337] flex items-center gap-2 font-serif">
              <Icon name="mdi:format-list-bulleted" class="text-emerald-700" size="22" /> 
              預約明細列表 ({{ filteredAppointments.length }} 筆)
            </h3>
            <button 
              v-if="hasActiveFilters" 
              @click="clearAllFilters" 
              class="text-xs bg-rose-50 text-rose-700 hover:bg-rose-100 px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1 cursor-pointer border border-rose-200"
            >
              <Icon name="mdi:filter-off" size="14" /> 清除所有篩選
            </button>
          </div>

          <!-- 高視覺密度搜尋與篩選列 (Density 8) -->
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
            
            <!-- 狀態篩選 -->
            <div class="col-span-2 sm:col-span-1 lg:col-span-1">
              <label class="block text-[11px] font-bold text-gray-600 mb-1">目前預約狀態</label>
              <select v-model="statusFilter" class="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#154337] bg-white h-[38px] outline-none font-medium">
                <option value="active">待履約 / 預約中 (預設，不含已完成)</option>
                <option value="">全部狀態 (包含已完成)</option>
                <option value="pending">審核中 (Pending)</option>
                <option value="confirmed">已確認 (Confirmed)</option>
                <option value="complete">已完成 (Complete)</option>
                <option value="cancelled">已取消 (Cancelled)</option>
              </select>
            </div>

            <!-- 開始日期 -->
            <div class="col-span-1">
              <label class="block text-[11px] font-bold text-gray-600 mb-1">日期 (開始)</label>
              <ClientOnly>
                <MyCalendar v-model="startDateObj" placeholder="選擇開始日期" class="compact-date-picker" />
              </ClientOnly>
            </div>
            
            <!-- 結束日期 -->
            <div class="col-span-1">
              <label class="block text-[11px] font-bold text-gray-600 mb-1">日期 (結束)</label>
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
        <div v-if="filteredAppointments.length === 0" class="text-center py-12 text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-xs sm:text-sm">
          {{ hasActiveFilters ? '找不到符合條件的預約紀錄。' : '目前沒有預約紀錄。' }}
        </div>

        <div v-else>
          <!-- 手機版卡片佈局 -->
          <div class="block md:hidden space-y-4">
            <div 
              v-for="appt in filteredAppointments" 
              :key="appt.id" 
              class="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col gap-3"
            >
              <div class="flex justify-between items-start border-b border-gray-100 pb-3">
                <div class="flex flex-col gap-1">
                  <span class="text-sm font-black text-[#154337] font-mono">
                    {{ appt.date }} <span class="text-gray-400 mx-1">|</span> {{ appt.start_time }}
                  </span>
                  <span class="font-mono text-xs text-gray-400">預約單號：{{ appt.appointment_code || '-' }}</span>
                </div>
                <span :class="['px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0 border', appt.status === 'complete' ? 'bg-blue-50 text-blue-700 border-blue-200' : appt.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : appt.status === 'cancelled' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-800 border-amber-200']">
                  {{ appt.status === 'complete' ? '已完成' : appt.status === 'confirmed' ? '已確認' : appt.status === 'cancelled' ? '已取消' : '審核中' }}
                </span>
              </div>

              <div class="flex flex-col gap-2.5 bg-[#FAF4EE]/50 p-3 rounded-xl border border-gray-100">
                <div class="flex justify-between items-center">
                  <span class="text-xs text-gray-500 font-bold">客戶姓名</span>
                  <button @click="openClientModal(appt)" class="text-[#154337] font-bold text-sm flex items-center gap-1">
                    <span class="underline decoration-dotted underline-offset-2">{{ appt.client_name }}</span>
                    <span v-if="appt.client_is_ghost === 1" class="text-[10px] bg-purple-100 text-purple-800 border border-purple-200 px-1.5 py-0.5 rounded-full font-bold ml-1">
                      👻 幽靈
                    </span>
                    <span v-else class="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded-full font-bold ml-1">
                      🌐 會員
                    </span>
                    <span v-if="appt.visit_count > 0" class="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full ml-1 font-black">{{ appt.visit_count }}次</span>
                  </button>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-xs text-gray-500 font-bold">美容師指派</span>
                  <select :value="appt.beautician_id || ''" @change="updateAppointmentBeautician(appt.id, ($event.target as HTMLSelectElement).value)" class="border border-gray-300 rounded-lg p-1.5 text-xs bg-white focus:ring-1 focus:ring-[#154337] min-w-[110px]">
                    <option value="">未指派</option>
                    <option v-for="b in beauticians" :key="b.id" :value="b.id">{{ b.name }}</option>
                  </select>
                </div>
              </div>

              <div class="pt-1 flex flex-col gap-2">
                <button @click="openNoteModal(appt)" class="w-full py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-xs font-bold text-[#154337] flex justify-center items-center gap-1.5 transition">
                  <Icon name="mdi:note-edit-outline" size="16" />
                  {{ appt.notes ? '查看 / 編輯備註' : '新增預約備註' }}
                </button>

                <div class="flex gap-2 w-full mt-1">
                  <button v-if="!appt.status || appt.status === 'pending' || appt.status === 'confirmed'" @click="openEditTimeModal(appt)" class="px-2.5 py-2 text-xs bg-amber-50 text-amber-900 border border-amber-200 rounded-xl font-bold active:scale-95 transition flex items-center justify-center gap-1 cursor-pointer">
                    <Icon name="mdi:clock-edit-outline" size="15" /> 改時間
                  </button>
                  <button v-if="!appt.status || appt.status === 'pending'" @click="updateAppointmentStatus(appt.id, 'confirmed')" class="flex-1 py-2 text-xs bg-emerald-700 text-white rounded-xl font-bold active:scale-95 transition">核准</button>
                  <button v-if="appt.status === 'confirmed'" @click="openCompleteModal(appt)" class="flex-1 py-2 text-xs bg-blue-700 text-white rounded-xl font-bold active:scale-95 transition">點收完成</button>
                  <button v-if="appt.status === 'complete'" @click="updateAppointmentStatus(appt.id, 'confirmed')" class="flex-1 py-2 text-xs bg-amber-600 text-white rounded-xl font-bold active:scale-95 transition">取消完成</button>
                  <button v-if="appt.status !== 'cancelled' && appt.status !== 'complete'" @click="updateAppointmentStatus(appt.id, 'cancelled')" class="flex-1 py-2 text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded-xl font-bold active:scale-95 transition">取消</button>
                </div>
              </div>
            </div>
          </div>

          <!-- 桌機版高密度數據表格 -->
          <div class="hidden md:block overflow-x-auto rounded-2xl border border-gray-200">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="border-b border-gray-200 text-gray-600 text-xs uppercase font-mono tracking-wider bg-[#FAF4EE]/70">
                  <th class="p-3.5 font-bold">狀態</th>
                  <th class="p-3.5 font-bold">預約單號</th>
                  <th class="p-3.5 font-bold cursor-pointer hover:text-[#154337] select-none" @click="toggleSort('date')">
                    預約日期 <Icon :name="sortField === 'date' ? (sortOrder === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down') : 'mdi:sort'" size="14" class="inline ml-1" />
                  </th>
                  <th class="p-3.5 font-bold cursor-pointer hover:text-[#154337] select-none" @click="toggleSort('start_time')">
                    時間區間 <Icon :name="sortField === 'start_time' ? (sortOrder === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down') : 'mdi:sort'" size="14" class="inline ml-1" />
                  </th>
                  <th class="p-3.5 font-bold">美容師指派</th>
                  <th class="p-3.5 font-bold">客戶姓名</th>
                  <th class="p-3.5 font-bold">聯絡電話</th>
                  <th class="p-3.5 font-bold min-w-[110px]">預約單筆備註</th>
                  <th class="p-3.5 font-bold text-right">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 text-xs sm:text-sm bg-white">
                <tr v-for="appt in filteredAppointments" :key="appt.id" class="hover:bg-[#FAF4EE]/40 transition duration-150">
                  <td class="p-3.5 whitespace-nowrap">
                    <span :class="['px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap inline-block border', appt.status === 'complete' ? 'bg-blue-50 text-blue-700 border-blue-200' : appt.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : appt.status === 'cancelled' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-800 border-amber-200']">
                      {{ appt.status === 'complete' ? '已完成' : appt.status === 'confirmed' ? '已確認' : appt.status === 'cancelled' ? '已取消' : '審核中' }}
                    </span>
                  </td>
                  <td class="p-3.5 font-mono text-xs font-bold text-gray-700">{{ appt.appointment_code || '-' }}</td>
                  <td class="p-3.5 font-semibold text-gray-900 font-mono">{{ appt.date }}</td>
                  <td class="p-3.5 text-[#154337] font-bold font-mono">{{ appt.start_time }} ~ {{ appt.end_time }}</td>
                  <td class="p-3.5">
                    <select 
                      :value="appt.beautician_id || ''" 
                      @change="updateAppointmentBeautician(appt.id, ($event.target as HTMLSelectElement).value)" 
                      class="border border-gray-300 rounded-lg p-1.5 text-xs bg-white focus:ring-2 focus:ring-[#154337] outline-none"
                    >
                      <option value="">未指派</option>
                      <option v-for="b in beauticians" :key="b.id" :value="b.id">{{ b.name }}</option>
                    </select>
                  </td>
                  <td class="p-3.5 font-medium">
                    <button @click="openClientModal(appt)" class="text-[#154337] font-bold underline decoration-dotted hover:text-black transition flex items-center gap-1.5 cursor-pointer">
                      <span>{{ appt.client_name }}</span>
                      <span v-if="appt.client_is_ghost === 1" class="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded-full font-bold">
                        👻 幽靈
                      </span>
                      <span v-else class="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full font-bold">
                        🌐 會員
                      </span>
                      <span v-if="appt.visit_count > 0" class="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full font-black">
                        履約 {{ appt.visit_count }} 次
                      </span>
                    </button>
                  </td>
                  <td class="p-3.5 font-mono text-gray-600 text-xs">{{ appt.client_phone }}</td>
                  <td class="p-3.5">
                    <button @click="openNoteModal(appt)" class="text-xs text-[#154337] font-bold px-2.5 py-1 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition whitespace-nowrap flex items-center gap-1 cursor-pointer">
                      <Icon name="mdi:note-edit-outline" size="14" />
                      查看備註
                    </button>
                  </td>
                  <td class="p-3.5 text-right whitespace-nowrap">
                    <div class="inline-flex items-center justify-end gap-1.5">
                      <button v-if="!appt.status || appt.status === 'pending' || appt.status === 'confirmed'" @click="openEditTimeModal(appt)" class="text-xs bg-amber-50 text-amber-900 border border-amber-200 h-8 px-2.5 rounded-xl font-bold hover:bg-amber-100 transition cursor-pointer active:scale-95 inline-flex items-center justify-center gap-1">
                        <Icon name="mdi:clock-edit-outline" size="14" />
                        改時間
                      </button>
                      <button v-if="!appt.status || appt.status === 'pending'" @click="updateAppointmentStatus(appt.id, 'confirmed')" class="text-xs bg-emerald-700 text-white h-8 px-3 rounded-xl font-bold hover:bg-emerald-800 transition cursor-pointer active:scale-95 inline-flex items-center justify-center">核准</button>
                      <button v-if="appt.status === 'confirmed'" @click="openCompleteModal(appt)" class="text-xs bg-blue-700 text-white h-8 px-3 rounded-xl font-bold hover:bg-blue-800 transition cursor-pointer active:scale-95 inline-flex items-center justify-center">點收完成</button>
                      <button v-if="appt.status === 'complete'" @click="updateAppointmentStatus(appt.id, 'confirmed')" class="text-xs bg-amber-600 text-white h-8 px-3 rounded-xl font-bold hover:bg-amber-700 transition cursor-pointer active:scale-95 inline-flex items-center justify-center">未完成</button>
                      <button v-if="appt.status !== 'cancelled' && appt.status !== 'complete'" @click="updateAppointmentStatus(appt.id, 'cancelled')" class="text-xs bg-rose-50 text-rose-700 border border-rose-200 h-8 px-3 rounded-xl font-bold hover:bg-rose-100 transition cursor-pointer active:scale-95 inline-flex items-center justify-center">取消</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- 結帳點收 Modal (Frosted Glass 彈窗) -->
    <div v-if="showCompleteModal && selectedApptForComplete" class="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
      <div class="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 relative max-h-[90vh] overflow-y-auto border border-white/20">
        <button @click="showCompleteModal = false" class="absolute top-4 right-4 text-gray-400 hover:text-gray-800 bg-gray-100 rounded-full p-1.5 transition cursor-pointer">
          <Icon name="mdi:close" size="20" />
        </button>

        <h3 class="text-lg font-bold text-[#154337] mb-1 flex items-center gap-2 font-serif">
          <Icon name="mdi:check-circle-outline" class="text-emerald-700" size="22" /> 預約完成點收與堂數扣減
        </h3>
        <p class="text-xs text-gray-500 mb-4 font-mono">
          客戶：<span class="font-bold text-gray-900">{{ selectedApptForComplete.client_name }}</span> | 
          時間：{{ selectedApptForComplete.date }} {{ selectedApptForComplete.start_time }}
        </p>

        <!-- 客戶可用包套清單 -->
        <div class="space-y-3 my-4">
          <p class="text-xs font-bold text-gray-700 border-b border-gray-100 pb-1">1. 扣減既有包套</p>
          
          <div v-if="loadingPackages" class="text-xs text-gray-400 py-2 text-center">載入客戶包套中...</div>
          <div v-else-if="clientActivePackages.length === 0" class="p-3 bg-amber-50 text-amber-800 rounded-2xl text-xs border border-amber-200">
            該客戶目前無可扣減的剩餘包套。
          </div>

          <div 
            v-else 
            v-for="pkg in clientActivePackages" 
            :key="pkg.id"
            :class="['p-3 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between cursor-pointer gap-2', selectedCoursesToDeduct[pkg.id] !== undefined ? 'border-[#154337] bg-[#154337]/5' : 'border-gray-200 bg-white']"
            @click="toggleCourseSelection(pkg.id)"
          >
            <div class="flex items-center gap-3">
              <input 
                type="checkbox" 
                :checked="selectedCoursesToDeduct[pkg.id] !== undefined"
                class="w-4 h-4 text-[#154337] rounded border-gray-300"
              />
              <div>
                <p class="text-xs sm:text-sm font-bold text-gray-900">{{ pkg.course_name }}</p>
                <p class="text-xs text-gray-500 mt-0.5">剩餘：<span class="font-bold text-[#154337]">{{ pkg.remaining_count }}</span> 堂</p>
              </div>
            </div>

            <div v-if="selectedCoursesToDeduct[pkg.id] !== undefined" class="flex items-center gap-2 self-end sm:self-auto bg-white p-1 rounded-xl border border-gray-200 shadow-2xs" @click.stop>
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

        <!-- 現場加購 / 當下購買 -->
        <div class="space-y-3 mt-6">
          <div class="flex justify-between items-center border-b border-gray-100 pb-1">
            <p class="text-xs font-bold text-gray-700">2. 現場加購 / 當下購買即使用</p>
            <button type="button" @click="addNewCoursePurchase" class="text-xs text-[#154337] font-bold hover:underline bg-[#FAF4EE] px-2.5 py-1 rounded-xl border border-[#154337]/15 cursor-pointer">
              + 新增項目
            </button>
          </div>

          <div v-if="newCoursesToBuy.length === 0" class="text-xs text-gray-400 italic py-2">
            無現場加購項目。
          </div>

          <div v-for="(newCourse, index) in newCoursesToBuy" :key="index" class="bg-gray-50 p-3 rounded-2xl border border-gray-200 space-y-2 relative">
            <button @click="removeNewCoursePurchase(index)" class="absolute top-2.5 right-2.5 text-rose-500 hover:text-rose-700 bg-white rounded-full p-1 shadow-2xs cursor-pointer">
              <Icon name="mdi:close" size="14" />
            </button>
            
            <div>
              <label class="block text-[11px] font-bold text-gray-600 mb-1">選擇課程</label>
              <select v-model="newCourse.course_id" @change="onNewCourseChange(newCourse)" class="w-full border border-gray-300 rounded-xl p-2 text-xs bg-white focus:ring-2 focus:ring-[#154337] outline-none">
                <option value="" disabled>請選擇課程...</option>
                <option v-for="c in availableCoursesList" :key="c.id" :value="c.id">{{ c.name }} (單價 ${{ c.price }})</option>
              </select>
            </div>
            
            <div class="grid grid-cols-3 gap-2">
              <div>
                <label class="block text-[10px] font-bold text-gray-600 mb-1">購買總堂數</label>
                <input type="number" v-model.number="newCourse.buy_amount" @input="onNewCourseChange(newCourse)" min="1" class="w-full border border-gray-300 rounded-xl p-1.5 text-xs focus:ring-2 focus:ring-[#154337] outline-none font-mono" />
              </div>
              <div>
                <label class="block text-[10px] font-bold text-gray-600 mb-1">本次消耗堂數</label>
                <input type="number" v-model.number="newCourse.use_count" min="1" :max="newCourse.buy_amount" class="w-full border border-gray-300 rounded-xl p-1.5 text-xs focus:ring-2 focus:ring-[#154337] outline-none font-mono" />
              </div>
              <div>
                <label class="block text-[10px] font-bold text-gray-600 mb-1">成交總金額 ($)</label>
                <input type="number" v-model.number="newCourse.custom_total_price" min="0" placeholder="可覆寫折扣價" class="w-full border border-gray-300 rounded-xl p-1.5 text-xs focus:ring-2 focus:ring-[#154337] outline-none font-mono bg-amber-50/50 text-amber-900 border-amber-200" />
              </div>
            </div>

            <div>
              <label class="block text-[10px] font-bold text-gray-600 mb-1">付款方式</label>
              <select v-model="newCourse.payment_method" class="w-full border border-gray-300 rounded-xl p-1.5 text-xs bg-white focus:ring-2 focus:ring-[#154337] outline-none">
                <option value="Cash">現金 (Cash)</option>
                <option value="Line Pay">Line Pay</option>
                <option value="Credit Card">信用卡</option>
                <option value="Transfer">匯款</option>
              </select>
            </div>
          </div>
        </div>

        <!-- 3. 現場加購實體保養產品 (庫存產品銷售) -->
        <div class="space-y-3 mt-6">
          <div class="flex justify-between items-center border-b border-gray-100 pb-1">
            <p class="text-xs font-bold text-gray-700">3. 現場加購實體保養產品 (庫存銷貨)</p>
            <button type="button" @click="addProductSale" class="text-xs text-[#154337] font-bold hover:underline bg-[#FAF4EE] px-2.5 py-1 rounded-xl border border-[#154337]/15 cursor-pointer">
              + 新增加購產品
            </button>
          </div>

          <div v-if="productsToSell.length === 0" class="text-xs text-gray-400 italic py-2">
            無加購保養產品。
          </div>

          <div v-for="(prod, index) in productsToSell" :key="index" class="bg-gray-50 p-3 rounded-2xl border border-gray-200 space-y-2 relative">
            <button type="button" @click="removeProductSale(index)" class="absolute top-2.5 right-2.5 text-rose-500 hover:text-rose-700 bg-white rounded-full p-1 shadow-2xs cursor-pointer">
              <Icon name="mdi:close" size="14" />
            </button>
            
            <div>
              <label class="block text-[11px] font-bold text-gray-600 mb-1">選擇庫存產品</label>
              <select v-model="prod.product_id" @change="onProductSaleChange(prod)" class="w-full border border-gray-300 rounded-xl p-2 text-xs bg-white focus:ring-2 focus:ring-[#154337] outline-none">
                <option value="" disabled>請選擇產品...</option>
                <option v-for="p in availableProductsList" :key="p.id" :value="p.id" :disabled="p.stock_quantity <= 0">
                  {{ p.name }} (售價 ${{ p.selling_price }} | 庫存 {{ p.stock_quantity }} 件)
                </option>
              </select>
            </div>
            
            <div class="grid grid-cols-3 gap-2">
              <div>
                <label class="block text-[10px] font-bold text-gray-600 mb-1">銷售數量</label>
                <input type="number" v-model.number="prod.quantity" min="1" class="w-full border border-gray-300 rounded-xl p-1.5 text-xs focus:ring-2 focus:ring-[#154337] outline-none font-mono" />
              </div>
              <div>
                <label class="block text-[10px] font-bold text-gray-600 mb-1">單價 ($)</label>
                <input type="number" v-model.number="prod.custom_unit_price" min="0" placeholder="產品售價" class="w-full border border-gray-300 rounded-xl p-1.5 text-xs focus:ring-2 focus:ring-[#154337] outline-none font-mono bg-amber-50/50 text-amber-900 border-amber-200" />
              </div>
              <div>
                <label class="block text-[10px] font-bold text-gray-600 mb-1">付款方式</label>
                <select v-model="prod.payment_method" class="w-full border border-gray-300 rounded-xl p-1.5 text-xs bg-white focus:ring-2 focus:ring-[#154337] outline-none">
                  <option value="Cash">現金 (Cash)</option>
                  <option value="Line Pay">Line Pay</option>
                  <option value="Credit Card">信用卡</option>
                  <option value="Transfer">匯款</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
          <button @click="showCompleteModal = false" class="px-4 py-2 text-xs font-bold bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 cursor-pointer">取消</button>
          <button @click="submitCompleteAppointment" class="px-4 py-2 text-xs font-bold bg-[#154337] text-white rounded-xl hover:bg-[#11352a] active:scale-95 transition shadow-xs cursor-pointer">
            確定完成並點收
          </button>
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
          <div class="flex items-center justify-between bg-gray-50 p-2.5 rounded-xl border border-gray-200 text-xs">
            <div class="flex items-center gap-1.5">
              <span class="text-gray-500">帳戶類型：</span>
              <span v-if="selectedClient.client_is_ghost === 1" class="bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 rounded-full font-bold">
                👻 幽靈客戶
              </span>
              <span v-else class="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                🌐 正式會員
              </span>
            </div>
            <div class="flex items-center gap-1">
              <span class="text-gray-500">履約次數：</span>
              <span class="font-bold text-[#154337] text-sm">{{ selectedClient.visit_count || 0 }} 次</span>
            </div>
          </div>
          <div><span class="text-gray-500">電話：</span><span class="font-semibold text-gray-800 font-mono">{{ selectedClient.client_phone }}</span></div>
          <div><span class="text-gray-500">信箱：</span><span class="font-semibold text-gray-800">{{ selectedClient.client_email || '未填寫' }}</span></div>
          <div><span class="text-gray-500">所在地：</span><span class="font-semibold text-gray-800">{{ selectedClient.client_location || '未填寫' }}</span></div>
          
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

    <!-- 🗓️ 手動新增預約 Modal (代客預約 / 幽靈客戶) -->
    <div v-if="showManualBookingModal" class="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 animate-fade-in">
      <div class="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-5 sm:p-7 relative border border-white/20 max-h-[92vh] overflow-y-auto">
        <button @click="showManualBookingModal = false" class="absolute top-4 right-4 text-gray-400 hover:text-gray-800 bg-gray-100 rounded-full p-1.5 transition cursor-pointer">
          <Icon name="mdi:close" size="20" />
        </button>

        <h3 class="text-lg sm:text-xl font-bold text-[#154337] mb-1 flex items-center gap-2 font-serif">
          <Icon name="mdi:calendar-plus" class="text-[#876D5A]" size="24" />
          手動代客預約 / 建立預約
        </h3>
        <p class="text-xs text-gray-500 mb-5">
          由店家代客快速建立預約並直接鎖定時段，避免線上重疊預約撞期。
        </p>

        <!-- 模式切換：建立新幽靈客戶 vs 選擇現有會員 -->
        <div class="flex bg-gray-100 p-1 rounded-2xl mb-5">
          <button 
            type="button"
            @click="manualBookingMode = 'new_ghost'"
            :class="['flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5', manualBookingMode === 'new_ghost' ? 'bg-white text-[#154337] shadow-xs' : 'text-gray-500 hover:text-gray-800']"
          >
            <span>👻 快速建立幽靈客戶 (私訊新客)</span>
          </button>
          <button 
            type="button"
            @click="manualBookingMode = 'existing_user'"
            :class="['flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5', manualBookingMode === 'existing_user' ? 'bg-white text-[#154337] shadow-xs' : 'text-gray-500 hover:text-gray-800']"
          >
            <span>🔍 選擇現有會員 / 幽靈</span>
          </button>
        </div>

        <div class="space-y-4">
          <!-- 模式一：建立新幽靈客戶 -->
          <div v-if="manualBookingMode === 'new_ghost'" class="p-4 bg-purple-50/50 rounded-2xl border border-purple-200/70 space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-purple-900 flex items-center gap-1">
                <Icon name="mdi:account-plus" size="16" /> 幽靈客戶基本資料
              </span>
              <span class="text-[10px] text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full font-bold">免密碼・免LINE</span>
            </div>

            <div class="grid grid-cols-2 gap-2.5">
              <div>
                <label class="block text-[11px] font-bold text-gray-700 mb-1">姓氏 <span class="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  v-model="manualBookingForm.last_name" 
                  placeholder="例如：王" 
                  class="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#154337] bg-white outline-none"
                />
              </div>
              <div>
                <label class="block text-[11px] font-bold text-gray-700 mb-1">名字 / 稱呼 <span class="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  v-model="manualBookingForm.first_name" 
                  placeholder="例如：小美" 
                  class="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#154337] bg-white outline-none"
                />
              </div>
            </div>

            <div>
              <label class="block text-[11px] font-bold text-gray-700 mb-1">
                聯絡手機號碼 <span class="text-rose-500">*</span>
                <span class="text-[10px] font-normal text-purple-700 ml-1">（日後客戶透過 LINE 註冊時將依此自動轉正）</span>
              </label>
              <input 
                type="tel" 
                v-model="manualBookingForm.phone" 
                placeholder="例如：0912345678" 
                class="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#154337] bg-white outline-none font-mono"
              />
            </div>
          </div>

          <!-- 模式二：選擇現有會員 / 既有幽靈客戶 -->
          <div v-else class="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200/70 space-y-3">
            <span class="text-xs font-bold text-emerald-900 flex items-center gap-1">
              <Icon name="mdi:account-search" size="16" /> 搜尋並選取現有客戶
            </span>
            <div class="relative">
              <Icon name="mdi:magnify" size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                v-model="manualUserSearchQuery" 
                placeholder="輸入姓名或手機搜尋..." 
                class="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-[#154337] bg-white outline-none" 
              />
            </div>
            <div class="max-h-36 overflow-y-auto space-y-1.5 custom-scrollbar">
              <div 
                v-for="u in filteredUsersList" 
                :key="u.id"
                @click="selectExistingUser(u)"
                :class="['p-2 rounded-xl border text-xs flex justify-between items-center cursor-pointer transition', manualBookingForm.selected_user_id === u.id ? 'bg-[#154337] text-white border-[#154337]' : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-800']"
              >
                <div class="flex items-center gap-2">
                  <span class="font-bold">{{ u.last_name }}{{ u.first_name }}</span>
                  <span :class="['text-[10px] px-1.5 py-0.5 rounded-full font-bold', manualBookingForm.selected_user_id === u.id ? 'bg-white/20 text-white' : (u.is_ghost === 1 ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700')]">
                    {{ u.is_ghost === 1 ? '👻 幽靈' : '🌐 正式' }}
                  </span>
                </div>
                <span class="font-mono text-[11px] opacity-80">{{ u.phone }}</span>
              </div>
              <div v-if="filteredUsersList.length === 0" class="text-xs text-gray-400 text-center py-3">
                找不到相符的客戶
              </div>
            </div>
          </div>

          <!-- 預約時段設定 -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">預約日期 <span class="text-rose-500">*</span></label>
              <ClientOnly>
                <MyCalendar v-model="manualBookingForm.dateObj" placeholder="選擇預約日期" class="w-full" />
              </ClientOnly>
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">開始時間 <span class="text-rose-500">*</span></label>
              <select v-model="manualBookingForm.start_time" class="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#154337] bg-white h-[38px] outline-none font-mono">
                <option v-for="t in timeOptions" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>
          </div>

          <!-- 指派美容師 -->
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">指派美容師 (選填)</label>
            <select v-model="manualBookingForm.beautician_id" class="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#154337] bg-white h-[38px] outline-none">
              <option value="">未指派</option>
              <option v-for="b in beauticians" :key="b.id" :value="b.id">{{ b.name }}</option>
            </select>
          </div>

          <!-- 預約備註 -->
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">預約備註 / 客戶需求說明 (選填)</label>
            <input 
              type="text" 
              v-model="manualBookingForm.notes" 
              placeholder="例如：LINE 私訊想做粉刺淨膚、朋友介紹" 
              class="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#154337] bg-white outline-none"
            />
          </div>
        </div>

        <div class="flex gap-3 pt-5 mt-3 border-t border-gray-100">
          <button 
            type="button" 
            @click="showManualBookingModal = false" 
            class="flex-1 py-2.5 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition cursor-pointer"
          >
            取消
          </button>
          <button 
            type="button" 
            @click="submitManualBooking" 
            :disabled="manualBookingSaving" 
            class="flex-1 py-2.5 text-xs font-bold text-white bg-[#876D5A] hover:bg-[#725a49] rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 shadow-xs disabled:opacity-50"
          >
            <Icon v-if="manualBookingSaving" name="mdi:loading" class="animate-spin" size="16" />
            <Icon v-else name="mdi:check" size="16" />
            <span>{{ manualBookingSaving ? '建立中...' : '⚡ 建立預約並鎖定時段' }}</span>
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
                  name="how_to_know" 
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

            <!-- 規定確認事項提示與開窗按鈕 (完全鎖定外層，禁止外層直接同意，必須點開彈窗於視窗內打勾) -->
            <div v-if="!questionnaireForm.agreed_to_terms" class="p-4 rounded-2xl bg-amber-50/90 border-2 border-amber-300/80 space-y-3 shadow-2xs">
              <div class="flex items-start gap-2.5">
                <Icon name="mdi:shield-alert-outline" class="text-2xl text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <h4 class="font-bold text-xs sm:text-sm text-amber-950 flex items-center gap-1.5">
                    <span>課程服務約定確認事項 (共 7 項規範)</span>
                    <span class="px-2 py-0.5 rounded-md bg-amber-200/70 text-amber-900 text-[10px] font-bold">尚未確認</span>
                  </h4>
                  <p class="text-[11px] text-amber-800 font-medium mt-1 leading-relaxed">
                    依美學服務規範，送出問卷前必須先點開下方彈窗「詳閱 7 項規定」，並於彈窗視窗內完成打勾確認（未點開視窗無法同意）。
                  </p>
                </div>
              </div>

              <button 
                type="button" 
                @click="openTermsModal"
                class="w-full py-2.5 px-4 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-700 active:scale-98 text-white shadow-xs transition flex items-center justify-center gap-2 cursor-pointer animate-pulse"
              >
                <Icon name="mdi:file-document-check" size="18" />
                <span>點此開啟規定彈窗並於視窗內打勾同意 (共 7 項)</span>
              </button>
            </div>

            <!-- 已同意狀態卡片 -->
            <div v-else class="p-4 rounded-2xl bg-emerald-50/90 border-2 border-emerald-300 space-y-2.5 shadow-2xs">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div class="flex items-start gap-2.5">
                  <Icon name="mdi:check-decagram" class="text-2xl text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <h4 class="font-bold text-xs sm:text-sm text-emerald-950 flex items-center gap-1.5">
                      <span>課程服務約定確認事項</span>
                      <span class="px-2 py-0.5 rounded-md bg-emerald-200/70 text-emerald-900 text-[10px] font-bold">✅ 已於彈窗內完成同意</span>
                    </h4>
                    <p class="text-[11px] text-emerald-700 font-medium mt-0.5">
                      已於規定彈窗內詳閱 7 項規範並確認「本人確認資料屬實並同意接受課程」。
                    </p>
                  </div>
                </div>

                <button 
                  type="button" 
                  @click="openTermsModal"
                  class="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-800 hover:bg-emerald-900 text-white shadow-xs transition flex items-center justify-center gap-1 cursor-pointer shrink-0 active:scale-95"
                >
                  <Icon name="mdi:file-document-outline" size="14" />
                  <span>重新檢視規定</span>
                </button>
              </div>
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
              :disabled="!questionnaireForm.agreed_to_terms || questionnaireSaving" 
              :class="[
                'px-6 py-2.5 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs',
                questionnaireForm.agreed_to_terms 
                  ? 'text-white bg-[#154337] hover:bg-[#11352a] active:scale-95 cursor-pointer' 
                  : 'text-gray-400 bg-gray-200 cursor-not-allowed opacity-70'
              ]"
              :title="!questionnaireForm.agreed_to_terms ? '請先點開上方彈窗完成 7 項規定同意' : '確認儲存問卷'"
            >
              <Icon v-if="questionnaireSaving" name="mdi:loading" class="animate-spin" size="16" />
              <Icon v-else-if="!questionnaireForm.agreed_to_terms" name="mdi:lock-outline" size="16" />
              <span>{{ questionnaireSaving ? '儲存中...' : (questionnaireForm.agreed_to_terms ? '確認儲存問卷' : '未同意規定 (須點開彈窗確認)') }}</span>
            </button>
          </div>

        </form>
      </div>
    </div>

    <!-- 📜 課程服務約定確認事項彈窗 (Terms Modal - 最上層 z-[100]) -->
    <div v-if="showTermsModal" class="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-[100] animate-fade-in">
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

        <!-- 彈窗內打勾同意卡片 (具備明確狀態提示) -->
        <label 
          :class="[
            'flex items-start gap-3.5 p-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer select-none',
            tempAgreedInModal 
              ? 'bg-emerald-50/90 border-emerald-500 shadow-xs text-emerald-950' 
              : 'bg-amber-50/90 border-amber-400 hover:border-amber-500 shadow-2xs text-amber-950'
          ]"
        >
          <input 
            type="checkbox" 
            v-model="tempAgreedInModal" 
            class="mt-1 w-5 h-5 rounded text-[#154337] focus:ring-[#154337] cursor-pointer shrink-0"
          />
          <div class="space-y-1 flex-1">
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs sm:text-sm font-black leading-snug">
                本人確認資料屬實並同意接受課程 <span class="text-rose-500">*</span>
              </span>
              <!-- 狀態提示徽章 -->
              <span 
                :class="[
                  'px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0 flex items-center gap-1 transition',
                  tempAgreedInModal 
                    ? 'bg-emerald-200/80 text-emerald-900' 
                    : 'bg-amber-200 text-amber-900'
                ]"
              >
                <Icon :name="tempAgreedInModal ? 'mdi:check-circle' : 'mdi:alert-circle-outline'" size="13" />
                <span>{{ tempAgreedInModal ? '已勾選同意' : '尚未勾選' }}</span>
              </span>
            </div>
            <p :class="['text-[11px] leading-relaxed', tempAgreedInModal ? 'text-emerald-700 font-medium' : 'text-amber-800 font-medium']">
              {{ tempAgreedInModal 
                ? '✅ 已確認所有 7 項規範，請點擊下方「我已了解並同意」送出。' 
                : '👉 請點擊此處方框完成打勾，確認已充分理解並同意上述 7 項約定。' }}
            </p>
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
            @click="confirmTermsInModal" 
            :disabled="!tempAgreedInModal"
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