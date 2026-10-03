const { execFile } = require('node:child_process');
const path = require('node:path');

function captureSelection(config) {
  if (process.platform !== 'win32') return Promise.reject(new Error('全局取词目前仅支持 Windows。'));
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass',
      '-File', path.join(__dirname, 'capture.ps1'), '-WaitMs', String(config.captureTimeoutMs),
    ], { windowsHide: true, timeout: config.captureProcessTimeoutMs, maxBuffer: 1024 * 1024, encoding: 'utf8' }, (error, stdout, stderr) => {
      let result;
      try { result = JSON.parse(stdout.trim()); } catch {
        reject(new Error('取词助手未能完成。请检查 PowerShell 是否可用、是否被系统策略限制；可在主窗口直接输入。'));
        return;
      }
      if (error || result.error) {
        reject(new Error(`取词失败：${result.error || '助手异常退出'}；请确认有选中文字且应用权限一致。`));
      } else if (typeof result.text !== 'string') {
        reject(new Error('取词助手未返回文字。'));
      } else {
        resolve({ text: result.text, warning: stderr.trim() ? '已取词，但剪贴板恢复失败，请检查剪贴板内容。' : '' });
      }
    });
  });
}
module.exports = { captureSelection };
