/**
 * 银行信贷审查审批系统 - Web版应用
 * 单页应用(SPA)，使用hash路由
 */

// ==================== 全局状态 ====================
const App = {
  currentTaskId: null,
  analysisResult: null, // 内存中保存当前任务的分析结果
  route: { name: 'index', params: {} }
};

// ==================== 工具函数 ====================
const util = {
  formatDate(ts, format = 'YYYY-MM-DD HH:mm') {
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, '0');
    return format
      .replace('YYYY', d.getFullYear())
      .replace('MM', pad(d.getMonth() + 1))
      .replace('DD', pad(d.getDate()))
      .replace('HH', pad(d.getHours()))
      .replace('mm', pad(d.getMinutes()))
      .replace('ss', pad(d.getSeconds()));
  },
  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / 1024 / 1024).toFixed(1) + 'MB';
  },
  generateTaskId() {
    return 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  },
  getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const map = { pdf: '📄', doc: '📝', docx: '📝', jpg: '🖼️', jpeg: '🖼️', png: '🖼️' };
    return map[ext] || '📋';
  },
  getRiskColor(level) {
    const map = { '低': '#52C41A', '中': '#FAAD14', '中等偏高': '#FA8C16', '高': '#FF4D4F' };
    return map[level] || '#909399';
  },
  priorityClass(priority) {
    if (priority.includes('必须') || priority === '高') return 'tag-high';
    if (priority.includes('建议') || priority === '中') return 'tag-medium';
    return 'tag-low';
  },
  statusText(status) {
    const map = {
      created: '待上传',
      uploaded: '待分析',
      analyzing: '分析中',
      completed: '已完成'
    };
    return map[status] || status;
  },
  escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
};

// ==================== Toast ====================
function showToast(title, icon = 'none', duration = 2000) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  const iconStr = icon === 'success' ? '✅ ' : icon === 'error' ? '❌ ' : '';
  toast.textContent = iconStr + title;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function showLoading(text) {
  const mask = document.createElement('div');
  mask.className = 'loading-mask';
  mask.id = 'loadingMask';
  mask.innerHTML = `
    <div class="loading-content">
      <div class="loading-spinner"></div>
      <div class="loading-text">${util.escapeHtml(text || '加载中...')}</div>
    </div>
  `;
  document.body.appendChild(mask);
}

function hideLoading() {
  const mask = document.getElementById('loadingMask');
  if (mask) mask.remove();
}

function showConfirm(title, content) {
  return new Promise((resolve) => {
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = `
      <div class="modal-content" style="max-width:340px;">
        <div class="modal-title">${util.escapeHtml(title)}</div>
        <div style="font-size:14px;color:#595959;line-height:1.7;margin-bottom:20px;text-align:center;">${util.escapeHtml(content)}</div>
        <div class="modal-actions">
          <button class="modal-btn modal-cancel" data-act="cancel">取消</button>
          <button class="modal-btn modal-confirm" data-act="confirm">确定</button>
        </div>
      </div>
    `;
    document.body.appendChild(mask);
    mask.addEventListener('click', (e) => {
      if (e.target === mask) {
        mask.remove();
        resolve(false);
        return;
      }
      const act = e.target.dataset.act;
      if (act === 'cancel') {
        mask.remove();
        resolve(false);
      } else if (act === 'confirm') {
        mask.remove();
        resolve(true);
      }
    });
  });
}

// ==================== API（纯前端实现，无需后端服务）====================
// 文件存储：按 taskId 存到 localStorage（注意 localStorage 单 key 上限约 5MB，
// 大文件仅保存元信息，文本内容截断保存）
const fileStore = {
  get(taskId) {
    try { return JSON.parse(localStorage.getItem(`files_${taskId}`) || '[]'); }
    catch { return []; }
  },
  save(taskId, files) {
    localStorage.setItem(`files_${taskId}`, JSON.stringify(files));
  }
};

const api = {
  // 文件"上传"：浏览器本地读取，存到 localStorage
  async uploadFiles(file, taskId) {
    let content = '';
    try {
      if (FileUtil.isTextFile(file)) {
        content = await FileUtil.readAsText(file);
        if (content.length > 50000) content = content.slice(0, 50000) + '\n... (内容已截断)';
      } else if (file.type.startsWith('image/')) {
        content = `[图片文件：${file.name}，演示模式下不解析图片内容]`;
      } else {
        content = `[文件：${file.name}，类型：${file.type || '未知'}，演示模式下仅解析文本类文件]`;
      }
    } catch (e) {
      content = `[文件读取失败：${e.message}]`;
    }
    const files = fileStore.get(taskId);
    const record = {
      originalName: file.name,
      fileName: file.name,
      size: file.size,
      mimeType: file.type || 'unknown',
      content,
      uploadTime: new Date().toISOString()
    };
    files.push(record);
    fileStore.save(taskId, files);
    return { code: 0, message: '上传成功', data: record };
  },

  async getFileList(taskId) {
    const files = fileStore.get(taskId);
    return { code: 0, data: { files } };
  },

  // 一键全流程分析
  async fullAnalysis(taskId, data) {
    try {
      const files = fileStore.get(taskId);
      const documentText = files.map(f => `--- ${f.originalName} ---\n${f.content}`).join('\n\n');
      const taskInfo = {
        customerName: data.customerName,
        loanType: data.loanType,
        loanAmount: data.loanAmount,
        industry: data.industry
      };
      const { summary, contradictions, review, industry } = await AnalysisService.fullAnalysis(documentText, taskInfo);
      // 兼容前端渲染：summary 包装为 { analysis: {...} }
      const result = { summary: { analysis: summary }, contradictions, review, industry };
      const results = JSON.parse(localStorage.getItem('analysisResults') || '{}');
      results[taskId] = result;
      localStorage.setItem('analysisResults', JSON.stringify(results));
      return { code: 0, message: '分析完成', data: result };
    } catch (e) {
      return { code: 1, message: '分析失败：' + e.message };
    }
  },

  async summarize(taskId, data) {
    try {
      const files = fileStore.get(taskId);
      const documentText = files.map(f => `--- ${f.originalName} ---\n${f.content}`).join('\n\n');
      const taskInfo = {
        customerName: data.customerName,
        loanType: data.loanType,
        loanAmount: data.loanAmount,
        industry: data.industry
      };
      const analysis = await AnalysisService.summarize(documentText, taskInfo);
      return { code: 0, message: '归纳分析完成', data: { analysis } };
    } catch (e) {
      return { code: 1, message: '分析失败：' + e.message };
    }
  },

  async contradictions(taskId) {
    try {
      const files = fileStore.get(taskId);
      const documentText = files.map(f => `--- ${f.originalName} ---\n${f.content}`).join('\n\n');
      const results = JSON.parse(localStorage.getItem('analysisResults') || '{}');
      const previous = results[taskId]?.summary?.analysis;
      const data = await AnalysisService.contradictions(documentText, previous);
      return { code: 0, message: '矛盾检测完成', data };
    } catch (e) {
      return { code: 1, message: '分析失败：' + e.message };
    }
  },

  async review(taskId) {
    try {
      const files = fileStore.get(taskId);
      const documentText = files.map(f => `--- ${f.originalName} ---\n${f.content}`).join('\n\n');
      const results = JSON.parse(localStorage.getItem('analysisResults') || '{}');
      const summary = results[taskId]?.summary?.analysis;
      const contradictions = results[taskId]?.contradictions;
      const data = await AnalysisService.review(documentText, summary, contradictions);
      return { code: 0, message: '审查建议生成完成', data };
    } catch (e) {
      return { code: 1, message: '分析失败：' + e.message };
    }
  },

  async industry(taskId, industry, customerInfo) {
    try {
      const data = await AnalysisService.industry(industry, customerInfo);
      return { code: 0, message: '行业分析完成', data };
    } catch (e) {
      return { code: 1, message: '分析失败：' + e.message };
    }
  },

  async getResult(taskId) {
    const results = JSON.parse(localStorage.getItem('analysisResults') || '{}');
    const result = results[taskId];
    if (result) return { code: 0, data: result };
    return { code: 1, message: '未找到分析结果' };
  }
};

// ==================== 数据存储 ====================
const store = {
  getTasks() {
    try {
      return JSON.parse(localStorage.getItem('tasks') || '[]');
    } catch { return []; }
  },
  saveTasks(tasks) {
    localStorage.setItem('tasks', JSON.stringify(tasks));
  },
  getTask(taskId) {
    return this.getTasks().find(t => t.taskId === taskId);
  },
  updateTask(taskId, updater) {
    const tasks = this.getTasks();
    const idx = tasks.findIndex(t => t.taskId === taskId);
    if (idx >= 0) {
      updater(tasks[idx]);
      this.saveTasks(tasks);
      return tasks[idx];
    }
    return null;
  },
  deleteTask(taskId) {
    const tasks = this.getTasks().filter(t => t.taskId !== taskId);
    this.saveTasks(tasks);
  }
};

// ==================== 路由 ====================
function navigate(hash) {
  location.hash = hash;
}

function parseRoute() {
  const hash = location.hash.replace(/^#/, '') || '/';
  // 格式: / 或 /upload/task_xxx 或 /analysis 或 /industry 或 /review
  const parts = hash.split('/').filter(Boolean);
  if (parts.length === 0) {
    return { name: 'index', params: {} };
  }
  if (parts[0] === 'upload') {
    return { name: 'upload', params: { taskId: parts[1] || '' } };
  }
  if (['analysis', 'industry', 'review'].includes(parts[0])) {
    return { name: parts[0], params: {} };
  }
  return { name: 'index', params: {} };
}

function render() {
  App.route = parseRoute();
  const app = document.getElementById('app');
  app.scrollTop = 0;
  window.scrollTo(0, 0);

  switch (App.route.name) {
    case 'index': renderIndex(); break;
    case 'upload': renderUpload(); break;
    case 'analysis': renderAnalysis(); break;
    case 'industry': renderIndustry(); break;
    case 'review': renderReview(); break;
    default: renderIndex();
  }
}

window.addEventListener('hashchange', render);

// ==================== 顶部导航 ====================
function topNav(title, showBack = false, backRoute = '#/') {
  return `
    <div class="top-nav">
      <div class="nav-back" onclick="location.hash='${backRoute}'" style="${showBack ? '' : 'visibility:hidden;'}">‹</div>
      <div class="nav-title">${util.escapeHtml(title)}</div>
      <div class="nav-placeholder"></div>
    </div>
  `;
}

// ==================== 首页 ====================
function renderIndex() {
  const tasks = store.getTasks();
  tasks.sort((a, b) => b.createTime - a.createTime);
  const completedCount = tasks.filter(t => t.status === 'completed').length;

  const taskListHtml = tasks.length === 0
    ? `<div class="empty-state">
         <div class="empty-icon">📂</div>
         <div>暂无审查任务</div>
         <div style="font-size:13px;margin-top:8px;color:#8c8c8c;">点击"新建审查"开始</div>
       </div>`
    : tasks.map(t => `
        <div class="task-card" onclick="enterTask('${t.taskId}')">
          <div class="task-header">
            <div class="task-customer">${util.escapeHtml(t.customerName)}</div>
            <div class="task-status status-${t.status}">${util.statusText(t.status)}</div>
          </div>
          <div class="task-info">
            <span class="task-tag">${util.escapeHtml(t.loanType)}</span>
            <span class="task-amount">${util.escapeHtml(t.loanAmount)}万元</span>
          </div>
          ${t.industry ? `<div class="task-industry">行业：${util.escapeHtml(t.industry)}</div>` : ''}
          <div class="task-footer">
            <span class="task-time">${util.formatDate(t.createTime)}</span>
            <span class="task-delete" onclick="event.stopPropagation();deleteTask('${t.taskId}')">删除</span>
          </div>
        </div>
      `).join('');

  const aiMode = AIConfig.getMode();
  const aiModeText = aiMode === 'real' ? '真实AI' : '演示模式';
  const aiModeClass = aiMode === 'real' ? 'ai-mode-real' : 'ai-mode-mock';

  document.getElementById('app').innerHTML = `
    <div class="header-banner">
      <div class="ai-config-btn ${aiModeClass}" onclick="showAIConfig()">
        <span class="ai-mode-dot"></span>
        <span>${aiModeText}</span>
        <span class="ai-config-icon">⚙</span>
      </div>
      <div class="header-title">信贷审查审批</div>
      <div class="header-subtitle">AI智能辅助 · 材料分析 · 风险识别</div>
      <div class="header-stats">
        <div class="stat-item">
          <div class="stat-num">${tasks.length}</div>
          <div class="stat-label">审查任务</div>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <div class="stat-num">${completedCount}</div>
          <div class="stat-label">已完成</div>
        </div>
      </div>
    </div>

    <div class="quick-actions">
      <div class="action-item" onclick="showCreateTask()">
        <div class="action-icon">📋</div>
        <span class="action-text">新建审查</span>
      </div>
      <div class="action-item" onclick="enterLatestTask()">
        <div class="action-icon">📊</div>
        <span class="action-text">继续分析</span>
      </div>
      <div class="action-item" onclick="goReview()">
        <div class="action-icon">🔍</div>
        <span class="action-text">审查建议</span>
      </div>
      <div class="action-item" onclick="goIndustry()">
        <div class="action-icon">🏭</div>
        <span class="action-text">行业分析</span>
      </div>
    </div>

    <div style="padding: 0 16px; margin-top: 8px;">
      <div class="section-title" style="margin-left:0;">审查任务</div>
    </div>
    <div class="task-list">${taskListHtml}</div>
  `;
}

// 首页交互
window.showCreateTask = function() {
  const loanTypes = ['流动资金贷款', '固定资产贷款', '项目融资', '并购贷款', '个人经营性贷款', '其他'];
  const mask = document.createElement('div');
  mask.className = 'modal-mask';
  mask.innerHTML = `
    <div class="modal-content" onclick="event.stopPropagation()">
      <div class="modal-title">新建审查任务</div>
      <div class="form-group">
        <label class="form-label">客户名称</label>
        <input class="form-input" id="f_customerName" placeholder="请输入企业/客户名称" />
      </div>
      <div class="form-group">
        <label class="form-label">贷款类型</label>
        <select class="form-select" id="f_loanType">
          ${loanTypes.map(t => `<option value="${t}">${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">申请金额（万元）</label>
        <input class="form-input" id="f_loanAmount" type="number" placeholder="请输入贷款金额" />
      </div>
      <div class="form-group">
        <label class="form-label">所属行业</label>
        <input class="form-input" id="f_industry" placeholder="如：机械制造、房地产开发等" />
      </div>
      <div class="modal-actions">
        <button class="modal-btn modal-cancel" onclick="this.closest('.modal-mask').remove()">取消</button>
        <button class="modal-btn modal-confirm" id="f_submit">创建</button>
      </div>
    </div>
  `;
  document.body.appendChild(mask);
  mask.addEventListener('click', (e) => { if (e.target === mask) mask.remove(); });

  mask.querySelector('#f_submit').addEventListener('click', () => {
    const customerName = mask.querySelector('#f_customerName').value.trim();
    const loanType = mask.querySelector('#f_loanType').value;
    const loanAmount = mask.querySelector('#f_loanAmount').value.trim();
    const industry = mask.querySelector('#f_industry').value.trim();

    if (!customerName) { showToast('请输入客户名称'); return; }
    if (!loanAmount) { showToast('请输入贷款金额'); return; }

    const taskId = util.generateTaskId();
    const task = {
      taskId, customerName, loanType, loanAmount, industry,
      createTime: Date.now(),
      status: 'created',
      files: []
    };
    const tasks = store.getTasks();
    tasks.push(task);
    store.saveTasks(tasks);

    App.currentTaskId = taskId;
    mask.remove();
    showToast('任务已创建', 'success');
    setTimeout(() => navigate(`/upload/${taskId}`), 300);
  });
};

window.enterTask = function(taskId) {
  const task = store.getTask(taskId);
  if (!task) return;
  App.currentTaskId = taskId;
  if (task.status === 'completed') {
    // 加载分析结果
    loadAnalysisResult(taskId).then(() => {
      navigate('/analysis');
    });
  } else {
    navigate(`/upload/${taskId}`);
  }
};

window.enterLatestTask = function() {
  const tasks = store.getTasks();
  if (tasks.length === 0) {
    showToast('暂无任务，请先创建');
    return;
  }
  // 找最近一个未完成的，否则取最新的
  const sorted = [...tasks].sort((a, b) => b.createTime - a.createTime);
  enterTask(sorted[0].taskId);
};

window.goReview = function() {
  if (!App.currentTaskId || !App.analysisResult) {
    showToast('请先完成材料分析');
    return;
  }
  navigate('/review');
};

window.goIndustry = function() {
  if (!App.currentTaskId) {
    showToast('请先创建或选择任务');
    return;
  }
  navigate('/industry');
};

window.deleteTask = async function(taskId) {
  const ok = await showConfirm('确认删除', '删除后无法恢复，确定删除该审查任务？');
  if (ok) {
    store.deleteTask(taskId);
    if (App.currentTaskId === taskId) {
      App.currentTaskId = null;
      App.analysisResult = null;
    }
    renderIndex();
    showToast('已删除', 'success');
  }
};

// 加载分析结果到内存
async function loadAnalysisResult(taskId) {
  try {
    showLoading('加载分析结果...');
    const res = await api.getResult(taskId);
    if (res.code === 0) {
      App.analysisResult = res.data;
      App.currentTaskId = taskId;
    }
  } catch (err) {
    showToast('加载分析结果失败');
  } finally {
    hideLoading();
  }
}

// ==================== 上传页 ====================
function renderUpload() {
  const taskId = App.route.params.taskId || App.currentTaskId;
  if (!taskId) {
    navigate('/');
    return;
  }
  App.currentTaskId = taskId;
  const task = store.getTask(taskId);

  if (!task) {
    showToast('任务不存在');
    navigate('/');
    return;
  }

  document.getElementById('app').innerHTML = `
    ${topNav('材料上传', true, '#/')}
    <div class="card task-info-card">
      <div class="task-info-header">
        <div class="task-info-name">${util.escapeHtml(task.customerName)}</div>
        <div class="task-info-tag">${util.escapeHtml(task.loanType)}</div>
      </div>
      <div class="info-row">
        <span class="info-label">申请金额</span>
        <span class="info-value">${util.escapeHtml(task.loanAmount)}万元</span>
      </div>
      ${task.industry ? `
      <div class="info-row">
        <span class="info-label">所属行业</span>
        <span class="info-value">${util.escapeHtml(task.industry)}</span>
      </div>` : ''}
      <div class="info-row">
        <span class="info-label">已上传文件</span>
        <span class="info-value" id="fileCount">0个</span>
      </div>
    </div>

    <label class="upload-area" id="uploadArea" for="fileInput">
      <div class="upload-icon">📎</div>
      <div class="upload-text">点击或拖拽上传信贷材料</div>
      <div class="upload-hint">支持所有文件类型（文本、图片、PDF、Word、Excel 等）</div>
      <div class="upload-formats">信贷调查报告 | 审计报告 | 营业执照 | 财务报表 | 购销合同</div>
      <input type="file" id="fileInput" multiple style="display:none;">
    </label>

    <div id="fileSection"></div>

    <div class="action-section" id="actionSection" style="display:none;">
      <button class="btn-primary" id="analyzeBtn">一键智能分析</button>
      <div class="analysis-flow">
        <div class="flow-step"><div class="flow-icon">📋</div><span>材料归纳</span></div>
        <div class="flow-arrow">→</div>
        <div class="flow-step"><div class="flow-icon">🔍</div><span>矛盾检测</span></div>
        <div class="flow-arrow">→</div>
        <div class="flow-step"><div class="flow-icon">💡</div><span>审查建议</span></div>
        <div class="flow-arrow">→</div>
        <div class="flow-step"><div class="flow-icon">🏭</div><span>行业分析</span></div>
      </div>
    </div>
  `;

  // 绑定上传事件
  const uploadArea = document.getElementById('uploadArea');
  const fileInput = document.getElementById('fileInput');

  // label 标签原生会触发 fileInput，这里额外处理拖拽
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });
  uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(Array.from(e.dataTransfer.files), taskId);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      uploadFiles(Array.from(e.target.files), taskId);
      fileInput.value = '';
    }
  });

  document.getElementById('analyzeBtn').addEventListener('click', () => startFullAnalysis(taskId));

  loadFileList(taskId);
}

async function loadFileList(taskId) {
  try {
    const res = await api.getFileList(taskId);
    if (res.code === 0) {
      const files = res.data.files || [];
      document.getElementById('fileCount').textContent = files.length + '个';

      const section = document.getElementById('fileSection');
      if (files.length > 0) {
        section.innerHTML = `
          <div style="padding:0 16px;">
            <div class="section-title" style="margin-left:0;">已上传材料 (${files.length})</div>
          </div>
          <div style="padding:0 16px;">
            ${files.map(f => `
              <div class="file-item">
                <div class="file-icon">${util.getFileIcon(f.fileName || f.originalName || f.filename || '')}</div>
                <div class="file-info">
                  <div class="file-name">${util.escapeHtml(f.fileName || f.originalName || f.filename || '未知文件')}</div>
                  <div class="file-size">${util.formatFileSize(f.size)} · ${util.formatDate(new Date(f.uploadTime).getTime(), 'MM-DD HH:mm')}</div>
                </div>
              </div>
            `).join('')}
          </div>
        `;
        document.getElementById('actionSection').style.display = 'block';
        // 更新任务状态
        store.updateTask(taskId, (t) => { if (t.status === 'created') t.status = 'uploaded'; });
      } else {
        section.innerHTML = '';
        document.getElementById('actionSection').style.display = 'none';
      }
    }
  } catch (err) {
    console.error('加载文件列表失败:', err);
  }
}

async function uploadFiles(files, taskId) {
  showLoading('上传中...');
  let success = 0, fail = 0;
  for (const file of files) {
    try {
      const res = await api.uploadFiles(file, taskId);
      if (res.code === 0) success++;
      else fail++;
    } catch (err) {
      console.error('上传失败:', err);
      fail++;
    }
  }
  hideLoading();
  if (success > 0) {
    showToast(`上传成功${success}个文件`, 'success');
    loadFileList(taskId);
  }
  if (fail > 0) {
    showToast(`${fail}个文件上传失败`, 'error');
  }
}

async function startFullAnalysis(taskId) {
  const task = store.getTask(taskId);
  if (!task) return;

  const btn = document.getElementById('analyzeBtn');
  btn.disabled = true;

  // 显示分析中遮罩
  const steps = ['正在归纳分析材料...', '正在检测矛盾点...', '正在生成审查建议...', '正在分析行业现状...'];
  const mask = document.createElement('div');
  mask.className = 'loading-mask';
  mask.id = 'analysisMask';
  mask.innerHTML = `
    <div class="loading-content">
      <div class="loading-spinner"></div>
      <div class="loading-text" id="stepText">正在启动分析...</div>
      <div class="loading-subtext">AI正在处理信贷材料，请稍候</div>
    </div>
  `;
  document.body.appendChild(mask);

  try {
    // 更新状态
    store.updateTask(taskId, (t) => { t.status = 'analyzing'; });

    // 逐步显示进度
    let stepIdx = 0;
    const stepTimer = setInterval(() => {
      const el = document.getElementById('stepText');
      if (el && stepIdx < steps.length) {
        el.textContent = steps[stepIdx];
        stepIdx++;
      }
    }, 2000);

    const res = await api.fullAnalysis(taskId, {
      customerName: task.customerName,
      loanType: task.loanType,
      loanAmount: task.loanAmount,
      industry: task.industry || ''
    });

    clearInterval(stepTimer);

    if (res.code === 0) {
      App.analysisResult = res.data;
      App.currentTaskId = taskId;
      store.updateTask(taskId, (t) => { t.status = 'completed'; });
      showToast('分析完成', 'success');
      mask.remove();
      setTimeout(() => navigate('/analysis'), 500);
    } else {
      mask.remove();
      showToast(res.message || '分析失败', 'error');
      store.updateTask(taskId, (t) => { t.status = 'uploaded'; });
    }
  } catch (err) {
    mask.remove();
    console.error('分析失败:', err);
    showToast(err.message || '分析失败', 'error');
    store.updateTask(taskId, (t) => { t.status = 'uploaded'; });
  } finally {
    btn.disabled = false;
  }
}

// ==================== 分析结果页 ====================
let analysisActiveTab = 'summary';

function renderAnalysis() {
  if (!App.analysisResult) {
    document.getElementById('app').innerHTML = `
      ${topNav('分析结果', true, '#/')}
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <div>暂无分析结果</div>
        <div style="font-size:13px;margin-top:8px;color:#8c8c8c;">请先上传材料并执行分析</div>
        <button class="empty-btn" onclick="location.hash='/'">去创建任务</button>
      </div>
    `;
    return;
  }

  const { summary, contradictions } = App.analysisResult;
  const conCount = (contradictions?.contradictions?.length || 0) + (contradictions?.unreasonablePoints?.length || 0);

  document.getElementById('app').innerHTML = `
    ${topNav('分析结果', true, '#/')}
    <div class="tab-bar">
      <div class="tab-item ${analysisActiveTab === 'summary' ? 'active' : ''}" onclick="switchAnalysisTab('summary')">材料归纳</div>
      <div class="tab-item ${analysisActiveTab === 'contradictions' ? 'active' : ''}" onclick="switchAnalysisTab('contradictions')">
        矛盾检测 ${conCount > 0 ? `<span class="tab-badge">${conCount}</span>` : ''}
      </div>
    </div>
    <div id="tabContent"></div>
    <div class="bottom-actions">
      <button class="bottom-btn industry-btn" onclick="location.hash='/industry'">🏭 行业分析</button>
      <button class="bottom-btn review-btn" onclick="location.hash='/review'">💡 审查建议</button>
    </div>
  `;

  renderAnalysisTab();
}

window.switchAnalysisTab = function(tab) {
  analysisActiveTab = tab;
  document.querySelectorAll('.tab-item').forEach(el => el.classList.remove('active'));
  event.target.closest('.tab-item').classList.add('active');
  renderAnalysisTab();
};

function renderAnalysisTab() {
  const content = document.getElementById('tabContent');
  if (analysisActiveTab === 'summary') {
    content.innerHTML = renderSummaryTab();
  } else {
    content.innerHTML = renderContradictionsTab();
  }
}

function renderSummaryTab() {
  const summary = App.analysisResult.summary || {};
  const a = summary.analysis || {};
  const ki = a.keyInfo || {};

  let html = '';

  // 总体概述
  if (a.summary) {
    html += `
      <div class="card">
        <div class="section-title">总体概述</div>
        <div class="summary-text">${util.escapeHtml(a.summary)}</div>
      </div>
    `;
  }

  // 关键信息
  if (Object.keys(ki).length > 0) {
    html += `
      <div class="card">
        <div class="section-title">关键信息</div>
        ${renderInfoRow('企业名称', ki.companyName)}
        ${renderInfoRow('贷款类型', ki.loanType)}
        ${renderInfoRow('贷款金额', ki.loanAmount)}
        ${renderInfoRow('贷款期限', ki.loanTerm)}
        ${renderInfoRow('注册资本', ki.registeredCapital)}
        ${renderInfoRow('成立日期', ki.establishedDate)}
        ${renderInfoRow('经营范围', ki.businessType)}
        ${renderInfoRow('担保方式', ki.guarantor)}
      </div>
    `;
  }

  // 财务经营亮点
  if (a.financialHighlights && a.financialHighlights.length > 0) {
    html += `
      <div class="card">
        <div class="section-title">财务经营亮点</div>
        <div class="highlight-list">
          ${a.financialHighlights.map(h => `
            <div class="highlight-item">
              <span class="highlight-dot">●</span>
              <span class="highlight-text">${util.escapeHtml(h)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // 风险点
  if (a.riskPoints && a.riskPoints.length > 0) {
    html += `
      <div class="card">
        <div class="section-title">识别风险点</div>
        <div class="risk-list">
          ${a.riskPoints.map(r => `
            <div class="risk-item">
              <span class="risk-marker">⚠</span>
              <span class="risk-text">${util.escapeHtml(r)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // 已处理文档
  if (summary.documents && summary.documents.length > 0) {
    html += `
      <div class="card">
        <div class="section-title">已分析材料</div>
        <div class="doc-list">
          ${summary.documents.map(d => `
            <div class="doc-item">
              <span class="doc-icon">📄</span>
              <span class="doc-name">${util.escapeHtml(d.filename)}</span>
              <span class="doc-status ${d.error ? 'error' : 'success'}">${d.error ? '解析失败' : '已解析'}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  return html || '<div class="empty-state"><div class="empty-icon">📋</div><div>暂无归纳结果</div></div>';
}

function renderContradictionsTab() {
  const c = App.analysisResult.contradictions || {};
  let html = '';

  // 风险等级总览
  const level = c.overallRiskLevel || '未知';
  html += `
    <div class="card risk-overview-card">
      <div class="risk-overview-label">总体风险等级</div>
      <div class="risk-overview-level" style="color:${util.getRiskColor(level)};">${util.escapeHtml(level)}</div>
    </div>
  `;

  // 矛盾点
  if (c.contradictions && c.contradictions.length > 0) {
    html += `
      <div class="card">
        <div class="section-title">数据矛盾点 (${c.contradictions.length})</div>
        <div class="issue-list">
          ${c.contradictions.map(item => `
            <div class="issue-item">
              <div class="issue-header">
                <div class="issue-type">${util.escapeHtml(item.type)}</div>
                <span class="tag ${util.priorityClass(item.severity)}">${util.escapeHtml(item.severity)}</span>
              </div>
              <div class="issue-desc">${util.escapeHtml(item.description)}</div>
              ${item.location ? `<div class="issue-location">📍 ${util.escapeHtml(item.location)}</div>` : ''}
              ${item.suggestion ? `<div class="issue-suggestion"><span class="suggestion-label">建议：</span>${util.escapeHtml(item.suggestion)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // 不合理之处
  if (c.unreasonablePoints && c.unreasonablePoints.length > 0) {
    html += `
      <div class="card">
        <div class="section-title">不合理之处 (${c.unreasonablePoints.length})</div>
        <div class="issue-list">
          ${c.unreasonablePoints.map(item => `
            <div class="issue-item">
              <div class="issue-header">
                <div class="issue-type">${util.escapeHtml(item.type)}</div>
              </div>
              <div class="issue-desc">${util.escapeHtml(item.description)}</div>
              ${item.suggestion ? `<div class="issue-suggestion"><span class="suggestion-label">建议：</span>${util.escapeHtml(item.suggestion)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // 无矛盾
  if ((!c.contradictions || c.contradictions.length === 0) && (!c.unreasonablePoints || c.unreasonablePoints.length === 0)) {
    html += `
      <div class="empty-state">
        <div class="empty-icon">✅</div>
        <div>未发现明显矛盾或不合理之处</div>
      </div>
    `;
  }

  return html;
}

function renderInfoRow(label, value) {
  if (value == null || value === '') return '';
  return `<div class="info-row"><span class="info-label">${label}</span><span class="info-value">${util.escapeHtml(value)}</span></div>`;
}

// ==================== 行业分析页 ====================
let industryAnalyzing = false;

function renderIndustry() {
  if (!App.currentTaskId) {
    document.getElementById('app').innerHTML = `
      ${topNav('行业分析', true, '#/')}
      <div class="empty-state">
        <div class="empty-icon">🏭</div>
        <div>请先创建或选择任务</div>
        <button class="empty-btn" onclick="location.hash='/'">去首页</button>
      </div>
    `;
    return;
  }

  const task = store.getTask(App.currentTaskId) || {};
  const result = App.analysisResult?.industry;

  if (!result) {
    document.getElementById('app').innerHTML = `
      ${topNav('行业分析', true, '#/')}
      <div class="input-section">
        <div class="input-card">
          <div class="input-icon">🏭</div>
          <div class="input-title">行业现状分析</div>
          <div class="input-desc">输入客户所在行业，AI将为您生成该行业的现状分析、发展趋势和风险评估</div>
          <input class="industry-input" id="industryInput" placeholder="如：机械制造、房地产开发、餐饮服务..." value="${util.escapeHtml(task.industry || '')}" />
          <button class="btn-primary" id="industryBtn">开始分析</button>
        </div>
      </div>
    `;
    document.getElementById('industryBtn').addEventListener('click', doIndustryAnalysis);
    return;
  }

  // 已有结果
  document.getElementById('app').innerHTML = `
    ${topNav('行业分析', true, '#/')}
    ${renderIndustryResult(result)}
    <div style="padding:16px;">
      <button class="btn-outline" id="redoBtn">重新分析</button>
    </div>
  `;
  document.getElementById('redoBtn').addEventListener('click', () => {
    App.analysisResult.industry = null;
    renderIndustry();
  });
}

function renderIndustryResult(result) {
  let html = '';

  // 行业概览
  const riskColor = util.getRiskColor(result.riskRating);
  html += `
    <div class="card">
      <div class="industry-header">
        <div class="industry-icon">🏭</div>
        <div>
          <div class="industry-name">${util.escapeHtml(result.industry)}</div>
          <div class="industry-risk">
            风险评级：
            <span class="risk-badge" style="background:${riskColor};">${util.escapeHtml(result.riskRating || '未知')}</span>
          </div>
        </div>
      </div>
      <div class="industry-overview">${util.escapeHtml(result.overview || '')}</div>
    </div>
  `;

  // 市场数据
  if (result.marketSize || result.growthRate) {
    html += `
      <div class="card">
        <div class="section-title">市场数据</div>
        ${result.marketSize ? renderInfoRow('市场规模', result.marketSize) : ''}
        ${result.growthRate ? `<div class="info-row"><span class="info-label">增长率</span><span class="info-value" style="color:#52C41A;font-weight:600;">${util.escapeHtml(result.growthRate)}</span></div>` : ''}
      </div>
    `;
  }

  // 发展趋势
  if (result.trends && result.trends.length > 0) {
    html += `
      <div class="card">
        <div class="section-title">发展趋势</div>
        <div class="trend-list">
          ${result.trends.map((t, i) => `
            <div class="trend-item">
              <div class="trend-index">${i + 1}</div>
              <div class="trend-content">
                <div class="trend-title">${util.escapeHtml(t.trend)}</div>
                <div class="trend-detail">${util.escapeHtml(t.detail)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // 行业风险
  if (result.risks && result.risks.length > 0) {
    html += `
      <div class="card">
        <div class="section-title">行业风险</div>
        <div class="risk-list">
          ${result.risks.map(r => `
            <div class="risk-item">
              <span class="risk-marker">⚠</span>
              <span class="risk-text">${util.escapeHtml(r)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // 发展机遇
  if (result.opportunities && result.opportunities.length > 0) {
    html += `
      <div class="card">
        <div class="section-title">发展机遇</div>
        <div class="opportunity-list">
          ${result.opportunities.map(o => `
            <div class="opportunity-item">
              <span class="opportunity-dot">✦</span>
              <span class="opportunity-text">${util.escapeHtml(o)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // 行业展望
  if (result.outlook) {
    html += `
      <div class="card">
        <div class="section-title">行业展望</div>
        <div class="outlook-text">${util.escapeHtml(result.outlook)}</div>
      </div>
    `;
  }

  return html;
}

async function doIndustryAnalysis() {
  if (industryAnalyzing) return;
  const industry = document.getElementById('industryInput').value.trim();
  if (!industry) {
    showToast('请输入行业名称');
    return;
  }

  industryAnalyzing = true;
  const btn = document.getElementById('industryBtn');
  btn.disabled = true;
  btn.textContent = '正在分析...';

  try {
    const task = store.getTask(App.currentTaskId) || {};
    const res = await api.industry(App.currentTaskId, industry, {
      companyName: task.customerName,
      businessType: industry
    });

    if (res.code === 0) {
      App.analysisResult = App.analysisResult || {};
      App.analysisResult.industry = res.data;
      showToast('分析完成', 'success');
      renderIndustry();
    } else {
      showToast(res.message || '分析失败', 'error');
    }
  } catch (err) {
    showToast(err.message || '分析失败', 'error');
  } finally {
    industryAnalyzing = false;
    btn.disabled = false;
    btn.textContent = '开始分析';
  }
}

// ==================== 审查建议页 ====================
let reviewActiveTab = 'supplement';

function renderReview() {
  if (!App.analysisResult || !App.analysisResult.review) {
    document.getElementById('app').innerHTML = `
      ${topNav('审查建议', true, '#/')}
      <div class="empty-state">
        <div class="empty-icon">💡</div>
        <div>暂无审查建议</div>
        <div style="font-size:13px;margin-top:8px;color:#8c8c8c;">请先完成材料分析</div>
        <button class="empty-btn" onclick="location.hash='/'">去创建任务</button>
      </div>
    `;
    return;
  }

  const r = App.analysisResult.review;
  const supCount = r.supplementaryMaterials?.length || 0;
  const sugCount = r.reviewSuggestions?.length || 0;

  document.getElementById('app').innerHTML = `
    ${topNav('审查建议', true, '#/')}
    <div class="tab-bar">
      <div class="tab-item ${reviewActiveTab === 'supplement' ? 'active' : ''}" onclick="switchReviewTab('supplement')">
        补充材料 ${supCount > 0 ? `<span class="tab-badge">${supCount}</span>` : ''}
      </div>
      <div class="tab-item ${reviewActiveTab === 'suggestions' ? 'active' : ''}" onclick="switchReviewTab('suggestions')">
        审查建议 ${sugCount > 0 ? `<span class="tab-badge">${sugCount}</span>` : ''}
      </div>
    </div>
    <div id="reviewTabContent"></div>
    <div class="bottom-actions">
      <button class="bottom-btn export-btn" id="exportBtn">📤 导出报告</button>
    </div>
  `;

  renderReviewTab();
  document.getElementById('exportBtn').addEventListener('click', exportReport);
}

window.switchReviewTab = function(tab) {
  reviewActiveTab = tab;
  document.querySelectorAll('.tab-item').forEach(el => el.classList.remove('active'));
  event.target.closest('.tab-item').classList.add('active');
  renderReviewTab();
};

function renderReviewTab() {
  const content = document.getElementById('reviewTabContent');
  const r = App.analysisResult.review;

  if (reviewActiveTab === 'supplement') {
    if (r.supplementaryMaterials && r.supplementaryMaterials.length > 0) {
      content.innerHTML = `
        <div class="card">
          <div class="section-title">需要补充的材料</div>
          <div class="material-list">
            ${r.supplementaryMaterials.map(m => `
              <div class="material-item">
                <div class="material-priority">
                  <span class="tag ${util.priorityClass(m.priority)}">${util.escapeHtml(m.priority)}</span>
                </div>
                <div class="material-content">
                  <div class="material-name">${util.escapeHtml(m.item)}</div>
                  <div class="material-reason">${util.escapeHtml(m.reason)}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else {
      content.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div><div>无需补充材料</div></div>`;
    }
  } else {
    let html = '';
    if (r.reviewSuggestions && r.reviewSuggestions.length > 0) {
      html += `
        <div class="card">
          <div class="section-title">审查建议</div>
          <div class="suggestion-list">
            ${r.reviewSuggestions.map(s => `
              <div class="suggestion-item">
                <div class="suggestion-header">
                  <div class="suggestion-category">${util.escapeHtml(s.category)}</div>
                  <span class="tag ${util.priorityClass(s.priority)}">${util.escapeHtml(s.priority)}</span>
                </div>
                <div class="suggestion-desc">${util.escapeHtml(s.suggestion)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else {
      html += `<div class="empty-state"><div class="empty-icon">📝</div><div>暂无审查建议</div></div>`;
    }

    if (r.conclusion) {
      html += `
        <div class="card conclusion-card">
          <div class="section-title">审查结论</div>
          <div class="conclusion-text">${util.escapeHtml(r.conclusion)}</div>
          <div class="conclusion-actions">
            <button class="conclusion-btn" id="copyBtn">📋 复制结论</button>
          </div>
        </div>
      `;
    }
    content.innerHTML = html;

    const copyBtn = document.getElementById('copyBtn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(r.conclusion).then(() => {
          showToast('已复制到剪贴板', 'success');
        }).catch(() => {
          // 降级方案
          const ta = document.createElement('textarea');
          ta.value = r.conclusion;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
          showToast('已复制到剪贴板', 'success');
        });
      });
    }
  }
}

// 导出报告
function exportReport() {
  const task = store.getTask(App.currentTaskId) || {};
  const data = App.analysisResult || {};
  const summary = data.summary?.analysis || {};
  const ki = summary.keyInfo || {};
  const c = data.contradictions || {};
  const r = data.review || {};
  const ind = data.industry || {};

  const report = `
═══════════════════════════════════════
   银行信贷审查审批报告
═══════════════════════════════════════

【客户信息】
客户名称：${task.customerName || ki.companyName || '-'}
贷款类型：${task.loanType || ki.loanType || '-'}
申请金额：${task.loanAmount || ki.loanAmount || '-'}万元
所属行业：${task.industry || ind.industry || '-'}
报告时间：${util.formatDate(Date.now())}

───────────────────────────────────────
一、材料归纳
───────────────────────────────────────

【总体概述】
${summary.summary || '-'}

【关键信息】
企业名称：${ki.companyName || '-'}
贷款金额：${ki.loanAmount || '-'}
贷款期限：${ki.loanTerm || '-'}
注册资本：${ki.registeredCapital || '-'}
成立日期：${ki.establishedDate || '-'}
经营范围：${ki.businessType || '-'}
担保方式：${ki.guarantor || '-'}

【财务经营亮点】
${(summary.financialHighlights || []).map((h, i) => `${i + 1}. ${h}`).join('\n') || '无'}

【识别风险点】
${(summary.riskPoints || []).map((r, i) => `${i + 1}. ${r}`).join('\n') || '无'}

───────────────────────────────────────
二、矛盾检测
───────────────────────────────────────

总体风险等级：${c.overallRiskLevel || '-'}

【数据矛盾点】
${(c.contradictions || []).map((item, i) => `${i + 1}. [${item.type}] ${item.description}\n   建议：${item.suggestion || '-'}`).join('\n') || '未发现明显矛盾'}

【不合理之处】
${(c.unreasonablePoints || []).map((item, i) => `${i + 1}. [${item.type}] ${item.description}\n   建议：${item.suggestion || '-'}`).join('\n') || '未发现不合理之处'}

───────────────────────────────────────
三、审查建议
───────────────────────────────────────

【需要补充的材料】
${(r.supplementaryMaterials || []).map((m, i) => `${i + 1}. [${m.priority}] ${m.item}\n   原因：${m.reason}`).join('\n') || '无需补充'}

【审查建议】
${(r.reviewSuggestions || []).map((s, i) => `${i + 1}. [${s.category}|${s.priority}] ${s.suggestion}`).join('\n') || '无'}

【审查结论】
${r.conclusion || '-'}

───────────────────────────────────────
四、行业分析
───────────────────────────────────────

行业：${ind.industry || '-'}
风险评级：${ind.riskRating || '-'}
市场规模：${ind.marketSize || '-'}
增长率：${ind.growthRate || '-'}

【行业概况】
${ind.overview || '-'}

【发展趋势】
${(ind.trends || []).map((t, i) => `${i + 1}. ${t.trend}\n   ${t.detail}`).join('\n') || '无'}

【行业风险】
${(ind.risks || []).map((r, i) => `${i + 1}. ${r}`).join('\n') || '无'}

【发展机遇】
${(ind.opportunities || []).map((o, i) => `${i + 1}. ${o}`).join('\n') || '无'}

【行业展望】
${ind.outlook || '-'}

═══════════════════════════════════════
   报告结束
═══════════════════════════════════════
`.trim();

  // 下载为txt文件
  const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `信贷审查报告_${task.customerName || '客户'}_${util.formatDate(Date.now(), 'YYYYMMDD_HHmm')}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('报告已导出', 'success');
}

// ==================== AI 配置面板 ====================
function showAIConfig() {
  const cfg = AIConfig.get();
  const mask = document.createElement('div');
  mask.className = 'ai-config-mask';
  mask.innerHTML = `
    <div class="ai-config-dialog">
      <div class="ai-config-title">AI 分析配置</div>
      <div class="ai-config-desc">
        配置后系统将调用真实 AI 进行信贷材料分析；未配置则使用内置演示数据。<br>
        <b>密钥仅保存在当前浏览器（localStorage），不会上传到任何服务器。</b>
      </div>

      <div class="ai-form-group">
        <label>AI 服务商</label>
        <select id="aiProvider" onchange="onProviderChange()">
          <option value="qwen" ${cfg.provider === 'qwen' ? 'selected' : ''}>通义千问（阿里云 DashScope，推荐）</option>
          <option value="openai" ${cfg.provider === 'openai' ? 'selected' : ''}>OpenAI 兼容接口</option>
        </select>
      </div>

      <div class="ai-form-group">
        <label>API Key</label>
        <input type="password" id="aiApiKey" placeholder="sk-..." value="${cfg.apiKey || ''}" autocomplete="off">
      </div>

      <div class="ai-form-group">
        <label>模型名称</label>
        <input type="text" id="aiModel" placeholder="qwen-plus" value="${cfg.model || 'qwen-plus'}">
      </div>

      <div class="ai-form-group" id="baseURLGroup" style="${cfg.provider === 'openai' ? '' : 'display:none'}">
        <label>接口地址（Base URL）</label>
        <input type="text" id="aiBaseURL" placeholder="https://api.openai.com/v1" value="${cfg.baseURL || ''}">
      </div>

      <div class="ai-form-tip" id="aiTip">
        通义千问申请地址：<a href="https://dashscope.console.aliyun.com/apiKey" target="_blank">dashscope.console.aliyun.com/apiKey</a>
        （新用户有免费额度）
      </div>

      <div class="ai-config-actions">
        <button class="ai-btn ai-btn-test" onclick="testAIConfig()">测试连接</button>
        <button class="ai-btn ai-btn-clear" onclick="clearAIConfig()">清除配置</button>
        <button class="ai-btn ai-btn-cancel" onclick="closeAIConfig()">取消</button>
        <button class="ai-btn ai-btn-save" onclick="saveAIConfig()">保存</button>
      </div>
    </div>
  `;
  document.body.appendChild(mask);
  mask.addEventListener('click', (e) => { if (e.target === mask) closeAIConfig(); });
}

function onProviderChange() {
  const provider = document.getElementById('aiProvider').value;
  const baseURLGroup = document.getElementById('baseURLGroup');
  const tip = document.getElementById('aiTip');
  const modelInput = document.getElementById('aiModel');
  if (provider === 'openai') {
    baseURLGroup.style.display = '';
    tip.innerHTML = 'OpenAI 兼容接口，可填写任意兼容服务的 Base URL（如 OpenAI、DeepSeek、Moonshot 等）';
    if (!modelInput.value || modelInput.value === 'qwen-plus') modelInput.value = 'gpt-4o-mini';
  } else {
    baseURLGroup.style.display = 'none';
    tip.innerHTML = '通义千问申请地址：<a href="https://dashscope.console.aliyun.com/apiKey" target="_blank">dashscope.console.aliyun.com/apiKey</a>（新用户有免费额度）';
    if (!modelInput.value || modelInput.value.startsWith('gpt')) modelInput.value = 'qwen-plus';
  }
}

function closeAIConfig() {
  const mask = document.querySelector('.ai-config-mask');
  if (mask) mask.remove();
}

function saveAIConfig() {
  const provider = document.getElementById('aiProvider').value;
  const apiKey = document.getElementById('aiApiKey').value.trim();
  const model = document.getElementById('aiModel').value.trim() || (provider === 'qwen' ? 'qwen-plus' : 'gpt-4o-mini');
  const baseURL = document.getElementById('aiBaseURL')?.value.trim();
  if (!apiKey) { showToast('请输入 API Key', 'error'); return; }
  const cfg = { provider, apiKey, model };
  if (provider === 'openai' && baseURL) cfg.baseURL = baseURL;
  AIConfig.save(cfg);
  closeAIConfig();
  showToast('配置已保存，已切换为真实 AI 分析', 'success');
  setTimeout(() => location.reload(), 800);
}

function clearAIConfig() {
  AIConfig.clear();
  closeAIConfig();
  showToast('已清除配置，恢复演示模式', 'success');
  setTimeout(() => location.reload(), 800);
}

async function testAIConfig() {
  const provider = document.getElementById('aiProvider').value;
  const apiKey = document.getElementById('aiApiKey').value.trim();
  const model = document.getElementById('aiModel').value.trim() || (provider === 'qwen' ? 'qwen-plus' : 'gpt-4o-mini');
  const baseURL = (document.getElementById('aiBaseURL')?.value.trim()) || (provider === 'qwen' ? 'https://dashscope.aliyuncs.com/compatible-mode/v1' : 'https://api.openai.com/v1');
  if (!apiKey) { showToast('请先输入 API Key', 'error'); return; }
  showToast('正在测试连接...', 'info', 3000);
  try {
    const res = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: '回复"OK"两个字' }],
        max_tokens: 10
      })
    });
    if (!res.ok) {
      const t = await res.text();
      showToast('连接失败: HTTP ' + res.status + ' ' + t.slice(0, 80), 'error', 5000);
      return;
    }
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || '(空)';
    showToast('连接成功！AI 回复: ' + reply.slice(0, 30), 'success', 4000);
  } catch (e) {
    showToast('连接失败: ' + e.message, 'error', 5000);
  }
}

// ==================== 启动 ====================
document.addEventListener('DOMContentLoaded', () => {
  // 纯前端版本：无需后端服务，显示当前 AI 模式
  const mode = AIConfig.getMode();
  console.log(`[信贷审查系统] 运行模式: ${mode === 'real' ? '真实 AI' : 'Mock 演示模式'}（纯前端，无需后端）`);
  render();
  // 启动后提示当前模式
  setTimeout(() => {
    showToast(mode === 'real' ? '已启用真实 AI 分析' : '当前为演示模式，点击右上角设置可接入真实 AI', 'info', 4000);
  }, 500);
});
