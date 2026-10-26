; The Windows installer (3.0.0, the easy install), built by scripts/installer.mjs from a portable
; build made with --installed (scripts/portable.mjs): Node, the app, its packages and the tray.
;
; Just for the person installing it, so no administrator is asked for: the program goes to
; Local AppData\Programs\SimonSays, and what is theirs — data, pictures, settings, backups, the
; versions updated to — is kept apart from it, in Local AppData\SimonSays (start.js, homeFor).
; Installing over an older version replaces the program and never touches those. Uninstalling
; keeps them too, unless the person says yes to deleting them.
;
; A running SimonSays is asked to quit first (SimonSays.exe --quit: the tray stops the app the
; way its own Quit does, cleanly), so nothing is replaced underneath it.
;
; Passed by the builder: AppVersion, SourceDir (the build's SimonSays folder), OutputDir,
; IconFile, and AppURL (the edition's GitHub repository, or empty).

#ifndef AppVersion
  #error AppVersion is passed by scripts/installer.mjs
#endif

[Setup]
AppId={{7CE81691-828C-415F-834E-F1C18D69F7B3}
AppName=SimonSays
AppVersion={#AppVersion}
AppVerName=SimonSays {#AppVersion}
AppPublisher=SimonSays
#if AppURL != ""
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}/issues
AppUpdatesURL={#AppURL}/releases
#endif
VersionInfoVersion={#AppVersion}
VersionInfoProductName=SimonSays
VersionInfoDescription=SimonSays installer
PrivilegesRequired=lowest
DefaultDirName={autopf}\SimonSays
DisableDirPage=yes
DisableProgramGroupPage=yes
DisableWelcomePage=no
UsePreviousAppDir=yes
OutputDir={#OutputDir}
; One name for every version, so the latest release's download link never changes; the version is in its properties.
OutputBaseFilename=SimonSays-Setup
SetupIconFile={#IconFile}
UninstallDisplayIcon={app}\SimonSays.exe
UninstallDisplayName=SimonSays
WizardStyle=modern
Compression=lzma2/max
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
; Anything still holding the program's files after SimonSays.exe --quit (a console copy, SimonSays.cmd) is closed by Windows.
CloseApplications=yes
CloseApplicationsFilter=*.exe,*.dll,*.node
RestartApplications=no
; English or Spanish, asked every time with Windows' own language picked; what is chosen is kept in
; language.txt beside the program, for the tray's menu and the first-run setup to start in it too.
LanguageDetectionMethod=uilanguage
ShowLanguageDialog=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[CustomMessages]
english.AutoStart=Start SimonSays when I sign in to Windows
spanish.AutoStart=Iniciar SimonSays al iniciar sesión en Windows
english.AppComment=Chat, overlays and buttons for your stream
spanish.AppComment=Chat, overlays y botones para tu directo
english.DeleteDataAsk=Also delete your SimonSays data?%n%nYour layouts, commands, accounts, pictures, settings and backups are kept in:%n%1%n%nChoose No to keep them, to install SimonSays again later or bring them into another copy. Yes cannot be undone.
spanish.DeleteDataAsk=¿Borrar también tus datos de SimonSays?%n%nTus overlays, comandos, cuentas, imágenes, ajustes y respaldos se guardan en:%n%1%n%nElige No para conservarlos, para volver a instalar SimonSays más tarde o traerlos a otra copia. Sí no se puede deshacer.

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "autostart"; Description: "{cm:AutoStart}"; Flags: unchecked

[InstallDelete]
; The program replaced whole, so nothing of an older version is left beside the new one. Never the data: it is not in here.
Type: filesandordirs; Name: "{app}\node"
Type: filesandordirs; Name: "{app}\server"
Type: filesandordirs; Name: "{app}\shared"
Type: filesandordirs; Name: "{app}\web"

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\SimonSays"; Filename: "{app}\SimonSays.exe"; Comment: "{cm:AppComment}"
Name: "{autodesktop}\SimonSays"; Filename: "{app}\SimonSays.exe"; Comment: "{cm:AppComment}"; Tasks: desktopicon

[Registry]
; The same value the tray's own "Start with Windows" sets and clears.
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "SimonSays"; ValueData: """{app}\SimonSays.exe"" --background"; Tasks: autostart; Flags: uninsdeletevalue

[UninstallDelete]
; Written by the installer itself (CurStepChanged), so not among its files: removed by hand.
Type: files; Name: "{app}\language.txt"

[Run]
Filename: "{app}\SimonSays.exe"; Description: "{cm:LaunchProgram,SimonSays}"; Flags: nowait postinstall skipifsilent

[Code]
const
  RunKey = 'Software\Microsoft\Windows\CurrentVersion\Run';

{ The SimonSays running from this folder asked to quit, and waited for: the tray stops the app cleanly. }
procedure QuitRunning(const Dir: String);
var
  Code: Integer;
begin
  if FileExists(Dir + '\SimonSays.exe') then
    Exec(Dir + '\SimonSays.exe', '--quit', Dir, SW_HIDE, ewWaitUntilTerminated, Code);
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  QuitRunning(ExpandConstant('{app}'));
  Result := '';
end;

{ The language chosen, for the tray and the first-run setup: en or es. }
procedure CurStepChanged(CurStep: TSetupStep);
var
  Lang: String;
begin
  if CurStep = ssPostInstall then
  begin
    if ActiveLanguage = 'spanish' then Lang := 'es' else Lang := 'en';
    SaveStringToFile(ExpandConstant('{app}\language.txt'), Lang, False);
  end;
end;

function InitializeUninstall(): Boolean;
begin
  QuitRunning(ExpandConstant('{app}'));
  Result := True;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  Home: String;
begin
  if CurUninstallStep = usPostUninstall then
  begin
    { Set by the tray as well as by the installer: gone either way. }
    RegDeleteValue(HKEY_CURRENT_USER, RunKey, 'SimonSays');
    Home := ExpandConstant('{localappdata}\SimonSays');
    { Kept unless the person says otherwise; a silent uninstall never deletes it. }
    if DirExists(Home) and not UninstallSilent then
      if MsgBox(FmtMessage(CustomMessage('DeleteDataAsk'), [Home]), mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES then
        DelTree(Home, True, True, True);
  end;
end;
