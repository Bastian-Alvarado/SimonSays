//! SimonSays in the tray (3.0.0, the easy install).
//!
//! What the installer's shortcut starts. It starts the app — the launcher,
//! start.js, on the Node beside this program — with no console window, keeps
//! what it says in logs/simonsays.log in the home (the user's own folder for
//! an installed copy, this folder for a portable one: start.js's homeFor),
//! and puts an icon in the tray to open the dashboard, restart, find the logs,
//! start with Windows, and quit.
//!
//! Quitting stops the app cleanly: Windows has no signal to stop a program
//! that has no console, only a kill, so this says "stop" on the launcher's
//! stdin (SIMONSAYS_CONTROL=stdin), the launcher asks the server, and the
//! server saves and says goodbye before it exits. If this program is gone
//! the pipe closes, which the launcher takes as a stop too.
//!
//! Only one runs: started again, it opens the dashboard and leaves.
//! `--background` (how Windows starts it at sign-in) does not open the
//! dashboard when the app is up. `--quit` asks the one running to quit, as
//! its menu's Quit does, and waits until it has: what the installer runs
//! before it replaces the program, and before it removes it.
#![cfg_attr(windows, windows_subsystem = "windows")]

use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use tao::event::{Event, StartCause};
use tao::event_loop::{ControlFlow, EventLoopBuilder};
use tray_icon::menu::{CheckMenuItem, Menu, MenuEvent, MenuItem, PredefinedMenuItem};
use tray_icon::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

/// The log is started again from empty past this, the one before kept as simonsays.old.log.
const LOG_LIMIT: u64 = 5 * 1024 * 1024;
/// How long a stop may take before the app is stopped by force.
const STOP_WITHIN: Duration = Duration::from_secs(20);

#[derive(Clone, Copy, PartialEq, Debug)]
enum Status {
    Starting,
    Running,
    Stopping,
    Stopped,
}

enum UserEvent {
    Menu(MenuEvent),
    Tray(TrayIconEvent),
    Status(Status),
    /// `SimonSays.exe --quit` was run: the installer, about to replace or remove this.
    QuitAsked,
    Exit,
}

/// The words, in the language Windows is in: Spanish, or English.
struct Words {
    open: &'static str,
    restart: &'static str,
    start: &'static str,
    logs: &'static str,
    autostart: &'static str,
    quit: &'static str,
    starting: &'static str,
    running: &'static str,
    stopping: &'static str,
    stopped: &'static str,
    no_node: &'static str,
}

const EN: Words = Words {
    open: "Open the dashboard",
    restart: "Restart",
    start: "Start",
    logs: "Open the logs folder",
    autostart: "Start with Windows",
    quit: "Quit SimonSays",
    starting: "SimonSays is starting…",
    running: "SimonSays is running",
    stopping: "SimonSays is stopping…",
    stopped: "SimonSays is stopped",
    no_node: "SimonSays cannot start: its Node (node\\node.exe) or start.js is missing from its folder. Install it again.",
};

const ES: Words = Words {
    open: "Abrir el panel",
    restart: "Reiniciar",
    start: "Iniciar",
    logs: "Abrir la carpeta de registros",
    autostart: "Iniciar con Windows",
    quit: "Salir de SimonSays",
    starting: "SimonSays se está iniciando…",
    running: "SimonSays está en marcha",
    stopping: "SimonSays se está deteniendo…",
    stopped: "SimonSays está detenido",
    no_node: "SimonSays no puede iniciarse: falta su Node (node\\node.exe) o start.js en su carpeta. Vuelve a instalarlo.",
};

/// The language chosen in the installer (language.txt beside this program), or the one Windows is in.
fn words(app: &Path) -> &'static Words {
    match fs::read_to_string(app.join("language.txt")).map(|s| s.trim().to_string()).as_deref() {
        Ok("es") => &ES,
        Ok("en") => &EN,
        _ if os::spanish() => &ES,
        _ => &EN,
    }
}

/// Where the program is, and where its things are kept (start.js's homeFor, the same rule).
struct Places {
    app: PathBuf,
    home: PathBuf,
}

impl Places {
    fn find() -> Places {
        let exe = std::env::current_exe().unwrap_or_else(|_| PathBuf::from("SimonSays.exe"));
        let app = exe.parent().map(Path::to_path_buf).unwrap_or_else(|| PathBuf::from("."));
        let home = if let Some(h) = std::env::var_os("SIMONSAYS_HOME").filter(|h| !h.is_empty()) {
            PathBuf::from(h)
        } else if app.join("installed.json").exists() {
            os::user_data_dir()
        } else {
            app.clone()
        };
        Places { app, home }
    }
    fn node(&self) -> PathBuf {
        self.app.join("node").join(if cfg!(windows) { "node.exe" } else { "node" })
    }
    fn logs(&self) -> PathBuf {
        self.home.join("logs")
    }
    /// The port the app listens on: PORT in the home's .env, as config.js reads it, or 8081.
    fn port(&self) -> u16 {
        fs::read_to_string(self.home.join(".env"))
            .ok()
            .and_then(|text| {
                text.lines().find_map(|line| {
                    let (key, value) = line.trim().split_once('=')?;
                    if key.trim() != "PORT" {
                        return None;
                    }
                    value.trim().trim_matches(|c| c == '"' || c == '\'').parse().ok()
                })
            })
            .unwrap_or(8081)
    }
    fn dashboard(&self) -> String {
        format!("http://localhost:{}/", self.port())
    }
}

/// The log file, started again when it has grown past LOG_LIMIT.
fn open_log(places: &Places) -> Option<File> {
    let dir = places.logs();
    fs::create_dir_all(&dir).ok()?;
    let file = dir.join("simonsays.log");
    if fs::metadata(&file).map(|m| m.len() > LOG_LIMIT).unwrap_or(false) {
        let _ = fs::rename(&file, dir.join("simonsays.old.log"));
    }
    OpenOptions::new().create(true).append(true).open(file).ok()
}

fn note(places: &Places, what: &str) {
    if let Some(mut f) = open_log(places) {
        let secs = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
        let _ = writeln!(f, "[tray {secs}] {what}");
    }
}

/// The app as it runs: the launcher, and the pipe to tell it to stop.
#[derive(Default)]
struct App {
    child: Option<Child>,
    stdin: Option<ChildStdin>,
}

impl App {
    fn start(&mut self, places: &Places) -> std::io::Result<()> {
        let log = open_log(places);
        let (out, err) = match &log {
            Some(f) => (Stdio::from(f.try_clone()?), Stdio::from(f.try_clone()?)),
            None => (Stdio::null(), Stdio::null()),
        };
        note(places, "starting the app");
        let mut cmd = Command::new(places.node());
        cmd.arg(places.app.join("start.js"))
            .current_dir(&places.app)
            .env("SIMONSAYS_CONTROL", "stdin")
            .stdin(Stdio::piped())
            .stdout(out)
            .stderr(err);
        os::no_window(&mut cmd);
        let mut child = cmd.spawn()?;
        self.stdin = child.stdin.take();
        self.child = Some(child);
        Ok(())
    }

    fn running(&mut self) -> bool {
        matches!(self.child.as_mut().map(|c| c.try_wait()), Some(Ok(None)))
    }

    /// Asked to stop, and waited for; stopped by force (the launcher and the server under it) if it will not.
    fn stop(&mut self, places: &Places) {
        let Some(mut child) = self.child.take() else { return };
        if let Some(mut stdin) = self.stdin.take() {
            let _ = stdin.write_all(b"stop\n");
            let _ = stdin.flush();
            // Closing the pipe says it too.
        }
        let until = Instant::now() + STOP_WITHIN;
        while Instant::now() < until {
            if let Ok(Some(_)) = child.try_wait() {
                note(places, "the app stopped");
                return;
            }
            thread::sleep(Duration::from_millis(200));
        }
        note(places, "the app did not stop in time; stopping it");
        os::kill_tree(&mut child);
    }
}

/// Whether the app answers: GET /api/health, without a library for one request.
fn healthy(port: u16) -> bool {
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let Ok(mut s) = TcpStream::connect_timeout(&addr, Duration::from_millis(800)) else { return false };
    let _ = s.set_read_timeout(Some(Duration::from_millis(1500)));
    if s.write_all(format!("GET /api/health HTTP/1.0\r\nHost: 127.0.0.1:{port}\r\n\r\n").as_bytes()).is_err() {
        return false;
    }
    let mut buf = [0u8; 64];
    let n = s.read(&mut buf).unwrap_or(0);
    std::str::from_utf8(&buf[..n]).map(|t| t.starts_with("HTTP/1.") && t.contains(" 200")).unwrap_or(false)
}

fn open(target: &str) {
    os::open(target);
}

fn main() {
    let places = Arc::new(Places::find());
    let w = words(&places.app);
    let background = std::env::args().any(|a| a == "--background");
    if std::env::args().any(|a| a == "--quit") {
        os::quit_running();
        return;
    }

    // One at a time: started again, the dashboard opens (not at sign-in), and that is all.
    if !os::only_one() {
        if !background {
            open(&places.dashboard());
        }
        return;
    }
    if !places.node().exists() || !places.app.join("start.js").exists() {
        os::alert(w.no_node);
        return;
    }

    let app = Arc::new(Mutex::new(App::default()));
    if let Err(err) = app.lock().unwrap().start(&places) {
        note(&places, &format!("could not start the app: {err}"));
    }

    let event_loop = EventLoopBuilder::<UserEvent>::with_user_event().build();
    let proxy = event_loop.create_proxy();
    {
        let p = proxy.clone();
        TrayIconEvent::set_event_handler(Some(move |e| {
            let _ = p.send_event(UserEvent::Tray(e));
        }));
        let p = proxy.clone();
        MenuEvent::set_event_handler(Some(move |e| {
            let _ = p.send_event(UserEvent::Menu(e));
        }));
        let p = proxy.clone();
        os::listen_for_quit(move || {
            let _ = p.send_event(UserEvent::QuitAsked);
        });
    }

    // Watching: up, still starting, or stopped — said in the tray as it changes.
    let busy = Arc::new(Mutex::new(false));
    {
        let (app, places, proxy, busy) = (app.clone(), places.clone(), proxy.clone(), busy.clone());
        thread::spawn(move || {
            let mut last = None;
            loop {
                let status = if *busy.lock().unwrap() {
                    Status::Stopping
                } else if !app.lock().unwrap().running() {
                    Status::Stopped
                } else if healthy(places.port()) {
                    Status::Running
                } else {
                    Status::Starting
                };
                if last != Some(status) {
                    last = Some(status);
                    if proxy.send_event(UserEvent::Status(status)).is_err() {
                        return;
                    }
                }
                thread::sleep(Duration::from_millis(1500));
            }
        });
    }

    let status_item = MenuItem::new(w.starting, false, None);
    let open_item = MenuItem::new(w.open, true, None);
    let restart_item = MenuItem::new(w.restart, true, None);
    let logs_item = MenuItem::new(w.logs, true, None);
    let autostart_item = CheckMenuItem::new(w.autostart, cfg!(windows), os::autostart(), None);
    let quit_item = MenuItem::new(w.quit, true, None);
    let menu = Menu::new();
    let _ = menu.append_items(&[
        &status_item,
        &PredefinedMenuItem::separator(),
        &open_item,
        &restart_item,
        &logs_item,
        &PredefinedMenuItem::separator(),
        &autostart_item,
        &PredefinedMenuItem::separator(),
        &quit_item,
    ]);

    let mut tray = None;
    let mut opened = background;
    let mut quitting = false;

    // Stop (and start again, for a restart) off the tray's own thread, so the menu never hangs on it.
    let restart_or_quit = {
        let (app, places, proxy, busy) = (app.clone(), places.clone(), proxy.clone(), busy.clone());
        move |again: bool| {
            let (app, places, proxy, busy) = (app.clone(), places.clone(), proxy.clone(), busy.clone());
            *busy.lock().unwrap() = true;
            let _ = proxy.send_event(UserEvent::Status(Status::Stopping));
            thread::spawn(move || {
                app.lock().unwrap().stop(&places);
                if again {
                    if let Err(err) = app.lock().unwrap().start(&places) {
                        note(&places, &format!("could not start the app: {err}"));
                    }
                    *busy.lock().unwrap() = false;
                } else {
                    let _ = proxy.send_event(UserEvent::Exit);
                }
            });
        }
    };

    event_loop.run(move |event, _, control_flow| {
        *control_flow = ControlFlow::Wait;
        match event {
            Event::NewEvents(StartCause::Init) => {
                tray = TrayIconBuilder::new()
                    .with_menu(Box::new(menu.clone()))
                    .with_menu_on_left_click(false)
                    .with_tooltip(w.starting)
                    .with_icon(os::icon())
                    .build()
                    .ok();
            }
            Event::UserEvent(UserEvent::Status(status)) => {
                let text = match status {
                    Status::Starting => w.starting,
                    Status::Running => w.running,
                    Status::Stopping => w.stopping,
                    Status::Stopped => w.stopped,
                };
                status_item.set_text(text);
                restart_item.set_text(if status == Status::Stopped { w.start } else { w.restart });
                restart_item.set_enabled(status != Status::Stopping);
                if let Some(t) = &tray {
                    let _ = t.set_tooltip(Some(text));
                }
                // The first time it is up, the dashboard opens — not at sign-in, when it starts in the background.
                if status == Status::Running && !opened {
                    opened = true;
                    open(&places.dashboard());
                }
            }
            Event::UserEvent(UserEvent::Tray(TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. })) => {
                open(&places.dashboard());
            }
            Event::UserEvent(UserEvent::Menu(e)) => {
                if e.id == *open_item.id() {
                    open(&places.dashboard());
                } else if e.id == *restart_item.id() {
                    restart_or_quit(true);
                } else if e.id == *logs_item.id() {
                    let _ = fs::create_dir_all(places.logs());
                    open(&places.logs().to_string_lossy());
                } else if e.id == *autostart_item.id() {
                    let on = autostart_item.is_checked();
                    if !os::set_autostart(on) {
                        autostart_item.set_checked(!on);
                    }
                } else if e.id == *quit_item.id() && !quitting {
                    quitting = true;
                    restart_or_quit(false);
                }
            }
            Event::UserEvent(UserEvent::QuitAsked) => {
                if !quitting {
                    quitting = true;
                    restart_or_quit(false);
                }
            }
            Event::UserEvent(UserEvent::Exit) => {
                tray.take();
                *control_flow = ControlFlow::Exit;
            }
            _ => {}
        }
    });
}

#[cfg(windows)]
mod os {
    use std::os::windows::process::CommandExt;
    use std::path::PathBuf;
    use std::process::{Child, Command};

    use windows_sys::Win32::Foundation::{GetLastError, ERROR_ALREADY_EXISTS};
    use windows_sys::Win32::Globalization::GetUserDefaultUILanguage;
    use windows_sys::Win32::System::Threading::{
        CreateEventW, CreateMutexW, OpenEventW, OpenMutexW, SetEvent, WaitForSingleObject, EVENT_MODIFY_STATE, INFINITE,
        SYNCHRONIZATION_SYNCHRONIZE,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONERROR, MB_OK};
    use winreg::enums::{HKEY_CURRENT_USER, KEY_READ, KEY_SET_VALUE};
    use winreg::RegKey;

    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    const RUN: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
    const RUN_NAME: &str = "SimonSays";
    const MUTEX: &str = "Local\\SimonSaysTray";
    const QUIT_EVENT: &str = "Local\\SimonSaysTrayQuit";
    /// How long `--quit` waits for the one running to be gone: its own stop may take up to STOP_WITHIN.
    const QUIT_WAIT_MS: u32 = 30_000;

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    /// Local AppData\SimonSays, as start.js's userDataDir has it.
    pub fn user_data_dir() -> PathBuf {
        let base = std::env::var_os("LOCALAPPDATA").map(PathBuf::from).unwrap_or_else(|| {
            PathBuf::from(std::env::var_os("USERPROFILE").unwrap_or_default()).join("AppData").join("Local")
        });
        base.join("SimonSays")
    }

    pub fn spanish() -> bool {
        (unsafe { GetUserDefaultUILanguage() } & 0x3ff) == 0x0a
    }

    /// Whether this is the only one running: a named mutex, owned until this program ends (so `--quit` can wait on it).
    pub fn only_one() -> bool {
        let name = wide(MUTEX);
        let handle = unsafe { CreateMutexW(std::ptr::null(), 1, name.as_ptr()) };
        !handle.is_null() && unsafe { GetLastError() } != ERROR_ALREADY_EXISTS
    }

    /// `f` when `--quit` is run: a named event this one waits on.
    pub fn listen_for_quit(f: impl Fn() + Send + 'static) {
        let name = wide(QUIT_EVENT);
        let event = unsafe { CreateEventW(std::ptr::null(), 0, 0, name.as_ptr()) } as usize;
        if event == 0 {
            return;
        }
        std::thread::spawn(move || {
            if unsafe { WaitForSingleObject(event as _, INFINITE) } == 0 {
                f();
            }
        });
    }

    /// Ask the one running to quit, and wait until it is gone. Nothing running: nothing to wait for.
    pub fn quit_running() {
        let event = unsafe { OpenEventW(EVENT_MODIFY_STATE, 0, wide(QUIT_EVENT).as_ptr()) };
        if event.is_null() {
            return;
        }
        let mutex = unsafe { OpenMutexW(SYNCHRONIZATION_SYNCHRONIZE, 0, wide(MUTEX).as_ptr()) };
        unsafe { SetEvent(event) };
        if !mutex.is_null() {
            // Owned by the one running: free (abandoned) once it has ended.
            unsafe { WaitForSingleObject(mutex, QUIT_WAIT_MS) };
        }
    }

    pub fn alert(text: &str) {
        let (text, title) = (wide(text), wide("SimonSays"));
        unsafe { MessageBoxW(std::ptr::null_mut(), text.as_ptr(), title.as_ptr(), MB_OK | MB_ICONERROR) };
    }

    pub fn no_window(cmd: &mut Command) {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    /// The launcher and the server under it, by force: what a stop that never came leaves.
    pub fn kill_tree(child: &mut Child) {
        let mut cmd = Command::new("taskkill");
        cmd.args(["/pid", &child.id().to_string(), "/T", "/F"]);
        no_window(&mut cmd);
        let _ = cmd.status();
        let _ = child.wait();
    }

    /// A web address in the default browser, or a folder in Explorer.
    pub fn open(target: &str) {
        let _ = Command::new("explorer").arg(target).spawn();
    }

    pub fn icon() -> tray_icon::Icon {
        tray_icon::Icon::from_resource(1, None).expect("the icon is built into the program")
    }

    pub fn autostart() -> bool {
        RegKey::predef(HKEY_CURRENT_USER)
            .open_subkey_with_flags(RUN, KEY_READ)
            .and_then(|k| k.get_value::<String, _>(RUN_NAME))
            .is_ok()
    }

    /// Started at sign-in, in the background: this program, from where it is now.
    pub fn set_autostart(on: bool) -> bool {
        let Ok(key) = RegKey::predef(HKEY_CURRENT_USER).open_subkey_with_flags(RUN, KEY_SET_VALUE) else { return false };
        if on {
            let Ok(exe) = std::env::current_exe() else { return false };
            key.set_value(RUN_NAME, &format!("\"{}\" --background", exe.display())).is_ok()
        } else {
            key.delete_value(RUN_NAME).is_ok() || !autostart()
        }
    }
}

#[cfg(not(windows))]
mod os {
    use std::path::PathBuf;
    use std::process::{Child, Command};

    pub fn user_data_dir() -> PathBuf {
        let home = PathBuf::from(std::env::var_os("HOME").unwrap_or_default());
        if cfg!(target_os = "macos") {
            home.join("Library").join("Application Support").join("SimonSays")
        } else {
            std::env::var_os("XDG_DATA_HOME").map(PathBuf::from).unwrap_or_else(|| home.join(".local").join("share")).join("simonsays")
        }
    }
    pub fn spanish() -> bool {
        std::env::var("LANG").map(|l| l.starts_with("es")).unwrap_or(false)
    }
    pub fn only_one() -> bool {
        true
    }
    pub fn listen_for_quit(_f: impl Fn() + Send + 'static) {}
    pub fn quit_running() {}
    pub fn alert(text: &str) {
        eprintln!("{text}");
    }
    pub fn no_window(_cmd: &mut Command) {}
    pub fn kill_tree(child: &mut Child) {
        let _ = child.kill();
        let _ = child.wait();
    }
    pub fn open(target: &str) {
        let _ = Command::new(if cfg!(target_os = "macos") { "open" } else { "xdg-open" }).arg(target).spawn();
    }
    pub fn icon() -> tray_icon::Icon {
        tray_icon::Icon::from_rgba(vec![0xf4, 0x3f, 0x5e, 0xff].repeat(32 * 32), 32, 32).expect("a plain icon")
    }
    pub fn autostart() -> bool {
        false
    }
    pub fn set_autostart(_on: bool) -> bool {
        false
    }
}
