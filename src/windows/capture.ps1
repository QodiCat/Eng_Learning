param([int]$WaitMs = 1500)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class SelectionNative {
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll")] public static extern uint GetClipboardSequenceNumber();
}
'@

$snapshot = $null
$changedClipboard = $false
$copiedSequence = 0
try {
    $foreground = [SelectionNative]::GetForegroundWindow()
    if ($foreground -eq [IntPtr]::Zero) { throw 'No active window.' }
    $watch = [Diagnostics.Stopwatch]::StartNew()
    while (([SelectionNative]::GetAsyncKeyState(0x11) -band 0x8000) -or
           ([SelectionNative]::GetAsyncKeyState(0x12) -band 0x8000) -or
           ([SelectionNative]::GetAsyncKeyState(0x10) -band 0x8000) -or
           ([SelectionNative]::GetAsyncKeyState(0x5B) -band 0x8000)) {
        if ($watch.ElapsedMilliseconds -gt $WaitMs) { throw 'Release shortcut keys and try again.' }
        Start-Sleep -Milliseconds 20
    }
    if ([SelectionNative]::GetForegroundWindow() -ne $foreground) { throw 'Active window changed. Select the text again.' }

    # UI Automation does not alter the clipboard. Some applications lack this pattern.
    $selected = ''
    $automationUnavailable = $false
    try {
        $element = [System.Windows.Automation.AutomationElement]::FocusedElement
        $pattern = $null
        if ($element -and $element.TryGetCurrentPattern([System.Windows.Automation.TextPattern]::Pattern, [ref]$pattern)) {
            $selected = (($pattern.GetSelection() | ForEach-Object { $_.GetText(-1) }) -join '')
        }
    } catch { $automationUnavailable = $true }
    if (-not [string]::IsNullOrWhiteSpace($selected)) {
        @{ text = $selected; method = 'automation' } | ConvertTo-Json -Compress
        exit 0
    }

    # Materialize clipboard formats before copying; never translate stale clipboard text.
    $original = [System.Windows.Forms.Clipboard]::GetDataObject()
    $snapshot = New-Object System.Windows.Forms.DataObject
    if ($original) {
        foreach ($format in $original.GetFormats($false)) {
            $value = $original.GetData($format, $false)
            if ($null -ne $value) { $snapshot.SetData($format, $false, $value) }
        }
    }
    if ([SelectionNative]::GetForegroundWindow() -ne $foreground) { throw 'Active window changed. Select the text again.' }
    $before = [SelectionNative]::GetClipboardSequenceNumber()
    [System.Windows.Forms.SendKeys]::SendWait('^c')
    $watch.Restart()
    while ([SelectionNative]::GetClipboardSequenceNumber() -eq $before) {
        if ($watch.ElapsedMilliseconds -gt $WaitMs) { throw 'No copied text received. The application may block copying or require elevated access.' }
        Start-Sleep -Milliseconds 25
    }
    $copiedSequence = [SelectionNative]::GetClipboardSequenceNumber()
    $changedClipboard = $true
    if ([SelectionNative]::GetForegroundWindow() -ne $foreground) { throw 'Active window changed during copying.' }
    $selected = [System.Windows.Forms.Clipboard]::GetText()
    if ([string]::IsNullOrWhiteSpace($selected)) { throw 'The selection contains no plain text.' }
    @{ text = $selected; method = 'copy'; automationUnavailable = $automationUnavailable } | ConvertTo-Json -Compress
} catch {
    @{ error = $_.Exception.Message } | ConvertTo-Json -Compress
    exit 1
} finally {
    if ($changedClipboard -and [SelectionNative]::GetClipboardSequenceNumber() -eq $copiedSequence) {
        try {
            if ($snapshot.GetFormats($false).Length -eq 0) { [System.Windows.Forms.Clipboard]::Clear() }
            else { [System.Windows.Forms.Clipboard]::SetDataObject($snapshot, $true) }
        } catch {
            [Console]::Error.WriteLine('Clipboard restore failed; the selected text may remain on the clipboard.')
        }
    }
}
