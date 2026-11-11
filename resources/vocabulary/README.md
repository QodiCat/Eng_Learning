# 本地考试词表

在拾词中打开“官方词库”，填写名称（如“四级 CET4”），选择本目录对应 TXT 文件导入。TXT 为 UTF-8，每行一个词，无表头，可离线使用。

| 文件 | 去重单词数 | 名称建议 |
| --- | ---: | --- |
| [CET4.txt](CET4.txt) | 4406 | 四级 CET4 |
| [CET6.txt](CET6.txt) | 2077 | 六级 CET6 |
| [IELTS.txt](IELTS.txt) | 4511 | 雅思 IELTS |
| [TOEFL.txt](TOEFL.txt) | 3461 | 托福 TOEFL |

## 来源与边界

- 来源：[TabHub English-words-cards](https://github.com/tabhub/English-words-cards)，四类词表对应目录下 images 的英文文件名作为词头。未下载图片或提取释义。
- 固定版本：`d92011be195cb9aa535e119302a909f2a6b38ab3`；下载日期：2026-11-11。
- 上游许可证：MIT，版权归 TabHub；完整文本见 [LICENSE-TabHub.txt](LICENSE-TabHub.txt)。社区整理的备考资源，不是考试机构官方完整大纲，不保证覆盖全部考试词汇。六级词表不自动合并四级基础词。
- 原始目录快照：[source/tree.json](source/tree.json)，保留完整 Git blob 标识；无截断。导入文件只含词头，不含释义、音标、例句；应用查询时仍使用现有翻译服务。
- 按应用实际导入器进行大小写归一、去重及格式验证。四级排除 65 项、六级排除 6 项、雅思排除 1 项、托福排除 0 项；被排除的词组等内容及原因、输出 SHA-256 均在 [manifest.json](manifest.json)，未把词组拆成单词。
- 可从原始快照重新生成：项目根目录运行 `node scripts/prepare-vocabulary.cjs`。使用项目配置和原有导入校验器，未更改应用导入规则。
- 导入官方词库只建立词表来源，不会把所有单词自动加入学习词库，也不会增加学习次数。同名词库冲突时请调整名称。
