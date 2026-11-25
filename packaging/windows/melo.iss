; Inno Setup script: builds Melo-Setup-<version>.exe, a one-click installer for Windows 10/11.
; Installs for the current user only (no administrator password), adds Start menu and desktop
; shortcuts, and starts Melo when it finishes. Build with packaging\windows\build.ps1.
;
; System check (before anything is copied):
;   required  64-bit Windows 10 or 11, 700 MB free disk space  -> setup stops with a clear message if missing
;   optional  Microsoft Edge (best voices + speech recognition), Claude Code, Ollama (a free local AI brain)
; Nothing optional is installed without permission: Ollama is offered as an unticked checkbox and installed
; with winget only if the user ticks it (or the download page opens when winget is missing). Melo works
; without any of them (offline teacher), and an AI brain can be added later under Parent > AI brain.
#define AppName "Melo"
#ifndef SourceDir
  #define SourceDir "..\..\dist\Melo"
#endif
#ifndef AppPublisher
  #define AppPublisher "Melo"
#endif
#ifndef AppVersion
  #define AppVersion "1.6.0"
#endif

[Setup]
AppId={{6B0E2A7C-3D1F-4E8B-9C55-MELO0MUSIC01}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppComments=AI music teacher for children
DefaultDirName={localappdata}\Programs\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
DisableDirPage=yes
DisableReadyPage=yes
PrivilegesRequired=lowest
OutputDir=..\..\dist
OutputBaseFilename=Melo-Setup-{#AppVersion}
SetupIconFile=..\icons\melo.ico
UninstallDisplayIcon={app}\Melo.exe
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
CloseApplications=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\Melo.exe"
Name: "{userdesktop}\{#AppName}"; Filename: "{app}\Melo.exe"

[Run]
Filename: "{app}\Melo.exe"; Description: "Start {#AppName}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; The child's lessons and recordings in %LOCALAPPDATA%\Melo are kept on purpose when uninstalling.
Type: filesandordirs; Name: "{app}"

[Code]
var
  CheckPage: TOutputMsgMemoWizardPage;
  ExtrasPage: TInputOptionWizardPage;
  HasEdge, HasClaude, HasOllama, HasWinget: Boolean;

function FileOnPath(Name: String): Boolean;
var
  Paths, Dir: String;
  P: Integer;
begin
  Result := False;
  Paths := GetEnv('PATH') + ';';
  while (not Result) and (Length(Paths) > 0) do
  begin
    P := Pos(';', Paths);
    Dir := Trim(Copy(Paths, 1, P - 1));
    Delete(Paths, 1, P);
    if (Dir <> '') and FileExists(AddBackslash(Dir) + Name) then
      Result := True;
  end;
end;

function FreeMB(Dir: String): Cardinal;
var
  FreeM, TotalM: Cardinal;
begin
  if GetSpaceOnDisk(Dir, True, FreeM, TotalM) then Result := FreeM else Result := 0;
end;

function YesNo(B: Boolean; Yes, No: String): String;
begin
  if B then Result := Yes else Result := No;
end;

function InitializeSetup(): Boolean;
var
  Free: Cardinal;
begin
  Result := True;
  Free := FreeMB(ExpandConstant('{localappdata}'));
  if (Free > 0) and (Free < 700) then
  begin
    MsgBox('Melo needs about 700 MB of free disk space (it has ' + IntToStr(Free) + ' MB). ' +
      'Please free some space and run the installer again.', mbCriticalError, MB_OK);
    Result := False;
    Exit;
  end;
  HasEdge := FileExists(ExpandConstant('{commonpf32}\Microsoft\Edge\Application\msedge.exe')) or
             FileExists(ExpandConstant('{commonpf}\Microsoft\Edge\Application\msedge.exe'));
  HasClaude := FileOnPath('claude.exe') or FileOnPath('claude.cmd') or
               FileExists(ExpandConstant('{%USERPROFILE}\.local\bin\claude.exe')) or
               FileExists(ExpandConstant('{userappdata}\npm\claude.cmd'));
  HasOllama := FileOnPath('ollama.exe') or FileExists(ExpandConstant('{localappdata}\Programs\Ollama\ollama.exe'));
  HasWinget := FileOnPath('winget.exe') or FileExists(ExpandConstant('{localappdata}\Microsoft\WindowsApps\winget.exe'));
end;

procedure InitializeWizard();
begin
  CheckPage := CreateOutputMsgMemoPage(wpWelcome, 'System check', 'What this computer has for Melo',
    'Melo itself needs nothing else: everything it needs is inside the installer. The items marked optional make it better.',
    'Required' + #13#10 +
    '  [OK] 64-bit Windows 10 or 11' + #13#10 +
    '  [OK] Disk space: ' + IntToStr(FreeMB(ExpandConstant('{localappdata}'))) + ' MB free (700 MB needed)' + #13#10#13#10 +
    'Optional' + #13#10 +
    '  ' + YesNo(HasEdge, '[OK] Microsoft Edge: natural voices and speech recognition for speaking practice',
                          '[--] Microsoft Edge not found: speaking practice needs Edge or Chrome') + #13#10 +
    '  ' + YesNo(HasClaude, '[OK] Claude Code found: Melo can use it as its AI brain (no API key)',
                            '[--] Claude Code not found (optional AI brain): https://claude.com/claude-code') + #13#10 +
    '  ' + YesNo(HasOllama, '[OK] Ollama found: a free local AI brain is available',
                            '[--] Ollama not found (optional free local AI brain): can be installed on the next page') + #13#10#13#10 +
    'Without an AI brain Melo still teaches with its built-in offline teacher. ' +
    'You can connect one later in Melo under Parent > AI brain.');
  ExtrasPage := CreateInputOptionPage(CheckPage.ID, 'Optional extras', 'Install these too? (only if you tick them)',
    'Each item is downloaded from its maker. Leave unticked to skip; you can add them later.', False, False);
  ExtrasPage.Add('Ollama: free AI brain that runs on this computer (about 1 GB; then run "ollama pull llama3.2" for a 2 GB model)');
  ExtrasPage.Values[0] := False;
  if HasOllama then ExtrasPage.CheckListBox.ItemEnabled[0] := False;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  Code: Integer;
begin
  if (CurStep = ssPostInstall) and (not HasOllama) and ExtrasPage.Values[0] then
  begin
    if HasWinget then
    begin
      WizardForm.StatusLabel.Caption := 'Installing Ollama with winget (you asked for it)...';
      if not Exec('winget.exe', 'install -e --id Ollama.Ollama --accept-source-agreements --accept-package-agreements',
                  '', SW_SHOW, ewWaitUntilTerminated, Code) or (Code <> 0) then
        MsgBox('Ollama could not be installed automatically (code ' + IntToStr(Code) + '). ' +
          'The download page will open; Melo works fine without it.', mbInformation, MB_OK);
      if Code <> 0 then ShellExec('open', 'https://ollama.com/download/windows', '', '', SW_SHOW, ewNoWait, Code);
    end
    else
      ShellExec('open', 'https://ollama.com/download/windows', '', '', SW_SHOW, ewNoWait, Code);
  end;
end;
