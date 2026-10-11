/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The Roadmap: every update so far and the major ones ahead, as a tree — a
 * big branch per major version, a smaller one per minor version along it,
 * and its patches as twigs. It is the changelog too: tap a version for what
 * it changed.
 *
 * Read from CHANGELOG.md as this copy was built with it, so it is always
 * this copy's own history (the public edition's for the public edition),
 * and from shared/roadmap.js for what is planned. A newer release this copy
 * could update to comes from the updater (server/engine/updater.js).
 */
import React, { useMemo, useState } from 'react';
import { GitBranch, ChevronDown, Download, Sparkles } from 'lucide-react';
import changelog from '../../../CHANGELOG.md?raw';
import { roadmapTree, notesFromMarkdown } from '../../../shared/roadmap.js';
import { VERSION } from '../../../shared/version.js';
import { ThemeConfig } from '../../types';
import { fill } from '../../words';

type Status = 'released' | 'current' | 'in-progress' | 'available' | 'planned';
interface Node { version: string; date?: string; notes: string[]; status: Status }
interface Minor { minor: string; version: string; node: Node | null; patches: Node[] }
interface Major { major: number; version: string; name: string; summary?: string; goals?: string[]; status: Status; since: string; minors: Minor[] }

interface Props {
  t: any;
  activeTheme: ThemeConfig;
  language: string;
  /** The updater's state (Settings → About), for a newer release this copy can update to. */
  updates?: { available?: boolean; latest?: { version: string; notes?: string; publishedAt?: string } | null } | null;
  /** To Settings → About, where the update button is. */
  openUpdates?: () => void;
}

/** A changelog line's own marks: `code` and **bold**, nothing else. */
const Line = ({ text }: { text: string }) => (
  <>
    {text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) => (
      part.startsWith('`') ? <code key={i} className="px-1 rounded bg-zinc-800 text-[0.95em] text-zinc-200">{part.slice(1, -1)}</code>
        : part.startsWith('**') ? <strong key={i} className="text-zinc-200">{part.slice(2, -2)}</strong>
          : <React.Fragment key={i}>{part}</React.Fragment>
    ))}
  </>
);

const dot: Record<Status, string> = {
  current: 'bg-current-accent border-current-accent shadow-[0_0_0_4px_rgba(255,255,255,0.08)]',
  'in-progress': 'bg-amber-400 border-amber-300 animate-pulse',
  available: 'bg-emerald-400 border-emerald-300',
  released: 'bg-zinc-500 border-zinc-400',
  planned: 'bg-transparent border-zinc-600 border-dashed',
};

export const RoadmapView: React.FC<Props> = ({ t, activeTheme, language, updates, openUpdates }) => {
  const light = activeTheme.id === 'light';
  const heading = light ? 'text-zinc-900' : 'text-white';
  const available = updates?.available && updates.latest
    ? { version: updates.latest.version, date: (updates.latest.publishedAt || '').slice(0, 10), notes: notesFromMarkdown(updates.latest.notes) }
    : null;
  const tree: Major[] = useMemo(() => roadmapTree(changelog, { current: VERSION, available }) as Major[], [available?.version]);

  // Open to begin with: whatever is news — this version, what is in progress, an update to have.
  const lively = (n?: Node | null) => Boolean(n && n.status !== 'released' && n.status !== 'planned');
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    for (const m of tree) {
      o[`major-${m.major}`] = m.status !== 'released';
      for (const mi of m.minors) for (const n of [mi.node, ...mi.patches]) if (lively(n)) o[n!.version] = true;
    }
    return o;
  });
  const toggle = (key: string) => setOpen((o) => ({ ...o, [key]: !o[key] }));
  const isOpen = (key: string) => Boolean(open[key]);

  const pillWords: Record<Status, string> = {
    current: t.roadmapHere || "You're here",
    'in-progress': t.roadmapInProgress || 'In progress',
    available: t.roadmapAvailable || 'Update available',
    released: t.roadmapReleased || 'Released',
    planned: t.roadmapPlanned || 'Planned',
  };
  const pill = (s: Status) => (s === 'released' ? null : (
    <span
      className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
        s === 'current' ? 'bg-current-accent text-white'
          : s === 'in-progress' ? 'bg-amber-500/15 text-amber-300'
            : s === 'available' ? 'bg-emerald-500/15 text-emerald-300'
              : 'bg-zinc-800 text-zinc-400'
      }`}
      data-roadmap-pill={s}
    >
      {pillWords[s]}
    </span>
  ));
  const when = (d?: string) => {
    if (!d) return '';
    const date = new Date(`${d}T12:00:00`);
    return Number.isNaN(date.getTime()) ? d : date.toLocaleDateString(language, { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const notes = (n: Node) => (
    <ul className="mt-2 space-y-1.5 text-xs text-zinc-400 leading-relaxed list-disc pl-4" data-roadmap-notes={n.version}>
      {n.notes.length ? n.notes.map((line, i) => <li key={i}><Line text={line} /></li>) : <li className="list-none -ml-4 text-zinc-600">{t.roadmapNoNotes || 'Nothing written for this one yet.'}</li>}
    </ul>
  );

  /** One version on its branch: its dot, its number and date, and what it changed when opened. */
  const version = (n: Node, size: 'minor' | 'patch') => (
    <div className="relative" data-roadmap-version={n.version} data-roadmap-status={n.status}>
      <span className={`absolute rounded-full border-2 ${dot[n.status]} ${size === 'minor' ? '-left-[42px] top-0.5 w-4 h-4' : '-left-[26px] top-[3px] w-2.5 h-2.5'}`} />
      <button onClick={() => toggle(n.version)} className="w-full flex flex-wrap items-center gap-x-2 gap-y-1 text-left group" aria-expanded={isOpen(n.version)}>
        <span className={`font-black tracking-tight ${size === 'minor' ? `text-sm ${heading}` : 'text-xs text-zinc-300'}`}>{n.version}</span>
        {n.date && <span className="text-[10px] text-zinc-500">{when(n.date)}</span>}
        {pill(n.status)}
        <span className="text-[10px] text-zinc-600 group-hover:text-zinc-400">{fill(t.roadmapChanges || '{n} changes', { n: String(n.notes.length) })}</span>
        <ChevronDown size={12} className={`text-zinc-600 transition-transform ${isOpen(n.version) ? '' : '-rotate-90'}`} />
      </button>
      {isOpen(n.version) && notes(n)}
      {n.status === 'available' && openUpdates && (
        <button onClick={openUpdates} className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25" data-roadmap-update>
          <Download size={12} /> {t.roadmapUpdate || 'Go to Updates'}
        </button>
      )}
    </div>
  );

  return (
    <div className="animate-fade-in space-y-6 pb-20 max-w-4xl" data-roadmap>
      <section className={`glass-panel p-6 sm:p-8 rounded-[40px] border ${activeTheme.borderClass} ${activeTheme.panelClass}`}>
        <div className="flex items-center gap-3 mb-3">
          <GitBranch className="text-current-accent" />
          <h3 className={`text-xl font-extrabold uppercase tracking-tight ${heading}`}>{t.roadmapNav || 'Roadmap'}</h3>
        </div>
        <p className="text-xs text-zinc-500 leading-relaxed max-w-2xl">
          {t.roadmapIntro || 'Every update so far and the big ones ahead. Each major version is a branch of its own, its minor versions grow along it, and their patches are the twigs. Tap a version to see what it changed.'}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4" data-roadmap-legend>
          {(['current', 'in-progress', 'available', 'released', 'planned'] as Status[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5 text-[10px] text-zinc-500">
              <span className={`w-2.5 h-2.5 rounded-full border-2 ${dot[s]}`} /> {pillWords[s]}
            </span>
          ))}
        </div>
        {language !== 'en' && <p className="mt-3 text-[10px] text-zinc-600">{t.roadmapNotesEnglish || 'Release notes are in English.'}</p>}
      </section>

      <section className={`glass-panel p-6 sm:p-8 rounded-[40px] border ${activeTheme.borderClass} ${activeTheme.panelClass}`} data-roadmap-tree>
        {tree.map((m, i) => {
          const planned = m.status === 'planned';
          const key = `major-${m.major}`;
          return (
            <div key={m.major} className={i ? 'pt-2' : ''} data-roadmap-major={m.major} data-roadmap-major-status={m.status}>
              {/* The big branch: its version, its name, where it stands. */}
              <button onClick={() => toggle(key)} className="w-full flex items-center gap-4 text-left" aria-expanded={isOpen(key)}>
                <span className={`shrink-0 w-10 h-10 rounded-full border-4 flex items-center justify-center ${dot[m.status]}`}>
                  {planned && <Sparkles size={14} className="text-zinc-500" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-lg font-black tracking-tight ${planned ? 'text-zinc-400' : heading}`}>
                    {m.name || `${m.major}.x`}
                  </span>
                  <span className="flex flex-wrap items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-mono text-zinc-500">{m.name ? m.version : `${m.major}.0.0 – ${m.major}.x`}</span>
                    {pill(m.status)}
                    {m.since && <span className="text-[10px] text-zinc-600">{fill(t.roadmapSince || 'Since {date}', { date: when(m.since) })}</span>}
                  </span>
                </span>
                <ChevronDown size={16} className={`shrink-0 text-zinc-600 transition-transform ${isOpen(key) ? '' : '-rotate-90'}`} />
              </button>

              {/* The trunk under it: solid where it has grown, dashed where it is still a plan. */}
              <div className={`ml-[18px] mt-2 pb-4 pl-8 border-l-4 ${planned ? 'border-dashed border-zinc-800' : 'border-zinc-700/70'}`}>
                {isOpen(key) && (planned ? (
                  <div className="py-1" data-roadmap-plan={m.version}>
                    {m.summary && <p className="text-xs text-zinc-400 leading-relaxed">{m.summary}</p>}
                    {m.goals?.length ? (
                      <ul className="mt-1 space-y-1 text-xs text-zinc-400 list-disc pl-4">{m.goals.map((g, k) => <li key={k}><Line text={g} /></li>)}</ul>
                    ) : !m.summary ? (
                      <p className="text-xs text-zinc-600">{t.roadmapToCome || 'What it brings will be added here as the plan takes shape.'}</p>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-5 py-1">
                    {m.minors.map((mi) => (
                      <div key={mi.minor} data-roadmap-minor={mi.minor}>
                        {mi.node
                          ? version(mi.node, 'minor')
                          : <span className={`text-sm font-black ${heading}`}>{mi.version}</span>}
                        {/* Its patches: twigs off the minor branch. */}
                        {mi.patches.length > 0 && (
                          <div className="mt-3 ml-1 pl-5 border-l-2 border-zinc-600/70 space-y-2.5" data-roadmap-patches={mi.minor}>
                            {mi.patches.map((p) => <React.Fragment key={p.version}>{version(p, 'patch')}</React.Fragment>)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
};
