<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue'

const config = useRuntimeConfig()
const backendUrl = config.public.backendUrl

// --- 1. 狀態定義 ---
const currentTab = ref<'catalog' | 'user_packages'>('catalog')
const coursesList = ref<any[]>([])
const userCoursesList = ref<any[]>([])
const usersList = ref<any[]>([])
const loading = ref(false)

const showCourseModal = ref(false)
const showSellModal = ref(false)
const showEditPackageModal = ref(false) 
const showRefundModal = ref(false)

// 表單 State
const courseForm = reactive({ id: null as number | null, name: '', description: '', price: 0, cost: 0 })
const sellForm = reactive({ user_id: '', course_id: '', amount: 1, custom_total_price: undefined as number | undefined, payment_method: 'Cash' })
const editPackageForm = reactive({ id: null as number | null, course_id: '', amount: 1, custom_total_price: undefined as number | undefined, client_name: '', course_name: '' })

const updateEditPackageTotalPrice = () => {
  const selectedCourse = coursesList.value.find(c => c.id === Number(editPackageForm.course_id))
  if (selectedCourse && typeof selectedCourse.price === 'number') {
    editPackageForm.custom_total_price = selectedCourse.price * (editPackageForm.amount || 1)
  }
}

// 搜尋會員相關 State 與邏輯
const userSearchText = ref('')
const isUserDropdownOpen = ref(false)

const filteredUsersList = computed(() => {
  if (!userSearchText.value.trim()) return usersList.value
  const q = userSearchText.value.trim().toLowerCase()
  return usersList.value.filter(u => {
    const fullName = `${u.last_name || ''}${u.first_name || ''}`.toLowerCase()
    const phone = (u.phone || '').toLowerCase()
    return fullName.includes(q) || phone.includes(q)
  })
})

const selectUserForSell = (u: any) => {
  sellForm.user_id = u.id
  userSearchText.value = `${u.last_name || ''}${u.first_name || ''} (${u.phone || ''})`
  isUserDropdownOpen.value = false
}

const clearSelectedUser = () => {
  sellForm.user_id = ''
  userSearchText.value = ''
  isUserDropdownOpen.value = true
}

const openSellModal = () => {
  sellForm.user_id = ''
  sellForm.course_id = ''
  sellForm.amount = 1
  sellForm.custom_total_price = undefined
  sellForm.payment_method = 'Cash'
  userSearchText.value = ''
  isUserDropdownOpen.value = false
  showSellModal.value = true
}

const updateSellTotalPrice = () => {
  const selectedCourse = coursesList.value.find(c => c.id === Number(sellForm.course_id))
  if (selectedCourse && typeof selectedCourse.price === 'number') {
    sellForm.custom_total_price = selectedCourse.price * (sellForm.amount || 1)
  }
}

// 退款表單 State
const refundForm = reactive({
  user_course_id: null as number | null,
  client_name: '',
  course_name: '',
  unit_price: 0,
  remaining_count: 0,
  refund_count: 1,
  refund_amount: 0,
  payment_method: 'Cash',
  description: ''
})

// 🌟 會員包套搜尋、用罄開關與歷史紀錄 State
const packageSearchText = ref('')
const showFinishedPackages = ref(false) // 預設隱藏已用罄包套

const showHistoryModal = ref(false)
const selectedPackageForHistory = ref<any>(null)
const packageHistoryList = ref<any[]>([])
const loadingHistory = ref(false)

// 包套統計計算
const activePackagesCount = computed(() => {
  return userCoursesList.value.filter(p => (p.remaining_count || 0) > 0).length
})

const finishedPackagesCount = computed(() => {
  return userCoursesList.value.filter(p => (p.remaining_count || 0) <= 0).length
})

// 🌟 過濾後的包套列表 (結合用罄開關與用戶姓名/電話/課程名稱即時搜尋)
const filteredUserPackagesList = computed(() => {
  let list = userCoursesList.value

  // 1. 已用罄開關過濾 (預設 false: 只看進行中 remaining_count > 0)
  if (!showFinishedPackages.value) {
    list = list.filter(pkg => (pkg.remaining_count || 0) > 0)
  }

  // 2. 搜尋關鍵字 (支援姓名、電話、課程名稱)
  if (packageSearchText.value.trim()) {
    const q = packageSearchText.value.trim().toLowerCase()
    list = list.filter(pkg => {
      const clientName = (pkg.client_name || '').toLowerCase()
      const clientPhone = (pkg.client_phone || '').toLowerCase()
      const courseName = (pkg.course_name || '').toLowerCase()
      return clientName.includes(q) || clientPhone.includes(q) || courseName.includes(q)
    })
  }

  return list
})

// 🌟 開啟包套課程使用與異動歷史紀錄 Modal
const openHistoryModal = async (pkg: any) => {
  selectedPackageForHistory.value = pkg
  packageHistoryList.value = []
  loadingHistory.value = true
  showHistoryModal.value = true

  try {
    const res = await fetch(`${backendUrl}/api/users-courses/history?user_course_id=${pkg.id}`)
    if (res.ok) {
      const data = await res.json()
      packageHistoryList.value = data.data || []
    } else {
      packageHistoryList.value = []
    }
  } catch (err) {
    console.error('讀取包套使用紀錄失敗', err)
    packageHistoryList.value = []
  } finally {
    loadingHistory.value = false
  }
}

const fetchData = async () => {
  loading.value = true
  try {
    const [resCourses, resUsers, resUserCourses] = await Promise.all([
      fetch(`${backendUrl}/api/courses`).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`${backendUrl}/api/users`).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`${backendUrl}/api/users-courses`).then(r => r.json()).catch(() => ({ data: [] }))
    ])
    coursesList.value = resCourses.data || []
    usersList.value = resUsers.data || []
    userCoursesList.value = resUserCourses.data || []
  } catch (err) {
    console.error('讀取資料失敗', err)
  } finally {
    loading.value = false
  }
}

const openCourseModal = (course: any = null) => {
  if (course) {
    Object.assign(courseForm, course)
  } else {
    Object.assign(courseForm, { id: null, name: '', description: '', price: 0, cost: 0 })
  }
  showCourseModal.value = true
}

const saveCourse = async () => {
  if (!courseForm.name.trim()) return alert('課程名稱為必填！')
  if (courseForm.price < 0 || courseForm.cost < 0) return alert('價格與成本不可小於 0！')

  const method = courseForm.id ? 'PUT' : 'POST'
  try {
    const res = await fetch(`${backendUrl}/api/courses`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(courseForm)
    })
    if (!res.ok) throw new Error('儲存失敗')
    alert(courseForm.id ? '✅ 課程更新成功！' : '✅ 課程建立成功！')
    showCourseModal.value = false
    fetchData()
  } catch (err: any) {
    alert(err.message)
  }
}

const deleteCourse = async (id: number, name: string) => {
  if (!confirm(`確定要刪除「${name}」課程方案嗎？`)) return
  try {
    const res = await fetch(`${backendUrl}/api/courses?id=${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('刪除失敗')
    fetchData()
  } catch (err: any) {
    alert(err.message)
  }
}

const handleSellPackage = async () => {
  if (!sellForm.user_id || !sellForm.course_id) return alert('請選擇客戶與課程！')
  if (sellForm.amount <= 0) return alert('購買堂數必須大於 0！')

  try {
    const selectedCourse = coursesList.value.find(c => c.id === Number(sellForm.course_id))
    const defaultTotalPrice = selectedCourse ? selectedCourse.price * sellForm.amount : 0
    const totalPrice = (typeof sellForm.custom_total_price === 'number' && !isNaN(sellForm.custom_total_price) && sellForm.custom_total_price >= 0)
      ? sellForm.custom_total_price
      : defaultTotalPrice

    const resSell = await fetch(`${backendUrl}/api/users-courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: Number(sellForm.user_id),
        course_id: Number(sellForm.course_id),
        amount: sellForm.amount,
        remaining_count: sellForm.amount
      })
    })
    if (!resSell.ok) throw new Error('新增會員包套失敗')

    await fetch(`${backendUrl}/api/cash-transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'income',
        category: '課程包套預收',
        amount: totalPrice,
        payment_method: sellForm.payment_method,
        user_id: Number(sellForm.user_id),
        description: `購買「${selectedCourse?.name || ''}」共 ${sellForm.amount} 堂 (${totalPrice !== defaultTotalPrice ? '優惠特價 $' + totalPrice : '定價 $' + defaultTotalPrice})`,
        date: new Date().toISOString().slice(0, 10)
      })
    })

    alert('✅ 銷售成功！')
    showSellModal.value = false
    Object.assign(sellForm, { user_id: '', course_id: '', amount: 1, payment_method: 'Cash' })
    fetchData()
  } catch (err: any) {
    alert('操作失敗：' + err.message)
  }
}

const openEditPackageModal = async (pkg: any) => {
  editPackageForm.id = pkg.id
  editPackageForm.course_id = pkg.course_id
  editPackageForm.amount = pkg.amount
  editPackageForm.client_name = pkg.client_name || '客戶'
  editPackageForm.course_name = pkg.course_name || '課程'

  try {
    const res = await fetch(`${backendUrl}/api/cash-transactions?user_id=${pkg.user_id}`)
    if (res.ok) {
      const data = await res.json()
      const ct = (data.data || []).find((c: any) => c.category === '課程包套預收' && c.description.includes(pkg.course_name))
      if (ct && typeof ct.amount === 'number') {
        editPackageForm.custom_total_price = ct.amount
      } else {
        editPackageForm.custom_total_price = (pkg.course_price || 0) * pkg.amount
      }
    } else {
      editPackageForm.custom_total_price = (pkg.course_price || 0) * pkg.amount
    }
  } catch {
    editPackageForm.custom_total_price = (pkg.course_price || 0) * pkg.amount
  }

  showEditPackageModal.value = true
}

const saveEditPackage = async () => {
  if (!editPackageForm.amount || editPackageForm.amount <= 0) return alert('總堂數必須大於 0！')
  try {
    const res = await fetch(`${backendUrl}/api/users-courses`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editPackageForm.id,
        course_id: Number(editPackageForm.course_id),
        amount: Number(editPackageForm.amount),
        custom_total_price: editPackageForm.custom_total_price !== undefined && editPackageForm.custom_total_price !== null ? Number(editPackageForm.custom_total_price) : undefined
      })
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || '修改失敗')
    }
    alert('✅ 會員包套內容與成交價格修改成功！財務現金流已同步自動調整。')
    showEditPackageModal.value = false
    fetchData()
  } catch (err: any) {
    alert(err.message)
  }
}

// 開啟退款 Modal
const openRefundModal = (pkg: any) => {
  if (pkg.remaining_count <= 0) {
    return alert('❌ 此包套剩餘堂數為 0，無法辦理退款！')
  }
  refundForm.user_course_id = pkg.id
  refundForm.client_name = pkg.client_name || '客戶'
  refundForm.course_name = pkg.course_name || '課程'
  refundForm.unit_price = pkg.course_price || 0
  refundForm.remaining_count = pkg.remaining_count
  refundForm.refund_count = pkg.remaining_count
  refundForm.refund_amount = pkg.remaining_count * (pkg.course_price || 0)
  refundForm.payment_method = 'Cash'
  refundForm.description = `辦理「${pkg.course_name}」課程退款`
  showRefundModal.value = true
}

// 當退款堂數改變時，自動計算建議退款金額
const handleRefundCountChange = () => {
  if (refundForm.refund_count > refundForm.remaining_count) {
    refundForm.refund_count = refundForm.remaining_count
  }
  if (refundForm.refund_count < 1) {
    refundForm.refund_count = 1
  }
  refundForm.refund_amount = refundForm.refund_count * refundForm.unit_price
}

// 提交退款請求
const submitRefund = async () => {
  if (refundForm.refund_count <= 0 || refundForm.refund_amount < 0) {
    return alert('請輸入有效的退款堂數與金額！')
  }
  if (!confirm(`確定要為 ${refundForm.client_name} 辦理退還 ${refundForm.refund_count} 堂，並支出退款金額 $${refundForm.refund_amount.toLocaleString()} 嗎？`)) return

  try {
    const res = await fetch(`${backendUrl}/api/users-courses/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_course_id: refundForm.user_course_id,
        refund_count: refundForm.refund_count,
        refund_amount: refundForm.refund_amount,
        payment_method: refundForm.payment_method,
        description: refundForm.description
      })
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || '退款失敗')
    }

    alert('✅ 課程退款成功！現金流支出與堂數流水帳已同步更新。')
    showRefundModal.value = false
    fetchData()
  } catch (err: any) {
    alert(err.message)
  }
}

const deleteUserPackage = async (pkg: any) => {
  if (pkg.amount !== pkg.remaining_count) {
    return alert(`❌ 無法刪除此包套！\n原因：此包套總堂數為 ${pkg.amount} 堂，但剩餘 ${pkg.remaining_count} 堂（已有堂數被消耗履約）。基於帳務與履約正確性，若要部分結束請使用「退款」功能。`)
  }

  if (!confirm(`確定要刪除「${pkg.client_name}」的「${pkg.course_name}」包套紀錄嗎？\n注意：這將會同步扣除對應的現金預收收入。`)) return

  try {
    const res = await fetch(`${backendUrl}/api/users-courses?id=${pkg.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || '刪除失敗')
    }
    alert('✅ 會員包套已刪除，財務現金流已同步回滾！')
    fetchData()
  } catch (err: any) {
    alert(err.message)
  }
}

onMounted(() => fetchData())
</script>

<template>
  <div class="space-y-4 sm:space-y-6 max-w-7xl mx-auto py-2 sm:py-4 px-2 sm:px-4">
    <!-- 頂部頁頭與操作按鈕區 (針對手機/平板/電腦各視窗優化) -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-gray-200 shadow-xs">
      <div>
        <h1 class="text-xl sm:text-2xl font-black text-[#154337] tracking-tight">課程與療程管理</h1>
        <p class="text-xs text-gray-500 mt-1">管理店內服務價目表與會員包套購買紀錄</p>
      </div>

      <div class="flex flex-row items-center gap-2.5 w-full md:w-auto">
        <button 
          @click="openCourseModal()" 
          class="flex-1 sm:flex-initial px-4 py-2.5 bg-white border border-gray-200 hover:border-[#154337] text-[#154337] rounded-xl text-xs font-bold transition shadow-2xs hover:bg-[#FAF4EE] flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
        >
          <Icon name="mdi:plus-circle-outline" class="text-base" />
          <span>新增課程項目</span>
        </button>

        <button 
          @click="openSellModal()" 
          class="flex-1 sm:flex-initial px-4 py-2.5 bg-[#154337] text-white rounded-xl text-xs font-bold hover:bg-[#0e2f27] transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
        >
          <Icon name="mdi:cart-outline" class="text-base" />
          <span>銷售會員包套</span>
        </button>
      </div>
    </div>

    <!-- 頁籤分頁 (高奢膠囊導航列) -->
    <div class="bg-[#FAF4EE]/70 p-1.5 rounded-2xl flex border border-[#154337]/10 w-full sm:w-auto max-w-md">
      <button 
        @click="currentTab = 'catalog'" 
        :class="['flex-1 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5', currentTab === 'catalog' ? 'bg-[#154337] text-white shadow-2xs' : 'text-gray-600 hover:text-[#154337]']"
      >
        <span>📖 服務項目與價目</span>
        <span :class="['px-1.5 py-0.2 rounded-full text-[10px] font-mono', currentTab === 'catalog' ? 'bg-white/20 text-white' : 'bg-gray-200/80 text-gray-600']">
          {{ coursesList.length }}
        </span>
      </button>
      <button 
        @click="currentTab = 'user_packages'" 
        :class="['flex-1 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5', currentTab === 'user_packages' ? 'bg-[#154337] text-white shadow-2xs' : 'text-gray-600 hover:text-[#154337]']"
      >
        <span>👤 會員包套剩餘堂數</span>
        <span :class="['px-1.5 py-0.2 rounded-full text-[10px] font-mono', currentTab === 'user_packages' ? 'bg-white/20 text-white' : 'bg-gray-200/80 text-gray-600']">
          {{ showFinishedPackages ? userCoursesList.length : activePackagesCount }}
        </span>
      </button>
    </div>

    <!-- 載入狀態 Indicator -->
    <div v-if="loading" class="text-center py-16 text-gray-400 text-xs sm:text-sm bg-white rounded-2xl border border-gray-200 flex items-center justify-center gap-2">
      <Icon name="mdi:loading" class="animate-spin text-xl text-[#154337]" />
      <span class="font-bold text-gray-500">載入課程資料中...</span>
    </div>
    
    <div v-else>
      <!-- 區塊 A: 服務項目與價目 (卡片網格，極致行動裝置適應) -->
      <div v-if="currentTab === 'catalog'" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
        <div v-if="coursesList.length === 0" class="col-span-full py-16 text-center text-gray-400 border border-dashed border-gray-300 rounded-2xl text-xs sm:text-sm bg-white">
          目前尚無任何課程方案，請點擊右上角「新增課程項目」建檔。
        </div>

        <div 
          v-for="course in coursesList" 
          :key="course.id" 
          class="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/90 shadow-2xs flex flex-col justify-between hover:shadow-md transition relative group"
        >
          <div>
            <!-- 卡片頂部標題與常駐操作按鈕（行動端常駐顯示，電腦端 hover 放大） -->
            <div class="flex justify-between items-start gap-2 mb-2">
              <h3 class="font-bold text-base text-gray-900 leading-snug">{{ course.name }}</h3>
              <div class="flex items-center gap-1 shrink-0">
                <button 
                  @click="openCourseModal(course)" 
                  class="text-gray-400 hover:text-[#154337] p-1.5 rounded-lg hover:bg-gray-100 transition cursor-pointer"
                  title="編輯課程"
                >
                  <Icon name="mdi:pencil" size="16" />
                </button>
                <button 
                  @click="deleteCourse(course.id, course.name)" 
                  class="text-gray-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                  title="刪除課程"
                >
                  <Icon name="mdi:delete-outline" size="16" />
                </button>
              </div>
            </div>
            
            <p class="text-xs text-gray-500 leading-relaxed min-h-[38px] line-clamp-2">
              {{ course.description || '無詳細說明' }}
            </p>
          </div>

          <div class="mt-4 pt-3 border-t border-gray-100/90 flex items-center justify-between bg-[#FAF4EE]/50 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 p-3.5 sm:p-4 rounded-b-2xl">
            <div>
              <span class="text-[10px] text-gray-400 font-bold block">預估成本</span>
              <span class="text-xs font-mono font-bold text-gray-600">${{ (course.cost || 0).toLocaleString() }}</span>
            </div>

            <div class="text-right">
              <span class="text-[10px] text-[#154337] font-bold block">單次價目</span>
              <span class="text-lg font-black text-[#154337] font-mono">${{ (course.price || 0).toLocaleString() }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 區塊 B: 會員包套剩餘堂數 (手機端響應卡片 + 桌機精緻表格) -->
      <div v-if="currentTab === 'user_packages'" class="space-y-3.5 sm:space-y-4">
        <!-- 頂部即時搜尋與已用罄開關工具列 (極致手機與桌機適應) -->
        <div class="bg-white p-3 sm:p-4 rounded-2xl border border-gray-200/90 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
          <!-- 搜尋框 (支援客戶姓名、電話、課程名稱即時過濾) -->
          <div class="relative flex-1 max-w-full sm:max-w-md">
            <Icon 
              name="mdi:magnify" 
              class="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-base" 
            />
            <input 
              type="text" 
              v-model="packageSearchText" 
              placeholder="搜尋客戶姓名、電話或課程名稱..." 
              class="w-full pl-9.5 pr-8 py-2 bg-gray-50/70 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-[#154337] rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-[#154337]/20 outline-none transition"
            />
            <button 
              v-if="packageSearchText" 
              @click="packageSearchText = ''" 
              type="button"
              class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-200 transition cursor-pointer"
              title="清除搜尋"
            >
              <Icon name="mdi:close" size="14" />
            </button>
          </div>

          <!-- 右側：已用罄切換開關與筆數摘要 -->
          <div class="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-gray-100">
            <!-- 已用罄切換開關 (高階平滑 Switch) -->
            <label class="flex items-center gap-2 cursor-pointer select-none group">
              <span class="text-xs font-bold text-gray-600 group-hover:text-[#154337] transition">
                顯示已用罄包套
                <span class="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-gray-100 text-gray-500 font-bold border border-gray-200">
                  {{ finishedPackagesCount }}
                </span>
              </span>
              <!-- Toggle switch pill -->
              <div class="relative inline-flex items-center">
                <input 
                  type="checkbox" 
                  v-model="showFinishedPackages" 
                  class="sr-only peer"
                />
                <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#154337] transition-colors duration-200"></div>
              </div>
            </label>

            <!-- 筆數統計標籤 -->
            <div class="hidden sm:block text-[11px] font-bold text-gray-400 border-l border-gray-200 pl-3">
              顯示 <span class="text-gray-800 font-mono">{{ filteredUserPackagesList.length }}</span> 筆
            </div>
          </div>
        </div>

        <!-- 列表容器 -->
        <div class="bg-transparent sm:bg-white rounded-2xl sm:shadow-xs sm:border sm:border-gray-200 overflow-hidden">
          <div v-if="filteredUserPackagesList.length === 0" class="py-14 sm:py-16 text-center text-gray-400 text-xs sm:text-sm bg-white rounded-2xl border sm:border-0 border-gray-200">
            <Icon name="mdi:package-variant-closed" class="text-3xl text-gray-300 mx-auto mb-2" />
            <p v-if="packageSearchText">找不到符合「{{ packageSearchText }}」的會員包套。</p>
            <p v-else-if="!showFinishedPackages && activePackagesCount === 0 && finishedPackagesCount > 0">
              目前無進行中的包套（共有 {{ finishedPackagesCount }} 筆已用罄包套，可開啟右上角開關查看）。
            </p>
            <p v-else>目前尚無會員購買包套紀錄。</p>
          </div>

          <div v-else>
            <!-- 📱 手機端：獨立雙重優化包套卡片 (< 640px) -->
            <div class="block sm:hidden space-y-3">
              <div 
                v-for="pkg in filteredUserPackagesList" 
                :key="pkg.id" 
                :class="['bg-white rounded-2xl p-4 border shadow-2xs space-y-3 transition', pkg.remaining_count > 0 ? 'border-gray-200/90' : 'border-gray-200 bg-gray-50/40 opacity-85']"
              >
                <!-- 頂列：狀態徽章與購買日期 -->
                <div class="flex justify-between items-center text-xs">
                  <span class="text-gray-400 font-mono text-[10px]">購買: {{ pkg.purchase_date?.slice(0, 10) || '-' }}</span>
                  <span :class="['px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0', pkg.remaining_count > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200']">
                    {{ pkg.remaining_count > 0 ? '進行中' : '已用罄' }}
                  </span>
                </div>

                <!-- 中間列：客戶與課程說明 -->
                <div>
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <h3 class="font-bold text-gray-900 text-base">{{ pkg.client_name || '未知客戶' }}</h3>
                    <span v-if="pkg.client_phone" class="text-[11px] text-gray-400 font-mono">({{ pkg.client_phone }})</span>
                  </div>
                  <p class="text-xs font-bold text-[#154337] mt-0.5">{{ pkg.course_name || '未知課程' }}</p>
                </div>

                <!-- 剩餘堂數進度統計框 -->
                <div class="flex justify-between items-center bg-[#FAF4EE]/70 p-3 rounded-xl">
                  <span class="text-xs text-gray-500 font-bold">堂數進度</span>
                  <div class="text-right">
                    <span :class="['text-base font-black font-mono', pkg.remaining_count > 0 ? 'text-[#154337]' : 'text-rose-500']">{{ pkg.remaining_count }}</span>
                    <span class="text-gray-400 mx-1">/</span>
                    <span class="text-xs font-bold text-gray-600 font-mono">{{ pkg.amount }} 堂</span>
                  </div>
                </div>

                <!-- 操作按鈕列 (手機端 4 欄等寬等高按鈕網格，圖示與文字完全對齊) -->
                <div class="grid grid-cols-4 gap-1.5 pt-1 border-t border-gray-100">
                  <button 
                    @click="openHistoryModal(pkg)" 
                    class="h-8 inline-flex items-center justify-center gap-0.5 px-1.5 bg-[#154337]/10 text-[#154337] hover:bg-[#154337]/20 border border-[#154337]/20 rounded-xl text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer"
                    title="查看使用與異動紀錄"
                  >
                    <Icon name="mdi:history" size="13" />
                    <span>紀錄</span>
                  </button>

                  <button 
                    @click="openEditPackageModal(pkg)" 
                    class="h-8 inline-flex items-center justify-center gap-0.5 px-1.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 transition shadow-2xs active:scale-95 cursor-pointer"
                  >
                    <Icon name="mdi:pencil-outline" size="13" />
                    <span>修改</span>
                  </button>

                  <button 
                    @click="openRefundModal(pkg)" 
                    :disabled="pkg.remaining_count <= 0" 
                    class="h-8 inline-flex items-center justify-center gap-0.5 px-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-xs font-bold hover:bg-amber-100 transition shadow-2xs disabled:opacity-40 disabled:pointer-events-none active:scale-95 cursor-pointer"
                  >
                    <Icon name="mdi:cash-refund" size="13" />
                    <span>退款</span>
                  </button>

                  <button 
                    @click="deleteUserPackage(pkg)" 
                    class="h-8 inline-flex items-center justify-center gap-0.5 px-1.5 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs font-bold hover:bg-rose-100 transition shadow-2xs active:scale-95 cursor-pointer"
                  >
                    <Icon name="mdi:trash-can-outline" size="13" />
                    <span>刪除</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- 💻 桌機端：傳統精緻表格 (>= 640px，按鈕尺寸與圖示完全規格化一致) -->
            <div class="hidden sm:block overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                    <th class="p-4 font-bold">購買日期</th>
                    <th class="p-4 font-bold">客戶姓名</th>
                    <th class="p-4 font-bold">購買課程</th>
                    <th class="p-4 font-bold text-center">剩餘 / 總堂數</th>
                    <th class="p-4 font-bold">狀態</th>
                    <th class="p-4 font-bold text-right">操作</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 text-sm">
                  <tr v-for="pkg in filteredUserPackagesList" :key="pkg.id" :class="['transition', pkg.remaining_count > 0 ? 'hover:bg-[#FAF4EE]/50' : 'bg-gray-50/40 text-gray-400 hover:bg-gray-50']">
                    <td class="p-4 text-gray-500 font-mono text-xs">{{ pkg.purchase_date?.slice(0, 10) || '-' }}</td>
                    <td class="p-4 font-bold text-gray-900">
                      {{ pkg.client_name || '未知客戶' }}
                      <span v-if="pkg.client_phone" class="text-xs text-gray-400 font-mono font-normal ml-1">({{ pkg.client_phone }})</span>
                    </td>
                    <td class="p-4 text-[#154337] font-bold">{{ pkg.course_name || '未知課程' }}</td>
                    <td class="p-4 text-center font-mono">
                      <span :class="['font-black text-base', pkg.remaining_count > 0 ? 'text-[#154337]' : 'text-rose-500']">{{ pkg.remaining_count }}</span>
                      <span class="text-gray-400 mx-1">/</span>
                      <span class="text-gray-500 font-bold text-xs">{{ pkg.amount }} 堂</span>
                    </td>
                    <td class="p-4">
                      <span :class="['px-2.5 py-1 rounded-full text-xs font-bold border shadow-2xs', pkg.remaining_count > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200']">
                        {{ pkg.remaining_count > 0 ? '進行中' : '已用罄' }}
                      </span>
                    </td>
                    <td class="p-4 text-right">
                      <div class="inline-flex items-center justify-end gap-1.5">
                        <button 
                          @click="openHistoryModal(pkg)" 
                          class="h-7.5 inline-flex items-center justify-center gap-1 px-2.5 bg-[#154337]/10 text-[#154337] hover:bg-[#154337]/20 border border-[#154337]/20 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95"
                          title="查看使用與異動紀錄"
                        >
                          <Icon name="mdi:history" size="13" />
                          <span>紀錄</span>
                        </button>
                        <button 
                          @click="openEditPackageModal(pkg)" 
                          class="h-7.5 inline-flex items-center justify-center gap-1 px-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 hover:border-gray-300 transition shadow-2xs cursor-pointer active:scale-95"
                          title="修改包套內容與價格"
                        >
                          <Icon name="mdi:pencil-outline" size="13" />
                          <span>修改</span>
                        </button>
                        <button 
                          @click="openRefundModal(pkg)" 
                          :disabled="pkg.remaining_count <= 0" 
                          class="h-7.5 inline-flex items-center justify-center gap-1 px-2.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-xs font-bold hover:bg-amber-100 transition shadow-2xs disabled:opacity-40 disabled:pointer-events-none cursor-pointer active:scale-95"
                          title="辦理課程退款"
                        >
                          <Icon name="mdi:cash-refund" size="13" />
                          <span>退款</span>
                        </button>
                        <button 
                          @click="deleteUserPackage(pkg)" 
                          class="h-7.5 inline-flex items-center justify-center gap-1 px-2.5 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs font-bold hover:bg-rose-100 transition shadow-2xs cursor-pointer active:scale-95"
                          title="刪除包套紀錄"
                        >
                          <Icon name="mdi:trash-can-outline" size="13" />
                          <span>刪除</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 課程 Modal -->
    <div v-if="showCourseModal" class="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 relative border border-gray-100 animate-fade-in">
        <button @click="showCourseModal = false" class="absolute top-4 right-4 text-gray-400 hover:text-gray-800 bg-gray-100 rounded-full p-1 transition cursor-pointer">
          <Icon name="mdi:close" size="20" />
        </button>
        <h3 class="text-lg font-bold text-[#154337] mb-5 flex items-center gap-2">
          <Icon name="mdi:flask-outline" class="text-xl" /> 
          <span>{{ courseForm.id ? '編輯課程方案' : '新增課程方案' }}</span>
        </h3>
        
        <form @submit.prevent="saveCourse" class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">課程名稱 <span class="text-rose-500">*</span></label>
            <input type="text" v-model="courseForm.name" required placeholder="例如：精緻美學管理" class="w-full border border-gray-300 rounded-xl p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">預估單次成本 ($) <span class="text-rose-500">*</span></label>
              <input type="number" v-model.number="courseForm.cost" required min="0" class="w-full border border-gray-300 rounded-xl p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none font-mono" />
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">單次售價 ($) <span class="text-rose-500">*</span></label>
              <input type="number" v-model.number="courseForm.price" required min="0" class="w-full border border-gray-300 rounded-xl p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none font-mono" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">課程說明</label>
            <textarea v-model="courseForm.description" rows="3" placeholder="簡述課程內容與特色..." class="w-full border border-gray-300 rounded-xl p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none"></textarea>
          </div>
          <div class="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button type="button" @click="showCourseModal = false" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-200 transition">取消</button>
            <button type="submit" class="px-4 py-2 bg-[#154337] text-white rounded-xl text-xs font-bold hover:bg-[#0e2f27] transition shadow-md">儲存課程</button>
          </div>
        </form>
      </div>
    </div>

    <!-- 銷售 Modal -->
    <div v-if="showSellModal" class="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 relative border border-gray-100 animate-fade-in">
        <button @click="showSellModal = false" class="absolute top-4 right-4 text-gray-400 hover:text-gray-800 bg-gray-100 rounded-full p-1 transition cursor-pointer">
          <Icon name="mdi:close" size="20" />
        </button>
        <h3 class="text-lg font-bold text-[#154337] mb-5 flex items-center gap-2">
          <Icon name="mdi:cart-outline" class="text-xl" /> 
          <span>銷售會員包套</span>
        </h3>
        <form @submit.prevent="handleSellPackage" class="space-y-4">
          <!-- 搜尋 + 下拉選單會員選擇器 -->
          <div class="relative space-y-1">
            <label class="block text-xs font-bold text-gray-700">選擇客戶 <span class="text-rose-500">*</span></label>
            <div class="relative">
              <input 
                type="text" 
                v-model="userSearchText" 
                @focus="isUserDropdownOpen = true"
                @input="isUserDropdownOpen = true"
                placeholder="輸入姓名或電話搜尋會員..." 
                class="w-full border border-gray-300 rounded-xl p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none pr-8 font-medium"
              />
              <button 
                v-if="sellForm.user_id || userSearchText" 
                type="button" 
                @click="clearSelectedUser" 
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-gray-100 rounded-full p-0.5 cursor-pointer"
              >
                <Icon name="mdi:close" size="14" />
              </button>
              <Icon 
                v-else 
                name="mdi:chevron-down" 
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" 
                size="18" 
              />
            </div>

            <!-- 可搜尋下拉清單 -->
            <div 
              v-if="isUserDropdownOpen" 
              class="absolute left-0 right-0 top-full mt-1 bg-white rounded-2xl shadow-xl border border-gray-200 z-50 max-h-52 overflow-y-auto divide-y divide-gray-50"
            >
              <div 
                v-if="filteredUsersList.length === 0" 
                class="p-3 text-xs text-gray-400 text-center"
              >
                找不到符合的會員
              </div>
              <div 
                v-for="u in filteredUsersList" 
                :key="u.id" 
                @click="selectUserForSell(u)"
                :class="['p-2.5 text-xs sm:text-sm cursor-pointer hover:bg-[#FAF4EE] transition flex justify-between items-center', String(sellForm.user_id) === String(u.id) ? 'bg-[#FAF4EE] font-bold text-[#154337]' : 'text-gray-700']"
              >
                <div class="flex items-center gap-1.5">
                  <span class="font-bold">{{ u.last_name }}{{ u.first_name }}</span>
                  <span :class="['text-[10px] px-1.5 py-0.5 rounded-full font-bold', u.is_ghost === 1 ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700']">
                    {{ u.is_ghost === 1 ? '👻 幽靈' : '🌐 正式' }}
                  </span>
                </div>
                <span class="text-gray-400 font-mono text-xs">{{ u.phone }}</span>
              </div>
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">選擇購買課程 <span class="text-rose-500">*</span></label>
            <select v-model="sellForm.course_id" @change="updateSellTotalPrice" required class="w-full border border-gray-300 rounded-xl p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none">
              <option value="" disabled>請選擇課程...</option>
              <option v-for="c in coursesList" :key="c.id" :value="c.id">{{ c.name }} (單價 ${{ c.price }})</option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">購買堂數 <span class="text-rose-500">*</span></label>
              <input type="number" v-model.number="sellForm.amount" @input="updateSellTotalPrice" required min="1" class="w-full border border-gray-300 rounded-xl p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none font-mono" />
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">成交總金額 ($) <span class="text-rose-500">*</span></label>
              <input type="number" v-model.number="sellForm.custom_total_price" required min="0" placeholder="可手動修改特價" class="w-full border border-amber-300 bg-amber-50/50 text-amber-900 rounded-xl p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#154337] outline-none font-mono font-bold" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">收款方式 <span class="text-rose-500">*</span></label>
            <select v-model="sellForm.payment_method" class="w-full border border-gray-300 rounded-xl p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none">
              <option value="Cash">現金 (Cash)</option>
              <option value="Line Pay">Line Pay</option>
              <option value="Credit Card">信用卡</option>
              <option value="Transfer">匯款</option>
            </select>
          </div>
          <div v-if="sellForm.course_id && sellForm.amount > 0" class="bg-emerald-50 p-3 rounded-2xl border border-emerald-100 flex justify-between items-center">
            <span class="text-xs text-emerald-800 font-bold">預收總金額試算：</span>
            <span class="text-lg font-black text-emerald-700 font-mono">
              ${{ (coursesList.find(c => c.id === Number(sellForm.course_id))?.price * sellForm.amount).toLocaleString() }}
            </span>
          </div>
          <div class="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button type="button" @click="showSellModal = false" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-200 transition">取消</button>
            <button type="submit" class="px-4 py-2 bg-[#154337] text-white rounded-xl text-xs font-bold hover:bg-[#0e2f27] transition shadow-md">確認銷售與收款</button>
          </div>
        </form>
      </div>
    </div>

    <!-- 編輯會員包套 Modal -->
    <div v-if="showEditPackageModal" class="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 relative border border-gray-100 animate-fade-in">
        <button @click="showEditPackageModal = false" class="absolute top-4 right-4 text-gray-400 hover:text-gray-800 bg-gray-100 rounded-full p-1 transition cursor-pointer">
          <Icon name="mdi:close" size="20" />
        </button>
        <h3 class="text-lg font-bold text-[#154337] mb-1 flex items-center gap-2">
          <Icon name="mdi:pencil-box-outline" class="text-xl" /> 
          <span>修改會員包套內容</span>
        </h3>
        <p class="text-xs text-gray-500 mb-4">客戶：<span class="font-bold text-gray-800">{{ editPackageForm.client_name }}</span></p>
        
        <form @submit.prevent="saveEditPackage" class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">更改課程方案 <span class="text-rose-500">*</span></label>
            <select v-model="editPackageForm.course_id" @change="updateEditPackageTotalPrice" required class="w-full border border-gray-300 rounded-xl p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none">
              <option v-for="c in coursesList" :key="c.id" :value="c.id">{{ c.name }} (單價 ${{ c.price }})</option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">更改總堂數 <span class="text-rose-500">*</span></label>
              <input type="number" v-model.number="editPackageForm.amount" @input="updateEditPackageTotalPrice" required min="1" class="w-full border border-gray-300 rounded-xl p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none font-mono" />
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">成交總金額/銷售價格 ($) <span class="text-rose-500">*</span></label>
              <input type="number" v-model.number="editPackageForm.custom_total_price" required min="0" placeholder="可修改成交總價" class="w-full border border-amber-300 bg-amber-50/50 text-amber-900 rounded-xl p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#154337] outline-none font-mono font-bold" />
            </div>
          </div>
          <p class="text-[11px] text-amber-700">⚠️ 調整總堂數與成交總金額將自動連動計算剩餘堂數，並同步調整現金流與預收帳目金額。</p>
          <div class="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button type="button" @click="showEditPackageModal = false" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-200 transition">取消</button>
            <button type="submit" class="px-4 py-2 bg-[#154337] text-white rounded-xl text-xs font-bold hover:bg-[#0e2f27] transition shadow-md">確認修改</button>
          </div>
        </form>
      </div>
    </div>

    <!-- 課程退款 Modal -->
    <div v-if="showRefundModal" class="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 relative border border-gray-100 animate-fade-in">
        <button @click="showRefundModal = false" class="absolute top-4 right-4 text-gray-400 hover:text-gray-800 bg-gray-100 rounded-full p-1 transition cursor-pointer">
          <Icon name="mdi:close" size="20" />
        </button>
        <h3 class="text-lg font-bold text-rose-600 mb-1 flex items-center gap-2">
          <Icon name="mdi:cash-refund" class="text-xl" /> 
          <span>辦理課程退款</span>
        </h3>
        <p class="text-xs text-gray-500 mb-4">客戶：<span class="font-bold text-gray-800">{{ refundForm.client_name }}</span> | 課程：<span class="font-bold text-gray-800">{{ refundForm.course_name }}</span></p>
        
        <form @submit.prevent="submitRefund" class="space-y-4">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">剩餘可退堂數</label>
              <input type="text" :value="refundForm.remaining_count + ' 堂'" disabled class="w-full border border-gray-200 bg-gray-50 rounded-xl p-2.5 text-xs sm:text-sm text-gray-500 font-bold font-mono" />
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">欲退還堂數 <span class="text-rose-500">*</span></label>
              <input type="number" v-model.number="refundForm.refund_count" @input="handleRefundCountChange" required min="1" :max="refundForm.remaining_count" class="w-full border border-gray-300 rounded-xl p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-rose-500 bg-white outline-none font-bold text-rose-600 font-mono" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">退款金額 ($) <span class="text-rose-500">*</span></label>
              <input type="number" v-model.number="refundForm.refund_amount" required min="0" class="w-full border border-gray-300 rounded-xl p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-rose-500 bg-white outline-none font-bold font-mono" />
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">退款支付方式 <span class="text-rose-500">*</span></label>
              <select v-model="refundForm.payment_method" class="w-full border border-gray-300 rounded-xl p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-rose-500 bg-white outline-none">
                <option value="Cash">現金退款 (Cash)</option>
                <option value="Line Pay">Line Pay 退款</option>
                <option value="Credit Card">信用卡刷退</option>
                <option value="Transfer">銀行匯款退回</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">退款備註說明</label>
            <input type="text" v-model="refundForm.description" placeholder="例如：因個人因素辦理剩餘堂數退費" class="w-full border border-gray-300 rounded-xl p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-rose-500 bg-white outline-none" />
          </div>

          <div class="bg-rose-50 p-3 rounded-2xl border border-rose-100 text-xs text-rose-700 space-y-1">
            <p class="font-bold">💡 財務與帳務連動提示：</p>
            <p>1. 將在現金流（Cash Transactions）自動新增一筆<b>支出金額</b>。</p>
            <p>2. 將在堂數流水帳（Appointment Courses）寫入一筆 <b>refund 類型</b>的退款紀錄與剩餘堂數快照。</p>
          </div>

          <div class="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button type="button" @click="showRefundModal = false" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-200 transition">取消</button>
            <button type="submit" class="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition shadow-md">確認執行退款</button>
          </div>
        </form>
      </div>
    </div>

    <!-- 🌟 包套使用與異動紀錄 Modal (高階時間軸與進度展示，深耕手機端與桌機端體驗) -->
    <div v-if="showHistoryModal" class="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50">
      <div class="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90dvh] flex flex-col relative border border-gray-100 animate-fade-in overflow-hidden">
        <!-- 彈窗 Header -->
        <div class="p-4 sm:p-5 pb-3 sm:pb-4 border-b border-gray-100 flex justify-between items-start">
          <div>
            <div class="flex items-center gap-2">
              <span class="p-1.5 rounded-xl bg-[#154337]/10 text-[#154337]">
                <Icon name="mdi:history" class="text-base sm:text-lg" />
              </span>
              <h3 class="text-base sm:text-lg font-bold text-[#154337]">包套課程使用紀錄</h3>
            </div>
            <p class="text-xs text-gray-500 mt-1">
              客戶：<span class="font-bold text-gray-800">{{ selectedPackageForHistory?.client_name }}</span>
              <span v-if="selectedPackageForHistory?.client_phone" class="font-mono text-gray-400 ml-1">({{ selectedPackageForHistory?.client_phone }})</span>
              <span class="mx-1.5 text-gray-300">|</span>
              課程：<span class="font-bold text-[#154337]">{{ selectedPackageForHistory?.course_name }}</span>
            </p>
          </div>
          <button 
            @click="showHistoryModal = false" 
            class="text-gray-400 hover:text-gray-800 bg-gray-100 rounded-full p-1.5 transition cursor-pointer shrink-0"
          >
            <Icon name="mdi:close" size="18" />
          </button>
        </div>

        <!-- 堂數概覽與進度條 -->
        <div class="bg-[#FAF4EE]/70 p-3.5 sm:p-4 mx-3 sm:mx-5 mt-3 sm:mt-4 rounded-2xl border border-[#154337]/10">
          <div class="flex justify-between items-center text-xs">
            <div>
              <span class="text-gray-400 font-bold block text-[10px]">購買日期</span>
              <span class="font-mono font-bold text-gray-700">{{ selectedPackageForHistory?.purchase_date?.slice(0, 10) || '-' }}</span>
            </div>
            <div class="text-center">
              <span class="text-gray-400 font-bold block text-[10px]">已履約消耗</span>
              <span class="font-mono font-bold text-gray-700">{{ (selectedPackageForHistory?.amount || 0) - (selectedPackageForHistory?.remaining_count || 0) }} 堂</span>
            </div>
            <div class="text-right">
              <span class="text-gray-400 font-bold block text-[10px]">當前剩餘</span>
              <span :class="['font-mono font-black text-sm sm:text-base', (selectedPackageForHistory?.remaining_count || 0) > 0 ? 'text-[#154337]' : 'text-rose-500']">
                {{ selectedPackageForHistory?.remaining_count }} / {{ selectedPackageForHistory?.amount }} 堂
              </span>
            </div>
          </div>

          <!-- 進度條 -->
          <div class="w-full bg-gray-200/80 rounded-full h-2 mt-2.5 overflow-hidden">
            <div 
              class="bg-[#154337] h-full rounded-full transition-all duration-500" 
              :style="{ width: `${Math.min(100, Math.max(0, (((selectedPackageForHistory?.amount || 1) - (selectedPackageForHistory?.remaining_count || 0)) / (selectedPackageForHistory?.amount || 1)) * 100))}%` }"
            ></div>
          </div>
        </div>

        <!-- 異動時間軸列表 (滾動區) -->
        <div class="p-3 sm:p-5 flex-1 overflow-y-auto max-h-[50vh] space-y-3">
          <!-- 載入中 -->
          <div v-if="loadingHistory" class="py-10 text-center text-gray-400 text-xs flex items-center justify-center gap-2">
            <Icon name="mdi:loading" class="animate-spin text-lg text-[#154337]" />
            <span>載入異動明細中...</span>
          </div>

          <!-- 無紀錄 -->
          <div v-else-if="packageHistoryList.length === 0" class="py-10 text-center text-gray-400 text-xs bg-gray-50/70 rounded-2xl border border-dashed border-gray-200">
            <Icon name="mdi:clipboard-text-clock-outline" class="text-3xl text-gray-300 mx-auto mb-2" />
            <p class="font-bold text-gray-600">尚無使用或異動紀錄</p>
            <p class="text-[11px] text-gray-400 mt-0.5">此包套目前完整保留中，未有到店預約扣堂或退款紀錄。</p>
          </div>

          <!-- 歷史時間軸 -->
          <div v-else class="space-y-2.5 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-gray-200/70">
            <div 
              v-for="item in packageHistoryList" 
              :key="item.id" 
              class="relative pl-8 text-xs"
            >
              <!-- 時間軸節點 Icon -->
              <div 
                :class="[
                  'absolute left-1.5 top-2 -translate-x-1/2 w-4.5 h-4.5 rounded-full flex items-center justify-center text-white text-[9px] shadow-2xs ring-4 ring-white',
                  item.type === 'usage' ? 'bg-emerald-600' :
                  item.type === 'refund' ? 'bg-rose-500' :
                  'bg-amber-500'
                ]"
              >
                <Icon :name="item.type === 'usage' ? 'mdi:check' : item.type === 'refund' ? 'mdi:cash-refund' : 'mdi:swap-horizontal'" size="11" />
              </div>

              <!-- 紀錄卡片 -->
              <div class="bg-white border border-gray-200/90 rounded-2xl p-3 shadow-2xs space-y-1.5 hover:border-[#154337]/30 transition">
                <!-- 頂列：類型標籤 + 堂數變動 + 剩餘快照 -->
                <div class="flex justify-between items-center gap-1">
                  <div class="flex items-center gap-1.5">
                    <span 
                      :class="[
                        'px-2 py-0.5 rounded-md text-[10px] font-bold border',
                        item.type === 'usage' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        item.type === 'refund' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        'bg-amber-50 text-amber-700 border-amber-200'
                      ]"
                    >
                      {{ 
                        item.type === 'usage' ? '到店履約扣堂' :
                        item.type === 'refund' ? '課程退款扣除' :
                        item.type === 'adjustment' ? '手動調整' : '異動'
                      }}
                    </span>
                    <span class="font-mono font-black text-rose-600 text-xs">-{{ item.use_count }} 堂</span>
                  </div>

                  <span class="text-[10.5px] font-mono font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">
                    剩餘: {{ item.balance_after !== null && item.balance_after !== undefined ? item.balance_after + ' 堂' : '-' }}
                  </span>
                </div>

                <!-- 預約關聯資訊 (若為履約使用) -->
                <div v-if="item.appointment_date || item.appointment_code" class="text-[11px] text-gray-600 bg-[#FAF4EE]/50 p-2 rounded-xl flex flex-wrap items-center gap-x-3 gap-y-1">
                  <div v-if="item.appointment_date" class="flex items-center gap-1">
                    <Icon name="mdi:calendar-clock" class="text-gray-400" size="13" />
                    <span>{{ item.appointment_date }} {{ item.appointment_start_time || '' }}</span>
                  </div>
                  <div v-if="item.beautician_name" class="flex items-center gap-1">
                    <Icon name="mdi:account-heart-outline" class="text-gray-400" size="13" />
                    <span>美容師: {{ item.beautician_name }}</span>
                  </div>
                  <div v-if="item.appointment_code" class="text-gray-400 font-mono">
                    #{{ item.appointment_code }}
                  </div>
                </div>

                <!-- 說明備註與紀錄時間 -->
                <div class="flex justify-between items-center text-[10px] text-gray-400 pt-1 border-t border-gray-50">
                  <span class="truncate max-w-[180px] sm:max-w-[240px] text-gray-500">{{ item.description || '-' }}</span>
                  <span class="font-mono shrink-0">{{ item.created_at?.slice(0, 16) || '' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 彈窗 Footer -->
        <div class="p-3.5 sm:p-4 border-t border-gray-100 bg-gray-50/50 flex justify-end">
          <button 
            type="button" 
            @click="showHistoryModal = false" 
            class="px-5 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-100 transition shadow-2xs cursor-pointer active:scale-95"
          >
            關閉
          </button>
        </div>
      </div>
    </div>

  </div>
</template>