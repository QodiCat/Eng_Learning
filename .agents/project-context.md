# 当前工程上下文

核对日期：2026-10-02。当前实现不等于产品批准；产品入口见 [.product/README.md](../.product/README.md)。

## 技术栈与状态

- Electron 44.5.1 + 原生 HTML/CSS/JavaScript；开发使用 Node.js 24+。
- Windows PowerShell 5.1（STA）调用 UI Automation / Windows Forms 完成取词。
- 产品目标 Windows 10 及以上；本轮构建 Windows x64，未覆盖全部系统与架构实机。
- 当前已有 Git。初始化时不存在 Git 的记录仅是历史状态。
- 真实命令来自 package.json 与锁文件，统一见根目录 AGENTS.md；PowerShell 可使用 npm.cmd。

## 当前目录

```text
src/
  main.cjs                 生命周期、IPC、全局快捷键、任务协调
  preload.cjs              最小化 renderer API
  config.cjs               .env 加载、校验与无密钥的公开配置
  translation/             输入校验、兼容 Chat Completions 客户端
  learning/                学习 JSON 存储、按日复习、词库解析
  windows/                 PowerShell 取词与进程包装
  renderer/                翻译、学习记录、词库、设置四个视图
scripts/                   启动、语法检查、打包、Electron 冒烟检查
test/                      核心业务与 HTTP 协议测试
.product/                  原始证据、澄清与暂定范围
```

## 运行配置与服务

- `.env.example` 提供非敏感默认配置。开发读取根目录 .env，打包应用读取 exe 同级 .env。
- 优先级：模板 < 本地 .env < 进程同名环境变量。数字和布尔配置严格校验。
- 用户明确选择自建/中转 OpenAI 兼容服务，地址、模型与密钥由用户稍后本地填写；不创建 OpenAI 账号密钥或切换服务。
- 主进程请求 `AI_BASE_URL + /chat/completions`，传入 model、stream:false 和 system/user messages，读取 choices[0].message.content。不自动追加 /v1。
- 不自动重定向；HTTP 失败、超时、取消、空响应、无效 JSON 和截断响应均显式失败。
- renderer 仅显示纯文本，无 Node/网络权限；启用上下文隔离、sandbox、CSP 和 IPC 来源校验。
- .env 不纳入 Git/构建包，打包输出只复制空密钥模板，密钥不通过 IPC 暴露。

## 取词与持久化

- 默认 Ctrl+Alt+E，来自 .env；冲突显式提示，配置重载注册失败时保留旧快捷键。
- 先取 UI Automation 选区，无可用选区再 Ctrl+C，检测剪贴板序列号，不能把旧剪贴板当作选区。
- 复制前快照剪贴板；只有剪贴板未再被其他程序修改时才恢复，恢复失败提示。
- 取词受应用权限、自定义控件、保护内容、剪贴板格式和系统策略影响；所有可复制应用兼容性仍需验收。
- 成功翻译且写盘成功才计数；失败/取消不计数，不允许并发翻译。
- learning.json 默认在 Electron userData，DATA_DIRECTORY 可指定绝对目录；写临时文件再重命名，失败不改内存，损坏数据不覆盖。
- 英文大小写归一、词形不合并；本机日历日去重，复习状态按词/日期保存、可撤销。
- 每词保存最新译文、累计次数及出现日期；历史日期也显示最新译文，不保存逐次译文。
- 词库支持 UTF-8 TXT 单词行和 JSON 字符串数组；英文大小写去重，同名库拒绝，无效项整份拒绝。
- 中文输入单独记条目，不自动将译文中的英文候选加入词库或计数。

## 验证、限制与后续维护

- npm test 覆盖输入、持久化、复习、词库、损坏/写盘失败、配置/密钥隔离、真实本地 HTTP 协议及错误处理。
- lint 仅检查 JavaScript 语法和源码行数；smoke 检查隐藏 Electron 窗口的 IPC、导航、拒绝输入、隔离与截图，使用 artifacts 隔离数据。
- build 生成未签名 Windows x64 便携目录；无 CI、安装器或自动部署。
- 真实中转服务未配置，不能宣称端到端翻译通过。全局跨应用取词需实机验收。
- 中文整句目前仅按标点/换行限制，不能可靠区分无标点句子；最终边界仍需澄清。
- 日终自动提醒尚未实现，只能主动打开当天列表，不将原需求标记为已完成。
- 文档随配置与代码同步更新，产品目标和批准状态仍只在 .product/ 中维护。
- 参考：[Chat Completions](https://developers.openai.com/api/reference/resources/chat)、[globalShortcut](https://www.electronjs.org/docs/latest/api/global-shortcut/)、[Electron security](https://www.electronjs.org/docs/latest/tutorial/security)。
