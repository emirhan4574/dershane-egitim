' Sessiz başlatıcı — siyah CMD penceresi göstermez
Set sh = CreateObject("WScript.Shell")
ps1 = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName) & "\Launch-Dershane.ps1"
cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & ps1 & """"
sh.Run cmd, 0, False
