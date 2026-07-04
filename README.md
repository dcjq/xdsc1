# 银行信贷审查审批系统（纯前端版）

AI 辅助的银行信贷业务审查审批工具，支持信贷材料上传、内容归纳分析、矛盾检测、审查建议、行业分析。

**纯前端应用，无需后端服务器**，可部署到任意静态托管平台（帽子云 / Vercel / GitHub Pages 等）。

## 功能

- 📤 **材料上传**：支持文本类文件，浏览器本地读取（数据不上传服务器）
- 📊 **归纳分析**：AI 提取企业关键信息、财务亮点、风险点
- ⚠️ **矛盾检测**：交叉验证材料，发现数据矛盾和不合理之处
- 💡 **审查建议**：生成补充材料建议和审批建议
- 🏭 **行业分析**：客户所在行业的现状、趋势、风险、机遇分析
- 📄 **报告导出**：一键导出完整审查报告（TXT）
- 🔧 **AI 配置**：默认演示模式，可配置通义千问 API Key 启用真实 AI

## 文件说明

| 文件 | 作用 |
|------|------|
| `index.html` | 应用入口 |
| `app.js` | 主应用逻辑（路由、UI 渲染、交互） |
| `ai-engine.js` | AI 引擎（Prompt、Mock 数据、真实 AI 调用） |
| `style.css` | 样式 |

## 本地运行

直接用浏览器打开 `index.html` 即可（部分浏览器需通过本地服务器访问，推荐用 VS Code Live Server 插件）。

或用 Node 启动简单静态服务器：

```bash
npx serve .
# 或
python -m http.server 8080
```

## 启用真实 AI

1. 申请通义千问 API Key：https://dashscope.console.aliyun.com/apiKey
2. 打开应用 → 右上角「⚙ 演示模式」按钮
3. 填入 API Key，模型 `qwen-plus`，保存

密钥仅保存在当前浏览器，不会上传服务器。

## 部署到帽子云

详见根目录 `MAOZI_DEPLOY.md`。

## 技术栈

- 原生 HTML / CSS / JavaScript（无框架，无构建步骤）
- localStorage 数据存储
- 通义千问 DashScope（OpenAI 兼容接口）
