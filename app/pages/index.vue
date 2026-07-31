<template>
  <div class="dashboard-content">
    <div class="welcome-banner">
      <div>
        <h1>早安，Ava</h1>
        <p>這裡是您今天的數據概覽，一切運行順暢。</p>
      </div>
      <button class="action-btn primary">
        <Icon name="mdi:plus" />
        新增預約
      </button>
    </div>

    <div class="stats-grid">
      <!-- 使用漸層邊框技術取代死板色塊 -->
      <div class="stat-card border-gradient">
        <div class="card-inner">
          <div class="stat-header">
            <span>今日營收</span>
            <div class="icon-badge green">
              <Icon name="mdi:trending-up" />
            </div>
          </div>
          <div class="stat-value">NT$ 42,800</div>
          <div class="stat-sub">較昨日 +12.5%</div>
        </div>
      </div>

      <div class="stat-card border-gradient">
        <div class="card-inner">
          <div class="stat-header">
            <span>預約數量</span>
            <div class="icon-badge purple">
              <Icon name="mdi:calendar-check" />
            </div>
          </div>
          <div class="stat-value">28 組</div>
          <div class="stat-sub">已完成 20 組</div>
        </div>
      </div>

      <div class="stat-card border-gradient">
        <div class="card-inner">
          <div class="stat-header">
            <span>新客轉換</span>
            <div class="icon-badge pink">
              <Icon name="mdi:account-convert-outline" />
            </div>
          </div>
          <div class="stat-value">65%</div>
          <div class="stat-sub">諮詢轉換率</div>
        </div>
      </div>

      <div class="stat-card border-gradient">
        <div class="card-inner">
          <div class="stat-header">
            <span>產品消耗</span>
            <div class="icon-badge dark">
              <Icon name="mdi:flask-empty-outline" />
            </div>
          </div>
          <div class="stat-value">120 件</div>
          <div class="stat-sub">需補貨 3 項</div>
        </div>
      </div>
    </div>

    <div class="quick-panel">
      <h3>快捷操作</h3>
      <div class="action-group">
        <button class="action-btn ghost">
          <Icon name="mdi:face-woman-shimmer-outline" />
          客戶畫像分析
        </button>
        <button class="action-btn ghost">
          <Icon name="mdi:chart-bell-curve-cumulative" />
          療程效果對比
        </button>
        <button class="action-btn ghost">
          <Icon name="mdi:robot-outline" />
          AI 排程建議
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-content {
  max-width: 1400px;
}

.welcome-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40px;
}

.welcome-banner h1 {
  font-size: 28px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: #154337;
}

.welcome-banner p {
  margin: 0;
  color: #64748b;
  font-size: 14px;
}

/* 數據卡片：使用漸層邊框 + 內部毛玻璃 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 32px;
}

.stat-card {
  border-radius: 12px; /* 適度圓角即可 */
  padding: 1.5px; /* 模擬邊框厚度 */
  background: linear-gradient(135deg, rgba(168, 85, 247, 0.5), rgba(236, 72, 153, 0.5));
  transition: transform 0.3s, box-shadow 0.3s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(168, 85, 247, 0.15);
}

.card-inner {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 11px; /* 外框12px - 1px邊框 */
  padding: 24px;
  height: 100%;
}

.stat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  color: #64748b;
  font-size: 13px;
  font-weight: 500;
}

/* 圖標徽章：取代大面積色塊，更精緻 */
.icon-badge {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.icon-badge.green { background: #dcfce7; color: #16a34a; }
.icon-badge.purple { background: #f3e8ff; color: #9333ea; }
.icon-badge.pink { background: #fce7f3; color: #db2777; }
.icon-badge.dark { background: #e2e8f0; color: #154337; }

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #154337;
  margin-bottom: 6px;
}

.stat-sub {
  font-size: 12px;
  color: #94a3b8;
}

/* 快捷操作面板 */
.quick-panel {
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 12px;
  padding: 24px;
  backdrop-filter: blur(8px);
}

.quick-panel h3 {
  margin: 0 0 20px 0;
  color: #154337;
  font-weight: 600;
  font-size: 16px;
}

.action-group {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 8px; /* 按鈕同樣縮小圓角 */
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s;
  border: none;
  font-weight: 500;
}

.action-btn.primary {
  background: #154337;
  color: white;
  box-shadow: 0 4px 12px rgba(21, 67, 55, 0.2);
}

.action-btn.primary:hover {
  background: #1c5a4a;
  transform: translateY(-1px);
}

.action-btn.ghost {
  background: #ffffff;
  color: #475569;
  border: 1px solid #e2e8f0;
}

.action-btn.ghost:hover {
  border-color: #154337;
  color: #154337;
  background: #f8fafc;
}
</style>
```!