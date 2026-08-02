/* ========================================================================
 * 剑网三收益记录工具 - 核心逻辑 app.js
 * 版本：1.0.0
 * 说明：全局函数均挂载到 window，供 HTML 内联 onclick 调用
 * ====================================================================== */

/* ============================ 全局变量与常量 ============================ */

// localStorage键名
const STORAGE_KEYS = [
  'jx3_accounts', 'jx3_servers', 'jx3_characters', 'jx3_income_types',
  'jx3_records', 'jx3_encounters', 'jx3_tasks', 'jx3_blacklist',
  'jx3_achievements', 'jx3_settings'
];

// 预设服务器
const PRESET_SERVERS = {
  telecom: ['长安城','梦江南','蝶恋花','绝代天骄','剑胆琴心','唯我独尊','龙争虎斗','斗转星移','乾坤一掷'],
  dual: ['破阵子','青梅煮酒','天鹅坪','飞龙在天']
};

// 预设门派
const PRESET_SECTS = ['纯阳','天策','花间','七秀','少林','藏剑','毒经','唐门','明教','丐帮','苍云','莫问','霸刀','蓬莱','凌雪','衍天','无方','刀宗','万灵','段氏'];

// 预设收益类型
const PRESET_INCOME_TYPES = [
  {id:'t1', name:'副本掉落', isDefault:true},
  {id:'t2', name:'日常奖励', isDefault:true},
  {id:'t3', name:'奇遇收益', isDefault:true},
  {id:'t4', name:'活动奖励', isDefault:true},
  {id:'t5', name:'交易所得', isDefault:true},
  {id:'t6', name:'世界BOSS', isDefault:true},
  {id:'t7', name:'其他', isDefault:true}
];

// 金额快捷映射
const AMOUNT_MAP = {
  '茶馆': 100, '矿车': 100, '攻防前置': 400,
  '大战·单人大战': 40, '大战·多人大战': 250,
  '跑商·满额完成': 75, '跑商·被劫镖一次': 50, '跑商·被劫镖两次': 25
};

// 日常/周常模板
const TASK_TEMPLATES = {
  daily: ['大战！英雄秘境','茶馆','矿车','门派日常','战场'],
  weekly: ['浪客行','驰援','世界BOSS','名剑大会','帮会大跑商']
};

// 奇遇预设库 - 绝世
const PEERLESS_ENCOUNTERS = ['侠行囧途','阴阳两界','寒刃铸心','塞外宝驹','三尺青峰','故地拾光','孤沙影寂','昆吾余火','浮光织梦','塞外西风','入蛟宫','追魂骨','千秋铸','万灵当歌','流年如虹','争铸吴钩','兔江湖','济苍生','三山四海'];

// 奇遇预设库 - 普通
const NORMAL_ENCOUNTERS = ['少年行','茶馆奇缘','生死判','炼狱厨神','清风捕王','扶摇九天','天涯无归','护佑苍生','虎啸山林','乱世舞姬','雪山恩仇','平生心愿','故园风雨','韶华故','惜往日','黑白路','舞众生','白日梦','劝学记','寻猫记','旧宴承欢','凌云梯','度人心','庆舞良宵','红尘不读','镜中琴音','拜春擂','莫负初心','赴九幽','空谷回音','泛天河','俠者成歌','沙海劫缘','福运满载','生花笔','行者愿','归苍莽','金凤倾楼','岁岁春光'];

// 诗句池
const POEMS = [
  '江湖路远，侠客行天下','十年磨一剑，霜刃未曾试','一剑霜寒十四州',
  '长剑倚天外，白酒劝君饮','侠之大者，为国为民','事了拂衣去，深藏身与名',
  '剑气纵横三万里，一剑光寒十九洲','人生得意须尽欢，莫使金樽空对月',
  '天生我材必有用，千金散尽还复来','大漠孤烟直，长河落日圆',
  '明月松间照，清泉石上流','风萧萧兮易水寒，壮士一去兮不复还'
];

// 简化农历表（2024-2026年春节日期，用于粗略计算）
const LUNAR_TABLE = {
  '2024-02-10': '正月初一',
  '2025-01-29': '正月初一',
  '2026-02-17': '正月初一'
};

// 运行时状态变量
let currentTab = 'home';
let currentTaskTab = 'daily';
let recordType = 'income';
let taskType = 'daily';
let settingsEditType = '';
let settingsEditId = null;
let confirmCallback = null;
// 记录列表是否已初始化筛选器
let recordFilterInitialized = false;

/* ============================ 一、数据层 ============================ */

/**
 * 从localStorage读取JSON数据，返回数组
 * @param {string} key - 存储键名
 * @returns {Array} 解析后的数组，失败返回空数组
 */
function loadData(key) {
  try {
    var raw = localStorage.getItem(key);
    if (!raw) return [];
    var data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('loadData 读取失败:', key, e);
    return [];
  }
}

/**
 * 保存数据到localStorage
 * @param {string} key - 存储键名
 * @param {*} data - 要保存的数据
 */
function saveData(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('saveData 保存失败:', key, e);
    showToast('数据保存失败，请检查存储空间');
  }
}

/**
 * 生成唯一ID
 * @returns {string} 唯一标识符
 */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

/**
 * 返回今日日期字符串 YYYY-MM-DD
 * @returns {string}
 */
function today() {
  return formatDate(new Date());
}

/**
 * Date对象转 YYYY-MM-DD 字符串
 * @param {Date} d
 * @returns {string}
 */
function formatDate(d) {
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

/**
 * 时间戳转可读格式
 * @param {number} ts - 时间戳
 * @returns {string} 如 2024-01-15 14:30
 */
function formatDateTime(ts) {
  if (!ts) return '';
  var d = new Date(ts);
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  var h = String(d.getHours()).padStart(2, '0');
  var min = String(d.getMinutes()).padStart(2, '0');
  return y + '-' + m + '-' + day + ' ' + h + ':' + min;
}

/**
 * 获取指定日期所在周的周一日期
 * @param {string} dateStr - YYYY-MM-DD 格式日期
 * @returns {string} 周一的日期 YYYY-MM-DD
 */
function getWeekStart(dateStr) {
  if (!dateStr) dateStr = today();
  var d = new Date(dateStr + 'T00:00:00');
  var day = d.getDay(); // 0=周日, 1=周一...
  var diff = day === 0 ? -6 : 1 - day; // 回到周一
  d.setDate(d.getDate() + diff);
  return formatDate(d);
}

/**
 * 首次初始化预设数据
 * 如果已存在 jx3_income_types 则跳过
 */
function initData() {
  // 初始化收益类型（仅首次）
  if (localStorage.getItem('jx3_income_types') === null) {
    saveData('jx3_income_types', PRESET_INCOME_TYPES.slice());
  }
  // 初始化空数组结构（如果不存在）
  STORAGE_KEYS.forEach(function(key) {
    if (key === 'jx3_income_types') return; // 已处理
    if (localStorage.getItem(key) === null) {
      saveData(key, []);
    }
  });
  // 初始化设置默认值
  var settings = loadData('jx3_settings');
  var hasGoal = settings.find(function(s){ return s.key === 'weeklyGoal'; });
  if (!hasGoal) {
    settings.push({ key: 'weeklyGoal', value: 10000 });
    saveData('jx3_settings', settings);
  }
}

/**
 * 数据迁移 - 将旧的 jx3_incomes 键迁移到 jx3_records
 * 为每条记录添加 type:'income' 字段
 */
function migrateData() {
  var oldRaw = localStorage.getItem('jx3_incomes');
  if (oldRaw === null) return; // 无旧数据
  try {
    var oldData = JSON.parse(oldRaw);
    if (!Array.isArray(oldData) || oldData.length === 0) {
      localStorage.removeItem('jx3_incomes');
      return;
    }
    var records = loadData('jx3_records');
    oldData.forEach(function(item) {
      // 避免重复迁移
      if (item.type) return; // 已有type字段说明可能已迁移过
      item.type = 'income';
      if (!item.id) item.id = uid();
      // 检查是否已存在
      var exists = records.find(function(r) { return r.id === item.id; });
      if (!exists) records.push(item);
    });
    saveData('jx3_records', records);
    localStorage.removeItem('jx3_incomes');
    console.log('数据迁移完成：jx3_incomes -> jx3_records');
  } catch (e) {
    console.error('数据迁移失败:', e);
  }
}

/**
 * 获取角色名称
 * @param {string} id - 角色ID
 * @returns {string}
 */
function getCharName(id) {
  if (!id) return '未知角色';
  var chars = loadData('jx3_characters');
  var c = chars.find(function(ch) { return ch.id === id; });
  return c ? c.name : '未知角色';
}

/**
 * 获取服务器名称
 * @param {string} id - 服务器ID
 * @returns {string}
 */
function getServerName(id) {
  if (!id) return '未知区服';
  var servers = loadData('jx3_servers');
  var s = servers.find(function(sv) { return sv.id === id; });
  return s ? s.name : '未知区服';
}

/**
 * 获取账号名称
 * @param {string} id - 账号ID
 * @returns {string}
 */
function getAccountName(id) {
  if (!id) return '未知账号';
  var accounts = loadData('jx3_accounts');
  var a = accounts.find(function(ac) { return ac.id === id; });
  return a ? a.name : '未知账号';
}

/**
 * 获取收益类型名称
 * @param {string} id - 类型ID
 * @returns {string}
 */
function getTypeName(id) {
  if (!id) return '其他';
  var types = loadData('jx3_income_types');
  var t = types.find(function(tp) { return tp.id === id; });
  return t ? t.name : '其他';
}

/**
 * 获取角色门派
 * @param {string} id - 角色ID
 * @returns {string}
 */
function getCharSect(id) {
  if (!id) return '';
  var chars = loadData('jx3_characters');
  var c = chars.find(function(ch) { return ch.id === id; });
  return c ? (c.sect || '') : '';
}

/* ============================ 二、通用UI函数 ============================ */

/**
 * 显示Toast提示，3秒自动消失
 * @param {string} msg - 提示消息
 */
function showToast(msg) {
  var toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(function() {
    toast.classList.remove('show');
  }, 3000);
}

/**
 * 打开弹窗
 * @param {string} id - 弹窗元素ID
 */
function openModal(id) {
  var modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('active');
  }
}

/**
 * 关闭弹窗
 * @param {string} id - 弹窗元素ID
 */
function closeModal(id) {
  var modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('active');
  }
}

/**
 * 显示确认弹窗
 * @param {string} msg - 确认消息
 * @param {Function} callback - 确认回调
 */
function showConfirm(msg, callback) {
  confirmCallback = callback;
  var msgEl = document.getElementById('confirm-msg');
  if (msgEl) msgEl.textContent = msg;
  openModal('confirm-modal');
}

/**
 * 确认弹窗的"确定"按钮回调（供HTML内联调用）
 */
function confirmYes() {
  closeModal('confirm-modal');
  if (typeof confirmCallback === 'function') {
    var cb = confirmCallback;
    confirmCallback = null;
    cb();
  }
}

/**
 * 确认弹窗的"取消"按钮回调
 */
function confirmNo() {
  closeModal('confirm-modal');
  confirmCallback = null;
}

/**
 * 页面切换
 * @param {string} page - 目标页面ID
 */
function switchPage(page) {
  currentTab = page;
  // 移除所有page的active
  var pages = document.querySelectorAll('.page');
  pages.forEach(function(p) { p.classList.remove('active'); });
  // 激活目标page
  var target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');

  // 更新侧边栏nav-item active
  var navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(function(n) { n.classList.remove('active'); });
  var activeNav = document.querySelector('.nav-item[data-page="' + page + '"]');
  if (activeNav) activeNav.classList.add('active');

  // 更新移动端导航
  var mobileNavs = document.querySelectorAll('.mobile-nav-item');
  mobileNavs.forEach(function(n) { n.classList.remove('active'); });
  var activeMobile = document.querySelector('.mobile-nav-item[data-page="' + page + '"]');
  if (activeMobile) activeMobile.classList.add('active');

  // 移动端"更多"按钮跳转到settings时也显示active
  if (page === 'settings') {
    var moreBtn = document.querySelector('.mobile-nav-item[data-page="more"]');
    if (moreBtn) moreBtn.classList.add('active');
  }

  // 根据页面调用对应渲染函数
  switch (page) {
    case 'home': renderHome(); break;
    case 'records': renderRecordList(); break;
    case 'encounters': renderEncounterList(); renderEncounterStats(); break;
    case 'tasks': renderTaskList(); break;
    case 'summary': renderSummary(); break;
    case 'settings': renderSettings(); break;
    case 'blacklist': renderBlacklist(); break;
  }

  // 移动端关闭侧边栏
  var sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.classList.remove('open');
}

/* ============================ 三、首页渲染 ============================ */

/**
 * 获取星期几中文
 * @returns {string}
 */
function getWeekday() {
  var weekdays = ['周日','周一','周二','周三','周四','周五','周六'];
  return weekdays[new Date().getDay()];
}

/**
 * 简化农历显示（查表法，以2024年2月10日正月初一为基准粗略估算）
 * @returns {string}
 */
function getLunarDate() {
  var todayStr = today();
  try {
    var d = new Date(todayStr + 'T00:00:00');
    var lunarMonths = ['正','二','三','四','五','六','七','八','九','十','冬','腊'];
    // 以2024年2月10日为正月初一基准
    var base = new Date('2024-02-10T00:00:00');
    var diff = Math.floor((d - base) / 86400000);
    if (diff < 0) {
      return '农历腊月' + (30 + diff) + '日';
    }
    var month = Math.floor(diff / 29.5);
    var day = Math.floor(diff % 29.5) + 1;
    if (day > 30) { day = day - 30; month++; }
    if (month > 11) month = month % 12;
    var dayStr;
    if (day === 10) {
      dayStr = '初十';
    } else if (day < 10) {
      dayStr = '初' + ['一','二','三','四','五','六','七','八','九'][day];
    } else if (day === 20) {
      dayStr = '二十';
    } else if (day < 20) {
      dayStr = '十' + ['','一','二','三','四','五','六','七','八','九'][day - 10];
    } else if (day === 30) {
      dayStr = '三十';
    } else {
      dayStr = '廿' + ['','一','二','三','四','五','六','七','八','九'][day - 20];
    }
    return '农历' + lunarMonths[month] + '月' + dayStr;
  } catch (e) {
    return '';
  }
}

/**
 * 格式化金币显示（加千分位）
 * @param {number} n
 * @returns {string}
 */
function formatGold(n) {
  return Number(n || 0).toLocaleString('zh-CN');
}

/**
 * HTML转义
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, function(c) {
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}

/**
 * 渲染首页
 */
function renderHome() {
  // 随机展示诗句
  var poemEl = document.getElementById('home-poem');
  if (poemEl) {
    poemEl.textContent = POEMS[Math.floor(Math.random() * POEMS.length)];
  }

  // 日期展示
  var dateEl = document.getElementById('home-date');
  if (dateEl) {
    var lunar = getLunarDate();
    dateEl.textContent = today() + ' ' + getWeekday() + (lunar ? ' ' + lunar : '');
  }

  // 统计今日收入/支出/净收益
  var records = loadData('jx3_records');
  var todayStr = today();
  var todayRecords = records.filter(function(r) { return r.date === todayStr; });
  var incomeTotal = 0, expenseTotal = 0;
  todayRecords.forEach(function(r) {
    if (r.type === 'expense') expenseTotal += Number(r.amount) || 0;
    else incomeTotal += Number(r.amount) || 0;
  });
  var netIncome = incomeTotal - expenseTotal;

  var incomeEl = document.getElementById('home-income-total');
  var expenseEl = document.getElementById('home-expense-total');
  var netEl = document.getElementById('home-net-income');
  if (incomeEl) incomeEl.textContent = '+' + formatGold(incomeTotal);
  if (expenseEl) expenseEl.textContent = '-' + formatGold(expenseTotal);
  if (netEl) {
    netEl.textContent = (netIncome >= 0 ? '+' : '') + formatGold(netIncome);
    netEl.style.color = netIncome >= 0 ? '#d4a843' : '#c0392b';
  }

  // 本周目标进度条
  var weekStart = getWeekStart(todayStr);
  var weekRecords = records.filter(function(r) {
    return r.date >= weekStart && r.type !== 'expense';
  });
  var weekIncome = 0;
  weekRecords.forEach(function(r) { weekIncome += Number(r.amount) || 0; });
  var settings = loadData('jx3_settings');
  var goalSetting = settings.find(function(s) { return s.key === 'weeklyGoal'; });
  var weeklyGoal = goalSetting ? Number(goalSetting.value) : 10000;
  var progress = weeklyGoal > 0 ? Math.min(100, (weekIncome / weeklyGoal) * 100) : 0;
  var fillEl = document.getElementById('home-goal-fill');
  var textEl = document.getElementById('home-goal-text');
  if (fillEl) fillEl.style.width = progress + '%';
  if (textEl) textEl.textContent = formatGold(weekIncome) + ' / ' + formatGold(weeklyGoal) + ' (' + progress.toFixed(1) + '%)';

  // 最近5条记录
  var recentEl = document.getElementById('home-recent-list');
  if (recentEl) {
    var sorted = records.slice().sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
    var recent = sorted.slice(0, 5);
    if (recent.length === 0) {
      recentEl.innerHTML = '<div class="empty-tip">暂无记录，快去记录你的第一笔收益吧</div>';
    } else {
      recentEl.innerHTML = recent.map(function(r) {
        var isIncome = r.type !== 'expense';
        var charName = getCharName(r.characterId);
        var typeName = getTypeName(r.category);
        var amount = (isIncome ? '+' : '-') + formatGold(Number(r.amount) || 0);
        var cls = isIncome ? 'income' : 'expense';
        return '<div class="recent-item ' + cls + '">' +
          '<div class="recent-info">' +
            '<span class="recent-char">' + escapeHtml(charName) + '</span>' +
            '<span class="recent-type">' + escapeHtml(typeName) + '</span>' +
          '</div>' +
          '<div class="recent-amount ' + cls + '">' + amount + '</div>' +
        '</div>';
      }).join('');
    }
  }

  // 填充筛选器选项
  fillFilterOptions();
}

/**
 * 填充筛选器下拉框选项
 */
function fillFilterOptions() {
  var accounts = loadData('jx3_accounts');
  var servers = loadData('jx3_servers');
  var characters = loadData('jx3_characters');
  fillSelect('filter-account', accounts, '全部账号');
  fillSelect('filter-server', servers, '全部区服');
  fillSelect('filter-char', characters, '全部角色');
}

/**
 * 填充select下拉框
 * @param {string} selectId - select元素ID
 * @param {Array} items - 数据数组
 * @param {string} allText - "全部"选项文本
 */
function fillSelect(selectId, items, allText) {
  var sel = document.getElementById(selectId);
  if (!sel) return;
  var currentVal = sel.value;
  var html = '<option value="">' + (allText || '全部') + '</option>';
  items.forEach(function(item) {
    html += '<option value="' + item.id + '">' + escapeHtml(item.name) + '</option>';
  });
  sel.innerHTML = html;
  sel.value = currentVal;
}

/* ============================ 四、收益记录模块 ============================ */

/**
 * 渲染收支记录列表
 */
function renderRecordList() {
  var records = loadData('jx3_records');
  // 按timestamp降序
  records.sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });

  // 首次渲染时填充筛选下拉框
  if (!recordFilterInitialized) {
    fillSelect('filter-account', loadData('jx3_accounts'), '全部账号');
    fillSelect('filter-server', loadData('jx3_servers'), '全部区服');
    fillSelect('filter-char', loadData('jx3_characters'), '全部角色');
    recordFilterInitialized = true;
  }

  // 应用筛选
  var filterAccount = document.getElementById('filter-account');
  var filterServer = document.getElementById('filter-server');
  var filterChar = document.getElementById('filter-char');
  var filterDateStart = document.getElementById('filter-date-start');
  var filterDateEnd = document.getElementById('filter-date-end');

  var fa = filterAccount ? filterAccount.value : '';
  var fs = filterServer ? filterServer.value : '';
  var fc = filterChar ? filterChar.value : '';
  var fds = filterDateStart ? filterDateStart.value : '';
  var fde = filterDateEnd ? filterDateEnd.value : '';

  var filtered = records.filter(function(r) {
    if (fa && r.accountId !== fa) return false;
    if (fs && r.serverId !== fs) return false;
    if (fc && r.characterId !== fc) return false;
    if (fds && r.date < fds) return false;
    if (fde && r.date > fde) return false;
    return true;
  });

  var listEl = document.getElementById('record-list');
  if (!listEl) return;

  if (filtered.length === 0) {
    listEl.innerHTML = '<div class="empty-tip">暂无记录，点击右下角按钮开始记录</div>';
    return;
  }

  listEl.innerHTML = filtered.map(function(r) {
    var isIncome = r.type !== 'expense';
    var charName = getCharName(r.characterId);
    var typeName = getTypeName(r.category);
    var amount = (isIncome ? '+' : '-') + formatGold(Number(r.amount) || 0);
    var cls = isIncome ? 'income' : 'expense';
    var timeStr = formatDateTime(r.timestamp);
    var note = r.note ? escapeHtml(r.note) : '';
    var items = r.items ? escapeHtml(r.items) : '';
    return '<div class="list-item ' + cls + '" data-id="' + r.id + '">' +
      '<div class="list-item-content">' +
        '<div class="item-top">' +
          '<span class="item-char">' + escapeHtml(charName) + '</span>' +
          '<span class="item-tag type-' + cls + '">' + escapeHtml(typeName) + '</span>' +
        '</div>' +
        '<div class="item-mid">' +
          '<span class="item-amount ' + cls + '">' + amount + '</span>' +
          (items ? '<span class="item-items">' + items + '</span>' : '') +
        '</div>' +
        '<div class="item-bottom">' +
          '<span class="item-time">' + timeStr + '</span>' +
          (note ? '<span class="item-note">' + note + '</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="swipe-action swipe-delete" onclick="deleteRecord(\'' + r.id + '\')">删除</div>' +
    '</div>';
  }).join('');

  // 绑定左滑删除
  listEl.querySelectorAll('.list-item').forEach(function(item) {
    bindSwipeDelete(item, function() {
      var id = item.getAttribute('data-id');
      deleteRecord(id);
    });
  });

  // 初始化SortableJS拖拽排序
  if (typeof Sortable !== 'undefined') {
    try {
      Sortable.create(listEl, {
        animation: 200,
        ghostClass: 'sortable-ghost',
        onEnd: function(evt) {
          // 可在此保存排序结果
        }
      });
    } catch (e) {
      console.warn('Sortable初始化失败:', e);
    }
  }
}

/**
 * 打开录入弹窗
 */
function openRecordModal() {
  var characters = loadData('jx3_characters');
  var incomeTypes = loadData('jx3_income_types');
  var records = loadData('jx3_records');

  // 填充角色下拉
  var charSel = document.getElementById('record-char');
  if (charSel) {
    var charHtml = '<option value="">请选择角色</option>';
    characters.forEach(function(c) {
      charHtml += '<option value="' + c.id + '">' + escapeHtml(c.name) + (c.sect ? ' (' + c.sect + ')' : '') + '</option>';
    });
    charSel.innerHTML = charHtml;
  }

  // 填充来源类型下拉
  var typeSel = document.getElementById('record-income-type');
  if (typeSel) {
    var typeHtml = '';
    incomeTypes.forEach(function(t) {
      typeHtml += '<option value="' + t.id + '">' + escapeHtml(t.name) + '</option>';
    });
    typeSel.innerHTML = typeHtml;
  }

  // 填充历史记录下拉（最近20条不重复的"角色+来源类型+金额"组合）
  var histSel = document.getElementById('record-history');
  if (histSel) {
    var seen = {};
    var history = [];
    records.sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
    records.forEach(function(r) {
      var key = r.characterId + '|' + r.category + '|' + r.amount;
      if (!seen[key] && r.characterId && r.category && r.amount) {
        seen[key] = true;
        history.push(r);
        if (history.length >= 20) return;
      }
    });
    var histHtml = '<option value="">从历史记录选择...</option>';
    history.forEach(function(r) {
      var val = JSON.stringify({ characterId: r.characterId, category: r.category, amount: r.amount, type: r.type, items: r.items || '' });
      histHtml += '<option value="' + escapeHtml(val) + '">' + escapeHtml(getCharName(r.characterId) + ' / ' + getTypeName(r.category) + ' / ' + formatGold(r.amount)) + '</option>';
    });
    histSel.innerHTML = histHtml;
  }

  // 重置表单
  setRecordType('income');
  var amountInput = document.getElementById('record-amount');
  if (amountInput) amountInput.value = '';
  var itemsInput = document.getElementById('record-items');
  if (itemsInput) itemsInput.value = '';
  var noteInput = document.getElementById('record-note');
  if (noteInput) noteInput.value = '';
  var dateInput = document.getElementById('record-date');
  if (dateInput) dateInput.value = today();
  if (charSel) charSel.value = '';
  if (histSel) histSel.value = '';

  // 绑定快捷面板按钮
  document.querySelectorAll('.quick-btn').forEach(function(btn) {
    btn.onclick = function() {
      var name = btn.getAttribute('data-name') || btn.textContent.trim();
      var amount = AMOUNT_MAP[name];
      if (amount && amountInput) {
        amountInput.value = amount;
      }
      // 自动匹配来源类型
      if (name.indexOf('大战') >= 0 || name.indexOf('茶馆') >= 0 || name.indexOf('矿车') >= 0 || name.indexOf('跑商') >= 0 || name.indexOf('攻防') >= 0) {
        var matchedType = incomeTypes.find(function(t) { return t.name === '日常奖励'; });
        if (matchedType && typeSel) typeSel.value = matchedType.id;
      }
      if (itemsInput) itemsInput.value = name;
    };
  });

  openModal('record-modal');
}

/**
 * 设置收支类型
 * @param {string} type - 'income' 或 'expense'
 */
function setRecordType(type) {
  recordType = type;
  var btns = document.querySelectorAll('.record-type-toggle .toggle-btn');
  btns.forEach(function(b) { b.classList.remove('active'); });
  var activeBtn = document.querySelector('.record-type-toggle .toggle-btn[data-type="' + type + '"]');
  if (activeBtn) activeBtn.classList.add('active');
}

/**
 * 调整金额输入框的值
 * @param {number} delta - 增减量
 */
function adjustAmount(delta) {
  var input = document.getElementById('record-amount');
  if (!input) return;
  var cur = parseInt(input.value) || 0;
  var newVal = cur + delta;
  if (newVal < 0) newVal = 0;
  input.value = newVal;
}

/**
 * 从历史记录加载到表单
 * @param {string} value - JSON字符串
 */
function loadFromHistory(value) {
  if (!value) return;
  try {
    var data = JSON.parse(value);
    if (data.characterId) {
      var charSel = document.getElementById('record-char');
      if (charSel) charSel.value = data.characterId;
    }
    if (data.category) {
      var typeSel = document.getElementById('record-income-type');
      if (typeSel) typeSel.value = data.category;
    }
    if (data.amount) {
      var amountInput = document.getElementById('record-amount');
      if (amountInput) amountInput.value = data.amount;
    }
    if (data.type) {
      setRecordType(data.type);
    }
    if (data.items) {
      var itemsInput = document.getElementById('record-items');
      if (itemsInput) itemsInput.value = data.items;
    }
  } catch (e) {
    console.error('加载历史记录失败:', e);
  }
}

/**
 * 保存记录
 */
function saveRecord() {
  var charSel = document.getElementById('record-char');
  var typeSel = document.getElementById('record-income-type');
  var amountInput = document.getElementById('record-amount');
  var itemsInput = document.getElementById('record-items');
  var noteInput = document.getElementById('record-note');
  var dateInput = document.getElementById('record-date');

  var characterId = charSel ? charSel.value : '';
  var category = typeSel ? typeSel.value : '';
  var amount = parseInt(amountInput ? amountInput.value : '0') || 0;
  var items = itemsInput ? itemsInput.value.trim() : '';
  var note = noteInput ? noteInput.value.trim() : '';
  var date = dateInput ? dateInput.value : today();

  // 验证
  if (!characterId) {
    showToast('请选择角色');
    return;
  }
  if (amount <= 0) {
    showToast('金额必须大于0');
    return;
  }

  // 获取角色关联的serverId和accountId
  var characters = loadData('jx3_characters');
  var char = characters.find(function(c) { return c.id === characterId; });
  var serverId = char ? char.serverId : '';
  var accountId = char ? char.accountId : '';

  var record = {
    id: uid(),
    characterId: characterId,
    serverId: serverId,
    accountId: accountId,
    type: recordType,
    category: category,
    amount: amount,
    items: items,
    note: note,
    date: date,
    timestamp: Date.now()
  };

  var records = loadData('jx3_records');
  records.push(record);
  saveData('jx3_records', records);

  closeModal('record-modal');
  renderRecordList();
  showToast(recordType === 'income' ? '收益已记录' : '支出已记录');

  // 触发盖章动效
  triggerStampEffect();

  // 检查成就解锁
  if (typeof window.checkAchievements === 'function') {
    window.checkAchievements();
  }
}

/**
 * 删除记录（带拂袖而去动效）
 * @param {string} id - 记录ID
 */
function deleteRecord(id) {
  showConfirm('确定删除这条记录吗？此操作不可撤销', function() {
    var listEl = document.getElementById('record-list');
    var item = listEl ? listEl.querySelector('.list-item[data-id="' + id + '"]') : null;
    if (item) {
      item.classList.add('fade-out');
      setTimeout(function() {
        var records = loadData('jx3_records');
        var filtered = records.filter(function(r) { return r.id !== id; });
        saveData('jx3_records', filtered);
        renderRecordList();
        showToast('记录已删除');
      }, 300);
    } else {
      var records = loadData('jx3_records');
      var filtered = records.filter(function(r) { return r.id !== id; });
      saveData('jx3_records', filtered);
      renderRecordList();
      showToast('记录已删除');
    }
  });
}

/* ============================ 五、奇遇台账模块 ============================ */

/**
 * 渲染奇遇列表
 */
function renderEncounterList() {
  var encounters = loadData('jx3_encounters');
  encounters.sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });

  // 填充角色筛选
  var filterChar = document.getElementById('encounter-filter-char');
  if (filterChar && filterChar.children.length <= 1) {
    var characters = loadData('jx3_characters');
    fillSelect('encounter-filter-char', characters, '全部角色');
  }

  // 筛选
  var fc = filterChar ? filterChar.value : '';
  var filterRarity = document.getElementById('encounter-filter-rarity');
  var fr = filterRarity ? filterRarity.value : '';

  var filtered = encounters.filter(function(e) {
    if (fc && e.characterId !== fc) return false;
    if (fr && e.rarity !== fr) return false;
    return true;
  });

  var listEl = document.getElementById('encounter-list');
  if (!listEl) return;

  if (filtered.length === 0) {
    listEl.innerHTML = '<div class="empty-tip">暂无奇遇记录，愿君早日触发奇遇</div>';
    return;
  }

  listEl.innerHTML = filtered.map(function(e) {
    var isPeerless = e.rarity === 'peerless';
    var charName = getCharName(e.characterId);
    var rarityLabel = isPeerless ? '绝世' : '普通';
    var rarityCls = isPeerless ? 'peerless' : 'normal';
    return '<div class="list-item encounter-item ' + rarityCls + '" data-id="' + e.id + '">' +
      '<div class="list-item-content">' +
        '<div class="item-top">' +
          '<span class="encounter-name ' + rarityCls + '">' + escapeHtml(e.name) + '</span>' +
          '<span class="item-tag rarity-' + rarityCls + '">' + rarityLabel + '</span>' +
        '</div>' +
        '<div class="item-mid">' +
          '<span class="item-char">' + escapeHtml(charName) + '</span>' +
          '<span class="item-time">' + escapeHtml(e.date || '') + '</span>' +
        '</div>' +
        (e.note ? '<div class="item-bottom"><span class="item-note">' + escapeHtml(e.note) + '</span></div>' : '') +
      '</div>' +
      '<div class="swipe-action swipe-delete" onclick="deleteEncounter(\'' + e.id + '\')">删除</div>' +
    '</div>';
  }).join('');

  // 绑定左滑删除
  listEl.querySelectorAll('.list-item').forEach(function(item) {
    bindSwipeDelete(item, function() {
      var id = item.getAttribute('data-id');
      deleteEncounter(id);
    });
  });
}

/**
 * 渲染统计栏
 */
function renderEncounterStats() {
  var encounters = loadData('jx3_encounters');
  var total = encounters.length;
  var peerlessCount = encounters.filter(function(e) { return e.rarity === 'peerless'; }).length;
  var normalCount = total - peerlessCount;

  var totalEl = document.getElementById('encounter-total');
  var peerlessEl = document.getElementById('encounter-peerless');
  var normalEl = document.getElementById('encounter-normal');
  if (totalEl) totalEl.textContent = total;
  if (peerlessEl) peerlessEl.textContent = peerlessCount;
  if (normalEl) normalEl.textContent = normalCount;
}

/**
 * 打开奇遇弹窗
 */
function openEncounterModal() {
  var characters = loadData('jx3_characters');

  // 填充预设库
  var sel = document.getElementById('encounter-select');
  if (sel) {
    var html = '<option value="">请选择奇遇...</option>';
    html += '<optgroup label="绝世奇遇">';
    PEERLESS_ENCOUNTERS.forEach(function(name) {
      html += '<option value="' + escapeHtml(name) + '">' + escapeHtml(name) + '</option>';
    });
    html += '</optgroup>';
    html += '<optgroup label="普通奇遇">';
    NORMAL_ENCOUNTERS.forEach(function(name) {
      html += '<option value="' + escapeHtml(name) + '">' + escapeHtml(name) + '</option>';
    });
    html += '</optgroup>';
    html += '<option value="custom">自定义...</option>';
    sel.innerHTML = html;
    sel.onchange = function() {
      var wrap = document.getElementById('encounter-custom-wrap');
      if (wrap) {
        wrap.style.display = (sel.value === 'custom') ? 'block' : 'none';
      }
    };
  }

  // 填充角色下拉
  var charSel = document.getElementById('encounter-char');
  if (charSel) {
    var charHtml = '<option value="">请选择角色</option>';
    characters.forEach(function(c) {
      charHtml += '<option value="' + c.id + '">' + escapeHtml(c.name) + (c.sect ? ' (' + c.sect + ')' : '') + '</option>';
    });
    charSel.innerHTML = charHtml;
  }

  // 默认日期为今天
  var dateInput = document.getElementById('encounter-date');
  if (dateInput) dateInput.value = today();

  // 重置
  var noteInput = document.getElementById('encounter-note');
  if (noteInput) noteInput.value = '';
  var customInput = document.getElementById('encounter-custom-name');
  if (customInput) customInput.value = '';
  var wrap = document.getElementById('encounter-custom-wrap');
  if (wrap) wrap.style.display = 'none';
  if (charSel) charSel.value = '';

  openModal('encounter-modal');
}

/**
 * 保存奇遇记录
 */
function saveEncounter() {
  var sel = document.getElementById('encounter-select');
  var charSel = document.getElementById('encounter-char');
  var dateInput = document.getElementById('encounter-date');
  var noteInput = document.getElementById('encounter-note');
  var customInput = document.getElementById('encounter-custom-name');

  var name = sel ? sel.value : '';
  var characterId = charSel ? charSel.value : '';
  var date = dateInput ? dateInput.value : today();
  var note = noteInput ? noteInput.value.trim() : '';

  if (name === 'custom') {
    name = customInput ? customInput.value.trim() : '';
  }

  if (!characterId) {
    showToast('请选择角色');
    return;
  }
  if (!name) {
    showToast('请选择或输入奇遇名称');
    return;
  }

  // 自动判断稀有度
  var rarity = 'normal';
  if (PEERLESS_ENCOUNTERS.indexOf(name) >= 0) {
    rarity = 'peerless';
  } else if (NORMAL_ENCOUNTERS.indexOf(name) >= 0) {
    rarity = 'normal';
  } else {
    rarity = 'normal'; // 自定义默认普通
  }

  // 获取角色关联信息
  var characters = loadData('jx3_characters');
  var char = characters.find(function(c) { return c.id === characterId; });
  var serverId = char ? char.serverId : '';
  var accountId = char ? char.accountId : '';

  var encounter = {
    id: uid(),
    name: name,
    rarity: rarity,
    characterId: characterId,
    serverId: serverId,
    accountId: accountId,
    note: note,
    date: date,
    timestamp: Date.now()
  };

  var encounters = loadData('jx3_encounters');
  encounters.push(encounter);
  saveData('jx3_encounters', encounters);

  closeModal('encounter-modal');
  renderEncounterList();
  renderEncounterStats();
  showToast(rarity === 'peerless' ? '恭喜触发绝世奇遇！' : '奇遇已记录');

  triggerStampEffect();

  if (typeof window.checkAchievements === 'function') {
    window.checkAchievements();
  }
}

/**
 * 删除奇遇记录
 * @param {string} id
 */
function deleteEncounter(id) {
  showConfirm('确定删除这条奇遇记录吗？', function() {
    var listEl = document.getElementById('encounter-list');
    var item = listEl ? listEl.querySelector('.list-item[data-id="' + id + '"]') : null;
    if (item) {
      item.classList.add('fade-out');
      setTimeout(function() {
        var encounters = loadData('jx3_encounters');
        var filtered = encounters.filter(function(e) { return e.id !== id; });
        saveData('jx3_encounters', filtered);
        renderEncounterList();
        renderEncounterStats();
        showToast('奇遇记录已删除');
      }, 300);
    } else {
      var encounters = loadData('jx3_encounters');
      var filtered = encounters.filter(function(e) { return e.id !== id; });
      saveData('jx3_encounters', filtered);
      renderEncounterList();
      renderEncounterStats();
      showToast('奇遇记录已删除');
    }
  });
}

/* ============================ 六、任务打卡模块 ============================ */

/**
 * 渲染任务列表
 */
function renderTaskList() {
  var tasks = loadData('jx3_tasks');
  var characters = loadData('jx3_characters');
  var todayStr = today();

  // 按currentTaskTab筛选
  var filtered = tasks.filter(function(t) { return t.type === currentTaskTab; });

  // 按角色分组
  var groups = {};
  filtered.forEach(function(t) {
    var cid = t.characterId || 'none';
    if (!groups[cid]) groups[cid] = [];
    groups[cid].push(t);
  });

  var listEl = document.getElementById('task-list');
  if (!listEl) return;

  if (filtered.length === 0) {
    listEl.innerHTML = '<div class="empty-tip">暂无任务，点击下方按钮添加任务</div>';
    updateTaskProgress(filtered, todayStr);
    return;
  }

  var html = '';
  Object.keys(groups).forEach(function(cid) {
    var charName = cid === 'none' ? '通用' : getCharName(cid);
    var char = characters.find(function(c) { return c.id === cid; });
    var isMain = char && char.isMain;
    html += '<div class="task-group">';
    html += '<div class="task-group-header">' + escapeHtml(charName) + (isMain ? ' <span class="main-tag">主</span>' : '') + '</div>';
    var groupTasks = groups[cid];
    // 按sortOrder排序
    groupTasks.sort(function(a, b) { return (a.sortOrder || 0) - (b.sortOrder || 0); });
    groupTasks.forEach(function(t) {
      var isDone = t.completedDates && t.completedDates.indexOf(todayStr) >= 0;
      html += '<div class="task-item' + (isDone ? ' completed' : '') + '" data-id="' + t.id + '">';
      html += '<div class="task-circle' + (isDone ? ' done' : '') + '" onclick="toggleTask(\'' + t.id + '\')"></div>';
      html += '<span class="task-name">' + escapeHtml(t.name) + '</span>';
      html += '<div class="swipe-action swipe-delete" onclick="event.stopPropagation();deleteTask(\'' + t.id + '\')">删除</div>';
      html += '</div>';
    });
    html += '</div>';
  });
  listEl.innerHTML = html;

  // 绑定滑动事件
  listEl.querySelectorAll('.task-item').forEach(function(item) {
    bindSwipeTask(item, function() {
      var id = item.getAttribute('data-id');
      toggleTask(id);
    }, function() {
      var id = item.getAttribute('data-id');
      deleteTask(id);
    });
  });

  // SortableJS拖拽排序
  if (typeof Sortable !== 'undefined') {
    try {
      Sortable.create(listEl, {
        animation: 200,
        ghostClass: 'sortable-ghost',
        handle: '.task-name',
        onEnd: function(evt) {
          // 可在此保存排序
        }
      });
    } catch (e) {
      console.warn('Sortable初始化失败:', e);
    }
  }

  // 更新进度条
  updateTaskProgress(filtered, todayStr);
}

/**
 * 更新任务进度条
 * @param {Array} tasks
 * @param {string} todayStr
 */
function updateTaskProgress(tasks, todayStr) {
  var total = tasks.length;
  var done = tasks.filter(function(t) {
    return t.completedDates && t.completedDates.indexOf(todayStr) >= 0;
  }).length;
  var progress = total > 0 ? (done / total) * 100 : 0;
  var fillEl = document.getElementById('task-progress-fill');
  var textEl = document.getElementById('task-progress-text');
  if (fillEl) fillEl.style.width = progress + '%';
  if (textEl) textEl.textContent = done + ' / ' + total;
}

/**
 * 切换日常/周常
 * @param {string} tab - 'daily' 或 'weekly'
 */
function switchTaskTab(tab) {
  currentTaskTab = tab;
  var btns = document.querySelectorAll('.task-tab-btn');
  btns.forEach(function(b) { b.classList.remove('active'); });
  var activeBtn = document.querySelector('.task-tab-btn[data-tab="' + tab + '"]');
  if (activeBtn) activeBtn.classList.add('active');
  renderTaskList();
}

/**
 * 打开任务弹窗
 */
function openTaskModal() {
  var characters = loadData('jx3_characters');
  var charSel = document.getElementById('task-char');
  if (charSel) {
    var html = '<option value="">通用</option>';
    characters.forEach(function(c) {
      html += '<option value="' + c.id + '">' + escapeHtml(c.name) + (c.sect ? ' (' + c.sect + ')' : '') + '</option>';
    });
    charSel.innerHTML = html;
  }
  var nameInput = document.getElementById('task-name');
  if (nameInput) nameInput.value = '';
  setTaskType(currentTaskTab);
  openModal('task-modal');
}

/**
 * 设置任务类型
 * @param {string} type - 'daily' 或 'weekly'
 */
function setTaskType(type) {
  taskType = type;
  var btns = document.querySelectorAll('.task-type-toggle .toggle-btn');
  btns.forEach(function(b) { b.classList.remove('active'); });
  var activeBtn = document.querySelector('.task-type-toggle .toggle-btn[data-type="' + type + '"]');
  if (activeBtn) activeBtn.classList.add('active');
}

/**
 * 保存任务
 */
function saveTask() {
  var nameInput = document.getElementById('task-name');
  var charSel = document.getElementById('task-char');

  var name = nameInput ? nameInput.value.trim() : '';
  var characterId = charSel ? charSel.value : '';

  if (!name) {
    showToast('请输入任务名称');
    return;
  }

  var tasks = loadData('jx3_tasks');
  var task = {
    id: uid(),
    name: name,
    type: taskType,
    characterId: characterId,
    completedDates: [],
    sortOrder: tasks.length,
    timestamp: Date.now()
  };
  tasks.push(task);
  saveData('jx3_tasks', tasks);

  closeModal('task-modal');
  currentTaskTab = taskType;
  renderTaskList();
  showToast('任务已添加');
}

/**
 * 从模板添加任务
 * @param {string} name - 任务名称
 */
function addTaskFromTemplate(name) {
  var tasks = loadData('jx3_tasks');
  var task = {
    id: uid(),
    name: name,
    type: currentTaskTab,
    characterId: '',
    completedDates: [],
    sortOrder: tasks.length,
    timestamp: Date.now()
  };
  tasks.push(task);
  saveData('jx3_tasks', tasks);
  renderTaskList();
  showToast('已添加：' + name);
}

/**
 * 切换任务完成状态
 * @param {string} id - 任务ID
 */
function toggleTask(id) {
  var tasks = loadData('jx3_tasks');
  var task = tasks.find(function(t) { return t.id === id; });
  if (!task) return;

  var todayStr = today();
  if (!task.completedDates) task.completedDates = [];

  var idx = task.completedDates.indexOf(todayStr);
  if (idx >= 0) {
    // 取消完成
    task.completedDates.splice(idx, 1);
    showToast('已取消完成');
  } else {
    // 标记完成
    task.completedDates.push(todayStr);
    showToast('打卡成功！');
    // 触发盖章落墨动效
    triggerStampEffect();
  }
  saveData('jx3_tasks', tasks);
  renderTaskList();

  if (typeof window.checkAchievements === 'function') {
    window.checkAchievements();
  }
}

/**
 * 一键给所有角色打卡当前任务
 */
function batchCheckAll() {
  showConfirm('确定给所有角色打卡当前类型的全部任务吗？', function() {
    var characters = loadData('jx3_characters');
    var tasks = loadData('jx3_tasks');
    var todayStr = today();
    var currentTasks = tasks.filter(function(t) { return t.type === currentTaskTab; });

    if (currentTasks.length === 0) {
      showToast('当前没有可打卡的任务');
      return;
    }

    // 对每个角色，为每个任务创建/打卡
    characters.forEach(function(char) {
      currentTasks.forEach(function(t) {
        // 如果任务已有角色归属且不是该角色，创建新任务
        if (t.characterId && t.characterId !== char.id) {
          // 检查是否已有同名任务
          var existing = tasks.find(function(et) {
            return et.name === t.name && et.type === t.type && et.characterId === char.id;
          });
          if (existing) {
            if (!existing.completedDates) existing.completedDates = [];
            if (existing.completedDates.indexOf(todayStr) < 0) {
              existing.completedDates.push(todayStr);
            }
          } else {
            tasks.push({
              id: uid(),
              name: t.name,
              type: t.type,
              characterId: char.id,
              completedDates: [todayStr],
              sortOrder: tasks.length,
              timestamp: Date.now()
            });
          }
        } else if (!t.characterId) {
          // 通用任务，直接打卡
          if (!t.completedDates) t.completedDates = [];
          if (t.completedDates.indexOf(todayStr) < 0) {
            t.completedDates.push(todayStr);
          }
        }
      });
    });

    saveData('jx3_tasks', tasks);
    renderTaskList();
    triggerStampEffect();
    showToast('一键打卡完成');

    if (typeof window.checkAchievements === 'function') {
      window.checkAchievements();
    }
  });
}

/**
 * 删除任务
 * @param {string} id
 */
function deleteTask(id) {
  showConfirm('确定删除这个任务吗？', function() {
    var listEl = document.getElementById('task-list');
    var item = listEl ? listEl.querySelector('.task-item[data-id="' + id + '"]') : null;
    if (item) {
      item.classList.add('fade-out');
      setTimeout(function() {
        var tasks = loadData('jx3_tasks');
        var filtered = tasks.filter(function(t) { return t.id !== id; });
        saveData('jx3_tasks', filtered);
        renderTaskList();
        showToast('任务已删除');
      }, 300);
    } else {
      var tasks = loadData('jx3_tasks');
      var filtered = tasks.filter(function(t) { return t.id !== id; });
      saveData('jx3_tasks', filtered);
      renderTaskList();
      showToast('任务已删除');
    }
  });
}

/* ============================ 七、数据汇总模块 ============================ */

/**
 * 渲染汇总
 */
function renderSummary() {
  var periodSel = document.getElementById('summary-period');
  var dateInput = document.getElementById('summary-date');
  var period = periodSel ? periodSel.value : 'day';
  var dateStr = dateInput ? dateInput.value : today();

  // 计算日期范围
  var startDate, endDate;
  if (period === 'week') {
    startDate = getWeekStart(dateStr);
    var d = new Date(startDate + 'T00:00:00');
    d.setDate(d.getDate() + 6);
    endDate = formatDate(d);
  } else {
    startDate = dateStr;
    endDate = dateStr;
  }

  var records = loadData('jx3_records');
  var filtered = records.filter(function(r) {
    return r.date >= startDate && r.date <= endDate;
  });

  // 计算总收入、总支出、净收益
  var incomeTotal = 0, expenseTotal = 0;
  filtered.forEach(function(r) {
    if (r.type === 'expense') expenseTotal += Number(r.amount) || 0;
    else incomeTotal += Number(r.amount) || 0;
  });
  var netIncome = incomeTotal - expenseTotal;

  var incomeEl = document.getElementById('summary-income');
  var expenseEl = document.getElementById('summary-expense');
  var netEl = document.getElementById('summary-net');
  if (incomeEl) incomeEl.textContent = formatGold(incomeTotal);
  if (expenseEl) expenseEl.textContent = formatGold(expenseTotal);
  if (netEl) {
    netEl.textContent = (netIncome >= 0 ? '+' : '') + formatGold(netIncome);
    netEl.style.color = netIncome >= 0 ? '#d4a843' : '#c0392b';
  }

  // 各来源类型占比（CSS柱状图）
  var incomeTypes = loadData('jx3_income_types');
  var categoryStats = {};
  filtered.filter(function(r) { return r.type !== 'expense'; }).forEach(function(r) {
    var cat = r.category || 'other';
    if (!categoryStats[cat]) categoryStats[cat] = 0;
    categoryStats[cat] += Number(r.amount) || 0;
  });
  var maxCat = 0;
  Object.keys(categoryStats).forEach(function(k) { if (categoryStats[k] > maxCat) maxCat = categoryStats[k]; });

  var catEl = document.getElementById('summary-category');
  if (catEl) {
    if (Object.keys(categoryStats).length === 0) {
      catEl.innerHTML = '<div class="empty-tip">暂无数据</div>';
    } else {
      var catHtml = '';
      incomeTypes.forEach(function(t) {
        var val = categoryStats[t.id] || 0;
        if (val === 0) return;
        var pct = maxCat > 0 ? (val / maxCat) * 100 : 0;
        catHtml += '<div class="bar-row">' +
          '<span class="bar-label">' + escapeHtml(t.name) + '</span>' +
          '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
          '<span class="bar-value">' + formatGold(val) + '</span>' +
        '</div>';
      });
      catEl.innerHTML = catHtml;
    }
  }

  // 各角色收益对比（横向条形图）
  var charStats = {};
  filtered.filter(function(r) { return r.type !== 'expense'; }).forEach(function(r) {
    var cid = r.characterId || 'none';
    if (!charStats[cid]) charStats[cid] = 0;
    charStats[cid] += Number(r.amount) || 0;
  });
  var maxChar = 0;
  Object.keys(charStats).forEach(function(k) { if (charStats[k] > maxChar) maxChar = charStats[k]; });

  var charEl = document.getElementById('summary-characters');
  if (charEl) {
    if (Object.keys(charStats).length === 0) {
      charEl.innerHTML = '<div class="empty-tip">暂无数据</div>';
    } else {
      var charHtml = '';
      Object.keys(charStats).forEach(function(cid) {
        var val = charStats[cid];
        var pct = maxChar > 0 ? (val / maxChar) * 100 : 0;
        charHtml += '<div class="bar-row">' +
          '<span class="bar-label">' + escapeHtml(getCharName(cid)) + '</span>' +
          '<div class="bar-track"><div class="bar-fill gold" style="width:' + pct + '%"></div></div>' +
          '<span class="bar-value">' + formatGold(val) + '</span>' +
        '</div>';
      });
      charEl.innerHTML = charHtml;
    }
  }

  // 奇遇触发数
  var encounters = loadData('jx3_encounters');
  var encounterCount = encounters.filter(function(e) {
    return e.date >= startDate && e.date <= endDate;
  }).length;
  var encounterEl = document.getElementById('summary-encounters');
  if (encounterEl) encounterEl.textContent = encounterCount;

  // 日常完成率
  var tasks = loadData('jx3_tasks');
  var dailyTasks = tasks.filter(function(t) { return t.type === 'daily'; });
  var doneCount = dailyTasks.filter(function(t) {
    return t.completedDates && t.completedDates.indexOf(dateStr) >= 0;
  }).length;
  var completionRate = dailyTasks.length > 0 ? (doneCount / dailyTasks.length * 100).toFixed(1) : 0;
  var rateEl = document.getElementById('summary-task-rate');
  if (rateEl) rateEl.textContent = completionRate + '%';

  // 绘制趋势图
  drawTrendChart(startDate, endDate, period);
}

/**
 * 绘制趋势折线图
 * @param {string} startDate
 * @param {string} endDate
 * @param {string} period
 */
function drawTrendChart(startDate, endDate, period) {
  var canvas = document.getElementById('trend-chart');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var w = canvas.width = canvas.offsetWidth || 300;
  var h = canvas.height = canvas.offsetHeight || 200;
  ctx.clearRect(0, 0, w, h);

  var records = loadData('jx3_records');
  // 按日期分组统计收入
  var dateStats = {};
  var dates = [];
  var d = new Date(startDate + 'T00:00:00');
  var endD = new Date(endDate + 'T00:00:00');
  while (d <= endD) {
    var ds = formatDate(d);
    dates.push(ds);
    dateStats[ds] = 0;
    d.setDate(d.getDate() + 1);
  }
  records.filter(function(r) { return r.type !== 'expense' && r.date >= startDate && r.date <= endDate; }).forEach(function(r) {
    if (dateStats.hasOwnProperty(r.date)) {
      dateStats[r.date] += Number(r.amount) || 0;
    }
  });

  if (dates.length === 0) return;

  var values = dates.map(function(d) { return dateStats[d]; });
  var maxVal = Math.max.apply(null, values);
  if (maxVal === 0) maxVal = 1;

  var padding = 30;
  var chartW = w - padding * 2;
  var chartH = h - padding * 2;

  // 绘制坐标轴
  ctx.strokeStyle = '#8b7355';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, h - padding);
  ctx.lineTo(w - padding, h - padding);
  ctx.stroke();

  // 绘制折线
  if (dates.length > 1) {
    ctx.strokeStyle = '#d4a843';
    ctx.lineWidth = 2;
    ctx.beginPath();
    dates.forEach(function(ds, i) {
      var x = padding + (chartW / (dates.length - 1)) * i;
      var y = h - padding - (dateStats[ds] / maxVal) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 填充区域
    ctx.lineTo(padding + chartW, h - padding);
    ctx.lineTo(padding, h - padding);
    ctx.closePath();
    ctx.fillStyle = 'rgba(212, 168, 67, 0.15)';
    ctx.fill();

    // 绘制点
    ctx.fillStyle = '#d4a843';
    dates.forEach(function(ds, i) {
      var x = padding + (chartW / (dates.length - 1)) * i;
      var y = h - padding - (dateStats[ds] / maxVal) * chartH;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  } else {
    // 单日只画一个点
    ctx.fillStyle = '#d4a843';
    var x = padding + chartW / 2;
    var y = h - padding - (values[0] / maxVal) * chartH;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 绘制日期标签
  ctx.fillStyle = '#8b7355';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  var labelStep = Math.ceil(dates.length / 7);
  dates.forEach(function(ds, i) {
    if (dates.length > 7 && i % labelStep !== 0) return;
    var x = padding + (chartW / Math.max(1, dates.length - 1)) * i;
    ctx.fillText(ds.substring(5), x, h - padding + 15);
  });
}

/**
 * Canvas绘制古风收益汇总图片并下载PNG
 */
function generateSummaryImage() {
  var canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 1200;
  var ctx = canvas.getContext('2d');

  // 宣纸底色
  ctx.fillStyle = '#f5ecd7';
  ctx.fillRect(0, 0, 800, 1200);

  // 纸纹噪点
  for (var i = 0; i < 3000; i++) {
    var nx = Math.random() * 800;
    var ny = Math.random() * 1200;
    var alpha = Math.random() * 0.08;
    ctx.fillStyle = 'rgba(139, 115, 85, ' + alpha + ')';
    ctx.fillRect(nx, ny, 1, 1);
  }

  // 红色外边框
  ctx.strokeStyle = '#c0392b';
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, 760, 1160);

  // 金色内边框
  ctx.strokeStyle = '#d4a843';
  ctx.lineWidth = 2;
  ctx.strokeRect(30, 30, 740, 1140);

  // 祥云装饰
  drawCloud(ctx, 60, 60);
  drawCloud(ctx, 740, 60);
  drawCloud(ctx, 60, 1140);
  drawCloud(ctx, 740, 1140);

  // 标题
  ctx.fillStyle = '#d4a843';
  ctx.font = 'bold 42px "STKaiti", "KaiTi", serif';
  ctx.textAlign = 'center';
  ctx.fillText('剑网三收益汇总', 400, 110);

  // 日期
  ctx.fillStyle = '#8b7355';
  ctx.font = '18px "STKaiti", "KaiTi", serif';
  var dateStr = today();
  ctx.fillText(dateStr + ' ' + getWeekday(), 400, 145);

  // 分隔线
  ctx.strokeStyle = '#d4a843';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(80, 165);
  ctx.lineTo(720, 165);
  ctx.stroke();

  // 获取汇总数据
  var periodSel = document.getElementById('summary-period');
  var dateInput = document.getElementById('summary-date');
  var period = periodSel ? periodSel.value : 'day';
  var dateStrVal = dateInput ? dateInput.value : today();
  var startDate, endDate;
  if (period === 'week') {
    startDate = getWeekStart(dateStrVal);
    var d = new Date(startDate + 'T00:00:00');
    d.setDate(d.getDate() + 6);
    endDate = formatDate(d);
  } else {
    startDate = dateStrVal;
    endDate = dateStrVal;
  }

  var records = loadData('jx3_records');
  var filtered = records.filter(function(r) { return r.date >= startDate && r.date <= endDate; });
  var incomeTotal = 0, expenseTotal = 0;
  filtered.forEach(function(r) {
    if (r.type === 'expense') expenseTotal += Number(r.amount) || 0;
    else incomeTotal += Number(r.amount) || 0;
  });
  var netIncome = incomeTotal - expenseTotal;

  // 期间标签
  ctx.fillStyle = '#8b7355';
  ctx.font = '16px serif';
  ctx.fillText(period === 'week' ? ('统计周期：' + startDate + ' 至 ' + endDate) : ('统计日期：' + startDate), 400, 195);

  // 总金币大字
  ctx.fillStyle = '#d4a843';
  ctx.font = 'bold 56px "STKaiti", "KaiTi", serif';
  ctx.fillText(formatGold(netIncome), 400, 270);
  ctx.fillStyle = '#8b7355';
  ctx.font = '16px serif';
  ctx.fillText('净收益（金）', 400, 300);

  // 收入支出明细
  ctx.font = '18px serif';
  ctx.fillStyle = '#d4a843';
  ctx.textAlign = 'left';
  ctx.fillText('总收入：' + formatGold(incomeTotal) + ' 金', 100, 340);
  ctx.fillStyle = '#c0392b';
  ctx.fillText('总支出：' + formatGold(expenseTotal) + ' 金', 100, 370);

  // 各来源明细+条形图
  var incomeTypes = loadData('jx3_income_types');
  var categoryStats = {};
  filtered.filter(function(r) { return r.type !== 'expense'; }).forEach(function(r) {
    var cat = r.category || 'other';
    if (!categoryStats[cat]) categoryStats[cat] = 0;
    categoryStats[cat] += Number(r.amount) || 0;
  });
  var maxCat = 0;
  Object.keys(categoryStats).forEach(function(k) { if (categoryStats[k] > maxCat) maxCat = categoryStats[k]; });

  ctx.fillStyle = '#8b7355';
  ctx.font = 'bold 20px "STKaiti", "KaiTi", serif';
  ctx.fillText('各来源收益', 100, 420);

  var yPos = 450;
  incomeTypes.forEach(function(t) {
    var val = categoryStats[t.id] || 0;
    if (val === 0) return;
    ctx.fillStyle = '#5a4a3a';
    ctx.font = '16px serif';
    ctx.fillText(t.name + '：' + formatGold(val) + ' 金', 100, yPos);
    // 条形图
    var barW = maxCat > 0 ? (val / maxCat) * 400 : 0;
    ctx.fillStyle = '#d4a843';
    ctx.fillRect(320, yPos - 12, barW, 16);
    yPos += 35;
  });

  // 各角色收益对比
  var charStats = {};
  filtered.filter(function(r) { return r.type !== 'expense'; }).forEach(function(r) {
    var cid = r.characterId || 'none';
    if (!charStats[cid]) charStats[cid] = 0;
    charStats[cid] += Number(r.amount) || 0;
  });
  var maxChar = 0;
  Object.keys(charStats).forEach(function(k) { if (charStats[k] > maxChar) maxChar = charStats[k]; });

  yPos += 20;
  ctx.fillStyle = '#8b7355';
  ctx.font = 'bold 20px "STKaiti", "KaiTi", serif';
  ctx.fillText('各角色收益', 100, yPos);
  yPos += 35;

  Object.keys(charStats).forEach(function(cid) {
    var val = charStats[cid];
    ctx.fillStyle = '#5a4a3a';
    ctx.font = '16px serif';
    ctx.fillText(getCharName(cid) + '：' + formatGold(val) + ' 金', 100, yPos);
    var barW = maxChar > 0 ? (val / maxChar) * 400 : 0;
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(320, yPos - 12, barW, 16);
    yPos += 35;
  });

  // 奇遇统计
  var encounters = loadData('jx3_encounters');
  var encounterCount = encounters.filter(function(e) { return e.date >= startDate && e.date <= endDate; }).length;
  var peerlessCount = encounters.filter(function(e) { return e.date >= startDate && e.date <= endDate && e.rarity === 'peerless'; }).length;
  yPos += 20;
  ctx.fillStyle = '#8b7355';
  ctx.font = 'bold 20px "STKaiti", "KaiTi", serif';
  ctx.fillText('奇遇统计', 100, yPos);
  yPos += 35;
  ctx.fillStyle = '#5a4a3a';
  ctx.font = '16px serif';
  ctx.fillText('触发次数：' + encounterCount + ' 次（其中绝世 ' + peerlessCount + ' 次）', 100, yPos);

  // 底部落款
  ctx.fillStyle = '#8b7355';
  ctx.font = '14px serif';
  ctx.textAlign = 'center';
  ctx.fillText('江湖路远 · 剑网三收益记录', 400, 1150);
  ctx.fillText('生成于 ' + formatDateTime(Date.now()), 400, 1170);

  // 下载
  canvas.toBlob(function(blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'jx3_summary_' + dateStr + '.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('汇总图已生成并下载');
  }, 'image/png');
}

/**
 * Canvas绘制祥云
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - 中心x
 * @param {number} y - 中心y
 */
function drawCloud(ctx, x, y) {
  ctx.save();
  ctx.strokeStyle = '#d4a843';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  // 主云团
  ctx.arc(x, y, 12, 0, Math.PI * 2);
  ctx.arc(x + 14, y - 4, 10, 0, Math.PI * 2);
  ctx.arc(x - 12, y + 2, 8, 0, Math.PI * 2);
  ctx.arc(x + 4, y + 8, 9, 0, Math.PI * 2);
  ctx.stroke();
  // 卷曲尾
  ctx.beginPath();
  ctx.arc(x + 22, y + 2, 5, Math.PI * 0.5, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/* ============================ 八、设置模块 ============================ */

/**
 * 渲染设置页
 */
function renderSettings() {
  var accounts = loadData('jx3_accounts');
  var servers = loadData('jx3_servers');
  var characters = loadData('jx3_characters');
  var incomeTypes = loadData('jx3_income_types');

  // 账号列表
  var acctEl = document.getElementById('settings-account-list');
  if (acctEl) {
    if (accounts.length === 0) {
      acctEl.innerHTML = '<div class="empty-tip">暂无账号</div>';
    } else {
      acctEl.innerHTML = accounts.map(function(a) {
        var charCount = characters.filter(function(c) { return c.accountId === a.id; }).length;
        return '<div class="settings-item">' +
          '<div class="settings-item-info">' +
            '<span class="settings-item-name">' + escapeHtml(a.name) + '</span>' +
            '<span class="settings-item-desc">角色 ' + charCount + ' 个</span>' +
          '</div>' +
          '<div class="settings-item-actions">' +
            '<button class="btn-icon" onclick="openSettingsModal(\'account\',\'' + a.id + '\')">编辑</button>' +
            '<button class="btn-icon danger" onclick="deleteSettingsItem(\'account\',\'' + a.id + '\')">删除</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }
  }

  // 区服列表
  var svrEl = document.getElementById('settings-server-list');
  if (svrEl) {
    if (servers.length === 0) {
      svrEl.innerHTML = '<div class="empty-tip">暂无区服</div>';
    } else {
      svrEl.innerHTML = servers.map(function(s) {
        var typeName = s.stype === 'dual' ? '双线' : '电信';
        var acctName = s.accountId ? getAccountName(s.accountId) : '无关联';
        var charCount = characters.filter(function(c) { return c.serverId === s.id; }).length;
        return '<div class="settings-item">' +
          '<div class="settings-item-info">' +
            '<span class="settings-item-name">' + escapeHtml(s.name) + '</span>' +
            '<span class="settings-item-desc">' + typeName + ' · ' + escapeHtml(acctName) + ' · 角色 ' + charCount + ' 个</span>' +
          '</div>' +
          '<div class="settings-item-actions">' +
            '<button class="btn-icon" onclick="openSettingsModal(\'server\',\'' + s.id + '\')">编辑</button>' +
            '<button class="btn-icon danger" onclick="deleteSettingsItem(\'server\',\'' + s.id + '\')">删除</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }
  }

  // 角色列表
  var charEl = document.getElementById('settings-character-list');
  if (charEl) {
    if (characters.length === 0) {
      charEl.innerHTML = '<div class="empty-tip">暂无角色</div>';
    } else {
      charEl.innerHTML = characters.map(function(c) {
        var sect = c.sect || '未设置';
        var svrName = c.serverId ? getServerName(c.serverId) : '未设置';
        var acctName = c.accountId ? getAccountName(c.accountId) : '无关联';
        return '<div class="settings-item">' +
          '<div class="settings-item-info">' +
            '<span class="settings-item-name">' + escapeHtml(c.name) + (c.isMain ? ' <span class="main-tag">主</span>' : '') + '</span>' +
            '<span class="settings-item-desc">' + escapeHtml(sect) + ' · ' + escapeHtml(svrName) + ' · ' + escapeHtml(acctName) + '</span>' +
          '</div>' +
          '<div class="settings-item-actions">' +
            '<button class="btn-icon" onclick="openSettingsModal(\'character\',\'' + c.id + '\')">编辑</button>' +
            '<button class="btn-icon danger" onclick="deleteSettingsItem(\'character\',\'' + c.id + '\')">删除</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }
  }

  // 收益类型列表
  var typeEl = document.getElementById('settings-incometype-list');
  if (typeEl) {
    if (incomeTypes.length === 0) {
      typeEl.innerHTML = '<div class="empty-tip">暂无类型</div>';
    } else {
      typeEl.innerHTML = incomeTypes.map(function(t) {
        return '<div class="settings-item">' +
          '<div class="settings-item-info">' +
            '<span class="settings-item-name">' + escapeHtml(t.name) + '</span>' +
          '</div>' +
          '<div class="settings-item-actions">' +
            '<button class="btn-icon" onclick="openSettingsModal(\'incomeType\',\'' + t.id + '\')">编辑</button>' +
            '<button class="btn-icon danger" onclick="deleteSettingsItem(\'incomeType\',\'' + t.id + '\')">删除</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }
  }

  // 显示上次备份时间
  var settings = loadData('jx3_settings');
  var backupSetting = settings.find(function(s) { return s.key === 'lastBackup'; });
  var backupEl = document.getElementById('last-backup-time');
  if (backupEl) {
    backupEl.textContent = backupSetting ? formatDateTime(backupSetting.value) : '从未备份';
  }
}

/**
 * 打开设置弹窗
 * @param {string} type - account/server/character/incomeType
 * @param {string} editId - 编辑时传入ID，新增为null
 */
function openSettingsModal(type, editId) {
  settingsEditType = type;
  settingsEditId = editId || null;

  var titleEl = document.getElementById('settings-modal-title');
  var fieldsEl = document.getElementById('settings-modal-fields');
  if (!fieldsEl) return;

  var titleMap = {
    account: '账号',
    server: '区服',
    character: '角色',
    incomeType: '收益类型'
  };
  if (titleEl) titleEl.textContent = (editId ? '编辑' : '添加') + titleMap[type];

  var html = '';

  if (type === 'account') {
    var accounts = loadData('jx3_accounts');
    var acct = editId ? accounts.find(function(a) { return a.id === editId; }) : null;
    var name = acct ? acct.name : '';
    html = '<div class="form-group"><label>账号名称</label>' +
      '<input type="text" id="settings-name" class="form-input" value="' + escapeHtml(name) + '" placeholder="请输入账号名称"></div>';
  } else if (type === 'server') {
    var servers = loadData('jx3_servers');
    var svrAccounts = loadData('jx3_accounts');
    var svr = editId ? servers.find(function(s) { return s.id === editId; }) : null;
    var svrName = svr ? svr.name : '';
    var svrType = svr ? svr.stype : 'telecom';
    var svrAcct = svr ? svr.accountId : '';
    html = '<div class="form-group"><label>区服名称</label>' +
      '<input type="text" id="settings-name" class="form-input" value="' + escapeHtml(svrName) + '" placeholder="请输入区服名称"></div>' +
      '<div class="form-group"><label>区服类型</label>' +
      '<select id="settings-stype" class="form-input">' +
        '<option value="telecom"' + (svrType === 'telecom' ? ' selected' : '') + '>电信</option>' +
        '<option value="dual"' + (svrType === 'dual' ? ' selected' : '') + '>双线</option>' +
      '</select></div>' +
      '<div class="form-group"><label>关联账号</label>' +
      '<select id="settings-account-id" class="form-input"><option value="">无关联</option>';
    svrAccounts.forEach(function(a) {
      html += '<option value="' + a.id + '"' + (svrAcct === a.id ? ' selected' : '') + '>' + escapeHtml(a.name) + '</option>';
    });
    html += '</select></div>';
  } else if (type === 'character') {
    var characters = loadData('jx3_characters');
    var charServers = loadData('jx3_servers');
    var charAccounts = loadData('jx3_accounts');
    var char = editId ? characters.find(function(c) { return c.id === editId; }) : null;
    var charName = char ? char.name : '';
    var charSect = char ? char.sect : '';
    var charSvr = char ? char.serverId : '';
    var charAcct = char ? char.accountId : '';
    var isMain = char ? char.isMain : false;
    html = '<div class="form-group"><label>角色名称</label>' +
      '<input type="text" id="settings-name" class="form-input" value="' + escapeHtml(charName) + '" placeholder="请输入角色名称"></div>' +
      '<div class="form-group"><label>门派</label>' +
      '<select id="settings-sect" class="form-input"><option value="">请选择门派</option>';
    PRESET_SECTS.forEach(function(s) {
      html += '<option value="' + s + '"' + (charSect === s ? ' selected' : '') + '>' + s + '</option>';
    });
    html += '</select></div>' +
      '<div class="form-group"><label>所在区服</label>' +
      '<select id="settings-server-id" class="form-input"><option value="">请选择区服</option>';
    charServers.forEach(function(s) {
      html += '<option value="' + s.id + '"' + (charSvr === s.id ? ' selected' : '') + '>' + escapeHtml(s.name) + '</option>';
    });
    html += '</select></div>' +
      '<div class="form-group"><label>关联账号</label>' +
      '<select id="settings-account-id" class="form-input"><option value="">无关联</option>';
    charAccounts.forEach(function(a) {
      html += '<option value="' + a.id + '"' + (charAcct === a.id ? ' selected' : '') + '>' + escapeHtml(a.name) + '</option>';
    });
    html += '</select></div>' +
      '<div class="form-group"><label><input type="checkbox" id="settings-is-main"' + (isMain ? ' checked' : '') + '> 设为主角色</label></div>';
  } else if (type === 'incomeType') {
    var incomeTypes = loadData('jx3_income_types');
    var it = editId ? incomeTypes.find(function(t) { return t.id === editId; }) : null;
    var itName = it ? it.name : '';
    html = '<div class="form-group"><label>类型名称</label>' +
      '<input type="text" id="settings-name" class="form-input" value="' + escapeHtml(itName) + '" placeholder="请输入类型名称"></div>';
  }

  fieldsEl.innerHTML = html;
  openModal('settings-modal');
}

/**
 * 保存设置项
 */
function saveSettingsItem() {
  var type = settingsEditType;
  var editId = settingsEditId;
  var nameInput = document.getElementById('settings-name');
  var name = nameInput ? nameInput.value.trim() : '';

  if (!name) {
    showToast('请输入名称');
    return;
  }

  if (type === 'account') {
    var accounts = loadData('jx3_accounts');
    if (editId) {
      var a = accounts.find(function(ac) { return ac.id === editId; });
      if (a) a.name = name;
    } else {
      accounts.push({ id: uid(), name: name });
    }
    saveData('jx3_accounts', accounts);
  } else if (type === 'server') {
    var servers = loadData('jx3_servers');
    var stypeSel = document.getElementById('settings-stype');
    var acctIdSel = document.getElementById('settings-account-id');
    var stype = stypeSel ? stypeSel.value : 'telecom';
    var acctId = acctIdSel ? acctIdSel.value : '';
    if (editId) {
      var s = servers.find(function(sv) { return sv.id === editId; });
      if (s) { s.name = name; s.stype = stype; s.accountId = acctId; }
    } else {
      servers.push({ id: uid(), name: name, stype: stype, accountId: acctId });
    }
    saveData('jx3_servers', servers);
  } else if (type === 'character') {
    var characters = loadData('jx3_characters');
    var sectSel = document.getElementById('settings-sect');
    var svrIdSel = document.getElementById('settings-server-id');
    var charAcctIdSel = document.getElementById('settings-account-id');
    var isMainChk = document.getElementById('settings-is-main');
    var sect = sectSel ? sectSel.value : '';
    var svrId = svrIdSel ? svrIdSel.value : '';
    var charAcctId = charAcctIdSel ? charAcctIdSel.value : '';
    var isMain = isMainChk ? isMainChk.checked : false;

    if (isMain) {
      // 取消其他主角色
      characters.forEach(function(c) { c.isMain = false; });
    }

    if (editId) {
      var c = characters.find(function(ch) { return ch.id === editId; });
      if (c) {
        c.name = name; c.sect = sect; c.serverId = svrId; c.accountId = charAcctId; c.isMain = isMain;
      }
    } else {
      characters.push({
        id: uid(), name: name, sect: sect, serverId: svrId, accountId: charAcctId, isMain: isMain
      });
    }
    saveData('jx3_characters', characters);
  } else if (type === 'incomeType') {
    var incomeTypes = loadData('jx3_income_types');
    if (editId) {
      var t = incomeTypes.find(function(tp) { return tp.id === editId; });
      if (t) t.name = name;
    } else {
      incomeTypes.push({ id: uid(), name: name, isDefault: false });
    }
    saveData('jx3_income_types', incomeTypes);
  }

  closeModal('settings-modal');
  renderSettings();
  showToast('保存成功');
}

/**
 * 删除设置项
 * @param {string} type - account/server/character/incomeType
 * @param {string} id
 */
function deleteSettingsItem(type, id) {
  var typeNames = {
    account: '账号', server: '区服', character: '角色', incomeType: '收益类型'
  };
  showConfirm('确定删除这个' + typeNames[type] + '吗？相关数据将保留但失去关联。', function() {
    var key = {
      account: 'jx3_accounts',
      server: 'jx3_servers',
      character: 'jx3_characters',
      incomeType: 'jx3_income_types'
    }[type];
    var data = loadData(key);
    var filtered = data.filter(function(item) { return item.id !== id; });
    saveData(key, filtered);
    renderSettings();
    showToast('已删除');
  });
}

/* ============================ 九、避雷名单模块 ============================ */

/**
 * 渲染避雷名单列表
 */
function renderBlacklist() {
  var blacklist = loadData('jx3_blacklist');
  blacklist.sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });

  // 筛选
  var filterType = document.getElementById('blacklist-filter-type');
  var filterKeyword = document.getElementById('blacklist-filter-keyword');
  var ft = filterType ? filterType.value : '';
  var fk = filterKeyword ? filterKeyword.value.trim().toLowerCase() : '';

  var filtered = blacklist.filter(function(b) {
    if (ft && b.type !== ft) return false;
    if (fk) {
      var text = ((b.name || '') + (b.reason || '') + (b.note || '')).toLowerCase();
      if (text.indexOf(fk) < 0) return false;
    }
    return true;
  });

  var listEl = document.getElementById('blacklist-list');
  if (!listEl) return;

  if (filtered.length === 0) {
    listEl.innerHTML = '<div class="empty-tip">暂无避雷记录，江湖太平</div>';
    return;
  }

  listEl.innerHTML = filtered.map(function(b) {
    var typeLabel = b.type === 'player' ? '玩家' : (b.type === 'team' ? '队伍' : '其他');
    var typeCls = b.type === 'player' ? 'player' : 'team';
    return '<div class="list-item blacklist-item" data-id="' + b.id + '">' +
      '<div class="list-item-content">' +
        '<div class="item-top">' +
          '<span class="item-tag blacklist-type ' + typeCls + '">' + typeLabel + '</span>' +
          '<span class="blacklist-name">' + escapeHtml(b.name || '') + '</span>' +
        '</div>' +
        (b.reason ? '<div class="item-mid"><span class="blacklist-reason">' + escapeHtml(b.reason) + '</span></div>' : '') +
        (b.note ? '<div class="item-bottom"><span class="item-note">' + escapeHtml(b.note) + '</span></div>' : '') +
        '<div class="item-bottom"><span class="item-time">' + escapeHtml(b.date || '') + '</span></div>' +
      '</div>' +
      '<div class="swipe-action swipe-delete" onclick="deleteBlacklist(\'' + b.id + '\')">删除</div>' +
    '</div>';
  }).join('');

  // 绑定左滑删除
  listEl.querySelectorAll('.list-item').forEach(function(item) {
    bindSwipeDelete(item, function() {
      var id = item.getAttribute('data-id');
      deleteBlacklist(id);
    });
  });
}

/**
 * 打开避雷名单弹窗
 */
function openBlacklistModal() {
  var typeSel = document.getElementById('blacklist-type');
  var nameInput = document.getElementById('blacklist-name');
  var reasonInput = document.getElementById('blacklist-reason');
  var noteInput = document.getElementById('blacklist-note');
  var dateInput = document.getElementById('blacklist-date');
  if (typeSel) typeSel.value = 'player';
  if (nameInput) nameInput.value = '';
  if (reasonInput) reasonInput.value = '';
  if (noteInput) noteInput.value = '';
  if (dateInput) dateInput.value = today();
  openModal('blacklist-modal');
}

/**
 * 保存避雷记录
 */
function saveBlacklist() {
  var typeSel = document.getElementById('blacklist-type');
  var nameInput = document.getElementById('blacklist-name');
  var reasonInput = document.getElementById('blacklist-reason');
  var noteInput = document.getElementById('blacklist-note');
  var dateInput = document.getElementById('blacklist-date');

  var type = typeSel ? typeSel.value : 'player';
  var name = nameInput ? nameInput.value.trim() : '';
  var reason = reasonInput ? reasonInput.value.trim() : '';
  var note = noteInput ? noteInput.value.trim() : '';
  var date = dateInput ? dateInput.value : today();

  if (!name) {
    showToast('请输入名称或编号');
    return;
  }

  var blacklist = loadData('jx3_blacklist');
  blacklist.push({
    id: uid(),
    type: type,
    name: name,
    reason: reason,
    note: note,
    date: date,
    timestamp: Date.now()
  });
  saveData('jx3_blacklist', blacklist);

  closeModal('blacklist-modal');
  renderBlacklist();
  showToast('已加入避雷名单');
}

/**
 * 删除避雷记录
 * @param {string} id
 */
function deleteBlacklist(id) {
  showConfirm('确定从避雷名单中移除吗？', function() {
    var listEl = document.getElementById('blacklist-list');
    var item = listEl ? listEl.querySelector('.list-item[data-id="' + id + '"]') : null;
    if (item) {
      item.classList.add('fade-out');
      setTimeout(function() {
        var blacklist = loadData('jx3_blacklist');
        var filtered = blacklist.filter(function(b) { return b.id !== id; });
        saveData('jx3_blacklist', filtered);
        renderBlacklist();
        showToast('已移除');
      }, 300);
    } else {
      var blacklist = loadData('jx3_blacklist');
      var filtered = blacklist.filter(function(b) { return b.id !== id; });
      saveData('jx3_blacklist', filtered);
      renderBlacklist();
      showToast('已移除');
    }
  });
}

/* ============================ 十、全局搜索 ============================ */

/**
 * 全局搜索
 * @param {string} keyword - 搜索关键词
 */
function globalSearch(keyword) {
  keyword = (keyword || '').trim().toLowerCase();
  if (!keyword) return;

  var results = [];

  // 搜索收益记录
  var records = loadData('jx3_records');
  records.forEach(function(r) {
    var text = ((r.note || '') + (r.items || '') + getCharName(r.characterId) + getTypeName(r.category)).toLowerCase();
    if (text.indexOf(keyword) >= 0) {
      results.push({
        type: 'record',
        title: getCharName(r.characterId) + ' - ' + (r.type === 'expense' ? '-' : '+') + formatGold(r.amount),
        desc: getTypeName(r.category) + (r.note ? ' ' + r.note : ''),
        date: r.date,
        id: r.id
      });
    }
  });

  // 搜索奇遇
  var encounters = loadData('jx3_encounters');
  encounters.forEach(function(e) {
    var text = ((e.name || '') + (e.note || '') + getCharName(e.characterId)).toLowerCase();
    if (text.indexOf(keyword) >= 0) {
      results.push({
        type: 'encounter',
        title: e.name + ' (' + (e.rarity === 'peerless' ? '绝世' : '普通') + ')',
        desc: getCharName(e.characterId) + (e.note ? ' ' + e.note : ''),
        date: e.date,
        id: e.id
      });
    }
  });

  // 搜索任务
  var tasks = loadData('jx3_tasks');
  tasks.forEach(function(t) {
    var text = ((t.name || '') + getCharName(t.characterId)).toLowerCase();
    if (text.indexOf(keyword) >= 0) {
      results.push({
        type: 'task',
        title: t.name,
        desc: getCharName(t.characterId) + ' · ' + (t.type === 'daily' ? '日常' : '周常'),
        date: '',
        id: t.id
      });
    }
  });

  // 显示结果
  var resultEl = document.getElementById('search-results');
  if (!resultEl) return;

  if (results.length === 0) {
    resultEl.innerHTML = '<div class="empty-tip">未找到相关结果</div>';
  } else {
    resultEl.innerHTML = results.slice(0, 30).map(function(r) {
      var typeLabel = r.type === 'record' ? '收益' : (r.type === 'encounter' ? '奇遇' : '任务');
      return '<div class="search-result-item" data-type="' + r.type + '" data-id="' + r.id + '">' +
        '<span class="search-result-type">' + typeLabel + '</span>' +
        '<div class="search-result-info">' +
          '<span class="search-result-title">' + escapeHtml(r.title) + '</span>' +
          '<span class="search-result-desc">' + escapeHtml(r.desc) + '</span>' +
        '</div>' +
        (r.date ? '<span class="search-result-date">' + escapeHtml(r.date) + '</span>' : '') +
      '</div>';
    }).join('');
  }

  // 显示搜索结果弹窗或区域
  var searchPanel = document.getElementById('search-panel');
  if (searchPanel) {
    searchPanel.classList.add('active');
  }
}

/* ============================ 十一、数据导入导出 ============================ */

/**
 * 导出全部localStorage为JSON文件
 */
function exportData() {
  var exportObj = {};
  STORAGE_KEYS.forEach(function(key) {
    exportObj[key] = loadData(key);
  });
  exportObj._exportTime = Date.now();
  exportObj._version = '1.0.0';

  var json = JSON.stringify(exportObj, null, 2);
  var blob = new Blob([json], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'jx3_backup_' + today() + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // 记录备份时间
  var settings = loadData('jx3_settings');
  var bs = settings.find(function(s) { return s.key === 'lastBackup'; });
  if (bs) bs.value = Date.now();
  else settings.push({ key: 'lastBackup', value: Date.now() });
  saveData('jx3_settings', settings);

  showToast('数据已导出');
}

/**
 * 导入JSON数据
 * @param {Event} event - 文件选择事件
 */
function importData(event) {
  var file = event.target.files[0];
  if (!file) return;

  var reader = new FileReader();
  reader.onload = function(e) {
    var data;
    try {
      data = JSON.parse(e.target.result);
    } catch (err) {
      showToast('导入失败：文件格式错误');
      return;
    }

    // 弹出确认：覆盖=确定，合并=取消
    confirmCallback = function() {
      // 覆盖模式
      STORAGE_KEYS.forEach(function(key) {
        if (data[key]) {
          saveData(key, data[key]);
        }
      });
      showToast('数据已覆盖导入');
      renderHome();
      renderSettings();
    };
    var msgEl = document.getElementById('confirm-msg');
    if (msgEl) msgEl.textContent = '选择"确定"覆盖现有数据，选择"取消"则合并数据。确定要覆盖吗？';
    openModal('confirm-modal');

    // 存储合并回调供取消时使用
    window._importMergeCallback = function() {
      STORAGE_KEYS.forEach(function(key) {
        if (data[key]) {
          var existing = loadData(key);
          var existingIds = existing.map(function(item) { return item.id; });
          data[key].forEach(function(item) {
            if (item.id && existingIds.indexOf(item.id) < 0) {
              existing.push(item);
            }
          });
          saveData(key, existing);
        }
      });
      showToast('数据已合并导入');
      renderHome();
      renderSettings();
    };
  };
  reader.readAsText(file);
  event.target.value = ''; // 重置input
}

/**
 * 导出收益记录为CSV
 */
function exportCSV() {
  var records = loadData('jx3_records');
  records.sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });

  var header = '日期,时间,角色,区服,账号,类型,来源,金额,物品,备注\n';
  var rows = records.map(function(r) {
    return [
      r.date || '',
      formatDateTime(r.timestamp),
      getCharName(r.characterId),
      getServerName(r.serverId),
      getAccountName(r.accountId),
      r.type === 'expense' ? '支出' : '收入',
      getTypeName(r.category),
      r.amount || 0,
      (r.items || '').replace(/,/g, '，'),
      (r.note || '').replace(/,/g, '，')
    ].join(',');
  }).join('\n');

  // 添加BOM以支持Excel中文
  var csv = '\ufeff' + header + rows;
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'jx3_records_' + today() + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('CSV已导出');
}

/**
 * 确认清空全部数据
 */
function confirmClearAll() {
  showConfirm('警告：此操作将清空所有数据且不可恢复！确定继续吗？', function() {
    showConfirm('再次确认：真的要清空全部数据吗？', function() {
      STORAGE_KEYS.forEach(function(key) {
        localStorage.removeItem(key);
      });
      initData();
      renderHome();
      renderSettings();
      showToast('全部数据已清空');
    });
  });
}

/* ============================ 左滑删除/右滑完成通用实现 ============================ */

/**
 * 绑定列表项左滑删除
 * @param {HTMLElement} item - 列表项元素
 * @param {Function} deleteCallback - 删除回调
 */
function bindSwipeDelete(item, deleteCallback) {
  var startX = 0, currentX = 0, isDragging = false;
  var THRESHOLD = 80;

  // 触摸事件
  item.addEventListener('touchstart', function(e) {
    startX = e.touches[0].clientX;
    isDragging = true;
    item.style.transition = 'none';
  }, { passive: true });

  item.addEventListener('touchmove', function(e) {
    if (!isDragging) return;
    currentX = e.touches[0].clientX - startX;
    if (currentX < 0) {
      item.style.transform = 'translateX(' + Math.max(currentX, -100) + 'px)';
    }
  }, { passive: true });

  item.addEventListener('touchend', function() {
    if (!isDragging) return;
    isDragging = false;
    item.style.transition = 'transform 0.3s ease';
    if (currentX < -THRESHOLD) {
      // 触发删除
      item.style.transform = 'translateX(-100px)';
      if (deleteCallback) deleteCallback();
    } else {
      // 回弹
      item.style.transform = 'translateX(0)';
    }
    currentX = 0;
  });

  // 鼠标事件
  item.addEventListener('mousedown', function(e) {
    startX = e.clientX;
    isDragging = true;
    item.style.transition = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    currentX = e.clientX - startX;
    if (currentX < 0) {
      item.style.transform = 'translateX(' + Math.max(currentX, -100) + 'px)';
    }
  });

  document.addEventListener('mouseup', function() {
    if (!isDragging) return;
    isDragging = false;
    item.style.transition = 'transform 0.3s ease';
    if (currentX < -THRESHOLD) {
      item.style.transform = 'translateX(-100px)';
      if (deleteCallback) deleteCallback();
    } else {
      item.style.transform = 'translateX(0)';
    }
    currentX = 0;
  });
}

/**
 * 绑定任务项滑动（左滑删除/右滑完成）
 * @param {HTMLElement} item - 任务项元素
 * @param {Function} completeCallback - 完成回调（右滑）
 * @param {Function} deleteCallback - 删除回调（左滑）
 */
function bindSwipeTask(item, completeCallback, deleteCallback) {
  var startX = 0, currentX = 0, isDragging = false;
  var THRESHOLD = 80;

  item.addEventListener('touchstart', function(e) {
    startX = e.touches[0].clientX;
    isDragging = true;
    item.style.transition = 'none';
  }, { passive: true });

  item.addEventListener('touchmove', function(e) {
    if (!isDragging) return;
    currentX = e.touches[0].clientX - startX;
    if (currentX < 0) {
      item.style.transform = 'translateX(' + Math.max(currentX, -100) + 'px)';
    } else {
      item.style.transform = 'translateX(' + Math.min(currentX, 100) + 'px)';
    }
  }, { passive: true });

  item.addEventListener('touchend', function() {
    if (!isDragging) return;
    isDragging = false;
    item.style.transition = 'transform 0.3s ease';
    if (currentX < -THRESHOLD) {
      // 左滑删除
      item.style.transform = 'translateX(-100px)';
      if (deleteCallback) deleteCallback();
    } else if (currentX > THRESHOLD) {
      // 右滑完成 - 收剑归鞘动效
      item.classList.add('sheath-effect');
      item.style.transform = 'translateX(0)';
      if (completeCallback) completeCallback();
      setTimeout(function() {
        item.classList.remove('sheath-effect');
      }, 600);
    } else {
      item.style.transform = 'translateX(0)';
    }
    currentX = 0;
  });

  // 鼠标事件
  item.addEventListener('mousedown', function(e) {
    startX = e.clientX;
    isDragging = true;
    item.style.transition = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    currentX = e.clientX - startX;
    if (currentX < 0) {
      item.style.transform = 'translateX(' + Math.max(currentX, -100) + 'px)';
    } else {
      item.style.transform = 'translateX(' + Math.min(currentX, 100) + 'px)';
    }
  });

  document.addEventListener('mouseup', function() {
    if (!isDragging) return;
    isDragging = false;
    item.style.transition = 'transform 0.3s ease';
    if (currentX < -THRESHOLD) {
      item.style.transform = 'translateX(-100px)';
      if (deleteCallback) deleteCallback();
    } else if (currentX > THRESHOLD) {
      item.classList.add('sheath-effect');
      item.style.transform = 'translateX(0)';
      if (completeCallback) completeCallback();
      setTimeout(function() {
        item.classList.remove('sheath-effect');
      }, 600);
    } else {
      item.style.transform = 'translateX(0)';
    }
    currentX = 0;
  });
}

/* ============================ 盖章动效 ============================ */

/**
 * 触发盖章动效（盖章落墨）
 */
function triggerStampEffect() {
  var stamp = document.createElement('div');
  stamp.className = 'stamp-effect';
  stamp.innerHTML = '<span>记</span>';
  document.body.appendChild(stamp);
  // 触发动画
  requestAnimationFrame(function() {
    stamp.classList.add('show');
  });
  setTimeout(function() {
    if (stamp.parentNode) stamp.parentNode.removeChild(stamp);
  }, 1500);
}

/* ============================ 十二、初始化 ============================ */

/**
 * 入口函数
 */
function init() {
  // 数据迁移
  migrateData();
  // 初始化数据
  initData();

  // 绑定侧边栏导航点击
  document.querySelectorAll('.nav-item').forEach(function(nav) {
    nav.addEventListener('click', function() {
      var page = this.getAttribute('data-page');
      if (page) switchPage(page);
    });
  });

  // 绑定移动端导航点击
  document.querySelectorAll('.mobile-nav-item').forEach(function(nav) {
    nav.addEventListener('click', function() {
      var page = this.getAttribute('data-page');
      if (page === 'more') {
        // "更多"按钮跳转到设置页
        switchPage('settings');
      } else if (page) {
        switchPage(page);
      }
    });
  });

  // 绑定全局搜索
  var searchInput = document.getElementById('global-search');
  var searchBtn = document.getElementById('search-btn');
  if (searchInput) {
    searchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        globalSearch(this.value);
      }
    });
  }
  if (searchBtn) {
    searchBtn.addEventListener('click', function() {
      if (searchInput) globalSearch(searchInput.value);
    });
  }

  // 绑定语音按钮（占位，实际语音识别需配合其他库）
  var voiceBtn = document.getElementById('voice-btn');
  if (voiceBtn) {
    voiceBtn.addEventListener('click', function() {
      showToast('语音功能开发中...');
    });
  }

  // 绑定右侧快捷按钮（浮动添加按钮等）
  var fabBtn = document.getElementById('fab-btn');
  if (fabBtn) {
    fabBtn.addEventListener('click', function() {
      openRecordModal();
    });
  }

  // 绑定弹窗遮罩点击关闭
  document.querySelectorAll('.modal-overlay').forEach(function(overlay) {
    overlay.addEventListener('click', function(e) {
      if (e.target === this) {
        this.classList.remove('active');
      }
    });
  });

  // 绑定ESC关闭弹窗
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(function(m) {
        m.classList.remove('active');
      });
    }
  });

  // 渲染首页
  renderHome();

  // 设置汇总页日期默认值为今天
  var summaryDate = document.getElementById('summary-date');
  if (summaryDate) summaryDate.value = today();

  // 绑定筛选器变化事件
  var filterIds = ['filter-account', 'filter-server', 'filter-char', 'filter-date-start', 'filter-date-end'];
  filterIds.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', function() {
        if (currentTab === 'records') renderRecordList();
      });
    }
  });

  // 绑定汇总页筛选变化
  var summaryPeriod = document.getElementById('summary-period');
  if (summaryPeriod) {
    summaryPeriod.addEventListener('change', function() { renderSummary(); });
  }
  var summaryDateEl = document.getElementById('summary-date');
  if (summaryDateEl) {
    summaryDateEl.addEventListener('change', function() { renderSummary(); });
  }

  // 绑定避雷名单筛选
  var blType = document.getElementById('blacklist-filter-type');
  var blKeyword = document.getElementById('blacklist-filter-keyword');
  if (blType) blType.addEventListener('change', function() { renderBlacklist(); });
  if (blKeyword) blKeyword.addEventListener('input', function() { renderBlacklist(); });

  // 绑定奇遇筛选
  var encChar = document.getElementById('encounter-filter-char');
  var encRarity = document.getElementById('encounter-filter-rarity');
  if (encChar) encChar.addEventListener('change', function() { renderEncounterList(); });
  if (encRarity) encRarity.addEventListener('change', function() { renderEncounterList(); });

  console.log('剑网三收益记录工具已初始化');
}

/* ============================ 挂载到window ============================ */

// 将所有函数挂载到window，供HTML内联调用
window.loadData = loadData;
window.saveData = saveData;
window.uid = uid;
window.today = today;
window.formatDate = formatDate;
window.formatDateTime = formatDateTime;
window.getWeekStart = getWeekStart;
window.initData = initData;
window.migrateData = migrateData;
window.getCharName = getCharName;
window.getServerName = getServerName;
window.getAccountName = getAccountName;
window.getTypeName = getTypeName;
window.getCharSect = getCharSect;

window.showToast = showToast;
window.openModal = openModal;
window.closeModal = closeModal;
window.showConfirm = showConfirm;
window.confirmYes = confirmYes;
window.confirmNo = confirmNo;
window.switchPage = switchPage;

window.renderHome = renderHome;
window.fillFilterOptions = fillFilterOptions;

window.renderRecordList = renderRecordList;
window.openRecordModal = openRecordModal;
window.setRecordType = setRecordType;
window.adjustAmount = adjustAmount;
window.loadFromHistory = loadFromHistory;
window.saveRecord = saveRecord;
window.deleteRecord = deleteRecord;

window.renderEncounterList = renderEncounterList;
window.renderEncounterStats = renderEncounterStats;
window.openEncounterModal = openEncounterModal;
window.saveEncounter = saveEncounter;
window.deleteEncounter = deleteEncounter;

window.renderTaskList = renderTaskList;
window.switchTaskTab = switchTaskTab;
window.openTaskModal = openTaskModal;
window.setTaskType = setTaskType;
window.saveTask = saveTask;
window.addTaskFromTemplate = addTaskFromTemplate;
window.toggleTask = toggleTask;
window.batchCheckAll = batchCheckAll;
window.deleteTask = deleteTask;

window.renderSummary = renderSummary;
window.generateSummaryImage = generateSummaryImage;
window.drawCloud = drawCloud;
window.drawTrendChart = drawTrendChart;

window.renderSettings = renderSettings;
window.openSettingsModal = openSettingsModal;
window.saveSettingsItem = saveSettingsItem;
window.deleteSettingsItem = deleteSettingsItem;

window.renderBlacklist = renderBlacklist;
window.openBlacklistModal = openBlacklistModal;
window.saveBlacklist = saveBlacklist;
window.deleteBlacklist = deleteBlacklist;

window.globalSearch = globalSearch;

window.exportData = exportData;
window.importData = importData;
window.exportCSV = exportCSV;
window.confirmClearAll = confirmClearAll;

window.init = init;
window.triggerStampEffect = triggerStampEffect;
window.formatGold = formatGold;
window.escapeHtml = escapeHtml;

// DOM加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
