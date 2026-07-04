/**
 * 信贷审查 AI 引擎（纯前端版）
 * - 默认 Mock 模式：内置完整演示数据，无需任何密钥
 * - 真实 AI 模式：用户配置通义千问 API Key 后，浏览器直接调用 AI
 *
 * 安全说明：
 * - API Key 仅存储在当前浏览器的 localStorage 中，不会上传到任何服务器
 * - 通义千问 DashScope 兼容 OpenAI 接口，支持浏览器跨域调用（CORS）
 * - 仅供个人/内部演示使用；生产环境建议改为后端代理调用以保护密钥
 */

// ==================== Prompt 定义（与后端 services 保持一致）====================
const PROMPTS = {
  summarize: `你是一位专业的银行信贷审查专家，擅长对信贷材料进行归纳分析。
请仔细阅读客户提交的信贷材料，提取关键信息，生成结构化的归纳分析报告。

输出要求：
1. summary: 对客户及贷款申请的总体概述（2-3句话）
2. keyInfo: 结构化提取关键信息（企业名称、贷款金额、期限、类型、经营范围、注册资本、成立日期、担保方式等）
3. financialHighlights: 财务及经营亮点（数组，每条1-2句话）
4. riskPoints: 识别到的风险点（数组，每条1-2句话）

请以JSON格式输出，不要包含其他文字。`,

  contradictions: `你是一位严谨的银行信贷审查专家，负责对信贷调查报告及附属材料进行交叉验证，识别数据矛盾和不合理之处。

检测维度：
1. 数据矛盾：同一信息在不同材料中不一致（如营业收入、资产规模、员工人数等）
2. 逻辑矛盾：材料描述与客观事实、行业惯例或内在逻辑不符
3. 不合理之处：担保方式、授信额度、还款来源等设置是否合理

输出要求：
1. contradictions: 矛盾点数组，每个包含：
   - type: 矛盾类型（数据矛盾/逻辑矛盾）
   - severity: 严重程度（高/中/低）
   - description: 矛盾描述
   - location: 涉及的材料位置
   - suggestion: 处理建议
2. unreasonablePoints: 不合理之处数组，每个包含：
   - type: 类型
   - description: 描述
   - suggestion: 建议
3. overallRiskLevel: 总体风险等级（低/中/中等偏高/高）

请以JSON格式输出，不要包含其他文字。`,

  review: `你是一位资深银行信贷审批专家，拥有20年信贷审批经验。
请基于客户提交的材料分析结果和矛盾检测结果，提出专业的审查建议。

输出要求：
1. supplementaryMaterials: 需要补充的材料列表，每个包含：
   - priority: 优先级（必须补充/建议补充/可选补充）
   - item: 材料名称
   - reason: 补充原因
2. reviewSuggestions: 审查建议列表，每个包含：
   - category: 建议类别（授信方案调整/授信额度控制/贷后管理/风险监控/期限管理等）
   - suggestion: 具体建议
   - priority: 优先级（高/中/低）
3. conclusion: 总体审查结论（1段话，给出是否同意授信、额度建议、条件等）

请以JSON格式输出，不要包含其他文字。`,

  industry: `你是一位资深的行业研究分析师，专注于为银行信贷决策提供行业分析支持。
请对指定行业进行全面、客观的分析，帮助信贷审查人员评估客户所处行业的整体环境和风险。

分析维度：
1. overview: 行业概况（2-3句话描述行业定位和发展现状）
2. marketSize: 市场规模
3. growthRate: 增长率
4. trends: 行业发展趋势数组，每个包含trend（趋势）和detail（详细说明）
5. risks: 行业风险点数组
6. opportunities: 行业机遇数组
7. outlook: 行业展望（对该行业未来1-2年发展前景的判断）
8. riskRating: 行业风险评级（低/中/中等偏高/高）

请以JSON格式输出，不要包含其他文字。`
};

// ==================== Mock 数据（与后端 aiService.js 保持一致）====================
const MOCK_DATA = {
  summarize: {
    summary: "该客户为XX制造企业，成立于2015年，注册资本5000万元，主要从事机械零部件加工与销售。本次申请流动资金贷款800万元，期限1年，用于补充日常经营周转资金。",
    keyInfo: {
      companyName: "XX机械制造有限公司",
      loanAmount: "800万元",
      loanTerm: "1年",
      loanType: "流动资金贷款",
      businessType: "机械零部件加工与销售",
      registeredCapital: "5000万元",
      establishedDate: "2015年",
      guarantor: "由法定代表人个人提供连带责任保证担保"
    },
    financialHighlights: [
      "2023年营业收入1.2亿元，同比增长15%",
      "资产负债率52%，处于行业合理水平",
      "近三年经营性现金流净额均为正数",
      "主要客户集中在汽车制造行业"
    ],
    riskPoints: [
      "应收账款周转天数达95天，高于行业平均水平",
      "前五大客户集中度达68%，客户集中度较高",
      "原材料价格波动对成本影响较大"
    ]
  },

  contradictions: {
    contradictions: [
      {
        type: "数据矛盾",
        severity: "高",
        description: "信贷调查报告中记载客户2023年营业收入为1.2亿元，但提供的审计报告显示营业收入为1.05亿元，差异金额达1500万元，差异率12.5%",
        location: "信贷调查报告第3页 vs 审计报告利润表",
        suggestion: "需核实客户真实营业收入数据，要求客户提供经税务机关确认的纳税申报表作为交叉验证"
      },
      {
        type: "逻辑矛盾",
        severity: "中",
        description: "调查报告称客户主要产品为汽车零部件，但企业营业执照经营范围中未包含汽车零部件制造，仅注明'机械零部件加工'",
        location: "信贷调查报告第2页 vs 营业执照",
        suggestion: "需确认客户实际经营范围是否与营业执照一致，是否存在超范围经营问题"
      },
      {
        type: "数据矛盾",
        severity: "中",
        description: "报告中提到客户员工人数为120人，但社保缴纳记录显示仅85人，差异可能涉及未缴纳社保的用工情况",
        location: "信贷调查报告第4页 vs 社保缴纳凭证",
        suggestion: "核实员工实际人数及社保缴纳情况，评估是否存在劳动用工合规风险"
      }
    ],
    unreasonablePoints: [
      {
        type: "担保方式不合理",
        description: "申请贷款800万元，仅由法定代表人个人保证担保，无抵押物。对于该规模的贷款，纯信用担保方式风险较高",
        suggestion: "建议增加房产抵押或设备抵押，降低信用风险敞口"
      },
      {
        type: "还款来源存疑",
        description: "调查报告中还款来源主要依赖应收账款回收，但应收账款账龄分析显示6个月以上应收款占比达35%，回收存在不确定性",
        suggestion: "需深入分析应收账款质量，评估还款来源的可靠性"
      }
    ],
    overallRiskLevel: "中等偏高"
  },

  review: {
    supplementaryMaterials: [
      { priority: "必须补充", item: "近三年经税务机关确认的纳税申报表", reason: "用于核实营业收入数据的真实性，解决调查报告与审计报告数据不一致的问题" },
      { priority: "必须补充", item: "主要应收账款明细及账龄分析表", reason: "评估应收账款质量和回收风险，核实还款来源可靠性" },
      { priority: "建议补充", item: "前五大客户购销合同复印件", reason: "核实客户集中度风险及主要客户合作稳定性" },
      { priority: "建议补充", item: "企业及法定代表人个人征信报告", reason: "全面评估客户信用状况及是否存在隐性负债" },
      { priority: "建议补充", item: "近期主要银行账户流水（近6个月）", reason: "核实经营现金流状况，验证收入真实性" },
      { priority: "可选补充", item: "抵押物评估报告（如增加抵押担保）", reason: "为调整担保方式提供依据" }
    ],
    reviewSuggestions: [
      { category: "授信方案调整", suggestion: "建议将纯信用担保调整为'抵押+保证'组合担保方式，抵押率不超过60%", priority: "高" },
      { category: "授信额度控制", suggestion: "鉴于客户集中度较高且应收账款质量存在不确定性，建议授信额度控制在500-600万元，低于申请额度的75%", priority: "高" },
      { category: "贷后管理", suggestion: "设置分批放款机制，首笔放款不超过300万元，根据经营回款情况决定后续放款", priority: "中" },
      { category: "风险监控", suggestion: "每月监控前五大客户经营状况及应收账款回收情况，设置预警指标：当应收账款逾期率超过15%时触发预警", priority: "中" },
      { category: "期限管理", suggestion: "建议贷款期限缩短至9个月，与客户应收账款回收周期匹配", priority: "低" }
    ],
    conclusion: "该客户经营基本面尚可，但存在数据不一致、担保方式偏弱、客户集中度过高等问题。建议在补充相关材料核实数据真实性后，适当降低授信额度、增强担保措施、加强贷后监控，可谨慎介入。"
  },

  industry: {
    industry: "机械零部件加工制造业",
    overview: "机械零部件加工制造业是装备制造业的重要组成部分，处于产业链中游。2023年以来，受益于新能源汽车、高端装备制造等下游需求拉动，行业整体保持温和增长态势，但面临原材料价格波动、人力成本上升等压力。",
    marketSize: "2023年我国机械零部件加工市场规模约1.8万亿元，同比增长约8%",
    growthRate: "8%",
    trends: [
      { trend: "向高端化、精密化转型", detail: "下游客户对零部件精度、质量要求持续提升，推动行业向高端制造升级，拥有精密加工能力的企业竞争优势明显" },
      { trend: "新能源汽车带动增量需求", detail: "新能源汽车产销量快速增长，带动相关零部件需求，为行业内具备汽车零部件生产能力的企业带来新的增长点" },
      { trend: "行业整合加速", detail: "环保政策趋严、成本压力加大背景下，中小企业面临洗牌，行业集中度逐步提升" },
      { trend: "数字化转型推进", detail: "智能制造、工业互联网等技术逐步渗透，数字化程度高的企业生产效率显著提升" }
    ],
    risks: [
      "原材料（钢材、铝材等）价格波动较大，直接影响企业成本和利润",
      "下游汽车行业周期性波动，可能传导至零部件供应商",
      "同质化竞争严重，中小企业议价能力弱",
      "环保监管趋严，环保投入成本增加",
      "技术工人短缺，人力成本持续上升"
    ],
    opportunities: [
      "国产替代政策推动，高端零部件进口替代空间大",
      "新能源汽车产业链需求旺盛",
      "一带一路带动出口市场增长",
      "数字化转型降本增效潜力大"
    ],
    outlook: "短期内行业保持温和增长，中长期来看，具备技术优势、客户资源优质、数字化转型领先的企业将脱颖而出。该客户所处细分领域前景尚可，但需关注其客户集中度风险及在行业竞争中的议价能力。",
    riskRating: "中等"
  }
};

// ==================== AI 配置管理 ====================
const AIConfig = {
  get() {
    try {
      return JSON.parse(localStorage.getItem('aiConfig') || '{}');
    } catch { return {}; }
  },
  save(cfg) {
    localStorage.setItem('aiConfig', JSON.stringify(cfg));
  },
  clear() {
    localStorage.removeItem('aiConfig');
  },
  // 是否已配置真实 AI
  isRealAI() {
    const cfg = this.get();
    return !!(cfg.provider && cfg.apiKey);
  },
  getMode() {
    return this.isRealAI() ? 'real' : 'mock';
  }
};

// ==================== AI 调用核心 ====================
const AIClient = {
  /**
   * 调用 AI（真实或 Mock）
   * @param {string} promptKey - PROMPTS 的 key
   * @param {string} userMessage - 用户输入内容
   * @returns {Promise<object>} 解析后的 JSON 对象
   */
  async chat(promptKey, userMessage) {
    const cfg = AIConfig.get();
    if (cfg.provider && cfg.apiKey) {
      // 真实 AI 模式
      return await this.callRealAI(cfg, PROMPTS[promptKey], userMessage);
    }
    // Mock 模式：模拟网络延迟
    await new Promise(r => setTimeout(r, 600 + Math.random() * 400));
    // 深拷贝 mock 数据
    return JSON.parse(JSON.stringify(MOCK_DATA[promptKey]));
  },

  /**
   * 调用真实 AI（通义千问 / OpenAI 兼容接口）
   */
  async callRealAI(cfg, systemPrompt, userMessage) {
    const baseURL = cfg.baseURL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    const model = cfg.model || 'qwen-plus';
    const url = `${baseURL}/chat/completions`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.3
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`AI 接口请求失败 (${res.status}): ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('AI 返回内容为空');

    // 提取 JSON（兼容 AI 可能包裹 ```json ``` 的情况）
    const jsonStr = this.extractJSON(content);
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      throw new Error('AI 返回内容无法解析为 JSON：' + content.slice(0, 200));
    }
  },

  extractJSON(text) {
    // 去除 ```json ``` 包裹
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) return fenced[1].trim();
    // 尝试找到第一个 { 到最后一个 }
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) return text.slice(start, end + 1);
    return text.trim();
  }
};

// ==================== 分析服务（对应后端 4 个 service）====================
const AnalysisService = {
  /**
   * 归纳分析
   * @param {string} documentText - 材料文本内容
   * @param {object} taskInfo - 任务信息 { customerName, loanType, loanAmount }
   */
  async summarize(documentText, taskInfo) {
    const userMessage = `任务信息：
客户名称：${taskInfo.customerName || '未提供'}
贷款类型：${taskInfo.loanType || '未提供'}
申请金额：${taskInfo.loanAmount || '未提供'}

以下是客户提交的信贷材料内容：

${documentText || '（未上传材料，以下为演示数据）'}

请对以上材料进行归纳分析。`;
    return await AIClient.chat('summarize', userMessage);
  },

  /**
   * 矛盾检测
   */
  async contradictions(documentText, previousSummary) {
    const contextInfo = previousSummary
      ? `\n\n前序分析摘要：${JSON.stringify(previousSummary)}`
      : '';
    const userMessage = `以下是客户提交的信贷材料（包括信贷调查报告、审计报告、营业执照等）：

${documentText || '（未上传材料，以下为演示数据）'}
${contextInfo}

请对各材料进行交叉验证，识别数据矛盾和不合理之处。`;
    return await AIClient.chat('contradictions', userMessage);
  },

  /**
   * 审查建议
   */
  async review(documentText, summaryResult, contradictionsResult) {
    const keyInfo = summaryResult?.keyInfo || {};
    const riskPoints = summaryResult?.riskPoints || [];
    const contradictions = contradictionsResult?.contradictions || [];
    const unreasonablePoints = contradictionsResult?.unreasonablePoints || [];

    const userMessage = `## 客户基本信息
${JSON.stringify(keyInfo, null, 2)}

## 材料归纳摘要
${summaryResult?.summary || '无'}

## 已识别风险点
${riskPoints.map((r, i) => `${i + 1}. ${r}`).join('\n') || '无'}

## 检测到的矛盾点
${contradictions.map(c => `- [${c.severity}] ${c.description}`).join('\n') || '无明显矛盾'}

## 不合理之处
${unreasonablePoints.map(u => `- ${u.description}`).join('\n') || '无明显不合理之处'}

## 已提交材料
${documentText ? '已上传信贷材料' : '未上传材料（演示模式）'}

## 客户所在行业
${keyInfo.businessType || '未提供'}

请基于以上信息，提出需要补充的材料建议和审查审批建议。`;
    return await AIClient.chat('review', userMessage);
  },

  /**
   * 行业分析
   */
  async industry(industry, customerInfo) {
    const userMessage = `请分析以下行业的现状：

行业：${industry || '机械零部件加工制造业'}

客户背景信息：
- 企业名称：${customerInfo?.companyName || '未知'}
- 经营范围：${customerInfo?.businessType || industry || '未提供'}
- 主要产品/服务：${customerInfo?.mainProduct || '未提供'}

请结合当前宏观经济环境和行业政策，对该行业进行全面分析。`;
    return await AIClient.chat('industry', userMessage);
  },

  /**
   * 一键全流程分析
   */
  async fullAnalysis(documentText, taskInfo) {
    const summary = await this.summarize(documentText, taskInfo);
    const contradictions = await this.contradictions(documentText, summary);
    const review = await this.review(documentText, summary, contradictions);
    const industry = await this.industry(
      taskInfo.industry || summary.keyInfo?.businessType || '机械零部件加工制造业',
      { companyName: taskInfo.customerName, businessType: summary.keyInfo?.businessType }
    );
    return { summary, contradictions, review, industry };
  }
};

// ==================== 文件读取工具 ====================
const FileUtil = {
  /**
   * 读取文件为文本
   * 支持 txt/csv/md/json 等文本文件
   */
  readAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = e => reject(new Error('文件读取失败'));
      reader.readAsText(file, 'UTF-8');
    });
  },

  /**
   * 读取图片为 Base64（可用于后续 OCR 扩展）
   */
  readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = e => reject(new Error('图片读取失败'));
      reader.readAsDataURL(file);
    });
  },

  /**
   * 读取文件为 ArrayBuffer
   */
  readAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = e => reject(new Error('文件读取失败'));
      reader.readAsArrayBuffer(file);
    });
  },

  /**
   * 判断是否为文本类文件
   */
  isTextFile(file) {
    const textTypes = ['text/plain', 'text/csv', 'text/markdown', 'application/json'];
    const textExts = ['.txt', '.csv', '.md', '.json', '.log'];
    if (textTypes.includes(file.type)) return true;
    return textExts.some(ext => file.name.toLowerCase().endsWith(ext));
  },

  /**
   * 判断文件类型
   */
  getFileKind(file) {
    const name = (file.name || '').toLowerCase();
    const type = file.type || '';
    if (type.startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|webp|tiff?)$/.test(name)) return 'image';
    if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
    if (name.endsWith('.docx')) return 'docx';
    if (name.endsWith('.doc')) return 'doc';
    if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) return 'xlsx';
    if (name.endsWith('.xls')) return 'xls';
    if (this.isTextFile(file)) return 'text';
    return 'unknown';
  },

  /**
   * 解析 PDF 文件（使用 pdf.js）
   */
  async parsePDF(file) {
    if (!window.pdfjsLib) throw new Error('PDF 解析库未加载，请检查网络');
    const arrayBuffer = await this.readAsArrayBuffer(file);
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    const maxPages = Math.min(pdf.numPages, 50); // 限制最多解析50页
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join(' ');
      text += `--- 第${i}页 ---\n${pageText}\n\n`;
    }
    if (pdf.numPages > maxPages) {
      text += `\n... (共${pdf.numPages}页，仅解析前${maxPages}页)`;
    }
    return text.trim() || '[PDF 文件无可提取文本，可能是扫描件，需 OCR 处理]';
  },

  /**
   * 解析 Word (.docx) 文件（使用 mammoth.js）
   */
  async parseDocx(file) {
    if (!window.mammoth) throw new Error('Word 解析库未加载，请检查网络');
    const arrayBuffer = await this.readAsArrayBuffer(file);
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value.trim() || '[Word 文件无可提取文本]';
  },

  /**
   * 解析 Excel 文件（使用 SheetJS / xlsx）
   */
  async parseExcel(file) {
    if (!window.XLSX) throw new Error('Excel 解析库未加载，请检查网络');
    const arrayBuffer = await this.readAsArrayBuffer(file);
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    let text = '';
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet, { FS: '\t' });
      text += `=== 工作表：${sheetName} ===\n${csv}\n\n`;
    }
    return text.trim() || '[Excel 文件无可提取数据]';
  },

  /**
   * 格式化文件大小
   */
  formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }
};

// 暴露到全局
window.PROMPTS = PROMPTS;
window.MOCK_DATA = MOCK_DATA;
window.AIConfig = AIConfig;
window.AIClient = AIClient;
window.AnalysisService = AnalysisService;
window.FileUtil = FileUtil;
