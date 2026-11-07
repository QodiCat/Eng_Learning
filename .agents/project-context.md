# 当前工程上下文

## 2026-10-30 API 测试脚本

- 后续排查：Node 底层为 `UND_ERR_CONNECT_TIMEOUT`，沙箱外复测仍失败；Windows curl 同源连接也超时，不能仅归因于沙箱限制。系统域名查找返回单个 IPv4，hosts 无对应覆盖；尚未确定与其他应用的 DNS/代理路径差异。
- 源码与打包目录 .env 地址、模型一致，密钥不同（未输出密钥）；本次脚本测试的是源码目录配置。
- 翻译客户端新增安全的连接超时、DNS、拒绝连接及 TLS 错误分类，未知 TypeError 不再统一误报网络错误。15 项测试与 lint 通过；未重新构建，现有打包应用暂不包含本次错误提示改进。真实调用仍未通过。

- `npm run test:api` 复用根目录 .env 与翻译客户端，默认翻译 apple，可传入测试文本；一次真实请求，不写学习记录。成功输出耗时与译文，失败返回非零退出码；不输出密钥。`--help` 不发请求。
- 本轮 14 项 Node 测试与 lint 通过，帮助入口正常。真实请求返回“无法连接翻译服务”，尚未验证模型可用；执行环境存在网络限制，不能据此判定服务或模型失效。未运行 Electron smoke 或构建：仅新增 Node 脚本。

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

## 2026-10-28 服务设置更新
- 翻译设置内可编辑服务地址、模型、密钥和鉴权要求，保存到当前运行目录 .env 并立即应用。
- config-save.cjs 负责校验与临时文件替换；保留其他 .env 配置值，保存时重写格式与注释。同名进程环境变量覆盖时拒绝保存并提示。
- 密钥不通过状态 IPC 返回；空白保留、显式清除，.env 明文存储。

## 2026-10-29 快捷键设置更新
- 翻译设置增加独立快捷键表单与 shortcut:save IPC；无需先配置 AI，保存到 .env 并立即注册。
- config-save.cjs 复用现有写盘逻辑；先注册新组合，再持久化，成功后释放旧组合；写盘失败释放新组合，保留旧组合。
- 覆盖空值、无效、占用、环境变量覆盖、写盘失败、重启读取及保留密钥测试；Electron smoke 增加实际快捷键注册与拒绝无效组合检查。

## 2026-11-07 翻译请求兼容

- 对照用户提供的 test.py，新增 AI_AUTH_SCHEME=bearer|raw；默认 bearer，raw 原样发送 Authorization。保存服务设置保留此高级配置。
- 桌面翻译注入 Electron net.fetch，使用 Chromium 网络栈及系统代理支持；Node test:api 仍使用 Node fetch，两者网络路径可能不同。
- 本机两份 .env 已按参考脚本对齐服务、模型和鉴权；不记录密钥。test.py 排除 Git 和构建复制。
- 16 项测试、lint、build、打包 smoke 通过；真实 Node 调用超时，Electron 沙箱外实时验证被自动审批拒绝，尚未验证服务恢复。源码与打包版已同步。
