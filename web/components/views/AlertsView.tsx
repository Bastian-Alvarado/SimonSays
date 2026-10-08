/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The alert builder.
 *
 * There was one before and it was deleted for being clunky: every control hid
 * behind a collapsible section, and you could not see what you were making
 * while you made it. This keeps the preview on screen at all times and puts the
 * controls in one column with headings instead of accordions — the arrangement
 * that worked for the overlay editor.
 *
 * The preview is the real `AlertOverlay`, the same component the browser source
 * mounts, so there is nothing to keep in sync. Sound is off in it: a preview
 * that re-renders on every keystroke would fire the sound on every keystroke.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDragOrder, DragGrip } from '../../hooks/useDragOrder';
import { moveToGap } from '../../../shared/list-order.js';
import { AlertConfig, AlertCondition, AlertType, AlertVariation, ThemeConfig } from '../../types';
import { AlertOverlay, ALERT_ANIMATIONS_IN, ALERT_ANIMATIONS_OUT } from '../AlertOverlay';
import { StylesheetPanel } from '../StylesheetPanel';
import { AutoColourRow } from '../AutoSwatch';
import { VariablePicker } from '../VariablePicker';
import { Button } from '../Button';
import { refusalWords, fill } from '../../words';
import { says } from '../../../shared/platforms.js';
import { sampleEvent } from '../../../shared/alert-samples.js';
import {
  Bell, Plus, Trash2, Play, Pause, SkipForward, Eye, EyeOff, Upload, Volume2, VolumeX, Image as ImageIcon, Check, ArrowUp, ArrowDown, MessageSquareText,
} from 'lucide-react';

/**
 * The events an alert can be bound to.
 *
 * Mirrors ALERT_TYPES on the server, which the smoke suite checks — an alert
 * saved for a type this list does not offer is one nobody could edit again.
 */
const TYPE_GROUPS: { group: string; types: { type: AlertType; label: string; sample: string }[] }[] = [
  {
    /*
      First, because it is usually the right answer: one alert that answers
      wherever the thing happened, with {words.*} saying whichever platform's
      word belongs in the sentence. The per-platform groups below are for when
      you genuinely want them to differ.
    */
    group: 'Any platform',
    /*
      Each sample is the caption a new alert starts with, so it is in
      Spanish, like everything else on stream. The labels are the screen's
      and come in its language (typeLabel); the English here is the fallback.
    */
    types: [
      { type: 'follow', label: 'New follower or subscriber', sample: '¡{user} ya es {words.follower}!' },
      { type: 'sub', label: 'Paid support', sample: '¡{user} ya es {words.supporter}!' },
      { type: 'sub_gift_bulk', label: 'Gift bundle', sample: '¡{user} regaló {event.count}!' },
      { type: 'cheer', label: 'Tip', sample: '¡{user} envió {words.tip}!' },
      { type: 'raid', label: 'Raid', sample: '¡Raid de {user} con {event.viewers} espectadores!' },
    ],
  },
  {
    group: 'Twitch',
    types: [
      { type: 'twitch_follow', label: 'Follow', sample: '¡Gracias por el follow, {user}!' },
      { type: 'twitch_sub', label: 'Subscription', sample: '¡{user} se suscribió con nivel {event.tier}!' },
      { type: 'twitch_sub_gift_bulk', label: 'Gift bundle', sample: '¡{user} regaló {event.count} subs!' },
      { type: 'twitch_cheer', label: 'Cheer', sample: '¡{user} envió {event.bits} bits!' },
      { type: 'twitch_raid', label: 'Raid', sample: '¡Raid de {user} con {event.viewers} espectadores!' },
      { type: 'twitch_redemption', label: 'Channel points', sample: '¡{user} canjeó {event.reward}!' },
    ],
  },
  {
    group: 'YouTube',
    types: [
      /*
        No subscriber alert. YouTube's API raises no event when somebody
        subscribes for free and never says whether a chatter is one, so the
        alert could be made and would never fire.
      */
      { type: 'youtube_sub', label: 'Member', sample: '¡{user} ahora es miembro!' },
      { type: 'youtube_sub_gift_bulk', label: 'Gift memberships', sample: '¡{user} regaló {event.count} membresías!' },
      { type: 'youtube_cheer', label: 'Super Chat', sample: '¡{user} envió un Super Chat de {event.amount}!' },
    ],
  },
  {
    group: 'TikTok',
    types: [
      { type: 'tiktok_follow', label: 'Follow', sample: '¡Gracias por seguir, {user}!' },
      { type: 'tiktok_sub', label: 'Subscription', sample: '¡{user} se suscribió!' },
      { type: 'tiktok_gift', label: 'Gift', sample: '¡{user} envió {event.giftName} x{event.count}!' },
      { type: 'tiktok_share', label: 'Share', sample: '¡{user} compartió el directo!' },
    ],
  },
  {
    group: 'Discord',
    types: [
      { type: 'discord_join', label: 'Joined the Discord', sample: '¡{user} se unió al Discord!' },
      { type: 'discord_boost', label: 'Boosted the Discord', sample: '¡{user} mejoró el servidor de Discord!' },
    ],
  },
  {
    group: 'Levels',
    types: [
      { type: 'level_up', label: 'Levelled up', sample: '¡{user} subió al nivel {event.level}!' },
      { type: 'giveaway_winner', label: 'Won the giveaway', sample: '¡{user} ganó {event.prize}!' },
      { type: 'points_redeem', label: 'Spent points in the shop', sample: '{user} canjeó {event.item}' },
    ],
  },
  {
    group: 'Stream',
    types: [
      { type: 'obs_stream_started', label: 'Stream started', sample: '¡Estamos en directo!' },
      { type: 'obs_stream_stopped', label: 'Stream stopped', sample: '¡Eso es todo por hoy!' },
      { type: 'obs_scene_changed', label: 'Scene changed', sample: 'Cambiando de escena…' },
      { type: 'spotify_track_change', label: 'Track changed', sample: 'Suena {spotify.track}' },
    ],
  },
];

const ALL_TYPES = TYPE_GROUPS.flatMap((g) => g.types);
const typeInfo = (t: string) => ALL_TYPES.find((x) => x.type === t);

/** "twitch_sub_gift_bulk" or "Any platform" as the end of a words key: TwitchSubGiftBulk, AnyPlatform. */
const keyPart = (s: string) => s.split(/[_ ]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
/** An event's name in the screen's language (t.alertType…), or the English above. */
const typeLabel = (t: any, type: string) => t?.[`alertType${keyPart(type)}`] || typeInfo(type)?.label || type;
/** Which group an event is listed under. */
const typeGroup = (type: string) => TYPE_GROUPS.find((g) => g.types.some((x) => x.type === type))?.group;
/** A group's heading the same way; the platforms' own names need no words. */
const groupLabel = (t: any, group: string) => t?.[`alertGroup${keyPart(group)}`] || group;

const LAYOUTS: { value: AlertConfig['layout']; label: string; key: string }[] = [
  { value: 'image-above', label: 'Above', key: 'alertsLayoutAbove' },
  { value: 'image-left', label: 'Left', key: 'alertsLayoutLeft' },
  { value: 'image-right', label: 'Right', key: 'alertsLayoutRight' },
  { value: 'image-cover', label: 'Behind', key: 'alertsLayoutBehind' },
];

/** The entrances' and exits' names in the screen's language; AlertOverlay's own labels are the English. */
const ANIMATION_KEYS: Record<string, string> = {
  'animate-pop-in': 'alertsAnimPop',
  'animate-fade-in': 'alertsAnimFade',
  'animate-zoom-in': 'alertsAnimZoom',
  'animate-slide-up': 'alertsAnimSlideUp',
  'animate-slide-down': 'alertsAnimSlideDown',
  'animate-fade-out': 'alertsAnimFade',
  'animate-pop-out': 'alertsAnimShrink',
  'animate-slide-out-up': 'alertsAnimSlideUp',
};

const FONTS = ['Montserrat', 'Inter', 'JetBrains Mono', 'Creepster', 'VT323', 'Impact', 'Georgia'];

/**
 * The numbers a variation can test, and which events carry them.
 *
 * Mirrors CONDITION_FIELDS on the server, which the smoke suite checks — a
 * condition the editor offers but the server drops is one that silently never
 * fires.
 */
const CONDITION_FIELDS: { field: AlertCondition['field']; label: string; types: string[] }[] = [
  { field: 'bits', label: 'Bits', types: ['twitch_cheer', 'cheer'] },
  { field: 'value', label: 'Money', types: ['youtube_cheer', 'cheer'] },
  { field: 'tier', label: 'Tier', types: ['twitch_sub', 'sub'] },
  { field: 'months', label: 'Months subbed', types: ['twitch_sub', 'youtube_sub', 'sub'] },
  { field: 'viewers', label: 'Viewers', types: ['twitch_raid', 'raid'] },
  { field: 'cost', label: 'Point cost', types: ['twitch_redemption', 'points_redeem'] },
  { field: 'count', label: 'Gift count', types: ['tiktok_gift', 'twitch_sub_gift_bulk', 'youtube_sub_gift_bulk', 'sub_gift_bulk', 'gift'] },
  { field: 'diamonds', label: 'Diamonds', types: ['tiktok_gift', 'gift'] },
  { field: 'amount', label: 'Amount', types: ['twitch_cheer', 'twitch_raid'] },
  { field: 'level', label: 'Level', types: ['level_up'] },
];

const OP_LABEL: Record<AlertCondition['op'], string> = { gte: '≥', lte: '≤', eq: '=' };
/**
 * Parts inside an alert that a stylesheet may name.
 *
 * Only what the renderer promises to keep. The body is the same name in both
 * arrangements — the one where the caption sits over the picture and the one
 * where it sits beside it — so a look written for one still means something
 * when the layout is changed.
 *
 * The caption is two things: the words you typed, and the name that changed.
 * They are named apart so a look can treat them differently, which is the
 * first thing anybody wants to do with them.
 */
const ALERT_PARTS = [
  '[data-alert="body"]',
  '[data-alert="media"]',
  '[data-alert="caption"]',
  '[data-alert="message"]',
  '[data-alert="name"]',
];

/** A condition's number by name, in the screen's language (t.alertsField…), or the English above. */
const fieldLabel = (t: any, f: string) => t?.[`alertsField${keyPart(f)}`] || CONDITION_FIELDS.find((x) => x.field === f)?.label || f;


/** The stand-in viewer in the preview. Awkward on purpose: accents and an
 *  underscore show whether the font and the accent colour hold up. */
const SAMPLE_USER = 'Ünïcödé_Näme';

/** A field label. Plain, repeated a lot, not worth a component each time. */
const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="block text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">{children}</span>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="border-t border-zinc-800 pt-5 mt-5 first:border-0 first:pt-0 first:mt-0">
    <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-4">{title}</h3>
    {children}
  </div>
);

interface AlertsViewProps {
  alerts: AlertConfig[];
  saveAlert: (a: AlertConfig) => void;
  deleteAlert: (id: string) => void;
  /** Fires it on stream; with a variation's id, that variation at its numbers. */
  testAlert: (id: string, variationId?: string) => void;
  /** The server's side of the line: paused, how many wait, and whether alerts nothing shows are held. */
  alertGate?: { paused: boolean; held: number; holdUnseen: boolean };
  /** Skip, pause, resume, clear, or hold (true/false). Answers, or refuses. */
  alertControl?: (op: string, value?: any) => Promise<any>;
  /** Uploaded media, so an alert can pick an image or sound already on the server. */
  assets?: { name: string; url: string }[];
  uploadAsset?: (file: File) => Promise<any>;
  refreshAssets?: () => void;
  /** The channel's own rewards, so a redemption alert names one rather than a UUID. */
  rewards?: { id: string; title: string }[];
  fetchRewards?: () => void;
  activeTheme: ThemeConfig;
  t: any;
}

export const AlertsView: React.FC<AlertsViewProps> = ({
  alerts, saveAlert, deleteAlert, testAlert, alertGate, alertControl, assets = [], uploadAsset, refreshAssets,
  rewards = [], fetchRewards, activeTheme, t,
}) => {
  // What the last press of Skip, Pause or Clear said, when it refused (nothing on screen to skip).
  const [controlNote, setControlNote] = useState('');
  const control = async (op: string, value?: any) => {
    setControlNote('');
    try {
      await alertControl?.(op, value);
    } catch (err: any) {
      setControlNote(refusalWords(t, err) || String(err?.message || err));
    }
  };
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AlertConfig | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [uploading, setUploading] = useState<'image' | 'sound' | 'variation-image' | 'variation-sound' | null>(null);
  // Why the last upload failed, under the box it was for: the alert's, or a variation's.
  const [uploadError, setUploadError] = useState<{ kind: 'image' | 'sound' | 'variation'; id?: string; text: string } | null>(null);
  // One file box for every variation: which one, and picture or sound, is set as it opens.
  const variationInput = useRef<HTMLInputElement | null>(null);
  const variationUploadFor = useRef<{ id: string; kind: 'image' | 'sound' } | null>(null);
  const [editingVariation, setEditingVariation] = useState<string | null>(null);
  const [previewVariation, setPreviewVariation] = useState<string | null>(null);
  // This browser's voices, to choose the one alerts are read in.
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (!window.speechSynthesis) return undefined;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);
  const imageInput = useRef<HTMLInputElement | null>(null);
  const soundInput = useRef<HTMLInputElement | null>(null);

  const saved = alerts.find((a) => a.id === selectedId) || alerts[0] || null;

  // Adopt the server's copy when the selection changes, but never while there
  // are unsaved edits in the box — a config patch would wipe them mid-sentence.
  const dirty = useRef(false);
  useEffect(() => {
    if (dirty.current) return;
    setDraft(saved ? { ...saved } : null);
  }, [saved]);

  /** Edit the draft and save it. The server is the only copy that matters. */
  const patch = (p: Partial<AlertConfig>) => {
    setDraft((d) => {
      if (!d) return d;
      const next = { ...d, ...p };
      dirty.current = true;
      saveAlert(next);
      // Re-key the preview so an animation change is visible immediately
      // rather than only on the next real alert.
      // A motion edit only shows on a fresh mount, the same as a change of
      // entrance — so the preview is re-keyed for those too.
      if (p.animationIn || p.animationOut || p.layout || p.css !== undefined || p.motionCss !== undefined) setPreviewKey((k) => k + 1);
      window.setTimeout(() => { dirty.current = false; }, 400);
      return next;
    });
  };

  const create = (type: AlertType) => {
    const info = typeInfo(type);
    const alert: AlertConfig = {
      id: Math.random().toString(36).slice(2, 11),
      // A name someone can recognise in a list, and a message that already
      // says the right thing for this event — the old builder created every
      // alert reading "{user} triggered an alert!" and named after the wrong
      // platform, so every one had to be rewritten before it was usable.
      name: fill(t.alertsDefaultName || '{type} alert', { type: typeLabel(t, type) }),
      type,
      enabled: true,
      layout: 'image-above',
      messageTemplate: info?.sample || '{user}',
      highlightText: true,
      // Automatic: the look's, or Montserrat, white and pink without one.
      fontFamily: '',
      fontSize: 32,
      textColor: '',
      accentColor: '',
      duration: 5000,
      animationIn: 'animate-pop-in',
      animationOut: 'animate-fade-out',
      soundVolume: 0.8,
    };
    saveAlert(alert);
    setSelectedId(alert.id);
  };

  // ------------------------------------------------------------ variations

  const variations = () => draft?.variations || [];

  const writeVariations = (next: AlertVariation[]) => patch({ variations: next });

  const addVariation = () => {
    const field = CONDITION_FIELDS.find((f) => f.types.includes(draft!.type))?.field || 'amount';
    writeVariations([...variations(), {
      id: Math.random().toString(36).slice(2, 11),
      name: fill(t.alertsVariationDefaultName || 'Big {type}', { type: typeLabel(t, draft!.type).toLowerCase() }),
      // Starts with a condition rather than empty: a variation with no
      // conditions always holds, which as a first row would silently shadow
      // every one added after it.
      conditions: [{ field: field as AlertCondition['field'], op: 'gte', value: 1000 }],
    }]);
  };

  const patchVariation = (id: string, p: Partial<AlertVariation>) => {
    writeVariations(variations().map((v) => (v.id === id ? { ...v, ...p } : v)));
  };

  const removeVariation = (id: string) => {
    writeVariations(variations().filter((v) => v.id !== id));
    if (editingVariation === id) setEditingVariation(null);
    if (previewVariation === id) setPreviewVariation(null);
  };

  /** Order is the rule, so moving a row is how you change which one wins. */
  const moveVariation = (id: string, delta: number) => {
    const list = [...variations()];
    const i = list.findIndex((v) => v.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    writeVariations(list);
  };
  const variationOrder = useDragOrder(({ from, gap }) => writeVariations(moveToGap(variations(), from, gap)));

  const addCondition = (id: string) => {
    const v = variations().find((x) => x.id === id);
    if (!v) return;
    const field = CONDITION_FIELDS.find((f) => f.types.includes(draft!.type))?.field || 'amount';
    patchVariation(id, { conditions: [...v.conditions, { field: field as AlertCondition['field'], op: 'gte', value: 1 }] });
  };

  const patchCondition = (id: string, index: number, p: Partial<AlertCondition>) => {
    const v = variations().find((x) => x.id === id);
    if (!v) return;
    patchVariation(id, { conditions: v.conditions.map((c, i) => (i === index ? { ...c, ...p } : c)) });
  };

  const removeCondition = (id: string, index: number) => {
    const v = variations().find((x) => x.id === id);
    if (!v) return;
    patchVariation(id, { conditions: v.conditions.filter((_, i) => i !== index) });
  };

  const onUpload = async (kind: 'image' | 'sound', file?: File | null) => {
    if (!file || !uploadAsset) return;
    setUploading(kind);
    setUploadError(null);
    try {
      const res = await uploadAsset(file);
      const url = res?.url || res?.path || '';
      if (url) patch(kind === 'image' ? { imageUrl: url } : { soundUrl: url });
      refreshAssets?.();
    } catch (err: any) {
      // Said, and why — too big, not a picture — rather than the button just going back to normal.
      setUploadError({ kind, text: refusalWords(t, err) || t.alertsUploadFailed || 'That file could not be uploaded.' });
    } finally {
      setUploading(null);
    }
  };

  /** A variation's own picture or sound, uploaded the same way. */
  const onVariationUpload = async (file?: File | null) => {
    const target = variationUploadFor.current;
    if (!file || !uploadAsset || !target) return;
    setUploading(`variation-${target.kind}`);
    setUploadError(null);
    try {
      const res = await uploadAsset(file);
      const url = res?.url || res?.path || '';
      if (url) patchVariation(target.id, target.kind === 'image' ? { imageUrl: url } : { soundUrl: url });
      refreshAssets?.();
    } catch (err: any) {
      setUploadError({ kind: 'variation', id: target.id, text: refusalWords(t, err) || t.alertsUploadFailed || 'That file could not be uploaded.' });
    } finally {
      setUploading(null);
      if (variationInput.current) variationInput.current.value = '';
    }
  };

  /**
   * What the preview renders.
   *
   * The server does the real interpolation against a live event. Here the
   * tokens are filled with plausible stand-ins instead of being left raw,
   * because a preview showing `{EVENT.BITS}` in the middle of a sentence tells
   * you nothing about whether the alert will look right — which is the only
   * question the preview exists to answer.
   */
  /*
    A caption with this alert's pretend event in it: the fields a real one
    carries (shared/alert-samples.js, the same "Fire on stream" sends), the
    platform's own words for {words.*}, and the same short names the server
    knows ({user}, {message}). Anything left is a field this event does not
    carry; it shows as a word, braces off, rather than as broken markup.
  */
  const fillPreview = useMemo(() => {
    const ev = sampleEvent(draft?.type || '', SAMPLE_USER);
    const said = ev.data.message ?? ev.data.input ?? (t.alertsReadSampleMessage || 'good luck tonight');
    const ctx: any = {
      user: { name: SAMPLE_USER, platform: ev.platform },
      platform: ev.platform,
      event: { type: ev.type, ...ev.data },
      message: { content: said, raw: said, args: said },
      input: said,
      words: Object.fromEntries(['follower', 'followers', 'followed', 'supporter', 'supporters', 'gift', 'tip'].map((k) => [k, says(ev.platform, k)])),
      spotify: { track: 'Blue Monday', artist: 'New Order' },
    };
    const SHORT: Record<string, string> = { user: 'user.name', username: 'user.name', message: 'message.content', args: 'message.args' };
    return (template: string, extra: Record<string, any> = {}) => String(template || '').replace(/[{]([a-zA-Z0-9_.-]+)[}]/g, (_m, key) => {
      const value = (SHORT[key] || key).split('.').reduce((at: any, k: string) => (at == null ? undefined : at[k]), { ...ctx, ...extra });
      return value === undefined || value === null || typeof value === 'object' ? key : String(value);
    });
  }, [draft?.type, t]);

  const previewAlert = useMemo(() => {
    if (!draft) return null;
    /*
      Previewing a variation applies it the same way the server does: only the
      fields it actually sets win, everything else comes from the alert. Kept
      deliberately trivial so the two copies of this merge cannot disagree —
      the smoke suite checks they still behave the same.
    */
    const chosen = draft.variations?.find((v) => v.id === previewVariation);
    const config = chosen
      ? Object.fromEntries([
        ...Object.entries(draft),
        ...Object.entries(chosen).filter(([k, val]) => (
          val !== undefined && !['id', 'name', 'conditions'].includes(k)
        )),
      ]) as AlertConfig
      : draft;
    const text = fillPreview(config.messageTemplate);
    return { id: `preview-${previewKey}-${previewVariation || 'base'}`, config, user: SAMPLE_USER, text };
  }, [draft, previewKey, previewVariation, fillPreview]);

  const heading = activeTheme.id === 'light' ? 'text-zinc-900' : 'text-zinc-100';
  const input = 'w-full bg-zinc-900/60 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-bold text-zinc-200 outline-none focus:border-current-accent';
  // The same box sized by whoever uses it: with w-full as well, a w-20 beside it loses and a row of three squeezes the first to nothing.
  const box = input.replace('w-full ', '');

  return (
    <div className="animate-fade-in space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-end gap-4">
        
      </div>

      {/*
        The line alerts wait in (engine/alert-gate.js): the one on screen
        skipped, new ones paused, and whether they wait while the scene on
        stream shows none. The deck has Skip and Pause as buttons too.
      */}
      {alertControl && (
        <div className="glass-panel rounded-3xl border border-zinc-800 p-5 flex flex-wrap items-center gap-2" data-alert-gate>
          <div className="flex items-center gap-2 mr-auto min-w-0">
            <span className={`w-2 h-2 rounded-full shrink-0 ${alertGate?.paused ? 'bg-amber-400' : 'bg-emerald-400'}`} />
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300" data-alert-gate-state>
              {alertGate?.paused ? (t.alertsPausedState || 'Alerts paused') : (t.alertsLiveState || 'Alerts are live')}
            </span>
            {Boolean(alertGate?.held) && (
              <span className="text-[10px] font-bold text-amber-400" data-alert-gate-held>
                {alertGate!.held === 1 ? (t.alertsWaitingOne || '1 waiting') : fill(t.alertsWaiting || '{n} waiting', { n: alertGate!.held })}
              </span>
            )}
          </div>
          <Button size="sm" variant="secondary" icon={<SkipForward size={13} />} onClick={() => control('skip')} title={t.alertsSkipHint || 'Ends the alert on screen now; the next one in line starts.'} data-alert-skip>
            {t.alertsSkip || 'Skip'}
          </Button>
          <Button
            size="sm"
            variant={alertGate?.paused ? 'primary' : 'secondary'}
            icon={alertGate?.paused ? <Play size={13} /> : <Pause size={13} />}
            onClick={() => control(alertGate?.paused ? 'resume' : 'pause')}
            title={alertGate?.paused ? (t.alertsResumeHint || 'Lets the waiting alerts out, in order.') : (t.alertsPauseHint || 'New alerts wait until you resume; the one on screen finishes.')}
            data-alert-pause
          >
            {alertGate?.paused ? (t.alertsResume || 'Resume') : (t.alertsPause || 'Pause')}
          </Button>
          {Boolean(alertGate?.held) && (
            <Button size="sm" variant="secondary" icon={<Trash2 size={13} />} onClick={() => control('clear')} data-alert-clear>
              {t.alertsClearWaiting || 'Drop the waiting ones'}
            </Button>
          )}
          <label className="w-full flex items-start gap-2 cursor-pointer pt-1" data-alert-hold>
            <input type="checkbox" checked={alertGate?.holdUnseen !== false} onChange={(e) => control('hold', e.target.checked)} className="accent-current-accent mt-0.5" />
            <span className="text-[10px] text-zinc-500 leading-snug">
              <span className="font-bold text-zinc-300">{t.alertsHold || 'Hold alerts while the scene on stream shows none'}</span>
              {' — '}
              {t.alertsHoldHint || 'with OBS open on a scene that has no alerts layer, like a BRB screen, they wait and play once one shows them, for up to 30 minutes. Off, they play on no page and are missed.'}
            </span>
          </label>
          {controlNote && <p className="w-full text-[10px] text-rose-400" data-alert-gate-note>{controlNote}</p>}
        </div>
      )}

      {/* pick an event to create one — no modal, the choice is the creation */}
      <div className="glass-panel rounded-3xl border border-zinc-800 p-5">
        <Label>{t.alertsNew || 'New alert for'}</Label>
        <div className="space-y-3">
          {TYPE_GROUPS.map((g) => (
            <div key={g.group} className="flex flex-wrap items-center gap-1.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600 w-20 shrink-0">{groupLabel(t, g.group)}</span>
              {g.types.map((x) => (
                <button
                  key={x.type}
                  onClick={() => create(x.type)}
                  title={x.sample}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800 text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:border-zinc-700 transition-all"
                >
                  <Plus size={10} /> {typeLabel(t, x.type)}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="glass-panel rounded-3xl border border-zinc-800 p-12 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-6 border border-zinc-800 text-zinc-500">
            <Bell size={32} />
          </div>
          <h3 className="text-xl font-extrabold mb-2 uppercase tracking-tight">{t.alertsNone || 'No alerts yet'}</h3>
          <p className="text-xs text-zinc-500 max-w-sm">
            {t.alertsNoneHint || 'Pick an event above and it appears here, ready to edit.'}
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {alerts.map((a) => (
              <button
                key={a.id}
                onClick={() => { dirty.current = false; setSelectedId(a.id); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                  a.id === draft?.id
                    ? 'bg-current-accent text-white border-transparent shadow-lg'
                    : 'bg-zinc-900/50 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                }`}
              >
                {!a.enabled && <EyeOff size={11} className="opacity-70" />}
                {a.name}
              </button>
            ))}
          </div>

          {draft && (
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
              {/* the preview, always on screen */}
              <div className="glass-panel rounded-3xl border border-zinc-800 p-4">
                <div
                  className="relative w-full rounded-2xl overflow-hidden"
                  style={{
                    aspectRatio: '16 / 9',
                    backgroundImage:
                      'linear-gradient(45deg, #18181b 25%, transparent 25%), linear-gradient(-45deg, #18181b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #18181b 75%), linear-gradient(-45deg, transparent 75%, #18181b 75%)',
                    backgroundSize: '20px 20px',
                    backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                    backgroundColor: '#09090b',
                  }}
                >
                  {previewAlert && <AlertOverlay key={previewKey} alert={previewAlert as any} scale={0.7} />}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Button size="sm" variant="secondary" icon={<Play size={13} />} onClick={() => setPreviewKey((k) => k + 1)}>
                    {t.alertsReplay || 'Replay'}
                  </Button>
                  <Button size="sm" icon={<Bell size={13} />} onClick={() => testAlert(draft.id)}>
                    {t.alertsTestLive || 'Fire on stream'}
                  </Button>
                  <span className="text-[9px] text-zinc-600 ml-1">
                    {t.alertsTestHint || 'sends it to every connected overlay'}
                  </span>
                </div>
              </div>

              {/* the controls, one column, no accordions */}
              <div className="glass-panel rounded-3xl border border-zinc-800 p-5">
                <Section title={t.alertsBasics || 'Basics'}>
                  <label className="block mb-3">
                    <Label>{t.alertsName || 'Name'}</Label>
                    <input className={input} value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
                  </label>
                  <div className="flex items-center justify-between mb-3">
                    <Label>{t.alertsEvent || 'Fires on'}</Label>
                    {/* With its group: Twitch and TikTok both have a "Follow". */}
                    <span className="text-[10px] font-bold text-zinc-400" data-alert-fires-on>
                      {typeGroup(draft.type) ? `${groupLabel(t, typeGroup(draft.type)!)} · ${typeLabel(t, draft.type)}` : typeLabel(t, draft.type)}
                    </span>
                  </div>

                  {/*
                    Channel points are the one event that needs narrowing: with
                    no reward chosen the alert fires on every redemption, which
                    is a reasonable catch-all but should be a decision rather
                    than the only option.
                  */}
                  {draft.type === 'twitch_redemption' && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between">
                        <Label>{t.reward || 'Reward'}</Label>
                        {fetchRewards && (
                          <button onClick={fetchRewards} className="text-[9px] font-bold text-current-accent hover:underline mb-1.5">
                            {t.refreshData || 'Refresh'}
                          </button>
                        )}
                      </div>
                      <select
                        className={input}
                        value={draft.redemptionRewardId || ''}
                        onChange={(e) => patch({ redemptionRewardId: e.target.value })}
                      >
                        <option value="">{t.anyReward || 'Any reward'}</option>
                        {rewards.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
                        {/*
                          A reward deleted on Twitch, or a list not fetched yet,
                          would leave the box reading "Any reward" while the
                          alert is in fact filtered to something — and firing on
                          nothing. Better to show the filter exists.
                        */}
                        {draft.redemptionRewardId && !rewards.some((r) => r.id === draft.redemptionRewardId) && (
                          <option value={draft.redemptionRewardId}>
                            {t.alertsUnknownReward || 'Unknown reward'} ({draft.redemptionRewardId.slice(0, 8)}…)
                          </option>
                        )}
                      </select>
                      <p className="text-[9px] text-zinc-600 mt-1.5 leading-snug">
                        {draft.redemptionRewardId
                          ? (t.alertsRewardOne || 'Only this reward fires it.')
                          : (t.alertsRewardAny || 'Every redemption fires it, whichever reward it was.')}
                      </p>
                    </div>
                  )}
                  <button
                    onClick={() => patch({ enabled: !draft.enabled })}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all ${
                      draft.enabled ? 'border-current-accent bg-current-accent/10' : 'border-zinc-800 bg-zinc-900/40'
                    }`}
                  >
                    {draft.enabled ? <Eye size={13} className="text-current-accent" /> : <EyeOff size={13} className="text-zinc-500" />}
                    <span className="flex-1 text-[10px] font-black uppercase tracking-widest text-zinc-300">
                      {draft.enabled ? (t.enabled || 'Enabled') : (t.disabled || 'Disabled')}
                    </span>
                  </button>
                </Section>

                <Section title={t.alertsMessage || 'Message'}>
                  <textarea
                    className={`${input} min-h-[64px] font-mono leading-relaxed`}
                    value={draft.messageTemplate}
                    onChange={(e) => patch({ messageTemplate: e.target.value })}
                  />
                  <button
                    onClick={() => setShowPicker(true)}
                    className="mt-2 text-[9px] font-black uppercase tracking-widest text-current-accent hover:brightness-125"
                  >
                    {t.variablesButton || 'Variables'}
                  </button>
                  {/*
                    Told which event this alert fires on, so the picker lists
                    that event's own fields first — {event.bits} for a cheer,
                    {event.viewers} for a raid — instead of a flat list of 62.
                  */}
                  <VariablePicker
                    open={showPicker}
                    onClose={() => setShowPicker(false)}
                    triggerType={draft.type}
                    triggerLabel={typeLabel(t, draft.type)}
                    t={t}
                  />
                  <button
                    onClick={() => patch({ highlightText: !draft.highlightText })}
                    className="mt-3 flex items-center gap-2 text-left"
                  >
                    <span className={`w-3.5 h-3.5 rounded-md border flex items-center justify-center ${
                      draft.highlightText ? 'bg-current-accent border-transparent' : 'border-zinc-700'
                    }`}>
                      {draft.highlightText && <Check size={10} className="text-white" />}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-400">{t.alertsHighlight || 'Colour the name'}</span>
                  </button>
                </Section>

                <Section title={t.alertsMedia || 'Image and sound'}>
                  <Label>{t.alertsImage || 'Image'}</Label>
                  <div className="flex gap-2 mb-2">
                    <input className={input} placeholder={t.alertsUrlPlaceholder || 'https://… or /media/…'} value={draft.imageUrl || ''} onChange={(e) => patch({ imageUrl: e.target.value })} />
                    <button onClick={() => imageInput.current?.click()} title={t.upload || 'Upload'} className="px-3 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white">
                      {uploading === 'image' ? <span className="text-[9px]">…</span> : <Upload size={13} />}
                    </button>
                    {/* Video as well: the overlay has drawn clips all along, and this was
                        the only thing that would not let one be chosen. */}
                    <input ref={imageInput} type="file" accept="image/*,video/*" hidden onChange={(e) => onUpload('image', e.target.files?.[0])} />
                  </div>
                  {uploadError?.kind === 'image' && <p className="text-[9px] text-rose-400 -mt-1 mb-2 leading-snug" data-alert-upload-error>{uploadError.text}</p>}
                  {draft.imageUrl && (
                    <button onClick={() => patch({ imageUrl: '' })} className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 hover:text-rose-500 mb-3">
                      {t.alertsClearImage || 'Remove image'}
                    </button>
                  )}

                  <div className="grid grid-cols-4 gap-1.5 mb-4 mt-2">
                    {LAYOUTS.map((l) => (
                      <button
                        key={l.value}
                        onClick={() => patch({ layout: l.value })}
                        className={`px-2 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
                          draft.layout === l.value ? 'bg-current-accent text-white border-transparent' : 'bg-zinc-900/60 text-zinc-500 border-zinc-800 hover:text-zinc-300'
                        }`}
                      >
                        {t[l.key] || l.label}
                      </button>
                    ))}
                  </div>

                  <Label>{t.alertsSound || 'Sound'}</Label>
                  <div className="flex gap-2">
                    <input className={input} placeholder={t.alertsUrlPlaceholder || 'https://… or /media/…'} value={draft.soundUrl || ''} onChange={(e) => patch({ soundUrl: e.target.value })} />
                    <button onClick={() => soundInput.current?.click()} title={t.upload || 'Upload'} className="px-3 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white">
                      {uploading === 'sound' ? <span className="text-[9px]">…</span> : <Upload size={13} />}
                    </button>
                    <input ref={soundInput} type="file" accept="audio/*" hidden onChange={(e) => onUpload('sound', e.target.files?.[0])} />
                  </div>
                  {uploadError?.kind === 'sound' && <p className="text-[9px] text-rose-400 mt-1.5 leading-snug" data-alert-upload-error>{uploadError.text}</p>}
                  {draft.soundUrl && (
                    <>
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={() => { const a = new Audio(draft.soundUrl); a.volume = draft.soundVolume ?? 1; a.play().catch(() => {}); }}
                          title={t.alertsPlaySound || 'Play it'}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-white border border-zinc-800"
                        >
                          <Volume2 size={13} />
                        </button>
                        <input
                          type="range" min={0} max={1} step={0.05}
                          value={draft.soundVolume ?? 1}
                          onChange={(e) => patch({ soundVolume: Number(e.target.value) })}
                          className="flex-1 accent-current-accent"
                        />
                        <span className="text-[9px] font-mono text-zinc-500 w-8 text-right">{Math.round((draft.soundVolume ?? 1) * 100)}%</span>
                      </div>
                      <button onClick={() => patch({ soundUrl: '' })} className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 hover:text-rose-500 mt-2">
                        {t.alertsClearSound || 'Remove sound'}
                      </button>
                    </>
                  )}
                </Section>

                {(() => {
                  const tts = { enabled: false, text: '{alert} {message}', voice: '', rate: 1, pitch: 1, volume: 1, delayMs: 1000, ...(draft.tts || {}) };
                  const setTts = (p: Partial<typeof tts>) => patch({ tts: { ...tts, ...p } });
                  // What it would say, with the preview's stand-ins: the caption as previewed, and a sample message.
                  const sample = fillPreview(tts.text, { alert: previewAlert?.text || '' }).replace(/ +/g, ' ').trim();
                  const listen = () => {
                    if (!window.speechSynthesis || !sample) return;
                    const u = new SpeechSynthesisUtterance(sample);
                    const v = voices.find((x) => x.voiceURI === tts.voice || x.name === tts.voice);
                    if (v) { u.voice = v; u.lang = v.lang; }
                    u.rate = tts.rate; u.pitch = tts.pitch; u.volume = tts.volume;
                    window.speechSynthesis.cancel();
                    window.speechSynthesis.speak(u);
                  };
                  return (
                    <Section title={t.alertsRead || 'Read aloud'}>
                      <button onClick={() => setTts({ enabled: !tts.enabled })} className="flex items-center gap-2 text-left mb-1" data-alert-read-toggle>
                        <span className={`w-3.5 h-3.5 rounded-md border flex items-center justify-center ${tts.enabled ? 'bg-current-accent border-transparent' : 'border-zinc-700'}`}>
                          {tts.enabled && <Check size={10} className="text-white" />}
                        </span>
                        <span className="text-[10px] font-bold text-zinc-400">{t.alertsReadOn || 'Read this alert aloud when it shows'}</span>
                      </button>
                      <p className="text-[9px] text-zinc-600 leading-relaxed mb-3">
                        {t.alertsReadHint || 'Spoken by the page that shows your alerts in OBS (or the chat dock if none is open), after the wait below so it does not talk over the sound. The alert stays up until it has been read. !tts messages are read by the same page, one after the other.'}
                      </p>
                      {tts.enabled && (
                        <>
                          <label className="block mb-3">
                            <Label>{t.alertsReadText || 'What it says'}</Label>
                            <textarea className={`${input} min-h-[52px] font-mono leading-relaxed`} value={tts.text} onChange={(e) => setTts({ text: e.target.value })} />
                            <span className="block text-[9px] text-zinc-600 mt-1 leading-relaxed">{t.alertsReadTextHint || '{alert} is the alert\'s own text, {message} what the viewer wrote with it (bits, a sub message, a Super Chat, a channel-point reward\'s text). Every other variable works too. Nothing to say, nothing is read.'}</span>
                          </label>
                          <div className="flex gap-3 mb-3">
                            <label className="flex-1">
                              <Label>{t.ttsVoice || 'Voice'}</Label>
                              <select className={input} value={tts.voice} onChange={(e) => setTts({ voice: e.target.value })}>
                                <option value="">{t.alertsReadDefaultVoice || 'Default voice'}</option>
                                {tts.voice && !voices.some((v) => v.voiceURI === tts.voice) && <option value={tts.voice}>{tts.voice}</option>}
                                {voices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
                              </select>
                            </label>
                            <label className="w-28">
                              <Label>{t.alertsReadDelay || 'Wait'} — {(tts.delayMs / 1000).toFixed(1)}s</Label>
                              <input type="range" min={0} max={5000} step={250} value={tts.delayMs} onChange={(e) => setTts({ delayMs: Number(e.target.value) })} className="w-full accent-current-accent mt-2" />
                            </label>
                          </div>
                          <div className="flex gap-3 items-end">
                            <label className="flex-1">
                              <Label>{t.ttsRate || 'Speed'} — {tts.rate.toFixed(1)}x</Label>
                              <input type="range" min={0.5} max={2} step={0.1} value={tts.rate} onChange={(e) => setTts({ rate: Number(e.target.value) })} className="w-full accent-current-accent" />
                            </label>
                            <label className="flex-1">
                              <Label>{t.ttsVolume || 'Volume'} — {Math.round(tts.volume * 100)}%</Label>
                              <input type="range" min={0} max={1} step={0.05} value={tts.volume} onChange={(e) => setTts({ volume: Number(e.target.value) })} className="w-full accent-current-accent" />
                            </label>
                            <button onClick={listen} title={sample} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-800 text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-white" data-alert-read-listen>
                              <MessageSquareText size={12} /> {t.alertsReadListen || 'Listen'}
                            </button>
                          </div>
                          <span className="block text-[9px] text-zinc-600 mt-2 leading-relaxed">{t.alertsReadVoiceHint || 'Voices are the ones on this computer. Pick one the PC running OBS has too — if it does not, that page reads in its default voice.'}</span>
                        </>
                      )}
                    </Section>
                  );
                })()}

                <Section title={t.alertsStyle || 'Style'}>
                  <label className="block mb-3">
                    <Label>{t.alertsFont || 'Font'}</Label>
                    <select className={input} value={draft.fontFamily || ''} onChange={(e) => patch({ fontFamily: e.target.value })}>
                      {/* Empty is automatic: the look's font, or Montserrat without one. */}
                      <option value="">{t.fontAutomatic || 'Automatic'}</option>
                      {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </label>
                  <label className="block mb-3">
                    <Label>{t.alertsSize || 'Size'} — {draft.fontSize}px</Label>
                    <input type="range" min={12} max={120} value={draft.fontSize} onChange={(e) => patch({ fontSize: Number(e.target.value) })} className="w-full accent-current-accent" />
                  </label>
                  {/*
                    Each colour, or automatic: left empty, the look on this
                    alert decides it, and without one the alert's own shows —
                    white words, a pink name. Picking one makes it yours, over
                    any look; the cross hands it back.
                  */}
                  <div className="space-y-2">
                    <AutoColourRow
                      name="textColor"
                      label={t.alertsTextColor || 'Text'}
                      value={draft.textColor}
                      fallback="#ffffff"
                      onChange={(v) => patch({ textColor: v })}
                      onClear={() => patch({ textColor: '' })}
                      t={t}
                    />
                    <AutoColourRow
                      name="accentColor"
                      label={t.alertsAccent || 'Name'}
                      value={draft.accentColor}
                      fallback="#f43f5e"
                      onChange={(v) => patch({ accentColor: v })}
                      onClear={() => patch({ accentColor: '' })}
                      t={t}
                    />
                  </div>
                </Section>

                {/*
                  Variations are what make an alert feel like it reacts: a
                  10,000-bit cheer should not look like a 100-bit one. Only the
                  fields a variation sets override the base, so one that changes
                  the sound alone keeps every other choice.
                */}
                {CONDITION_FIELDS.some((f) => f.types.includes(draft.type)) && (
                  <Section title={t.alertsVariations || 'Variations'}>
                    <input ref={variationInput} type="file" hidden onChange={(e) => onVariationUpload(e.target.files?.[0])} data-alert-variation-file />
                    <p className="text-[9px] text-zinc-600 mb-3 leading-snug">
                      {t.alertsVariationsHint || 'A different look when the event is big. The first one whose conditions all hold is the one that plays, so order matters.'}
                    </p>

                    <div ref={variationOrder.listRef} className="relative">
                    {variationOrder.line}
                    {(draft.variations || []).map((v, i) => {
                      const open = editingVariation === v.id;
                      return (
                        <div key={v.id} {...variationOrder.row(v.id)} className={`rounded-xl border mb-2 ${open ? 'border-current-accent bg-current-accent/10' : 'border-zinc-800 bg-zinc-900/40'} ${variationOrder.held === v.id ? 'opacity-40' : ''}`}>
                          <div className="flex items-center gap-1.5 p-2.5">
                            {(draft.variations || []).length > 1 && <DragGrip grip={variationOrder.grip(v.id)} title={t.alertsVariationDrag || 'Drag to change which one is checked first'} size={12} className="-ml-1" />}
                            <button onClick={() => setEditingVariation(open ? null : v.id)} className="flex-1 text-left">
                              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-200">{v.name}</span>
                              <span className="block text-[9px] text-zinc-500 font-mono mt-0.5">
                                {v.conditions.length
                                  ? v.conditions.map((c) => `${fieldLabel(t, c.field)} ${OP_LABEL[c.op]} ${c.value}`).join(` ${t.alertsAnd || 'and'} `)
                                  : (t.alertsVariationAlways || 'always — a catch-all')}
                              </span>
                            </button>
                            <button onClick={() => moveVariation(v.id, -1)} disabled={i === 0} title={t.alertsVariationUp || 'Check this one earlier'} className="p-1 text-zinc-500 hover:text-white disabled:opacity-25"><ArrowUp size={12} /></button>
                            <button onClick={() => moveVariation(v.id, 1)} disabled={i === (draft.variations!.length - 1)} title={t.alertsVariationDown || 'Check this one later'} className="p-1 text-zinc-500 hover:text-white disabled:opacity-25"><ArrowDown size={12} /></button>
                            <button onClick={() => removeVariation(v.id)} title={t.alertsVariationRemove || 'Remove this variation'} className="p-1 text-zinc-500 hover:text-rose-500"><Trash2 size={12} /></button>
                          </div>

                          {open && (
                            <div className="px-2.5 pb-3 space-y-2">
                              <input
                                className={input}
                                value={v.name}
                                onChange={(e) => patchVariation(v.id, { name: e.target.value })}
                              />

                              {v.conditions.map((c, ci) => (
                                <div key={ci} className="flex gap-1.5">
                                  <select
                                    className={`${box} flex-1 min-w-0`}
                                    value={c.field}
                                    onChange={(e) => patchCondition(v.id, ci, { field: e.target.value as any })}
                                  >
                                    {CONDITION_FIELDS.filter((f) => f.types.includes(draft.type)).map((f) => (
                                      <option key={f.field} value={f.field}>{fieldLabel(t, f.field)}</option>
                                    ))}
                                  </select>
                                  <select
                                    className={`${box} w-14 shrink-0 px-2`}
                                    value={c.op}
                                    onChange={(e) => patchCondition(v.id, ci, { op: e.target.value as any })}
                                  >
                                    <option value="gte">≥</option>
                                    <option value="lte">≤</option>
                                    <option value="eq">=</option>
                                  </select>
                                  <input
                                    type="number"
                                    className={`${box} w-20 shrink-0`}
                                    value={c.value}
                                    onChange={(e) => patchCondition(v.id, ci, { value: Number(e.target.value) || 0 })}
                                  />
                                  <button onClick={() => removeCondition(v.id, ci)} title={t.alertsConditionRemove || 'Remove this condition'} className="px-2 text-zinc-600 hover:text-rose-500"><Trash2 size={11} /></button>
                                </div>
                              ))}

                              {v.conditions.length < 4 && (
                                <button onClick={() => addCondition(v.id)} className="text-[9px] font-black uppercase tracking-widest text-current-accent hover:brightness-125">
                                  + {t.alertsAddCondition || 'Condition'}
                                </button>
                              )}

                              <div className="pt-2 border-t border-zinc-800/80">
                                <p className="text-[9px] text-zinc-600 mb-2 leading-snug">
                                  {t.alertsVariationOverrides || 'Anything left blank uses the alert above.'}
                                </p>
                                <div className="space-y-1.5" data-alert-variation-fields>
                                  <input
                                    className={input}
                                    placeholder={t.alertsMessage || 'Message'}
                                    value={v.messageTemplate ?? ''}
                                    onChange={(e) => patchVariation(v.id, { messageTemplate: e.target.value || undefined })}
                                  />
                                  {/* The picture and the sound, typed or uploaded, as the alert's own are. */}
                                  {(['image', 'sound'] as const).map((kind) => (
                                    <div key={kind} className="flex gap-1.5">
                                      <input
                                        className={input}
                                        placeholder={kind === 'image' ? (t.alertsImage || 'Image') : (t.alertsSound || 'Sound')}
                                        value={(kind === 'image' ? v.imageUrl : v.soundUrl) ?? ''}
                                        onChange={(e) => patchVariation(v.id, kind === 'image' ? { imageUrl: e.target.value || undefined } : { soundUrl: e.target.value || undefined })}
                                      />
                                      <button
                                        onClick={() => { variationUploadFor.current = { id: v.id, kind }; variationInput.current?.setAttribute('accept', kind === 'image' ? 'image/*,video/*' : 'audio/*'); variationInput.current?.click(); }}
                                        title={t.upload || 'Upload'}
                                        className="px-3 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white"
                                        data-alert-variation-upload={kind}
                                      >
                                        {uploading === `variation-${kind}` ? <span className="text-[9px]">…</span> : <Upload size={12} />}
                                      </button>
                                    </div>
                                  ))}
                                  {uploadError?.kind === 'variation' && uploadError.id === v.id && (
                                    <p className="text-[9px] text-rose-400 leading-snug" data-alert-upload-error>{uploadError.text}</p>
                                  )}
                                  {/* Everything else a variation may set: blank, or "as the alert", is the alert's own. */}
                                  <div className="grid grid-cols-2 gap-1.5">
                                    <select className={input} value={v.layout ?? ''} onChange={(e) => patchVariation(v.id, { layout: (e.target.value || undefined) as any })} data-alert-variation-layout>
                                      <option value="">{t.alertsSameLayout || 'Picture: same'}</option>
                                      {LAYOUTS.map((l) => <option key={l.value} value={l.value}>{t[l.key] || l.label}</option>)}
                                    </select>
                                    <select className={input} value={v.fontFamily ?? ''} onChange={(e) => patchVariation(v.id, { fontFamily: e.target.value || undefined })} data-alert-variation-font>
                                      <option value="">{t.alertsSameFont || 'Font: same'}</option>
                                      {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                    <input
                                      type="number"
                                      className={input}
                                      placeholder={t.alertsSize || 'Size'}
                                      value={v.fontSize ?? ''}
                                      onChange={(e) => patchVariation(v.id, { fontSize: e.target.value === '' ? undefined : Number(e.target.value) })}
                                    />
                                    <input
                                      type="number"
                                      min={0.5}
                                      max={60}
                                      step={0.5}
                                      className={input}
                                      placeholder={t.alertsSecondsOnScreen || 'Seconds'}
                                      value={v.duration !== undefined ? v.duration / 1000 : ''}
                                      onChange={(e) => patchVariation(v.id, { duration: e.target.value === '' ? undefined : Math.round(Number(e.target.value) * 1000) })}
                                      data-alert-variation-duration
                                    />
                                    <select className={input} value={v.animationIn ?? ''} onChange={(e) => patchVariation(v.id, { animationIn: e.target.value || undefined })} data-alert-variation-in>
                                      <option value="">{t.alertsSameIn || 'Enter: same'}</option>
                                      {ALERT_ANIMATIONS_IN.map((a) => <option key={a.value} value={a.value}>{t[ANIMATION_KEYS[a.value]] || a.label}</option>)}
                                    </select>
                                    <select className={input} value={v.animationOut ?? ''} onChange={(e) => patchVariation(v.id, { animationOut: e.target.value || undefined })} data-alert-variation-out>
                                      <option value="">{t.alertsSameOut || 'Exit: same'}</option>
                                      {ALERT_ANIMATIONS_OUT.map((a) => <option key={a.value} value={a.value}>{t[ANIMATION_KEYS[a.value]] || a.label}</option>)}
                                    </select>
                                    <input
                                      type="number"
                                      min={0}
                                      max={100}
                                      step={5}
                                      className={input}
                                      placeholder={t.alertsVolumePercent || 'Volume %'}
                                      value={v.soundVolume !== undefined ? Math.round(v.soundVolume * 100) : ''}
                                      onChange={(e) => patchVariation(v.id, { soundVolume: e.target.value === '' ? undefined : Math.min(1, Math.max(0, Number(e.target.value) / 100)) })}
                                      data-alert-variation-volume
                                    />
                                    <select
                                      className={input}
                                      value={v.highlightText === undefined ? '' : v.highlightText ? 'yes' : 'no'}
                                      onChange={(e) => patchVariation(v.id, { highlightText: e.target.value === '' ? undefined : e.target.value === 'yes' })}
                                      data-alert-variation-highlight
                                    >
                                      <option value="">{t.alertsSameHighlight || 'Name: same'}</option>
                                      <option value="yes">{t.alertsHighlight || 'Colour the name'}</option>
                                      <option value="no">{t.alertsNoHighlight || 'Name in the text colour'}</option>
                                    </select>
                                    {/* The two colours: picked, or left to the alert. */}
                                    {(['textColor', 'accentColor'] as const).map((field) => (
                                      <div key={field} className="flex items-center gap-1.5 px-2 py-1 rounded-xl border border-zinc-800 bg-zinc-900/60" data-alert-variation-colour={field}>
                                        <input
                                          type="color"
                                          value={v[field] || draft[field] || (field === 'textColor' ? '#ffffff' : '#f43f5e')}
                                          onChange={(e) => patchVariation(v.id, { [field]: e.target.value } as Partial<AlertVariation>)}
                                          className="w-6 h-6 rounded bg-transparent border-0 p-0 cursor-pointer"
                                        />
                                        <span className="flex-1 text-[9px] font-bold text-zinc-400 truncate">
                                          {field === 'textColor' ? (t.alertsTextColor || 'Text') : (t.alertsAccent || 'Name')}
                                          {!v[field] && <span className="text-zinc-600"> · {t.alertsSameAsAlert || 'as the alert'}</span>}
                                        </span>
                                        {v[field] && (
                                          <button onClick={() => patchVariation(v.id, { [field]: undefined } as Partial<AlertVariation>)} title={t.alertsBackToAlert || 'Back to the alert\'s own'} className="text-zinc-600 hover:text-rose-500">
                                            <Trash2 size={11} />
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 mt-2">
                                  <button
                                    onClick={() => setPreviewVariation(previewVariation === v.id ? null : v.id)}
                                    className="text-[9px] font-black uppercase tracking-widest text-current-accent hover:brightness-125"
                                  >
                                    {previewVariation === v.id ? (t.alertsPreviewBase || 'Preview the base alert') : (t.alertsPreviewThis || 'Preview this variation')}
                                  </button>
                                  {/* On stream, as this one, at the numbers its conditions ask for. */}
                                  <button
                                    onClick={() => testAlert(draft.id, v.id)}
                                    className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-current-accent hover:brightness-125"
                                    data-alert-variation-fire
                                  >
                                    <Bell size={10} /> {t.alertsFireVariation || 'Fire this one on stream'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    </div>

                    {(draft.variations || []).length < 8 && (
                      <button
                        onClick={addVariation}
                        className="w-full mt-1 py-2 rounded-xl border border-zinc-800 text-[9px] font-black uppercase tracking-widest text-zinc-500 hover:text-white hover:border-zinc-700 transition-all"
                      >
                        <Plus size={11} className="inline mr-1 -mt-0.5" />
                        {t.alertsAddVariation || 'Add a variation'}
                      </button>
                    )}
                  </Section>
                )}

                <Section title={t.alertsTiming || 'Timing'}>
                  <label className="block mb-3">
                    <Label>{t.alertsDuration || 'On screen'} — {(draft.duration / 1000).toFixed(1)}s</Label>
                    <input type="range" min={1000} max={20000} step={500} value={draft.duration} onChange={(e) => patch({ duration: Number(e.target.value) })} className="w-full accent-current-accent" />
                  </label>
                  <div className="flex gap-3">
                    <label className="flex-1">
                      <Label>{t.alertsIn || 'Enter'}</Label>
                      <select className={input} value={draft.animationIn} onChange={(e) => patch({ animationIn: e.target.value })}>
                        {ALERT_ANIMATIONS_IN.map((a) => <option key={a.value} value={a.value}>{t[ANIMATION_KEYS[a.value]] || a.label}</option>)}
                      </select>
                    </label>
                    <label className="flex-1">
                      <Label>{t.alertsOut || 'Exit'}</Label>
                      <select className={input} value={draft.animationOut} onChange={(e) => patch({ animationOut: e.target.value })}>
                        {ALERT_ANIMATIONS_OUT.map((a) => <option key={a.value} value={a.value}>{t[ANIMATION_KEYS[a.value]] || a.label}</option>)}
                      </select>
                    </label>
                  </div>
                </Section>

                {/*
                  Per alert, not on the alerts layer. One layer draws every
                  alert on the channel, so a stylesheet there would be one
                  rule for a follow, a raid and a donation alike — the box
                  belongs where the alert is, and travels with it.
                */}
                <Section title={t.alertsCssSection || 'Custom CSS'}>
                  <StylesheetPanel
                    title={t.alertsCss || 'This alert’s CSS'}
                    css={draft.css}
                    motionCss={draft.motionCss}
                    scopeHint={t.alertScopeHint || 'is this alert. Pseudo-elements and @keyframes work here too.'}
                    travelsHint={t.alertCssTravels || 'Kept on the alert, so it styles this one and no other.'}
                    parts={ALERT_PARTS}
                    patch={patch}
                    t={t}
                  />
                </Section>

                <button
                  onClick={() => { if (!window.confirm(fill(t.alertsDeleteConfirm || 'Delete "{name}"? It cannot be brought back.', { name: draft.name }))) return; deleteAlert(draft.id); setSelectedId(null); }}
                  data-alert-delete
                  className="w-full mt-6 py-2.5 rounded-xl border border-zinc-800 text-[9px] font-black uppercase tracking-widest text-zinc-600 hover:text-rose-500 hover:border-rose-900 transition-all"
                >
                  <Trash2 size={11} className="inline mr-1.5 -mt-0.5" />
                  {t.alertsDelete || 'Delete this alert'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
