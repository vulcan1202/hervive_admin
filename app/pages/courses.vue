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
const showRefundModal = ref(false) // 🌟 退款 Modal 控制

// 表單 State
const courseForm = reactive({ id: null as number | null, name: '', description: '', price: 0, cost: 0 })
const sellForm = reactive({ user_id: '', course_id: '', amount: 1, payment_method: 'Cash' })
const editPackageForm = reactive({ id: null as number | null, course_id: '', amount: 1, client_name: '', course_name: '' })

// 🌟 退款表單 State
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
    const totalPrice = selectedCourse.price * sellForm.amount

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
        description: `購買「${selectedCourse.name}」共 ${sellForm.amount} 堂`,
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

const openEditPackageModal = (pkg: any) => {
  editPackageForm.id = pkg.id
  editPackageForm.course_id = pkg.course_id
  editPackageForm.amount = pkg.amount
  editPackageForm.client_name = pkg.client_name || '客戶'
  editPackageForm.course_name = pkg.course_name || '課程'
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
        amount: Number(editPackageForm.amount)
      })
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || '修改失敗')
    }
    alert('✅ 會員包套內容修改成功！財務現金流已同步自動調整。')
    showEditPackageModal.value = false
    fetchData()
  } catch (err: any) {
    alert(err.message)
  }
}

// 🌟 開啟退款 Modal
const openRefundModal = (pkg: any) => {
  if (pkg.remaining_count <= 0) {
    return alert('❌ 此包套剩餘堂數為 0，無法辦理退款！')
  }
  refundForm.user_course_id = pkg.id
  refundForm.client_name = pkg.client_name || '客戶'
  refundForm.course_name = pkg.course_name || '課程'
  refundForm.unit_price = pkg.course_price || 0
  refundForm.remaining_count = pkg.remaining_count
  refundForm.refund_count = pkg.remaining_count // 預設全部退款
  refundForm.refund_amount = pkg.remaining_count * (pkg.course_price || 0)
  refundForm.payment_method = 'Cash'
  refundForm.description = `辦理「${pkg.course_name}」課程退款`
  showRefundModal.value = true
}

// 🌟 當退款堂數改變時，自動計算建議退款金額
const handleRefundCountChange = () => {
  if (refundForm.refund_count > refundForm.remaining_count) {
    refundForm.refund_count = refundForm.remaining_count
  }
  if (refundForm.refund_count < 1) {
    refundForm.refund_count = 1
  }
  refundForm.refund_amount = refundForm.refund_count * refundForm.unit_price
}

// 🌟 提交退款請求
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
    return alert(`❌ 無法刪除此包套！\n原因：此包套總堂數為 ${pkg.amount} 堂，但剩餘 ${pkg.remaining_count} 堂（已有堂數被消耗履約）。基於帳務與履約正確性，若要部分結束請使用「退款」功能[cite: 20]。`)
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
  <div class="space-y-6 max-w-7xl mx-auto">
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 class="text-2xl font-bold text-[#154337]">課程與療程管理</h1>
        <p class="text-xs text-gray-500 mt-1">管理店內服務價目表與會員包套購買紀錄</p>
      </div>
      <div class="flex gap-2 w-full sm:w-auto">
        <button @click="openCourseModal()" class="flex-1 sm:flex-none px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-sm">
          + 新增課程項目
        </button>
        <button @click="showSellModal = true" class="flex-1 sm:flex-none px-4 py-2 bg-[#154337] text-white rounded-xl text-xs font-bold hover:bg-opacity-90 shadow-sm">
          🛒 銷售會員包套
        </button>
      </div>
    </div>

    <div class="flex border-b border-gray-200 text-sm font-bold">
      <button @click="currentTab = 'catalog'" :class="['py-2.5 px-4 border-b-2 transition', currentTab === 'catalog' ? 'border-[#154337] text-[#154337]' : 'border-transparent text-gray-400 hover:text-gray-600']">
        📖 服務項目與價目 ({{ coursesList.length }})
      </button>
      <button @click="currentTab = 'user_packages'" :class="['py-2.5 px-4 border-b-2 transition', currentTab === 'user_packages' ? 'border-[#154337] text-[#154337]' : 'border-transparent text-gray-400 hover:text-gray-600']">
        👤 會員包套剩餘堂數
      </button>
    </div>

    <div v-if="loading" class="text-center py-10 text-gray-400 text-sm flex items-center justify-center gap-2">
      <Icon name="mdi:loading" class="animate-spin" size="20" /> 載入中...
    </div>
    
    <div v-else>
      <div v-if="currentTab === 'catalog'" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-if="coursesList.length === 0" class="col-span-full py-12 text-center text-gray-400 border border-dashed border-gray-300 rounded-xl text-sm">
          目前尚無任何課程方案。
        </div>
        <div v-for="course in coursesList" :key="course.id" class="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between hover:shadow-md transition group">
          <div>
            <div class="flex justify-between items-start mb-2">
              <h3 class="font-bold text-base text-gray-800">{{ course.name }}</h3>
              <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button @click="openCourseModal(course)" class="text-gray-400 hover:text-[#154337] p-1"><Icon name="mdi:pencil" size="16" /></button>
                <button @click="deleteCourse(course.id, course.name)" class="text-gray-400 hover:text-red-500 p-1"><Icon name="mdi:delete" size="16" /></button>
              </div>
            </div>
            <p class="text-xs text-gray-500 mt-1.5 leading-relaxed min-h-[40px]">{{ course.description || '無詳細說明' }}</p>
          </div>
          <div class="mt-4 pt-3 border-t border-gray-100 flex flex-col gap-1.5">
            <div class="flex justify-between items-center">
              <span class="text-[11px] text-gray-400 font-bold">預估成本</span>
              <span class="text-sm font-bold text-gray-500">${{ course.cost?.toLocaleString() || 0 }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-xs text-gray-400 font-bold">單次價格</span>
              <span class="text-lg font-black text-[#154337]">${{ course.price.toLocaleString() }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 會員包套剩餘堂數清單 (加入修改、退款與刪除按鈕) -->
      <div v-if="currentTab === 'user_packages'" class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div v-if="userCoursesList.length === 0" class="py-12 text-center text-gray-400 text-sm">目前尚無會員購買紀錄。</div>
        <div v-else class="overflow-x-auto">
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
              <tr v-for="pkg in userCoursesList" :key="pkg.id" class="hover:bg-gray-50 transition group">
                <td class="p-4 text-gray-600 font-mono text-xs">{{ pkg.purchase_date?.slice(0, 10) || '-' }}</td>
                <td class="p-4 font-bold text-gray-800">{{ pkg.client_name || '未知客戶' }}</td>
                <td class="p-4 text-[#154337] font-bold">{{ pkg.course_name || '未知課程' }}</td>
                <td class="p-4 text-center">
                  <span :class="['font-black', pkg.remaining_count > 0 ? 'text-[#154337]' : 'text-red-500']">{{ pkg.remaining_count }}</span>
                  <span class="text-gray-400 mx-1">/</span>
                  <span class="text-gray-500 font-bold">{{ pkg.amount }}</span>
                </td>
                <td class="p-4">
                  <span v-if="pkg.remaining_count > 0" class="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">進行中</span>
                  <span v-else class="bg-gray-200 text-gray-600 px-2 py-1 rounded text-xs font-bold">已用罄</span>
                </td>
                <td class="p-4 text-right space-x-1.5">
                  <button @click="openEditPackageModal(pkg)" class="px-2.5 py-1 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-100 shadow-xs">
                    修改
                  </button>
                  <button @click="openRefundModal(pkg)" :disabled="pkg.remaining_count <= 0" class="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-100 shadow-xs disabled:opacity-40">
                    退款
                  </button>
                  <button @click="deleteUserPackage(pkg)" class="px-2.5 py-1 bg-red-50 border border-red-100 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 shadow-xs">
                    刪除
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 課程 Modal 保持不變 -->
    <div v-if="showCourseModal" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
        <button @click="showCourseModal = false" class="absolute top-4 right-4 text-gray-400 hover:text-gray-800 bg-gray-100 rounded-full p-1 transition"><Icon name="mdi:close" size="20" /></button>
        <h3 class="text-xl font-bold text-[#154337] mb-5 flex items-center gap-2"><Icon name="mdi:flask-outline" size="22" /> {{ courseForm.id ? '編輯課程方案' : '新增課程方案' }}</h3>
        
        <form @submit.prevent="saveCourse" class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">課程名稱 <span class="text-red-500">*</span></label>
            <input type="text" v-model="courseForm.name" required placeholder="例如：精緻美學管理" class="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">預估單次成本 ($) <span class="text-red-500">*</span></label>
              <input type="number" v-model.number="courseForm.cost" required min="0" class="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none" />
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">單次售價 ($) <span class="text-red-500">*</span></label>
              <input type="number" v-model.number="courseForm.price" required min="0" class="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">課程說明</label>
            <textarea v-model="courseForm.description" rows="3" placeholder="簡述課程內容與特色..." class="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none"></textarea>
          </div>
          <div class="flex justify-end gap-2 pt-2 border-t border-gray-100 mt-2">
            <button type="button" @click="showCourseModal = false" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-200 transition">取消</button>
            <button type="submit" class="px-4 py-2 bg-[#154337] text-white rounded-xl text-sm font-bold hover:bg-opacity-90 transition">儲存課程</button>
          </div>
        </form>
      </div>
    </div>

    <!-- 銷售 Modal 保持不變 -->
    <div v-if="showSellModal" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
        <button @click="showSellModal = false" class="absolute top-4 right-4 text-gray-400 hover:text-gray-800 bg-gray-100 rounded-full p-1 transition"><Icon name="mdi:close" size="20" /></button>
        <h3 class="text-xl font-bold text-[#154337] mb-5 flex items-center gap-2"><Icon name="mdi:cart-outline" size="22" /> 銷售會員包套</h3>
        <form @submit.prevent="handleSellPackage" class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">選擇客戶 <span class="text-red-500">*</span></label>
            <select v-model="sellForm.user_id" required class="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none">
              <option value="" disabled>請選擇會員...</option>
              <option v-for="u in usersList" :key="u.id" :value="u.id">{{ u.last_name }}{{ u.first_name }} ({{ u.phone }})</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">選擇購買課程 <span class="text-red-500">*</span></label>
            <select v-model="sellForm.course_id" required class="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none">
              <option value="" disabled>請選擇課程...</option>
              <option v-for="c in coursesList" :key="c.id" :value="c.id">{{ c.name }} (單價 ${{ c.price }})</option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">購買堂數 <span class="text-red-500">*</span></label>
              <input type="number" v-model.number="sellForm.amount" required min="1" class="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none" />
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">收款方式 <span class="text-red-500">*</span></label>
              <select v-model="sellForm.payment_method" class="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none">
                <option value="Cash">現金 (Cash)</option>
                <option value="Line Pay">Line Pay</option>
                <option value="Credit Card">信用卡</option>
                <option value="Transfer">匯款</option>
              </select>
            </div>
          </div>
          <div v-if="sellForm.course_id && sellForm.amount > 0" class="bg-emerald-50 p-3 rounded-xl border border-emerald-100 flex justify-between items-center mt-2">
            <span class="text-xs text-emerald-800 font-bold">預收總金額試算：</span>
            <span class="text-lg font-black text-emerald-700">
              ${{ (coursesList.find(c => c.id === Number(sellForm.course_id))?.price * sellForm.amount).toLocaleString() }}
            </span>
          </div>
          <div class="flex justify-end gap-2 pt-2 border-t border-gray-100 mt-2">
            <button type="button" @click="showSellModal = false" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold">取消</button>
            <button type="submit" class="px-4 py-2 bg-[#154337] text-white rounded-xl text-sm font-bold hover:bg-opacity-90 transition">確認銷售與收款</button>
          </div>
        </form>
      </div>
    </div>

    <!-- 編輯會員包套 Modal -->
    <div v-if="showEditPackageModal" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
        <button @click="showEditPackageModal = false" class="absolute top-4 right-4 text-gray-400 hover:text-gray-800 bg-gray-100 rounded-full p-1 transition"><Icon name="mdi:close" size="20" /></button>
        <h3 class="text-xl font-bold text-[#154337] mb-2 flex items-center gap-2"><Icon name="mdi:pencil-box-outline" size="22" /> 修改會員包套內容</h3>
        <p class="text-xs text-gray-500 mb-4">客戶：<span class="font-bold text-gray-800">{{ editPackageForm.client_name }}</span></p>
        
        <form @submit.prevent="saveEditPackage" class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">更改課程方案 <span class="text-red-500">*</span></label>
            <select v-model="editPackageForm.course_id" required class="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none">
              <option v-for="c in coursesList" :key="c.id" :value="c.id">{{ c.name }} (單價 ${{ c.price }})</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">更改總堂數 <span class="text-red-500">*</span></label>
            <input type="number" v-model.number="editPackageForm.amount" required min="1" class="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none" />
            <p class="text-[11px] text-amber-600 mt-1">⚠️ 調整總堂數將自動連動計算剩餘堂數，並同步調整現金流與預收帳目差額。</p>
          </div>
          <div class="flex justify-end gap-2 pt-2 border-t border-gray-100 mt-4">
            <button type="button" @click="showEditPackageModal = false" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-200 transition">取消</button>
            <button type="submit" class="px-4 py-2 bg-[#154337] text-white rounded-xl text-sm font-bold hover:bg-opacity-90 transition">確認修改</button>
          </div>
        </form>
      </div>
    </div>

    <!-- 🌟 課程退款 Modal -->
    <div v-if="showRefundModal" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
        <button @click="showRefundModal = false" class="absolute top-4 right-4 text-gray-400 hover:text-gray-800 bg-gray-100 rounded-full p-1 transition"><Icon name="mdi:close" size="20" /></button>
        <h3 class="text-xl font-bold text-red-600 mb-2 flex items-center gap-2"><Icon name="mdi:cash-refund" size="22" /> 辦理課程退款</h3>
        <p class="text-xs text-gray-500 mb-4">客戶：<span class="font-bold text-gray-800">{{ refundForm.client_name }}</span> | 課程：<span class="font-bold text-gray-800">{{ refundForm.course_name }}</span></p>
        
        <form @submit.prevent="submitRefund" class="space-y-4">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">剩餘可退堂數</label>
              <input type="text" :value="refundForm.remaining_count + ' 堂'" disabled class="w-full border border-gray-200 bg-gray-50 rounded-lg p-2.5 text-sm text-gray-500 font-bold" />
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">欲退還堂數 <span class="text-red-500">*</span></label>
              <input type="number" v-model.number="refundForm.refund_count" @input="handleRefundCountChange" required min="1" :max="refundForm.remaining_count" class="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-red-500 bg-white outline-none font-bold text-red-600" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">退款金額 ($) <span class="text-red-500">*</span></label>
              <input type="number" v-model.number="refundForm.refund_amount" required min="0" class="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-red-500 bg-white outline-none font-bold" />
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">退款支付方式 <span class="text-red-500">*</span></label>
              <select v-model="refundForm.payment_method" class="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-red-500 bg-white outline-none">
                <option value="Cash">現金退款 (Cash)</option>
                <option value="Line Pay">Line Pay 退款</option>
                <option value="Credit Card">信用卡刷退</option>
                <option value="Transfer">銀行匯款退回</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">退款備註說明</label>
            <input type="text" v-model="refundForm.description" placeholder="例如：因個人因素辦理剩餘堂數退費" class="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-red-500 bg-white outline-none" />
          </div>

          <div class="bg-red-50 p-3 rounded-xl border border-red-100 text-xs text-red-700 space-y-1">
            <p class="font-bold">💡 財務與帳務連動提示：</p>
            <p>1. 將在現金流（Cash Transactions）自動新增一筆<b>支出金額</b>。</p>
            <p>2. 將在堂數流水帳（Appointment Courses）寫入一筆 <b>refund 類型</b>的退款紀錄與剩餘堂數快照。</p>
          </div>

          <div class="flex justify-end gap-2 pt-2 border-t border-gray-100 mt-4">
            <button type="button" @click="showRefundModal = false" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-200 transition">取消</button>
            <button type="submit" class="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-opacity-90 transition">確認執行退款</button>
          </div>
        </form>
      </div>
    </div>

  </div>
</template>