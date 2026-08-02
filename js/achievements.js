/* ======================================================================
   剑网三收益记录 · 成就徽章系统
   功能：定义成就、统计触发条件、检测解锁、渲染徽章列表、
        生成古风成就海报（Canvas 导出 PNG）。
   依赖：app.js 提供 loadData/saveData/showToast/today/formatDate/
        getWeekStart 等全局方法。
   ====================================================================== */

// 成就定义表
// check 接收统计对象 s，返回是否达成
const ACHIEVEMENTS = [
  { id: 'first_record', icon: '初', name: '初入江湖', desc: '记录第一笔收益', check: (s) => s.totalRecords >= 1 },
  { id: 'records_50', icon: '勤', name: '勤勉不息', desc: '累计记录50笔', check: (s) => s.totalRecords >= 50 },
  { id: 'records_100', icon: '百', name: '百战不殆', desc: '累计记录100笔', check: (s) => s.totalRecords >= 100 },
  { id: 'gold_1w', icon: '金', name: '日进斗金', desc: '累计收入10000金', check: (s) => s.totalIncome >= 10000 },
  { id: 'gold_10w', icon: '富', name: '富甲一方', desc: '累计收入100000金', check: (s) => s.totalIncome >= 100000 },
  { id: 'gold_100w', icon: '豪', name: '富可敌国', desc: '累计收入1000000金', check: (s) => s.totalIncome >= 1000000 },
  { id: 'encounter_1', icon: '遇', name: '初遇奇缘', desc: '触发第一次奇遇', check: (s) => s.totalEncounters >= 1 },
  { id: 'encounter_10', icon: '缘', name: '奇缘广结', desc: '触发10次奇遇', check: (s) => s.totalEncounters >= 10 },
  { id: 'encounter_peerless', icon: '绝', name: '绝世奇缘', desc: '触发绝世奇遇', check: (s) => s.peerlessEncounters >= 1 },
  { id: 'encounter_peerless_3', icon: '神', name: '欧皇降世', desc: '触发3次绝世奇遇', check: (s) => s.peerlessEncounters >= 3 },
  { id: 'task_daily_7', icon: '恒', name: '风雨无阻', desc: '连续7天完成日常', check: (s) => s.dailyStreak >= 7 },
  { id: 'task_daily_30', icon: '毅', name: '坚持不懈', desc: '连续30天完成日常', check: (s) => s.dailyStreak >= 30 },
  { id: 'task_all_daily', icon: '全', name: '日理万机', desc: '一天内完成所有日常', check: (s) => s.allDailyInDay },
  { id: 'multi_char', icon: '众', name: '人多势众', desc: '创建5个角色', check: (s) => s.charCount >= 5 },
  { id: 'blacklist_1', icon: '鉴', name: '明察秋毫', desc: '添加第一条避雷记录', check: (s) => s.blacklistCount >= 1 },
  { id: 'blacklist_10', icon: '察', name: '江湖百晓', desc: '添加10条避雷记录', check: (s) => s.blacklistCount >= 10 },
  { id: 'voice_first', icon: '声', name: '声控记账', desc: '首次使用语音录入', check: (s) => s.voiceUsed },
  { id: 'export_first', icon: '档', name: '留档存案', desc: '首次导出数据', check: (s) => s.exported },
  { id: 'net_positive', icon: '盈', name: '开源节流', desc: '单日净收益超过1000金', check: (s) => s.dailyNetPositive >= 1000 },
  { id: 'week_goal', icon: '标', name: '目标达成', desc: '完成本周收益目标', check: (s) => s.weekGoalMet }
];

/**
 * 计算成就所需的统计数据
 */
function calcAchievementStats() {
  const records = loadData('jx3_records') || [];
  const encounters = loadData('jx3_encounters') || [];
  const tasks = loadData('jx3_tasks') || [];
  const chars = loadData('jx3_characters') || [];
  const blacklist = loadData('jx3_blacklist') || [];
  const settings = loadData('jx3_settings') || [];

  // 基础计数
  const totalRecords = records.length;
  const totalIncome = records.filter(r => r.type === 'income').reduce((s, r) => s + (r.amount || 0), 0);
  const totalEncounters = encounters.length;
  const peerlessEncounters = encounters.filter(e => e.rarity === 'peerless').length;
  const charCount = chars.length;
  const blacklistCount = blacklist.length;

  // 连续打卡天数（从今天往回数，每天都完成所有日常才累加）
  let dailyStreak = 0;
  const dailyTasks = tasks.filter(t => t.type === 'daily');
  let checkDate = new Date();
  while (dailyTasks.length > 0) {
    const dateStr = formatDate(checkDate);
    const allDone = dailyTasks.every(t => t.completedDates && t.completedDates.includes(dateStr));
    if (allDone) {
      dailyStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // 今天是否完成所有日常
  const allDailyInDay = dailyTasks.length > 0 && dailyTasks.every(t => t.completedDates && t.completedDates.includes(today()));

  // 单日净收益
  const todayRecords = records.filter(r => r.date === today());
  const todayIncome = todayRecords.filter(r => r.type === 'income').reduce((s, r) => s + (r.amount || 0), 0);
  const todayExpense = todayRecords.filter(r => r.type === 'expense').reduce((s, r) => s + (r.amount || 0), 0);
  const dailyNetPositive = todayIncome - todayExpense;

  // 本周目标
  const weekGoal = (settings[0] && settings[0].weeklyGoal) || 10000;
  const weekStart = getWeekStart(today());
  const weekIncome = records.filter(r => r.type === 'income' && r.date >= weekStart).reduce((s, r) => s + (r.amount || 0), 0);
  const weekGoalMet = weekIncome >= weekGoal;

  // 标记类成就（语音/导出）从已解锁记录中读取
  const achData = loadData('jx3_achievements') || [];
  const voiceUsed = achData.some(a => a.id === 'voice_first');
  const exported = achData.some(a => a.id === 'export_first');

  return {
    totalRecords, totalIncome, totalEncounters, peerlessEncounters,
    charCount, blacklistCount, dailyStreak, allDailyInDay,
    dailyNetPositive, weekGoalMet, voiceUsed, exported
  };
}

/**
 * 检查成就解锁
 * 遍历所有成就，达成且未解锁的写入存储并提示。
 */
function checkAchievements() {
  const stats = calcAchievementStats();
  const unlocked = loadData('jx3_achievements') || [];
  const unlockedIds = unlocked.map(a => a.id);
  const newUnlocks = [];

  for (const ach of ACHIEVEMENTS) {
    if (!unlockedIds.includes(ach.id) && ach.check(stats)) {
      unlocked.push({ id: ach.id, unlockedDate: today() });
      newUnlocks.push(ach);
    }
  }

  if (newUnlocks.length > 0) {
    saveData('jx3_achievements', unlocked);
    for (const ach of newUnlocks) {
      showToast('成就解锁：' + ach.name);
    }
    // 若当前在成就页，重新渲染
    if (typeof currentTab !== 'undefined' && currentTab === 'achievements') {
      renderAchievements();
    }
  }
}

/**
 * 标记成就（用于语音、导出等事件触发型成就）
 */
function markAchievement(id) {
  const unlocked = loadData('jx3_achievements') || [];
  if (!unlocked.some(a => a.id === id)) {
    unlocked.push({ id, unlockedDate: today() });
    saveData('jx3_achievements', unlocked);
    checkAchievements();
  }
}

/**
 * 渲染成就列表
 */
function renderAchievements() {
  const stats = calcAchievementStats();
  const unlocked = loadData('jx3_achievements') || [];
  const unlockedIds = unlocked.map(a => a.id);
  const container = document.getElementById('achievement-list');
  if (!container) return;

  container.innerHTML = ACHIEVEMENTS.map(ach => {
    const isUnlocked = unlockedIds.includes(ach.id);
    const unlockedInfo = unlocked.find(a => a.id === ach.id);
    return `
      <div class="achievement-card ${isUnlocked ? 'unlocked' : 'locked'}">
        <div class="achievement-icon">${ach.icon}</div>
        <div class="achievement-name">${ach.name}</div>
        <div class="achievement-desc">${ach.desc}</div>
        ${isUnlocked && unlockedInfo ? `<div class="achievement-date">${unlockedInfo.unlockedDate}</div>` : ''}
      </div>
    `;
  }).join('');

  // 兼容：若页面有统计概览区域可在此扩展（stats 已计算可用）
  void stats;
}

/**
 * 生成成就海报（Canvas 绘制古风海报并导出 PNG）
 */
function generateAchievementPoster() {
  const stats = calcAchievementStats();
  const unlocked = loadData('jx3_achievements') || [];
  const unlockedIds = unlocked.map(a => a.id);

  const canvas = document.getElementById('achievement-poster-canvas');
  if (!canvas) {
    showToast('未找到海报画布');
    return;
  }
  const ctx = canvas.getContext('2d');

  // 底色（宣纸黄）
  ctx.fillStyle = '#F5F0E6';
  ctx.fillRect(0, 0, 800, 1200);

  // 纸纹噪点
  for (let i = 0; i < 300; i++) {
    ctx.beginPath();
    ctx.arc(Math.random() * 800, Math.random() * 1200, Math.random() * 2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(180,170,150,${Math.random() * 0.05})`;
    ctx.fill();
  }

  // 外边框（朱砂红）
  ctx.strokeStyle = '#B83A2B';
  ctx.lineWidth = 4;
  ctx.strokeRect(30, 30, 740, 1140);

  // 内边框（金色）
  ctx.strokeStyle = '#C9A86C';
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 40, 720, 1120);

  // 标题
  ctx.fillStyle = '#B83A2B';
  ctx.font = '48px "Ma Shan Zheng", cursive';
  ctx.textAlign = 'center';
  ctx.fillText('江湖成就榜', 400, 140);

  // 标题分割线
  ctx.beginPath();
  ctx.moveTo(150, 170);
  ctx.lineTo(650, 170);
  ctx.strokeStyle = '#C9A86C';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 统计概览
  ctx.font = '24px "Noto Serif SC", serif';
  ctx.fillStyle = '#5A5A5A';
  ctx.fillText(`累计收入 ${stats.totalIncome.toLocaleString()} 金`, 400, 220);
  ctx.fillText(`奇遇触发 ${stats.totalEncounters} 次 · 绝世 ${stats.peerlessEncounters} 次`, 400, 260);
  ctx.fillText(`成就解锁 ${unlockedIds.length} / ${ACHIEVEMENTS.length}`, 400, 300);

  // 概览分割线
  ctx.beginPath();
  ctx.moveTo(150, 330);
  ctx.lineTo(650, 330);
  ctx.strokeStyle = '#E8E2D8';
  ctx.stroke();

  // 已解锁成就列表（3列网格）
  ctx.font = '20px "Ma Shan Zheng", cursive';
  ctx.fillStyle = '#5B7F8A';
  ctx.textAlign = 'left';
  ctx.fillText('已获成就', 80, 370);

  let xPos = 80, yPos = 420;
  let col = 0;
  for (const ach of ACHIEVEMENTS) {
    if (unlockedIds.includes(ach.id)) {
      // 印章圆形背景
      ctx.beginPath();
      ctx.arc(xPos + 30, yPos, 28, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(184,58,43,0.1)';
      ctx.fill();
      ctx.strokeStyle = '#B83A2B';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 印章字
      ctx.font = '24px "Ma Shan Zheng", cursive';
      ctx.fillStyle = '#B83A2B';
      ctx.textAlign = 'center';
      ctx.fillText(ach.icon, xPos + 30, yPos + 8);

      // 成就名
      ctx.font = '13px "Noto Serif SC", serif';
      ctx.fillStyle = '#2B2B2B';
      ctx.textAlign = 'center';
      ctx.fillText(ach.name, xPos + 30, yPos + 50);

      col++;
      if (col >= 3) {
        col = 0;
        xPos = 80;
        yPos += 90;
      } else {
        xPos += 220;
      }
    }
  }

  // 底部署名
  ctx.font = '18px "Ma Shan Zheng", cursive';
  ctx.fillStyle = '#B83A2B';
  ctx.textAlign = 'center';
  ctx.fillText('剑网三·江湖账房', 400, 1140);

  // 导出 PNG
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `剑网三成就海报_${today()}.png`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('海报已保存');
    // 标记首次导出成就
    markAchievement('export_first');
  });
}

// ======================================================================
// 模块导出：挂载到 window，供 HTML onclick 与其他模块调用
// ======================================================================
window.ACHIEVEMENTS = ACHIEVEMENTS;
window.calcAchievementStats = calcAchievementStats;
window.checkAchievements = checkAchievements;
window.markAchievement = markAchievement;
window.renderAchievements = renderAchievements;
window.generateAchievementPoster = generateAchievementPoster;
