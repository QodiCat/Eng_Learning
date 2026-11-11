# 当前工程上下文

## 2026-11-11 卡片助记

- learning/mnemonic.cjs 复用现有翻译客户端的请求、响应限制、超时及错误处理，将词条和释义作为 JSON 数据发送，专用提示生成联想、适用的词根词缀/谐音、例句、自测；标明谐音非标准发音，禁止编造词源。
- 主窗口 study:mnemonic IPC 沿用现有兼容服务、net.fetch 和 activeRequest 互斥/取消；结果成功后原子写入 word.mnemonic，不增加查询/学习次数。小窗无此 IPC 权限。卡片展示缓存，可重新生成；生成期间禁止切卡/关闭，提供取消，失败保留缓存和显式错误。
- 25 项 Node 测试、lint、源码与打包版 smoke 通过；覆盖提示数据、助记持久化/空值拒绝/次数独立、失败保留内容及卡片入口。构建使用本地 Electron 缓存，便携包已更新并保留 .env；未发送真实 AI 请求，真实生成效果待使用验证。

## 2026-11-11 本地考试词表

- resources/vocabulary 提供可导入的 CET4（4406）、CET6（2077）、IELTS（4511）、TOEFL（3461）TXT；来源 TabHub/English-words-cards 固定版本 d92011be195cb9aa535e119302a909f2a6b38ab3 的完整 Git tree，提取各类 images 文件名为词头，保留 MIT 许可、来源说明、排除明细和 SHA-256。
- scripts/prepare-vocabulary.cjs 使用现有 parseLibrary 与项目配置从本地快照生成词表；排除 72 个不兼容条目，未放宽单词导入规则，不包含图片及释义，不声称考试官方完整大纲。
- 四份文件均经真实导入器与 LearningStore 导入隔离临时目录、重启读取核对数量通过，学习词条仍为空；lint 通过。未改用户数据库，未调用 AI；本轮无应用代码变化，无需重新打包。

## 2026-11-11 学习词库统计

- 学习词库新增总词数、已学习、待学习，统计全部 words，studyCount > 0 为已学习；词组按一条计，日期筛选不改变全库统计，卡片提交后随状态刷新。
- 24 项 Node 测试、lint、源码及打包版 smoke 通过；新增卡片提交后数字与持久状态一致、日期筛选不影响总体数字的断言。确认应用未运行后，使用本机 Electron 缓存构建成功，便携包已更新且保留 .env。未调用真实 API。

## 2026-11-11 卡片学习

- 学习词库新增开始学习，按当前筛选开启顺序卡片；展开释义后提交下一词/完成计次，退出未提交卡片不计数。study.js 负责卡片会话，study IPC 仅主窗口允许，store.study 原子持久化 studyCount 与 lastStudyId，旧词条默认 0 次；查询及复习标记独立。
- 24 项 Node 测试、lint、源码 smoke 通过；覆盖旧字段默认值、计次持久化、重复提交、写盘失败、卡片隐藏释义、退出不计数与完成计数。未调用真实 API。
- 用户确认托盘退出后，使用匹配 Electron 版本的本机缓存完成构建（首次默认下载 fetch failed），保留原 .env。打包版 smoke 在沙箱外通过，包含卡片退出不计数、展开释义后提交计次断言。便携包已更新；客户实机验收待确认。

## 2026-11-11 便携包同步

- 用户反馈旧界面后，核实运行 dist 旧版本；用户退出应用后 npm run build 成功，原 .env 保留。
- npm run smoke:packaged 在沙箱外通过（沙箱内受 Electron 目录 ACL 限制），验证菜单“学习词库 / 官方词库”、默认全部词条及日期筛选。便携包已更新；未调用真实 API，客户实机验收待确认。

## 2026-11-10 学习词库与官方词库

- 学习记录入口改为学习词库，默认展示全部 words（学习查词与翻译记录选词入库），可按日期筛选及恢复全部；全部视图按词条最近学习日期标记复习。
- 我的词库入口改为官方词库，仅管理外部导入词表，移除 personal-list；保留原有数据及选词去重字段，无需迁移。
- 23 项 Node 测试、lint、源码 Electron smoke 通过；新增界面命名、默认全部、日期筛选及恢复、无个人列表断言。冒烟显式设置学习模式，避免失败残留模式影响重试。沙箱 ACL 阻止启动，沙箱外检查最终通过；曾出现截图 UnknownVizError。
- 本轮未构建便携包、未执行打包版 smoke 或真实 API 测试；改动已在源码生效。产品反馈已记录，PRD 批准状态不变。

## 2026-11-08 翻译记录词组入库

- history.js 支持同一原文或译文段落内拖选英文词组，保留单击选词；拖选后 click 不再覆盖为单词。非法字符或跨原译文选择不可提交。history-token 显式允许文本选择。
- translation/input.cjs 新增 selectedEnglish，供 LearningStore.selectedInput 调用，校验同一来源内连续完整的英文词组；归一大小写、空白与弯撇号，沿用 MAX_INPUT_LENGTH。词组整体调用已有释义流程并存为一个 en: 条目；不放宽学习模式手动输入规则。
- 23 项 Node 测试、lint、源码和打包版 smoke、构建通过；新增词组归属、部分单词/不连续词拒绝、去重与持久化测试，smoke 覆盖 Range 选择多个词及 click 不覆盖。Windows 便携包已更新，保留现有 .env；未调用真实 AI。

## 2026-11-08 弹窗简化反馈

- 按用户截图移除 popup.html 中模式选择和结果重复原文；popup.js 清理对应监听与赋值，翻译模式不再显示保存提示及词库来源，学习模式保留次数与来源。主窗口负责切换模式，弹窗接收 mode 事件刷新字符上限；移除弹窗对 mode:save 的 IPC 权限。
- 22 项 Node 测试、lint、源码 Electron smoke 通过；更新 smoke 断言验证精简元素、译文与历史保存，并检查 popup-translation-smoke.png 截图。使用隔离数据，未调用真实 AI。
- 应用退出后已成功重新构建便携包并保留 .env，打包版 smoke 通过。新增截图首次在打包版使用了错误的资源相对目录，已改用 smoke 的实际 artifacts 目录；修复后遇到一次截图 UnknownVizError，重试通过。

## 2026-11-08 学习与翻译模式

- 后续重新打包：用户退出旧应用后，使用匹配版本 Electron 缓存执行 build 成功，Windows x64 便携包已更新，原有 .env 保留。打包版 smoke 沙箱内受 ACL 限制，沙箱外首次截图 UnknownVizError，重试通过；验证包含两种模式同步、句子翻译记录及点选单词。未发送真实 AI 请求。

- 主窗口与快捷弹窗提供 learning / translation 模式，learning.json 持久化并通过 mode:save IPC 同步；任务进行中拒绝切换。旧版数据补充默认学习模式与空翻译记录、个人词库字段，不改已有记录。
- translation/input.cjs 按模式校验；学习模式沿用原规则，翻译模式保留句子标点与段落，支持中英词组/整句。MAX_TRANSLATION_INPUT_LENGTH 默认 10000，由 .env.example 提供并公开至 renderer；含中文按中译英，否则英译中。
- 翻译模式使用完整文本翻译提示，原文以 JSON 数据传入，逐次写 translations，不自动计入 words。history.js 展示记录并支持点击英文原文/译文单词；history:add 仅主窗口可用，主进程校验记录与完整单词归属，查词成功后原子写学习记录和 personalKeys，重复加入拒绝。
- 我的词库显示个人学习词条；小窗 textarea 支持多行，Enter 提交、Shift+Enter 换行。快捷键沿用原有 selection / popup 配置，两种产品模式共享该行为。
- 验证：22 项 Node 测试、lint、源码 Electron smoke 通过（沙箱 ACL 失败后沙箱外运行；首次截图 UnknownVizError，重跑通过）。新增模式测试覆盖边界、历史隔离、去重、旧数据与双向请求；smoke 覆盖模式同步、选区句子自动翻译、历史展示和点选。
- 构建未完成：运行中的 dist/WordBridge-win32-x64/WordBridge.exe 占用 d3dcompiler_47.dll，更新目录报 EPERM；沙箱外构建另遇 fetch failed，指定现有版本缓存后仍被 DLL 占用阻止。打包版未更新、未运行新版 packaged smoke。未调用真实 AI，跨应用取词和实际译文待实机验证；PRD 批准状态不变。

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

## 2026-11-07 后台驻留与快捷翻译窗

- 用户授权：关闭主窗口后持续后台运行，取词快捷键唤起小翻译窗口。需求与交付记录见 .product/phase-1/development-scope.md，未批准 PRD。
- src/desktop/windows.cjs 管理双窗口、安全来源、托盘和关闭隐藏；主进程在取词后显示小窗，两个窗口共享原翻译服务及学习记录。小窗仅允许 state/translate/cancel/desktop:main/desktop:hide，设置 IPC 仍仅主窗口可调用。
- 主窗口和小窗关闭均隐藏，Esc 隐藏小窗；托盘双击打开主窗口，菜单可打开主窗口、快捷翻译或明确退出。退出取消请求并释放快捷键；不做开机自启。
- scripts/smoke-desktop.cjs 检查后台存活、取词先于小窗显示、主窗口保持隐藏、权限、纯文本结果、关闭/重开与托盘入口；smoke 使用独立 userData 避免现有应用单实例锁导致假成功。
- 打包改为 dist 临时目录生成后更新目标目录内容，保留 .env，避免 Windows 持有目标目录句柄时 rmdir EBUSY。临时和清理路径校验限定在 dist 内。
- 16 项 Node 测试、lint、build、源码及打包版 smoke 通过（Electron 检查在沙箱外运行）。本机服务配置保留。未做真实 AI 请求、跨应用取词实机验收或开机自启测试；未发布、未记录客户验收通过。

## 2026-11-07 快捷键直接弹窗与中文翻译方向

- 按用户最新反馈，默认 SHORTCUT_MODE=popup：快捷键立即显示、聚焦并选中小窗输入，不启动选区助手；SHORTCUT_MODE=selection 保留原有选区自动翻译路径。模板配置校验并由 .env/进程环境管理，现有 .env 未填写时默认 popup。
- 中文输入仍用既有 classifyInput；翻译客户端为 zh 输入追加明确的中译英方向，同时保留已保存自定义提示词。小窗和主界面说明同步；修正设置页旧的关闭退出说明。
- 17 项 Node 测试、lint、源码与打包 smoke 通过，新增中文本地 HTTP 请求及直接弹窗聚焦检查。便携包已更新；未发送真实 AI 请求，服务输出和用户实际键盘触发仍待实机验收。
- 构建资源获取出现 fetch failed；新增 ELECTRON_ZIP_DIRECTORY 可选构建配置，从 .env 或进程环境读取匹配版本 ZIP 目录，本轮使用现有 Electron 缓存成功构建。未配置时保持打包器原流程，不静默回退。

## 2026-11-07 选区自动翻译恢复及中文失败定位

- 最新用户要求按快捷键自动读取中英文选区并翻译，无需再点击。默认 SHORTCUT_MODE 恢复 selection，本机开发与打包配置同步；popup 可选模式保留。
- 本机真实学习记录显示“翻译”被模型当作指令，返回索要文本；另有中文词只在中文解释末尾附英文。中文请求改用 sourceLanguage/targetLanguage/text JSON 数据，system 明确词语不是指令并要求英文译词首行；中文-only 返回显式失败，不写学习记录、不计数。不声称已验证真实模型恢复。
- 主进程翻译和快捷键入口允许测试注入请求实现，用于隔离 smoke 检查自动调用路径；正常运行仍为 net.fetch，未引入生产 Mock 或静默降级。
- 18 项 Node 测试、lint、构建、源码和打包 smoke 通过。新检查覆盖英文与中文选区自动发请求、直接显示、计数以及中文-only 失败不计数；截图阶段首次 UnknownVizError，分别重跑通过。服务配置保留，使用匹配版本 Electron 缓存构建。
- 未执行真实 API 请求或跨应用实际键盘选区验收；真实中译英服务效果仍待用户确认。PRD 与客户验收状态未变。
