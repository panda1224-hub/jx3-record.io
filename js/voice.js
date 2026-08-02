/* ======================================================================
   剑网三收益记录 · AI 语音录入模块
   功能：基于浏览器原生 Web Speech API 实现语音识别，
        自动解析“角色 + 活动 + 金额”，并回填到记录表单。
   依赖：app.js 提供 loadData/saveData/showToast/switchPage/
        openRecordModal/setRecordType/AMOUNT_MAP 等全局方法。
   ====================================================================== */

// 语音识别实例与状态
let recognition = null;
let isListening = false;

// 中文数字字符表（数字位）
const CN_DIGITS = {
  '零': 0, '〇': 0, '一': 1, '二': 2, '两': 2, '三': 3,
  '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9
};
// 中文数字单位（十百千）
const CN_UNITS = { '十': 10, '百': 100, '千': 1000 };
// 中文数字大节单位（万、亿）
const CN_SECTIONS = { '万': 10000, '亿': 100000000 };
// 全部可能出现在中文数字中的字符（用于从语音文本中抽取数字串）
const CN_ALL_CHARS = '零〇一二两三四五六七八九十百千万亿';

/**
 * 初始化语音识别
 * 兼容性检测：不支持 Web Speech API 时隐藏语音按钮。
 */
function initVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    // 当前浏览器不支持语音识别，隐藏语音按钮
    const btn = document.getElementById('voice-btn');
    if (btn) btn.style.display = 'none';
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'zh-CN';          // 中文识别
  recognition.continuous = false;       // 单次识别
  recognition.interimResults = false;   // 只返回最终结果

  // 识别成功回调：解析语音指令
  recognition.onresult = function (event) {
    const transcript = event.results[0][0].transcript;
    parseVoiceCommand(transcript);
  };

  // 识别出错回调：根据错误类型给出提示
  recognition.onerror = function (event) {
    isListening = false;
    updateVoiceButton();
    if (event.error === 'not-allowed') {
      showToast('请允许麦克风权限');
    } else if (event.error === 'no-speech') {
      showToast('未检测到语音，请重试');
    } else {
      showToast('语音识别出错: ' + event.error);
    }
  };

  // 识别结束回调：重置按钮状态
  recognition.onend = function () {
    isListening = false;
    updateVoiceButton();
  };
}

/**
 * 开关语音识别
 */
function toggleVoice() {
  if (!recognition) {
    showToast('当前浏览器不支持语音识别');
    return;
  }
  if (isListening) {
    // 正在监听 -> 停止
    recognition.stop();
    isListening = false;
  } else {
    // 开始监听
    try {
      recognition.start();
      isListening = true;
      showToast('请说出：角色 + 活动 + 金额，如“小明 茶馆 一百”');
    } catch (e) {
      // 重复启动会抛 InvalidStateError
      showToast('语音启动失败，请稍后重试');
    }
  }
  updateVoiceButton();
}

/**
 * 更新语音按钮外观（监听中高亮）
 */
function updateVoiceButton() {
  const btn = document.getElementById('voice-btn');
  if (!btn) return;
  if (isListening) {
    // 监听中：朱砂红底白字
    btn.style.background = 'var(--primary-red)';
    btn.style.color = '#fff';
    btn.style.borderColor = 'var(--primary-red-dark)';
  } else {
    // 待机：透明底金色字
    btn.style.background = 'transparent';
    btn.style.color = 'var(--accent-gold-light)';
    btn.style.borderColor = 'var(--accent-gold)';
  }
}

/**
 * 解析一段不含“万、亿”的中文数字小节
 * 例：一百二十 -> 120，一百零五 -> 105，十五 -> 15，十 -> 10
 */
function parseChineseSection(str) {
  let result = 0;     // 已累计值
  let current = 0;    // 当前数字位
  let hasDigit = false;

  for (const ch of str) {
    if (ch in CN_DIGITS) {
      current = CN_DIGITS[ch];
      hasDigit = true;
    } else if (ch in CN_UNITS) {
      // 单位前没有数字（如“十”开头）则按 1 处理
      if (!hasDigit) current = 1;
      result += current * CN_UNITS[ch];
      current = 0;
      hasDigit = false;
    }
  }
  // 末尾剩余的个位数（如“一百零五”中的“五”）
  result += current;
  return result;
}

/**
 * 完整解析中文数字，支持万、亿分段
 * 例：一万两千五百 -> 12500，一亿 -> 100000000
 */
function parseChineseNumber(text) {
  if (!text) return 0;

  // 按“亿”分段
  let total = 0;
  const yiIndex = text.indexOf('亿');
  if (yiIndex !== -1) {
    total += parseChineseNumber(text.substring(0, yiIndex)) * CN_SECTIONS['亿'];
    text = text.substring(yiIndex + 1);
  }
  // 按“万”分段
  const wanIndex = text.indexOf('万');
  if (wanIndex !== -1) {
    total += parseChineseSection(text.substring(0, wanIndex)) * CN_SECTIONS['万'];
    text = text.substring(wanIndex + 1);
  }
  // 剩余小节
  total += parseChineseSection(text);
  return total;
}

/**
 * 从语音文本中抽取最长的连续中文数字串
 * 例："小明 茶馆 一百" -> "一百"
 */
function extractChineseNumberString(text) {
  let best = '';
  let current = '';
  for (const ch of text) {
    if (CN_ALL_CHARS.indexOf(ch) !== -1) {
      current += ch;
    } else {
      if (current.length > best.length) best = current;
      current = '';
    }
  }
  if (current.length > best.length) best = current;
  return best;
}

/**
 * 从文本中解析金额（优先阿拉伯数字，其次中文数字）
 * 返回解析到的金额，解析不到返回 0
 */
function parseAmount(text) {
  // 1. 优先匹配阿拉伯数字（含小数）
  const numMatch = text.match(/\d+(\.\d+)?/);
  if (numMatch) {
    return Math.round(parseFloat(numMatch[0]));
  }
  // 2. 中文数字解析
  const cnStr = extractChineseNumberString(text);
  if (cnStr) {
    const num = parseChineseNumber(cnStr);
    if (num > 0) return num;
  }
  return 0;
}

/**
 * 解析语音指令，自动识别角色、活动、金额，并回填表单
 */
function parseVoiceCommand(text) {
  showToast('识别结果：' + text);

  // 1. 尝试匹配角色名
  const chars = loadData('jx3_characters') || [];
  let matchedChar = null;
  for (const c of chars) {
    if (c && c.name && text.includes(c.name)) {
      matchedChar = c;
      break;
    }
  }

  // 2. 尝试匹配活动名称（从金额映射表）
  let matchedActivity = null;
  let matchedAmount = 0;
  const amountMap = (typeof AMOUNT_MAP !== 'undefined') ? AMOUNT_MAP : {};
  for (const [name, amount] of Object.entries(amountMap)) {
    // 取活动名的简短前缀用于模糊匹配（如“大战·单人” -> “大战”）
    const shortName = name.split('·')[0];
    if (text.includes(shortName) || text.includes(name)) {
      matchedActivity = name;
      matchedAmount = amount;
      break;
    }
  }

  // 3. 解析金额数字（阿拉伯数字优先，其次中文数字）
  const parsedAmount = parseAmount(text);
  // 优先使用语音中明确说出的金额，否则回退到活动默认金额
  const finalAmount = parsedAmount > 0 ? parsedAmount : matchedAmount;

  // 4. 判断收支类型
  let type = 'income';
  if (text.includes('支出') || text.includes('花费') || text.includes('买') || text.includes('修')) {
    type = 'expense';
  }

  // 5. 自动填入记录表单
  if (matchedChar || finalAmount > 0) {
    switchPage('records');
    openRecordModal();
    setTimeout(() => {
      // 角色回填
      if (matchedChar) {
        const charSelect = document.getElementById('record-char');
        if (charSelect) charSelect.value = matchedChar.id;
      }
      // 金额回填
      if (finalAmount > 0) {
        const amountInput = document.getElementById('record-amount');
        if (amountInput) amountInput.value = finalAmount;
      }
      // 备注回填（保留原始语音文本，便于核对）
      const noteInput = document.getElementById('record-note');
      if (noteInput) {
        noteInput.value = '语音录入：' + text;
      }
      // 设置收支类型
      if (typeof setRecordType === 'function') {
        setRecordType(type);
      }
      // 标记“声控记账”成就
      if (typeof markAchievement === 'function') {
        markAchievement('voice_first');
      }
      showToast('已自动填入，请确认后保存');
    }, 300);
  } else {
    showToast('未能识别有效信息，请手动录入');
  }
}

// ======================================================================
// 模块导出：挂载到 window，供 HTML onclick 与其他模块调用
// ======================================================================
window.initVoice = initVoice;
window.toggleVoice = toggleVoice;
window.updateVoiceButton = updateVoiceButton;
window.parseVoiceCommand = parseVoiceCommand;
window.parseChineseNumber = parseChineseNumber;
window.parseAmount = parseAmount;

// 页面加载完成后自动初始化语音模块
document.addEventListener('DOMContentLoaded', initVoice);
