/* ======================================================================
   剑网三收益记录 · Canvas 趋势图模块
   功能：在 Canvas 上绘制收益/支出/净收益趋势折线图，
        支持数据点标记、网格、图例、渐变填充。
   依赖：app.js 提供 loadData/formatDate 等全局方法。
   ====================================================================== */

/**
 * 绘制收益趋势折线图
 * @param {string} canvasId 画布元素 ID
 * @param {Array} data 趋势数据 [{date, income, expense, net}, ...]
 */
function drawTrendChart(canvasId, data) {
  const canvas = document.getElementById(canvasId);

  // 无数据或无画布时给出空状态提示
  if (!canvas || !data || data.length === 0) {
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = '16px "Noto Serif SC", serif';
      ctx.fillStyle = '#8A8A8A';
      ctx.textAlign = 'center';
      ctx.fillText('暂无数据', canvas.width / 2, canvas.height / 2);
    }
    return;
  }

  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const padding = { top: 30, right: 30, bottom: 40, left: 50 };
  const chartW = W - padding.left - padding.right;
  const chartH = H - padding.top - padding.bottom;

  ctx.clearRect(0, 0, W, H);

  // 计算最大值（用于 Y 轴比例）
  const maxVal = Math.max(
    ...data.map(d => Math.max(d.income || 0, d.expense || 0, Math.abs(d.net || 0))),
    1
  );

  // 横向网格线 + Y 轴刻度
  ctx.strokeStyle = '#E8E2D8';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + chartH * i / 4;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(W - padding.right, y);
    ctx.stroke();

    // Y 轴标签
    const val = Math.round(maxVal * (4 - i) / 4);
    ctx.font = '11px "Noto Serif SC", serif';
    ctx.fillStyle = '#8A8A8A';
    ctx.textAlign = 'right';
    ctx.fillText(val.toString(), padding.left - 8, y + 4);
  }

  // X 轴日期标签（最多显示约 7 个，避免拥挤）
  const step = Math.max(1, Math.floor(data.length / 7));
  data.forEach((d, i) => {
    if (i % step === 0) {
      const x = padding.left + chartW * i / Math.max(data.length - 1, 1);
      ctx.font = '11px "Noto Serif SC", serif';
      ctx.fillStyle = '#8A8A8A';
      ctx.textAlign = 'center';
      const dateLabel = d.date.substring(5); // 截取 MM-DD
      ctx.fillText(dateLabel, x, H - padding.bottom + 18);
    }
  });

  // 绘制收入折线（金色，带填充）
  drawLine(ctx, data, 'income', padding, chartW, chartH, maxVal, '#C9A86C', true, false);

  // 绘制支出折线（红色）
  drawLine(ctx, data, 'expense', padding, chartW, chartH, maxVal, '#B83A2B', false, false);

  // 绘制净收益折线（墨蓝色，虚线）
  drawLine(ctx, data, 'net', padding, chartW, chartH, maxVal, '#5B7F8A', false, true);

  // 图例
  ctx.font = '12px "Noto Serif SC", serif';
  ctx.textAlign = 'left';

  ctx.fillStyle = '#C9A86C';
  ctx.fillRect(padding.left, 10, 12, 12);
  ctx.fillStyle = '#2B2B2B';
  ctx.fillText('收入', padding.left + 18, 20);

  ctx.fillStyle = '#B83A2B';
  ctx.fillRect(padding.left + 70, 10, 12, 12);
  ctx.fillStyle = '#2B2B2B';
  ctx.fillText('支出', padding.left + 88, 20);

  ctx.fillStyle = '#5B7F8A';
  ctx.fillRect(padding.left + 140, 10, 12, 12);
  ctx.fillStyle = '#2B2B2B';
  ctx.fillText('净收益', padding.left + 158, 20);
}

/**
 * 绘制单条折线（含可选填充与虚线）
 */
function drawLine(ctx, data, field, padding, chartW, chartH, maxVal, color, fill, dashed) {
  // 渐变填充区域
  if (fill) {
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + chartH);
    data.forEach((d, i) => {
      const x = padding.left + chartW * i / Math.max(data.length - 1, 1);
      const y = padding.top + chartH - (d[field] || 0) / maxVal * chartH;
      ctx.lineTo(x, y);
    });
    ctx.lineTo(padding.left + chartW, padding.top + chartH);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    gradient.addColorStop(0, color + '40');
    gradient.addColorStop(1, color + '05');
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  // 折线本体
  ctx.beginPath();
  if (dashed) ctx.setLineDash([5, 3]);
  data.forEach((d, i) => {
    const x = padding.left + chartW * i / Math.max(data.length - 1, 1);
    const y = padding.top + chartH - (d[field] || 0) / maxVal * chartH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.setLineDash([]);

  // 数据点
  data.forEach((d, i) => {
    const x = padding.left + chartW * i / Math.max(data.length - 1, 1);
    const y = padding.top + chartH - (d[field] || 0) / maxVal * chartH;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  });
}

/**
 * 生成最近 N 天的趋势数据
 * @param {number} days 天数
 * @returns {Array} [{date, income, expense, net}, ...]
 */
function generateTrendData(days) {
  const records = loadData('jx3_records') || [];
  const data = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = formatDate(d);
    const dayRecords = records.filter(r => r.date === dateStr);
    const income = dayRecords.filter(r => r.type === 'income').reduce((s, r) => s + (r.amount || 0), 0);
    const expense = dayRecords.filter(r => r.type === 'expense').reduce((s, r) => s + (r.amount || 0), 0);
    data.push({ date: dateStr, income, expense, net: income - expense });
  }
  return data;
}

// ======================================================================
// 模块导出：挂载到 window，供 HTML onclick 与其他模块调用
// ======================================================================
window.drawTrendChart = drawTrendChart;
window.generateTrendData = generateTrendData;
window.drawLine = drawLine;
