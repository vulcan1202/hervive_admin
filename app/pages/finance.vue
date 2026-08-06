<script setup lang="ts">
import { ref, onMounted, reactive, watch } from 'vue'

const config = useRuntimeConfig()
const backendUrl = config.public.backendUrl

// --- 1. 狀態與篩選 ---
const currentTab = ref<'cash_flow' | 'revenue'>('cash_flow')

const today = new Date()

const startDateObj = ref<Date | null>(today)
const endDateObj = ref<Date | null>(today)

const startDateStr = ref(startDateObj.value?.toISOString().slice(0, 10) || '')
const endDateStr = ref(endDateObj.value?.toISOString().slice(0, 10) || '')

watch(startDateObj, (newStart) => {
  if (newStart) {
    startDateStr.value = new Date(newStart.getTime() - newStart.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
    if (endDateObj.value && endDateObj.value < newStart) {
      endDateObj.value = new Date(newStart)
    }
  } else {
    startDateStr.value = ''
  }
})

watch(endDateObj, (newEnd) => {
  if (newEnd) {
    endDateStr.value = new Date(newEnd.getTime() - newEnd.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
  } else {
    endDateStr.value = ''
  }
})

const setThisMonth = () => {
  const now = new Date()
  startDateObj.value = new Date(now.getFullYear(), now.getMonth(), 1)
  endDateObj.value = new Date(now.getFullYear(), now.getMonth() + 1, 0)
}

const summary = reactive({
  total_income: 0,
  total_expense: 0,
  net_cash_flow: 0,
  total_recognized_revenue: 0,
  estimated_cost: 0
})

const cashList = ref<any[]>([])
const revenueList = ref<any[]>([])
const loading = ref(false)

// Modal 控制狀態
const showCashModal = ref(false)
const showEditCashModal = ref(false) // 🌟 編輯收支 Modal 控制

const cashForm = reactive({
  type: 'expense',
  category: '店面雜支',
  amount: 0,
  payment_method: 'Cash',
  date: new Date().toISOString().slice(0, 10),
  description: ''
})

// 🌟 編輯收支表單 State
const editCashForm = reactive({
  id: null as number | null,
  type: 'expense',
  category: '',
  amount: 0,
  payment_method: 'Cash',
  date: '',
  description: ''
})

// --- 2. API 資料載入 ---
const fetchFinancialData = async () => {
  if (!startDateStr.value || !endDateStr.value) return 
  
  loading.value = true
  try {
    const query = `start_date=${startDateStr.value}&end_date=${endDateStr.value}`
    
    const [resSummary, resCash, resRevenue] = await Promise.all([
      fetch(`${backendUrl}/api/financial-summary?${query}`).then(r => r.json()),
      fetch(`${backendUrl}/api/cash-transactions?${query}`).then(r => r.json()),
      fetch(`${backendUrl}/api/revenue-recognitions?${query}`).then(r => r.json())
    ])

    const summaryData = resSummary.data || resSummary

    if (summaryData && summaryData.cash_flow) {
      summary.total_income = summaryData.cash_flow.total_income || 0
      summary.total_expense = summaryData.cash_flow.total_expense || 0
      summary.net_cash_flow = summaryData.cash_flow.net_cash_flow || 0
      summary.total_recognized_revenue = summaryData.revenue_recognition?.total_recognized_revenue || 0
      summary.estimated_cost = summaryData.revenue_recognition?.estimated_cost || 0
    }
    
    cashList.value = resCash.data || resCash || []
    revenueList.value = resRevenue.data || resRevenue || []
  } catch (err) {
    console.error('讀取財務報表失敗', err)
  } finally {
    loading.value = false
  }
}

watch([startDateStr, endDateStr], () => {
  if (startDateStr.value && endDateStr.value) {
    fetchFinancialData()
  }
})

// 手動新增收支
const handleAddCashTransaction = async () => {
  if (cashForm.amount <= 0) return alert('請輸入有效金額！')
  try {
    const res = await fetch(`${backendUrl}/api/cash-transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cashForm)
    })
    if (!res.ok) throw new Error('新增失敗')
    alert('✅ 收支紀錄已成功建立！')
    showCashModal.value = false
    fetchFinancialData()
  } catch (err: any) {
    alert(err.message)
  }
}

// 🌟 開啟編輯收支 Modal
const openEditCashModal = (item: any) => {
  editCashForm.id = item.id
  editCashForm.type = item.type
  editCashForm.category = item.category
  editCashForm.amount = item.amount
  editCashForm.payment_method = item.payment_method || 'Cash'
  editCashForm.date = item.date
  editCashForm.description = item.description || ''
  showEditCashModal.value = true
}

// 🌟 儲存編輯收支
const handleUpdateCashTransaction = async () => {
  if (editCashForm.amount <= 0) return alert('請輸入有效金額！')
  try {
    const res = await fetch(`${backendUrl}/api/cash-transactions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editCashForm)
    })
    if (!res.ok) throw new Error('更新失敗')
    alert('✅ 收支紀錄已更新！')
    showEditCashModal.value = false
    fetchFinancialData()
  } catch (err: any) {
    alert(err.message)
  }
}

// 🌟 刪除收支紀錄 (若為退款會自動回滾堂數)
const handleDeleteCashTransaction = async (item: any) => {
  let confirmMsg = `確定要刪除這筆${item.type === 'income' ? '收入' : '支出'}紀錄嗎？`
  if (item.category === '課程退款') {
    confirmMsg = `⚠️ 注意：此筆為「課程退款」紀錄！刪除後系統將會自動把當初退還的堂數「加回會員包套中」。確定要刪除嗎？`
  }
  if (!confirm(confirmMsg)) return

  try {
    const res = await fetch(`${backendUrl}/api/cash-transactions?id=${item.id}`, {
      method: 'DELETE'
    })
    if (!res.ok) throw new Error('刪除失敗')
    alert('✅ 紀錄已刪除，相關帳務與堂數已同步！')
    fetchFinancialData()
  } catch (err: any) {
    alert(err.message)
  }
}

onMounted(() => fetchFinancialData())
</script>

<template>
  <div class="space-y-6">
    <!-- 頂部列：日期篩選與操作 -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h1 class="text-2xl font-bold text-[#154337]">財務與營收管理</h1>
        <p class="text-xs text-gray-500 mt-1">追蹤店內實際現金流與到店履約營收認列</p>
      </div>
      
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
        <div class="flex items-center gap-1.5 bg-gray-50 p-1.5 rounded-xl border border-gray-200">
          <ClientOnly>
            <div class="w-24 sm:w-28">
              <MyCalendar v-model="startDateObj" placeholder="開始日期" class="compact-date-picker bg-white" />
            </div>
            <span class="text-xs text-gray-400 font-bold px-0.5">至</span>
            <div class="w-24 sm:w-28">
              <MyCalendar 
                v-model="endDateObj" 
                placeholder="結束日期" 
                :min-date="startDateObj" 
                class="compact-date-picker bg-white" 
              />
            </div>
          </ClientOnly>
          <div class="w-px h-5 bg-gray-300 mx-1"></div>
          <button @click="setThisMonth" class="px-3 bg-white border border-gray-200 text-gray-600 hover:text-[#154337] rounded-lg text-xs font-bold hover:bg-gray-100 transition whitespace-nowrap shadow-sm h-[28px]">
            本月
          </button>
        </div>
        
        <button @click="showCashModal = true" class="px-4 py-2 bg-[#154337] text-white rounded-xl text-xs font-bold hover:bg-opacity-90 shadow-sm whitespace-nowrap mt-2 sm:mt-0 h-[36px]">
          + 記一筆收支
        </button>
      </div>
    </div>

    <!-- KPI 數據指標卡片 -->
    <div class="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
      <div class="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <span class="text-xs font-bold text-gray-400 block">現金總收入</span>
        <span class="text-xl sm:text-2xl font-black text-green-600 mt-1 block">${{ summary.total_income.toLocaleString() }}</span>
      </div>
      <div class="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <span class="text-xs font-bold text-gray-400 block">現金總支出</span>
        <span class="text-xl sm:text-2xl font-black text-red-500 mt-1 block">${{ summary.total_expense.toLocaleString() }}</span>
      </div>
      <div class="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <span class="text-xs font-bold text-gray-400 block">淨現金流 (收入-支出)</span>
        <span :class="['text-xl sm:text-2xl font-black mt-1 block', summary.net_cash_flow >= 0 ? 'text-gray-800' : 'text-red-600']">
          ${{ summary.net_cash_flow.toLocaleString() }}
        </span>
      </div>
      <div class="bg-emerald-900 text-white p-4 rounded-2xl shadow-sm">
        <span class="text-xs font-bold text-emerald-200 block">實質履約總營收</span>
        <span class="text-xl sm:text-2xl font-black mt-1 block">${{ summary.total_recognized_revenue.toLocaleString() }}</span>
      </div>
      <div class="bg-orange-50 p-4 rounded-2xl border border-orange-200 shadow-sm">
        <span class="text-xs font-bold text-orange-600 block">預估履約成本</span>
        <span class="text-xl sm:text-2xl font-black text-orange-500 mt-1 block">${{ summary.estimated_cost.toLocaleString() }}</span>
      </div>
    </div>

    <!-- 頁籤與數據表格 -->
    <div class="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 shadow-sm min-h-[400px]">
      <div class="flex border-b border-gray-100 pb-4 mb-4 gap-4">
        <button @click="currentTab = 'cash_flow'" :class="['font-bold text-sm pb-2 border-b-2 transition', currentTab === 'cash_flow' ? 'border-[#154337] text-[#154337]' : 'border-transparent text-gray-400 hover:text-gray-600']">
          💵 現金流明細 ({{ cashList.length }})
        </button>
        <button @click="currentTab = 'revenue'" :class="['font-bold text-sm pb-2 border-b-2 transition', currentTab === 'revenue' ? 'border-[#154337] text-[#154337]' : 'border-transparent text-gray-400 hover:text-gray-600']">
          📈 實質營收認列紀錄 ({{ revenueList.length }})
        </button>
      </div>

      <div v-if="loading" class="py-10 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
        <Icon name="mdi:loading" class="animate-spin" size="20" /> 讀取資料中...
      </div>
      <div v-else>
        <!-- 頁籤 1: 現金流明細列表 (加入編輯與刪除按鈕) -->
        <div v-if="currentTab === 'cash_flow'" class="space-y-2">
          <div v-if="cashList.length === 0" class="text-center py-10 text-gray-400 text-xs border border-dashed rounded-xl">尚無現金流紀錄。</div>
          <div v-for="item in cashList" :key="item.id" class="flex justify-between items-center p-3 bg-gray-50 rounded-xl text-xs border border-gray-100 hover:bg-gray-100 transition">
            <div class="max-w-[70%]">
              <div class="flex items-center gap-2">
                <span :class="['px-2 py-0.5 rounded-full text-[10px] font-bold', item.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700']">
                  {{ item.type === 'income' ? '收入' : '支出' }}
                </span>
                <span class="font-bold text-gray-800">{{ item.category }}</span>
                <span v-if="item.client_name" class="text-gray-400">({{ item.client_name }})</span>
              </div>
              <p class="text-gray-500 mt-1 truncate">{{ item.description || '無備註' }} • {{ item.date }}</p>
            </div>
            
            <div class="flex items-center gap-3">
              <span :class="['font-mono font-bold text-sm', item.type === 'income' ? 'text-green-600' : 'text-red-500']">
                {{ item.type === 'income' ? '+' : '-' }}${{ item.amount.toLocaleString() }}
              </span>
              <!-- 🌟 編輯與刪除操作按鈕 -->
              <div class="flex gap-1">
                <button @click="openEditCashModal(item)" class="px-2 py-1 bg-white border border-gray-200 text-gray-700 rounded hover:bg-gray-50 font-bold text-[11px]">編輯</button>
                <button @click="handleDeleteCashTransaction(item)" class="px-2 py-1 bg-red-50 border border-red-100 text-red-600 rounded hover:bg-red-100 font-bold text-[11px]">刪除</button>
              </div>
            </div>
          </div>
        </div>

        <!-- 頁籤 2: 實質營收認列紀錄 -->
        <div v-if="currentTab === 'revenue'" class="space-y-2">
          <div v-if="revenueList.length === 0" class="text-center py-10 text-gray-400 text-xs border border-dashed rounded-xl">尚無實質營收認列紀錄。</div>
          <div v-for="item in revenueList" :key="item.id" class="flex justify-between items-center p-3 bg-gray-50 rounded-xl text-xs border border-gray-100 hover:bg-gray-100 transition">
            <div>
              <div class="flex items-center gap-2">
                <span :class="['px-2 py-0.5 rounded-full text-[10px] font-bold', item.source_type === 'course_usage' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700']">
                  {{ item.source_type === 'course_usage' ? '課程履約' : '產品銷售' }}
                </span>
                <span class="font-bold text-gray-800">{{ item.client_name }}</span>
                <span v-if="item.appointment_code" class="text-gray-400 font-mono text-[10px] bg-gray-200 px-1.5 py-0.5 rounded">單號: {{ item.appointment_code }}</span>
              </div>
              <p class="text-gray-500 mt-1">{{ item.description || item.course_name || '無備註' }} • {{ item.date }}</p>
            </div>
            <span class="font-mono font-black text-sm text-[#154337]">
              +${{ item.amount.toLocaleString() }}
            </span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 新增收支 Modal -->
    <div v-if="showCashModal" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
        <button @click="showCashModal = false" class="absolute top-4 right-4 text-gray-400 hover:text-gray-800 bg-gray-100 rounded-full p-1 transition"><Icon name="mdi:close" size="20" /></button>
        <h3 class="text-xl font-bold text-[#154337] mb-5 flex items-center gap-2">新增收支紀錄</h3>
        <form @submit.prevent="handleAddCashTransaction" class="space-y-4">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">類型</label>
              <select v-model="cashForm.type" class="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none">
                <option value="expense">支出 (Expense)</option>
                <option value="income">收入 (Income)</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">分類</label>
              <input type="text" v-model="cashForm.category" required placeholder="如：店租、進貨" class="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">金額 ($)</label>
              <input type="number" v-model.number="cashForm.amount" required min="1" class="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none" />
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">日期</label>
              <input type="date" v-model="cashForm.date" required class="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">備註說明</label>
            <textarea v-model="cashForm.description" rows="2" class="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none"></textarea>
          </div>
          <div class="flex justify-end gap-2 pt-2 mt-2 border-t border-gray-100">
            <button type="button" @click="showCashModal = false" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold">取消</button>
            <button type="submit" class="px-4 py-2 bg-[#154337] text-white rounded-xl text-sm font-bold">確定儲存</button>
          </div>
        </form>
      </div>
    </div>

    <!-- 🌟 編輯收支 Modal -->
    <div v-if="showEditCashModal" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
        <button @click="showEditCashModal = false" class="absolute top-4 right-4 text-gray-400 hover:text-gray-800 bg-gray-100 rounded-full p-1 transition"><Icon name="mdi:close" size="20" /></button>
        <h3 class="text-xl font-bold text-[#154337] mb-5 flex items-center gap-2">編輯收支紀錄</h3>
        <form @submit.prevent="handleUpdateCashTransaction" class="space-y-4">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">類型</label>
              <select v-model="editCashForm.type" class="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none">
                <option value="expense">支出 (Expense)</option>
                <option value="income">收入 (Income)</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">分類</label>
              <input type="text" v-model="editCashForm.category" required class="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">金額 ($)</label>
              <input type="number" v-model.number="editCashForm.amount" required min="1" class="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none" />
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">日期</label>
              <input type="date" v-model="editCashForm.date" required class="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">備註說明</label>
            <textarea v-model="editCashForm.description" rows="2" class="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#154337] bg-white outline-none"></textarea>
          </div>
          <div class="flex justify-end gap-2 pt-2 mt-2 border-t border-gray-100">
            <button type="button" @click="showEditCashModal = false" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold">取消</button>
            <button type="submit" class="px-4 py-2 bg-[#154337] text-white rounded-xl text-sm font-bold">儲存修改</button>
          </div>
        </form>
      </div>
    </div>

  </div>
</template>

<style>
.compact-date-picker :deep(input) {
  padding: 0.25rem 0.5rem !important;
  font-size: 0.7rem !important;
  height: 28px !important;
  min-height: 28px !important;
  border: none !important;
  box-shadow: none !important;
  background-color: transparent !important;
}
.compact-date-picker :deep(.dp__input_icon) {
  display: none !important;
}
.compact-date-picker :deep(.dp__input_icon_pad) {
  padding-left: 0.5rem !important; 
}
.compact-date-picker {
  --dp-font-size: 0.75rem;
  --dp-menu-min-width: 230px;
  --dp-cell-size: 26px;
  --dp-cell-padding: 2px;
  --dp-row-margin: 2px 0;
  --dp-button-height: 28px;
  --dp-month-year-row-height: 30px;
  --dp-button-icon-height: 16px;
}
</style>