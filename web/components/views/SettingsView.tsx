
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
*/
import React, { useRef } from 'react';
import { Language, ThemeConfig, ThemeId } from '../../types';
import { THEMES } from '../../constants';
import { Palette, Sun, Moon, Check, Languages, Globe, Save, Upload, Download, Database, Info, RefreshCw } from 'lucide-react';
import { Button } from '../Button';
import { VERSION } from '../../../shared/version.js';
import { fill } from '../../words';

interface SettingsViewProps {
  activeTheme: ThemeConfig;
  activeThemeId: ThemeId;
  setActiveThemeId: (id: ThemeId) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  exportConfig: () => Promise<any>;
  importConfig: (bundle: any) => Promise<any>;
  /** The server's version, once it has said; this page's own is VERSION. */
  serverVersion?: string;
  t: any;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ 
  activeTheme, 
  activeThemeId, 
  setActiveThemeId, 
  language,
  setLanguage,
  exportConfig,
  importConfig,
  serverVersion,
  t
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = React.useState<'export' | 'import' | null>(null);
  const [note, setNote] = React.useState<string>('');

  /**
   * The device-local half of a backup.
   *
   * Everything else — commands, actions, alerts, levels — belongs to the
   * server and is fetched from it. These are the per-browser display choices,
   * which is all V2 ever had and all the old export ever captured.
   */
  const DEVICE_KEYS = [
    'app_theme', 'app_lang',
    'chat_theme', 'chat_dock_bg', 'chat_show_avatars', 'chat_show_platform_icons',
    'chat_color_username', 'chat_show_events', 'chat_event_platforms',
    'chat_highlight_ranks', 'chat_rank_badges', 'chat_sender_role',
    'twitch_client_id',
  ];

  const readDeviceKeys = () => {
    const out: Record<string, any> = {};
    for (const key of DEVICE_KEYS) {
      const item = localStorage.getItem(key);
      if (item === null) continue;
      try { out[key] = JSON.parse(item); } catch { out[key] = item; }
    }
    return out;
  };

  const handleExport = async () => {
    setBusy('export');
    setNote('');
    try {
      const bundle: any = await exportConfig();
      bundle.device = readDeviceKeys();

      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `simon-says-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      const count = Object.keys(bundle.collections || {}).length;
      const stripped = bundle.meta?.stripped?.length ?? 0;
      setNote(`${t.exportDone || 'Saved'}: ${count} ${t.exportCollections || 'collections'}`
        + (stripped ? ` — ${t.exportSecretsNote || 'sign-ins are not included; connect again on the new machine'}` : ''));
    } catch (err: any) {
      setNote(`${t.exportFailed || 'Export failed'}: ${err?.message || err}`);
    } finally {
      setBusy(null);
    }
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (event.target) event.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      setBusy('import');
      setNote('');
      try {
        const bundle = JSON.parse(String(e.target?.result ?? ''));
        if (!bundle?.meta || bundle.meta.app !== 'SimonSays') {
          setNote(t.importNotOurs || 'That is not a SimonSays backup file.');
          return;
        }
        if (!window.confirm(t.importConfirm)) return;

        // The server first: it owns the part worth restoring, and it refuses
        // the request outright if this browser is not on the same machine.
        const summary: any = await importConfig(bundle);

        // Then this device's own preferences, if the file carries them.
        for (const [key, value] of Object.entries(bundle.device || {})) {
          localStorage.setItem(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
        }

        const n = summary?.restored?.length ?? 0;
        setNote(`${t.importDone || 'Restored'} ${n} ${t.exportCollections || 'collections'} — ${t.importReloading || 'reloading'}…`);
        setTimeout(() => window.location.reload(), 1200);
      } catch (err: any) {
        setNote(`${t.importFailed || 'Import failed'}: ${err?.message || err}`);
      } finally {
        setBusy(null);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="animate-fade-in space-y-12">
      
      
      {/* Theme Section */}
      <section className={`glass-panel p-6 sm:p-8 rounded-[40px] border ${activeTheme.borderClass} ${activeTheme.panelClass}`}>
        <div className="flex items-center gap-3 mb-8">
          <Palette className="text-current-accent" />
          <h3 className="text-xl font-extrabold uppercase tracking-tight">{t.visualTheme}</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {THEMES.map(tTheme => (
            <button key={tTheme.id} onClick={() => setActiveThemeId(tTheme.id)} className={`group relative p-6 rounded-3xl border transition-all duration-300 flex flex-col items-start text-left ${activeThemeId === tTheme.id ? `border-current-accent ${tTheme.id === 'light' ? 'bg-zinc-50' : 'bg-zinc-800/40'}` : `border-transparent ${tTheme.id === 'light' ? 'bg-zinc-100/50 hover:bg-zinc-100' : 'bg-zinc-900 hover:bg-zinc-800'}`}`}>
              <div className="flex items-center justify-between w-full mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: tTheme.primary }}>
                  {tTheme.isLight ? <Sun className="text-white" size={20} /> : <Moon className="text-white" size={20} />}
                </div>
                {activeThemeId === tTheme.id && <div className="bg-current-accent text-white rounded-full p-1"><Check size={14} strokeWidth={3} /></div>}
              </div>
              <h4 className={`font-extrabold uppercase tracking-tight mb-1 ${tTheme.id === 'light' ? 'text-zinc-900' : 'text-zinc-100'}`}>{tTheme.name}</h4>
            </button>
          ))}
        </div>
      </section>
      
      {/* Language Section */}
      <section className={`glass-panel p-6 sm:p-8 rounded-[40px] border ${activeTheme.borderClass} ${activeTheme.panelClass}`}>
        <div className="flex items-center gap-3 mb-8">
          <Languages className="text-current-accent" />
          <h3 className="text-xl font-extrabold uppercase tracking-tight">{t.language}</h3>
        </div>
        <div className="flex flex-wrap gap-4">
          {(['en', 'es'] as Language[]).map(lang => (
            <button key={lang} onClick={() => setLanguage(lang)} className={`px-8 py-4 rounded-3xl border transition-all duration-300 flex items-center gap-3 font-extrabold uppercase tracking-widest flex-1 sm:flex-none ${language === lang ? `border-current-accent ${activeTheme.id === 'light' ? 'bg-zinc-50' : 'bg-zinc-800/40'} text-current-accent` : `border-transparent ${activeTheme.id === 'light' ? 'bg-zinc-100/50 hover:bg-zinc-100' : 'bg-zinc-900 hover:bg-zinc-800'} text-zinc-500`}`}>
              <Globe size={18} /> {lang === 'en' ? 'English' : 'Español'} {language === lang && <Check size={14} strokeWidth={3} className="ml-1" />}
            </button>
          ))}
        </div>
      </section>

      {/* NEW: Data Management Section */}
      <section className={`glass-panel p-6 sm:p-8 rounded-[40px] border ${activeTheme.borderClass} ${activeTheme.panelClass}`}>
        <div className="flex items-center gap-3 mb-8">
          <Database className="text-current-accent" />
          <h3 className="text-xl font-extrabold uppercase tracking-tight">{t.dataManagement || 'Data Management'}</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Export Card */}
            <div className={`p-6 rounded-3xl border ${activeTheme.id === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/50 border-zinc-800'} flex flex-col justify-between h-full`}>
                <div className="mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-4">
                        <Download size={24} />
                    </div>
                    <h4 className={`font-bold text-lg mb-1 ${activeTheme.id === 'light' ? 'text-zinc-900' : 'text-white'}`}>{t.exportConfig || 'Export Configuration'}</h4>
                    <p className="text-xs text-zinc-500">{t.exportDesc || 'Save a backup of your settings to a JSON file.'}</p>
                </div>
                <Button onClick={handleExport} disabled={busy !== null} className="w-full bg-indigo-500 hover:bg-indigo-600 border-none text-white">
                    {t.exportConfig || 'Export Configuration'}
                </Button>
            </div>

            {/* Import Card */}
            <div className={`p-6 rounded-3xl border ${activeTheme.id === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/50 border-zinc-800'} flex flex-col justify-between h-full`}>
                <div className="mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4">
                        <Upload size={24} />
                    </div>
                    <h4 className={`font-bold text-lg mb-1 ${activeTheme.id === 'light' ? 'text-zinc-900' : 'text-white'}`}>{t.importConfig || 'Import Configuration'}</h4>
                    <p className="text-xs text-zinc-500">{t.importDesc || 'Restore settings from a previously exported JSON file.'}</p>
                </div>
                <input 
                    type="file" 
                    accept=".json" 
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    onChange={handleFileChange}
                />
                <Button variant="outline" onClick={handleImportClick} disabled={busy !== null} className="w-full border-zinc-700 hover:bg-zinc-800">
                    {t.importConfig || 'Import Configuration'}
                </Button>
            </div>
        </div>

        {note && (
          <p className="mt-6 text-xs font-bold text-zinc-400 bg-zinc-900/60 border border-zinc-800 rounded-2xl px-4 py-3">{note}</p>
        )}

        <p className="mt-4 text-[10px] text-zinc-600 leading-relaxed">{t.backupScopeNote}</p>
      </section>

      {/*
        Which version this is. The page and the server are one version
        unless the page was opened before an update and never reloaded —
        then it says so, since an older page can miss what the server sends.
      */}
      <section className={`glass-panel p-6 sm:p-8 rounded-[40px] border ${activeTheme.borderClass} ${activeTheme.panelClass}`} data-settings-about>
        <div className="flex items-center gap-3 mb-6">
          <Info className="text-current-accent" />
          <h3 className="text-xl font-extrabold uppercase tracking-tight">{t.aboutApp || 'About'}</h3>
        </div>
        <p className={`text-2xl font-black tracking-tight ${activeTheme.id === 'light' ? 'text-zinc-900' : 'text-white'}`}>
          SimonSays <span className="text-current-accent" data-app-version={VERSION}>{fill(t.versionLine || 'Version {version}', { version: VERSION })}</span>
        </p>
        {serverVersion && serverVersion !== VERSION ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3" data-version-mismatch={serverVersion}>
            <p className="text-xs text-amber-200 flex-1 min-w-[12rem]">{fill(t.versionMismatch || 'This page is version {page}, but the server is {server}: reload the page to use the server’s.', { page: VERSION, server: serverVersion })}</p>
            <Button size="sm" onClick={() => window.location.reload()} icon={<RefreshCw size={14} />}>{t.versionReload || 'Reload'}</Button>
          </div>
        ) : serverVersion ? (
          <p className="mt-2 text-xs text-zinc-500" data-version-same>{t.versionSame || 'The server runs this same version.'}</p>
        ) : null}
      </section>
    </div>
  );
};
