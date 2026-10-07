
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
*/
import React, { useEffect, useRef, useState } from 'react';
import { ThemeConfig, SyncLogEntry, LinkedUserData } from '../../types';
import { Shield, Link as LinkIcon, Trash2, Clock, CheckCircle, RefreshCcw, Star, Diamond, Sword, Trophy, Search, Loader2, Heart, Award, Gem, List, User, Bot, Plus, X, ArrowRight, AlertTriangle, Filter, Gift, UploadCloud, Database } from 'lucide-react';
import { Button } from '../Button';

// Icons for roles
const SubIcon = ({ size = 20, className = "" }) => <Star size={size} className={className} />;
const VipIcon = ({ size = 20, className = "" }) => <Diamond size={size} className={className} />;
const ModIcon = ({ size = 20, className = "" }) => <Sword size={size} className={className} />;
const FollowerIcon = ({ size = 20, className = "" }) => <Heart size={size} className={className} />;
const FounderIcon = ({ size = 20, className = "" }) => <Award size={size} className={className} />;
const BitIcon = ({ size = 20, className = "" }) => <Gem size={size} className={className} />;
const GiftIcon = ({ size = 20, className = "" }) => <Gift size={size} className={className} />;

const TwitchIcon = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} width={size} height={size}><path d="M21 2H3v16h5v4l4-4h5l4-4V2zm-10 9V7m5 4V7" /></svg>
);
const TikTokIcon = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg"><path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.002-.001.002.001a2.895 2.895 0 0 1 3.183-4.51v-3.5a6.329 6.329 0 0 0-5.394 10.692 6.33 6.33 0 0 0 10.857-4.424V8.687a8.182 8.182 0 0 0 4.773 1.526V6.79a4.831 4.831 0 0 1-1.003-.104z" /></svg>
);
const YouTubeIcon = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
);
type LinkPlatform = 'twitch' | 'tiktok' | 'youtube';
/** What an account can be on: the stream platforms, and Discord when adding to somebody already linked. */
type PickPlatform = LinkPlatform | 'discord';
const PLATFORM_COLOUR: Record<PickPlatform, string> = { twitch: '#9146FF', tiktok: '#ff0050', youtube: '#FF0000', discord: '#5865F2' };
const PLATFORM_LABEL: Record<PickPlatform, string> = { twitch: 'Twitch', tiktok: 'TikTok', youtube: 'YouTube', discord: 'Discord' };
const platformOfKey = (key: string): LinkPlatform => (key.startsWith('tiktok:') ? 'tiktok' : key.startsWith('youtube:') ? 'youtube' : 'twitch');
const PlatformIcon = ({ platform, size = 14, className = '' }: { platform: PickPlatform; size?: number; className?: string }) => (
  platform === 'discord' ? <DiscordIcon size={size} className={className} /> : platform === 'tiktok' ? <TikTokIcon size={size} className={className} /> : platform === 'youtube' ? <YouTubeIcon size={size} className={className} /> : <TwitchIcon size={size} className={className} />
);
/*
  Roles for showing up, read from each person's history across every account
  they have: so many streams, a streak in a row, being on so many platforms,
  so many messages. Saved a moment after each change.
*/
const LOYALTY_KINDS = ['streams', 'streak', 'platforms', 'messages'] as const;
const LoyaltyRoles = ({ rules, roles, save, t }: { rules: any[]; roles: any[]; save: (rules: any[]) => Promise<any>; t: any }) => {
  const [list, setList] = useState<any[]>(rules || []);
  const timer = useRef<any>(null);
  useEffect(() => { if (!timer.current) setList(rules || []); }, [rules]);
  const change = (next: any[]) => {
    setList(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; save(next).catch(() => {}); }, 600);
  };
  const kindName: Record<string, string> = {
    streams: t.loyaltyStreams || 'Streams attended',
    streak: t.loyaltyStreak || 'Streams in a row (taken away when it breaks)',
    platforms: t.loyaltyPlatforms || 'Platforms they watch on',
    messages: t.loyaltyMessages || 'Messages',
  };
  return (
    <div className="space-y-2" data-loyalty-roles>
      <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1"><Trophy size={10} className="text-amber-400" /> {t.loyaltyTitle || 'Loyalty'}</h4>
      <p className="text-[10px] text-zinc-600 leading-relaxed">{t.loyaltyHint || 'From each person\'s history across all their linked accounts. Checked when a stream ends and when somebody is linked.'}</p>
      {list.map((r, i) => (
        <div key={r.id || i} className="flex items-center gap-2 p-2 bg-zinc-900/40 rounded-2xl border border-zinc-800/50" data-loyalty-rule>
          <select value={r.kind} onChange={(e) => change(list.map((x, j) => (j === i ? { ...x, kind: e.target.value } : x)))} className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-[11px] rounded-lg px-2 py-1.5 flex-1 min-w-0">
            {LOYALTY_KINDS.map((k) => <option key={k} value={k}>{kindName[k]}</option>)}
          </select>
          <span className="text-[10px] text-zinc-500">≥</span>
          <input type="number" min={1} value={r.atLeast} onChange={(e) => change(list.map((x, j) => (j === i ? { ...x, atLeast: Number(e.target.value) } : x)))} className="w-16 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-[11px] text-white text-right" />
          <select value={r.roleId} onChange={(e) => change(list.map((x, j) => (j === i ? { ...x, roleId: e.target.value } : x)))} className={`bg-zinc-950 border text-zinc-300 text-[11px] rounded-lg px-2 py-1.5 w-36 ${r.roleId ? 'border-zinc-800' : 'border-amber-500/40'}`}>
            <option value="">{t.loyaltyPickRole || 'Which role?'}</option>
            {(roles || []).filter((x: any) => x.name !== '@everyone' && !x.managed).map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          <button onClick={() => change(list.filter((_, j) => j !== i))} className="p-1.5 text-zinc-600 hover:text-red-500"><Trash2 size={12} /></button>
        </div>
      ))}
      {list.length < 20 && (
        <button onClick={() => change([...list, { id: `loy-${Date.now().toString(36)}`, kind: 'streams', atLeast: 10, roleId: '' }])} className="w-full py-2 border border-dashed border-zinc-700 rounded-xl text-zinc-500 text-[11px] font-bold hover:text-white hover:border-zinc-500 flex items-center justify-center gap-1.5" data-loyalty-add>
          <Plus size={12} /> {t.loyaltyAdd || 'Add a loyalty role'}
        </button>
      )}
    </div>
  );
};

/** One account of somebody's: the platform's colour and icon, the name it goes by, and a way to take it off. */
const AccountChip = ({ account, onRemove, armed = false, t = {} }: { account: { key: string; platform: PickPlatform; id: string; name: string }; onRemove?: () => void; armed?: boolean; t?: any }) => (
  <span className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg text-[10px] font-bold border" style={{ background: `${PLATFORM_COLOUR[account.platform]}1a`, borderColor: `${PLATFORM_COLOUR[account.platform]}40` }} data-person-account={account.key}>
    <span style={{ color: PLATFORM_COLOUR[account.platform] }} className="flex"><PlatformIcon platform={account.platform} size={11} /></span>
    <span className="text-zinc-200 max-w-[150px] truncate" title={`${account.name} · ${account.id}`}>{account.name}</span>
    {onRemove ? (
      <button onClick={onRemove} className={`p-0.5 rounded transition-colors ${armed ? 'text-rose-300 bg-rose-500/30' : 'text-zinc-500 hover:text-rose-400'}`} title={armed ? (t.linkRemoveSure || 'Press again to take this account off') : (t.linkRemoveAccount || 'Take this account off them')} data-person-remove={account.key}>
        {armed ? <Trash2 size={10} /> : <X size={10} />}
      </button>
    ) : <span className="w-1" />}
  </span>
);
/** One person as the server lists them (role-sync people()): every account they have. */
interface LinkedPerson {
  uid: string;
  name: string;
  avatar: string;
  xp: number;
  level: number;
  accounts: { key: string; platform: PickPlatform; id: string; name: string; avatar?: string; linkedAt: number }[];
}
const DiscordIcon = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6034.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1569 2.419zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1568 2.419z"/>
  </svg>
);

interface RoleManagementViewProps {
  activeTheme: ThemeConfig;
  t: any;
  system: any;
}

export const RoleManagementViewConnected: React.FC<RoleManagementViewProps> = ({ activeTheme, t, system }) => {
    const { linkedUsers, linkedPeople, loyaltyRoles, moderation: modSettings, moderationLog, pendingLinks, discordRoles, roleMappings, syncLog, discordSearchResults, roleSyncSubsCheck } = system.data;
    const { fetchDiscordRoles, setRoleMappings, forceSyncUser, clearSyncLog, getTwitchUser, searchDiscordMember, linkDiscord, unlinkDiscord, listServerMembers, findYoutube, listTwitchFollowers, addAccount, setLoyaltyRoles, moderation } = system.actions;
    const [linkError, setLinkError] = useState('');
    const { discordGuildId, discordStatus, botMember } = system.connections;

    const [searchQuery, setSearchQuery] = useState('');
    const [syncingUsers, setSyncingUsers] = useState<Set<string>>(new Set());
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    // Tab State
    const [activeTab, setActiveTab] = useState<'accounts' | 'activity'>('accounts');
    const [filterPlatform, setFilterPlatform] = useState<'all' | LinkPlatform>('all');

    // Manual Link Modal State
    const [isManualLinkModalOpen, setIsManualLinkModalOpen] = useState(false);
    const [linkPlatform, setLinkPlatform] = useState<PickPlatform>('twitch');
    // Adding an account to somebody already linked: who, shown on the right in place of the Discord list.
    const [linkTarget, setLinkTarget] = useState<LinkedPerson | null>(null);
    // Taking one account off somebody: pressed once, then again to be sure.
    const [armedRemove, setArmedRemove] = useState('');
    // Moderating somebody: whose menu is open, the press waiting for a second, and what came of it.
    const [modOpen, setModOpen] = useState('');
    const [modArmed, setModArmed] = useState('');
    const [modSaid, setModSaid] = useState<Record<string, string>>({});
    // YouTube: people seen in its chat, and a channel found by @handle or id.
    const [youtubeResults, setYoutubeResults] = useState<{ seen: any[]; found: any | null } | null>(null);
    const [isSearchingYoutube, setIsSearchingYoutube] = useState(false);
    // Everybody in the Discord server, as the Voice call screen lists them, filtered here as you type.
    const [discordMembers, setDiscordMembers] = useState<{ id: string; name: string; username: string; avatar: string }[]>([]);
    const [membersState, setMembersState] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');
    // Everybody following on Twitch, newest first, filtered by what is typed in the Twitch box.
    const [twitchFollowers, setTwitchFollowers] = useState<{ followers: { id: string; login: string; name: string; followedAt: number; avatar: string }[]; total: number; complete: boolean } | null>(null);
    const [followersState, setFollowersState] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');

    const [manualLinkTwitchUser, setManualLinkTwitchUser] = useState('');
    const [manualLinkTwitchData, setManualLinkTwitchData] = useState<any>(null);
    const [manualLinkTwitchError, setManualLinkTwitchError] = useState('');
    
    const [manualLinkDiscordQuery, setManualLinkDiscordQuery] = useState('');
    const [manualLinkDiscordSelected, setManualLinkDiscordSelected] = useState<any>(null);
    const [isSearchingDiscord, setIsSearchingDiscord] = useState(false);

    // Fetch roles when component mounts if we have a guild ID
    useEffect(() => {
        if (discordStatus === 'connected' && discordGuildId && (!discordRoles || discordRoles.length === 0)) {
            fetchDiscordRoles(discordGuildId);
        }
    }, [discordStatus, discordGuildId]);

    const handleRoleChange = (key: string, roleId: string) => {
        setRoleMappings((prev: any) => ({
            ...prev,
            [key]: roleId === "" ? null : roleId
        }));
    };

    const handleRefreshRoles = () => {
        if (discordGuildId) {
            setIsRefreshing(true);
            fetchDiscordRoles(discordGuildId);
            setTimeout(() => setIsRefreshing(false), 1500);
        }
    };

    /*
      Bring one linked person's Discord roles in line now. The server works
      out what they should hold from what it has seen of them — chat badges,
      follows, subs, bits — and asks Discord what they hold first.
    */
    const handleForceSync = async (key: string) => {
        if (syncingUsers.has(key)) return;
        setSyncingUsers(prev => new Set(prev).add(key));
        try {
            await forceSyncUser(key);
        } catch (e) {
            console.error(e);
        } finally {
            setSyncingUsers(prev => {
                const next = new Set(prev);
                next.delete(key);
                return next;
            });
        }
    };

    // --- Manual Link Logic ---
    const resetManualLink = () => {
        setManualLinkTwitchUser('');
        setManualLinkTwitchData(null);
        setManualLinkTwitchError('');
        setManualLinkDiscordQuery('');
        setManualLinkDiscordSelected(null);
        setIsSearchingDiscord(false);
        setLinkPlatform('twitch');
        setYoutubeResults(null);
    };

    // The server's members and the channel's followers, once per opening of the link window (the server keeps each a minute).
    const openManualLink = (target: LinkedPerson | null = null) => {
        resetManualLink();
        setLinkTarget(target);
        setLinkError('');
        setIsManualLinkModalOpen(true);
        if (listTwitchFollowers && followersState !== 'loading') {
            setFollowersState('loading');
            listTwitchFollowers()
                .then((res: any) => { setTwitchFollowers(res?.followers ? res : { followers: [], total: 0, complete: true }); setFollowersState('ready'); })
                .catch(() => setFollowersState('failed'));
        }
        if (!listServerMembers || membersState === 'loading') return;
        setMembersState('loading');
        listServerMembers()
            .then((list: any[]) => { setDiscordMembers(list || []); setMembersState('ready'); })
            .catch(() => setMembersState('failed'));
    };

    const checkTwitchUser = async () => {
        if (!manualLinkTwitchUser) return;
        setManualLinkTwitchError('');
        setManualLinkTwitchData(null);

        if (linkPlatform === 'youtube') {
            // Chat files a YouTube viewer under their channel id: found among the people seen in chat, or by @handle / id.
            setIsSearchingYoutube(true);
            try {
                const res = await findYoutube(manualLinkTwitchUser);
                setYoutubeResults(res || { seen: [], found: null });
                if (!res?.seen?.length && !res?.found) setManualLinkTwitchError(t.linkYoutubeNotFound || 'Nobody by that name in YouTube chat yet. Try their @handle or channel id.');
            } catch (err: any) {
                setManualLinkTwitchError(err?.message || String(err));
            } finally {
                setIsSearchingYoutube(false);
            }
            return;
        }

        if (linkPlatform === 'twitch') {
            const data = await getTwitchUser(manualLinkTwitchUser);
            if (data) {
                setManualLinkTwitchData(data);
            } else {
                setManualLinkTwitchError(t.userNotFound || 'User not found');
            }
        } else {
            // For TikTok, we can't verify via API, so we just mock a success object
            // This relies on Passive Sync later
            setManualLinkTwitchData({
                id: `tiktok_${manualLinkTwitchUser}`,
                login: manualLinkTwitchUser,
                display_name: manualLinkTwitchUser,
                profile_image_url: '' // Will use placeholder
            });
        }
    };

    const pickYoutube = (p: { id: string; name: string; avatar?: string }) => {
        setManualLinkTwitchData({ id: p.id, login: p.name, display_name: p.name, profile_image_url: p.avatar || '' });
        setManualLinkTwitchError('');
    };

    // The followers filtered by what is typed — name, login or id. Enter still looks up anybody on Twitch, following or not.
    const followerQuery = manualLinkTwitchUser.trim().toLowerCase().replace(/^@/, '');
    const allFollowers = twitchFollowers?.followers || [];
    const shownFollowers = allFollowers.filter((f) => !followerQuery
        || f.name.toLowerCase().includes(followerQuery) || f.login.toLowerCase().includes(followerQuery) || f.id === followerQuery);
    const pickFollower = (f: { id: string; login: string; name: string; avatar: string }) => {
        setManualLinkTwitchData({ id: f.id, login: f.login, display_name: f.name, profile_image_url: f.avatar });
        setManualLinkTwitchError('');
    };

    // The member list filtered by what is typed — name, username or id. A server whose list could not be read is searched instead.
    const memberQuery = manualLinkDiscordQuery.trim().toLowerCase();
    const shownMembers = discordMembers.filter((m) => !memberQuery
        || m.name.toLowerCase().includes(memberQuery) || m.username.toLowerCase().includes(memberQuery) || m.id === memberQuery);
    const pickMember = (m: { id: string; name: string; username: string; avatar: string }) => setManualLinkDiscordSelected(m);

    const searchDiscordUser = () => {
        if (membersState === 'ready') return;
        if (!manualLinkDiscordQuery || !discordGuildId) return;
        setIsSearchingDiscord(true);
        // Clear previous selection
        setManualLinkDiscordSelected(null);
        // Trigger search
        searchDiscordMember(discordGuildId, manualLinkDiscordQuery, 'manual_search');
    };

    // Watch for search results update (managed by useDiscord hook -> useStreamSystem)
    useEffect(() => {
        if (isSearchingDiscord && discordSearchResults) {
            setIsSearchingDiscord(false);
        }
    }, [discordSearchResults, isSearchingDiscord]);

    /*
      Link on the server, keyed the way chat keys the same person — the
      numeric Twitch id, or the TikTok @handle — so the badges and events
      that arrive for them afterwards find the link. The server syncs their
      roles straight away and the list updates from the server.
    */
    // The Discord member picked: from the member list ({id, name, avatar}) or, where it could not be read, from a search (a Discord member).
    const pickedMember = () => {
        const picked = manualLinkDiscordSelected;
        if (!picked) return null;
        return picked.user
            ? {
                id: picked.user.id,
                name: picked.nick || picked.user.global_name || picked.user.username,
                avatar: picked.user.avatar ? `https://cdn.discordapp.com/avatars/${picked.user.id}/${picked.user.avatar}.png` : undefined,
            }
            : { id: picked.id, name: picked.name, avatar: picked.avatar || undefined };
    };
    // Keyed the way chat keys them: Twitch's numeric id, YouTube's channel id, the TikTok @handle.
    const pickedStreamId = () => (linkPlatform === 'tiktok' ? String(manualLinkTwitchData.login).trim().replace(/^@/, '') : String(manualLinkTwitchData.id));
    const canLink = linkTarget
        ? (linkPlatform === 'discord' ? !!manualLinkDiscordSelected : !!manualLinkTwitchData)
        : !!manualLinkTwitchData && !!manualLinkDiscordSelected;

    const executeManualLink = async () => {
        if (!canLink) return;
        setLinkError('');
        // Another account for somebody already linked: Discord or a stream account, joined to them.
        if (linkTarget) {
            const member = pickedMember();
            try {
                await addAccount(linkPlatform === 'discord'
                    ? { to: linkTarget.accounts[0].key, platform: 'discord', platformId: member!.id, platformName: member!.name, avatar: member!.avatar }
                    : { to: linkTarget.accounts[0].key, platform: linkPlatform, platformId: pickedStreamId(), platformName: manualLinkTwitchData.display_name || manualLinkTwitchData.login, avatar: manualLinkTwitchData.profile_image_url || undefined });
                setIsManualLinkModalOpen(false);
                resetManualLink();
                setLinkTarget(null);
            } catch (err: any) {
                setLinkError(err?.message || String(err));
            }
            return;
        }
        const member = pickedMember()!;
        try {
            await linkDiscord({
                platform: linkPlatform as LinkPlatform,
                platformId: pickedStreamId(),
                platformName: manualLinkTwitchData.display_name || manualLinkTwitchData.login,
                discordId: member.id,
                discordName: member.name,
                discordAvatar: member.avatar,
            });
            setIsManualLinkModalOpen(false);
            resetManualLink();
        } catch (err: any) {
            setLinkError(err?.message || String(err));
        }
    };

    // Everybody linked, as people; filtered by a platform they are on, and by any name or id they go by.
    const people: LinkedPerson[] = linkedPeople || [];
    const ownerOf = (key: string) => people.find((p) => p.accounts.some((a) => a.key === key)) || null;
    const query = searchQuery.trim().toLowerCase().replace(/^@/, '');
    const shownPeople = people.filter((p) => (filterPlatform === 'all' || p.accounts.some((a) => a.platform === filterPlatform))
        && (!query || p.name.toLowerCase().includes(query) || p.accounts.some((a) => a.name.toLowerCase().includes(query) || a.id.toLowerCase() === query)));
    // One account off somebody — only that one: pressed once, then again to be sure.
    const removeAccount = (key: string) => {
        if (armedRemove === key) { setArmedRemove(''); unlinkDiscord(key); return; }
        setArmedRemove(key);
        setTimeout(() => setArmedRemove((k) => (k === key ? '' : k)), 4000);
    };

    // Helper for rendering a row
    const renderMappingRow = (label: string, mapKey: string, Icon: any, styleClasses: string) => (
        <div className="flex items-center justify-between p-3 bg-zinc-900/40 hover:bg-zinc-900/60 transition-colors rounded-2xl border border-zinc-800/50 group">
            <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all group-hover:scale-105 group-hover:shadow-[0_0_15px_-5px_currentColor] ${styleClasses}`}>
                    <Icon size={18} />
                </div>
                <span className="text-xs font-bold text-zinc-300 group-hover:text-white transition-colors">{label}</span>
            </div>
            <select 
                value={roleMappings[mapKey] || ""} 
                onChange={(e) => handleRoleChange(mapKey, e.target.value)}
                className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs rounded-lg px-3 py-2 outline-none focus:border-current-accent w-40 transition-colors"
            >
                <option value="">No Role</option>
                {discordRoles?.map((role: any) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                ))}
            </select>
        </div>
    );

    // Everybody in the Discord server to pick from, or a search where the list could not be read: on the right when linking, on the left when adding Discord to somebody.
    const discordPicker = () => (
        <>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={manualLinkDiscordQuery}
                            onChange={e => setManualLinkDiscordQuery(e.target.value)}
                            placeholder={membersState === 'ready' ? (t.linkDiscordFilter || 'Filter by name, username or id') : (t.discordMemberHint || "Search Discord username")}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs font-bold focus:border-[#5865F2] outline-none text-white"
                            onKeyDown={(e) => e.key === 'Enter' && searchDiscordUser()}
                            data-link-discord-filter
                        />
                        {membersState !== 'ready' && (
                            <button onClick={searchDiscordUser} className="bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl px-3 transition-colors" disabled={isSearchingDiscord}>
                                {isSearchingDiscord ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                            </button>
                        )}
                    </div>

                    {/* The one picked, or the list to pick from */}
                    <div className={`rounded-2xl border overflow-hidden min-h-[120px] max-h-[220px] overflow-y-auto ${manualLinkDiscordSelected ? 'bg-[#5865F2]/10 border-[#5865F2]/30' : 'bg-zinc-900/30 border-zinc-800'}`} data-link-discord-list>
                        {manualLinkDiscordSelected ? (() => {
                            const sel = manualLinkDiscordSelected.user
                                ? { id: manualLinkDiscordSelected.user.id, name: manualLinkDiscordSelected.nick || manualLinkDiscordSelected.user.global_name || manualLinkDiscordSelected.user.username, avatar: manualLinkDiscordSelected.user.avatar ? `https://cdn.discordapp.com/avatars/${manualLinkDiscordSelected.user.id}/${manualLinkDiscordSelected.user.avatar}.png` : '' }
                                : manualLinkDiscordSelected;
                            return (
                                <div className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3 min-w-0">
                                        {sel.avatar ? <img src={sel.avatar} className="w-10 h-10 rounded-full border-2 border-[#5865F2]" alt="" /> : <div className="w-10 h-10 rounded-full bg-[#5865F2] flex items-center justify-center text-white"><User size={16} /></div>}
                                        <div className="min-w-0">
                                            <div className="text-xs font-bold text-white truncate">{sel.name}</div>
                                            <div className="text-[9px] text-zinc-400 font-mono">{sel.id}</div>
                                        </div>
                                    </div>
                                    <button onClick={() => setManualLinkDiscordSelected(null)} className="text-zinc-500 hover:text-white"><X size={14} /></button>
                                </div>
                            );
                        })() : membersState === 'ready' ? (
                            <div className="divide-y divide-zinc-800">
                                {shownMembers.slice(0, 200).map((m) => (
                                    <button key={m.id} onClick={() => pickMember(m)} className="w-full text-left p-2.5 hover:bg-white/5 flex items-center gap-3 transition-colors" data-link-discord-member={m.id}>
                                        {m.avatar ? <img src={m.avatar} className="w-7 h-7 rounded-full" alt="" loading="lazy" /> : <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center"><User size={12} /></div>}
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-bold text-zinc-300 truncate">{m.name}</div>
                                            <div className="text-[9px] text-zinc-500 truncate">{m.username && m.username !== m.name ? `@${m.username} · ` : ''}{m.id}</div>
                                        </div>
                                        {ownerOf(`discord:${m.id}`) && <LinkIcon size={12} className="text-[#5865F2]" />}
                                        <Plus size={14} className="text-zinc-500" />
                                    </button>
                                ))}
                                {shownMembers.length === 0 && <div className="p-4 text-center text-[10px] text-zinc-600 italic">{t.linkDiscordNobody || 'Nobody in the server by that name.'}</div>}
                                {shownMembers.length > 200 && <div className="p-2 text-center text-[9px] text-zinc-600">{t.linkDiscordMore || 'Type to narrow the list down.'}</div>}
                            </div>
                        ) : membersState === 'loading' ? (
                            <div className="p-4 text-center text-[10px] text-zinc-500 flex items-center justify-center gap-2"><Loader2 size={12} className="animate-spin" /> {t.linkDiscordLoading || 'Reading the server\'s members…'}</div>
                        ) : (
                            <div className="divide-y divide-zinc-800">
                                {discordSearchResults.length > 0 ? (
                                    discordSearchResults.map((res: any) => (
                                        <button key={res.user.id} onClick={() => setManualLinkDiscordSelected(res)} className="w-full text-left p-3 hover:bg-white/5 flex items-center gap-3 transition-colors">
                                            {res.user.avatar ? (
                                                <img src={`https://cdn.discordapp.com/avatars/${res.user.id}/${res.user.avatar}.png`} className="w-8 h-8 rounded-full" alt="" />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center"><User size={12} /></div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-bold text-zinc-300 truncate">{res.user.username}</div>
                                                <div className="text-[9px] text-zinc-500 truncate">{res.user.id}</div>
                                            </div>
                                            <Plus size={14} className="text-zinc-500" />
                                        </button>
                                    ))
                                ) : (
                                    <div className="p-4 text-center text-[10px] text-zinc-600 italic">
                                        {isSearchingDiscord ? t.searching : 'Search to find members...'}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
        </>
    );

    return (
    <div className="animate-fade-in space-y-8">
      
      {/* Manual Link Modal */}
      {isManualLinkModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => setIsManualLinkModalOpen(false)}>
              <div className={`max-w-2xl w-full glass-panel rounded-[40px] border ${activeTheme.borderClass} ${activeTheme.panelClass} shadow-2xl overflow-hidden flex flex-col`} onClick={e => e.stopPropagation()}>
                  <div className="p-6 border-b border-zinc-800 bg-zinc-950/50 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                          <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-500"><LinkIcon size={20} /></div>
                          <div>
                              <h3 className="text-lg font-black uppercase tracking-tight">{t.manualLinkTitle || 'Manually Link Accounts'}</h3>
                              <p className="text-[10px] text-zinc-500">{linkTarget ? (t.linkAddDesc || 'Add another of their accounts to {name}.').replace('{name}', linkTarget.name) : (t.manualLinkDesc || 'Connect a Twitch, TikTok or YouTube account to a Discord member without chat commands.')}</p>
                          </div>
                      </div>
                      <button onClick={() => setIsManualLinkModalOpen(false)} className="text-zinc-500 hover:text-white transition-colors"><X size={20} /></button>
                  </div>
                  
                  <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 relative">
                      {/* Connector Icon */}
                      <div className="hidden md:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 bg-zinc-900 border border-zinc-700 rounded-full p-2 text-zinc-400">
                          <ArrowRight size={20} />
                      </div>

                      {/* Left: Platform User */}
                      <div className="space-y-4" data-link-platform-side>
                          {/* Platform Toggle */}
                          <div className="flex bg-zinc-900 rounded-xl p-1 border border-zinc-800 mb-2">
                              {((linkTarget ? ['discord', 'twitch', 'tiktok', 'youtube'] : ['twitch', 'tiktok', 'youtube']) as PickPlatform[]).map((p) => (
                                  <button
                                    key={p}
                                    onClick={() => { setLinkPlatform(p); setManualLinkTwitchData(null); setManualLinkTwitchUser(''); setManualLinkTwitchError(''); setYoutubeResults(null); }}
                                    className={`flex-1 flex items-center justify-center ${linkTarget ? 'gap-1 px-1 text-[9px]' : 'gap-2 text-[10px]'} py-2 rounded-lg font-bold uppercase transition-all ${linkPlatform === p ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                                    style={linkPlatform === p ? { background: PLATFORM_COLOUR[p] } : undefined}
                                    data-link-platform={p}
                                  >
                                      <PlatformIcon platform={p} size={12} /> {PLATFORM_LABEL[p]}
                                  </button>
                              ))}
                          </div>

                          {linkPlatform === 'discord' ? discordPicker() : (<>

                          <div className="flex gap-2">
                              <input
                                  type="text"
                                  value={manualLinkTwitchUser}
                                  onChange={e => { setManualLinkTwitchUser(e.target.value); if (linkPlatform === 'twitch' && followersState === 'ready') setManualLinkTwitchData(null); }}
                                  placeholder={linkPlatform === 'twitch' ? (followersState === 'ready' && allFollowers.length ? (t.linkTwitchFilter || 'Filter followers, or any username') : (t.twitchUserHint || "Enter Twitch username")) : linkPlatform === 'youtube' ? (t.linkYoutubeHint || 'Name in YouTube chat, @handle or channel id') : "Enter TikTok username"}
                                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs font-bold outline-none text-white transition-colors"
                                  style={{ borderColor: undefined }}
                                  onKeyDown={(e) => e.key === 'Enter' && checkTwitchUser()}
                                  data-link-platform-input
                              />
                              <button
                                onClick={checkTwitchUser}
                                className="bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl px-3 transition-colors"
                                title={linkPlatform === 'tiktok' ? 'Set User' : t.findUser}
                              >
                                  {isSearchingYoutube ? <Loader2 size={16} className="animate-spin" /> : linkPlatform === 'tiktok' ? <CheckCircle size={16} /> : <Search size={16} />}
                              </button>
                          </div>

                          {manualLinkTwitchError && (
                              <p className="text-[10px] text-red-500 font-bold flex items-center gap-1"><AlertTriangle size={10} /> {manualLinkTwitchError}</p>
                          )}

                          {/* Twitch: everybody following, newest first, filtered as you type. */}
                          {linkPlatform === 'twitch' && !manualLinkTwitchData && followersState !== 'idle' && (
                              <div data-link-twitch-followers>
                                  <div className="flex items-center gap-2 mb-1.5 text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                                      <FollowerIcon size={10} className="text-[#9146FF]" /> {t.linkTwitchFollowers || 'Followers'}
                                      {followersState === 'ready' && <span className="ml-auto normal-case tracking-normal font-normal text-zinc-600">{shownFollowers.length} / {twitchFollowers?.total ?? allFollowers.length}</span>}
                                  </div>
                                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 max-h-[200px] overflow-y-auto">
                                      {followersState === 'loading' ? (
                                          <div className="p-4 text-center text-[10px] text-zinc-500 flex items-center justify-center gap-2"><Loader2 size={12} className="animate-spin" /> {t.linkTwitchLoading || 'Reading your followers…'}</div>
                                      ) : followersState === 'failed' ? (
                                          <div className="p-4 text-center text-[10px] text-zinc-500">{t.linkTwitchFailed || "Couldn't read your followers. Reconnect Twitch on the Connections screen, or type a username and press Enter."}</div>
                                      ) : (
                                          <div className="divide-y divide-zinc-800">
                                              {shownFollowers.slice(0, 200).map((f) => (
                                                  <button key={f.id} onClick={() => pickFollower(f)} className="w-full text-left p-2.5 hover:bg-white/5 flex items-center gap-3 transition-colors" data-link-twitch-follower={f.id}>
                                                      {f.avatar ? <img src={f.avatar} className="w-7 h-7 rounded-full" alt="" loading="lazy" /> : <div className="w-7 h-7 rounded-full bg-[#9146FF]/30 flex items-center justify-center text-[#9146FF]"><TwitchIcon size={12} /></div>}
                                                      <div className="flex-1 min-w-0">
                                                          <div className="text-xs font-bold text-zinc-300 truncate">{f.name}</div>
                                                          <div className="text-[9px] text-zinc-500 truncate">
                                                              {f.login && f.login.toLowerCase() !== f.name.toLowerCase() ? `@${f.login} · ` : ''}
                                                              {f.followedAt ? (t.linkTwitchFollowed || 'followed {date}').replace('{date}', new Date(f.followedAt).toLocaleDateString()) : f.id}
                                                          </div>
                                                      </div>
                                                      {linkedUsers?.[`twitch:${f.id}`] && <LinkIcon size={12} className="text-[#9146FF]" />}
                                                      <Plus size={14} className="text-zinc-500" />
                                                  </button>
                                              ))}
                                              {shownFollowers.length === 0 && <div className="p-4 text-center text-[10px] text-zinc-600 italic">{allFollowers.length ? (t.linkTwitchNobody || 'None of your followers by that name. Press Enter to look the name up on Twitch.') : (t.linkTwitchNone || 'Nobody follows yet. Type a username and press Enter.')}</div>}
                                              {shownFollowers.length > 200 && <div className="p-2 text-center text-[9px] text-zinc-600">{t.linkDiscordMore || 'Type to narrow the list down.'}</div>}
                                              {twitchFollowers && !twitchFollowers.complete && <div className="p-2 text-center text-[9px] text-zinc-600">{(t.linkTwitchPartial || 'Only your newest {n} followers are listed. Enter looks up anybody.').replace('{n}', String(allFollowers.length))}</div>}
                                          </div>
                                      )}
                                  </div>
                              </div>
                          )}

                          {/* YouTube: who it could be — people seen in its chat, and the channel an @handle or id names. */}
                          {linkPlatform === 'youtube' && youtubeResults && !manualLinkTwitchData && (youtubeResults.seen.length > 0 || youtubeResults.found) && (
                              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 max-h-[150px] overflow-y-auto divide-y divide-zinc-800" data-link-youtube-results>
                                  {[...(youtubeResults.found ? [{ ...youtubeResults.found, fromYoutube: true }] : []), ...youtubeResults.seen.filter((p: any) => p.id !== youtubeResults.found?.id)].map((p: any) => (
                                      <button key={p.id} onClick={() => pickYoutube(p)} className="w-full text-left p-2.5 hover:bg-white/5 flex items-center gap-3 transition-colors">
                                          {p.avatar ? <img src={p.avatar} className="w-7 h-7 rounded-full" alt="" /> : <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center"><YouTubeIcon size={12} /></div>}
                                          <div className="flex-1 min-w-0">
                                              <div className="text-xs font-bold text-zinc-300 truncate">{p.name}</div>
                                              <div className="text-[9px] text-zinc-500 truncate">{p.fromYoutube ? (t.linkYoutubeFromYoutube || 'Found on YouTube') : (t.linkYoutubeSeen || 'Seen in your YouTube chat')} · {p.id}</div>
                                          </div>
                                          <Plus size={14} className="text-zinc-500" />
                                      </button>
                                  ))}
                              </div>
                          )}

                          {/* Result Card */}
                          <div
                            className={`p-4 rounded-2xl border transition-all ${manualLinkTwitchData ? '' : 'bg-zinc-900/30 border-zinc-800 border-dashed opacity-50'}`}
                            style={manualLinkTwitchData ? { background: `${PLATFORM_COLOUR[linkPlatform]}1a`, borderColor: `${PLATFORM_COLOUR[linkPlatform]}4d` } : undefined}
                          >
                              {manualLinkTwitchData ? (
                                  <div className="flex items-center gap-3">
                                      {linkPlatform !== 'tiktok' && manualLinkTwitchData.profile_image_url ? (
                                          <img src={manualLinkTwitchData.profile_image_url} alt="" className="w-12 h-12 rounded-full border-2" style={{ borderColor: PLATFORM_COLOUR[linkPlatform] }} />
                                      ) : (
                                          <div className="w-12 h-12 rounded-full border-2 flex items-center justify-center" style={{ borderColor: PLATFORM_COLOUR[linkPlatform], background: `${PLATFORM_COLOUR[linkPlatform]}33` }}>
                                              <PlatformIcon platform={linkPlatform} size={20} />
                                          </div>
                                      )}
                                      <div className="min-w-0">
                                          <div className="text-sm font-bold text-white truncate">{manualLinkTwitchData.display_name}</div>
                                          {linkPlatform !== 'tiktok' && <div className="text-[10px] text-zinc-400 font-mono truncate">ID: {manualLinkTwitchData.id}</div>}
                                          {linkPlatform === 'tiktok' && <div className="text-[10px] text-zinc-400 italic">Passive Sync Enabled</div>}
                                      </div>
                                      <div className="ml-auto text-white p-1 rounded-full" style={{ background: PLATFORM_COLOUR[linkPlatform] }}><CheckCircle size={14} /></div>
                                      <button onClick={() => setManualLinkTwitchData(null)} className="text-zinc-500 hover:text-white" data-link-platform-clear><X size={14} /></button>
                                  </div>
                              ) : (
                                  <div className="flex flex-col items-center justify-center py-4 text-zinc-600">
                                      <User size={24} className="mb-2 opacity-50" />
                                      <span className="text-[10px] font-bold uppercase">No User Selected</span>
                                  </div>
                              )}
                          </div>

                          {/* Already somebody's: linking puts the two together rather than replacing anything. */}
                          {manualLinkTwitchData && (() => {
                              const owner = ownerOf(`${linkPlatform}:${pickedStreamId()}`);
                              if (!owner) return null;
                              const theirs = linkTarget && owner.uid === linkTarget.uid;
                              return (
                                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex gap-2 text-amber-500" data-link-owner>
                                      <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                                      <p className="text-[10px] leading-tight font-medium">{theirs
                                          ? (t.linkAlreadyTheirs || 'This account is already theirs.')
                                          : (t.linkAlreadyOwned || 'This account already belongs to {name}. Linking puts them together as one person.').replace('{name}', owner.name)}</p>
                                  </div>
                              );
                          })()}

                          {linkPlatform === 'tiktok' && manualLinkTwitchData && (
                              <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-3">
                                  <p className="text-[10px] text-zinc-400">
                                      <strong>Note:</strong> TikTok roles update automatically when the user chats, sends a gift, or follows while the stream is live.
                                  </p>
                              </div>
                          )}
                          {linkPlatform === 'youtube' && manualLinkTwitchData && (
                              <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-3">
                                  <p className="text-[10px] text-zinc-400">{t.linkYoutubeNote || 'YouTube roles update when they chat (membership, moderator) or send a Super Chat while you are live.'}</p>
                              </div>
                          )}
                          </>)}
                      </div>

                      {/* Right: Discord — everybody in the server, filtered as you type */}
                      <div className="space-y-4" data-link-discord-side>
                          {linkTarget ? (
                              <div className="space-y-3" data-link-person>
                                  <div className="flex items-center gap-2 mb-2">
                                      <User size={16} className="text-current-accent" />
                                      <span className="text-xs font-black uppercase tracking-widest text-zinc-400">{t.linkAddTo || 'Joins'}</span>
                                  </div>
                                  <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 space-y-3">
                                      <div className="flex items-center gap-3">
                                          {linkTarget.avatar ? <img src={linkTarget.avatar} className="w-10 h-10 rounded-full" alt="" /> : <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center"><User size={16} /></div>}
                                          <div className="min-w-0">
                                              <div className="text-sm font-bold text-white truncate">{linkTarget.name}</div>
                                              <div className="text-[10px] text-zinc-500">{(t.linkPersonLevel || 'Level {level} · {xp} XP').replace('{level}', String(linkTarget.level)).replace('{xp}', String(linkTarget.xp))}</div>
                                          </div>
                                      </div>
                                      <div className="flex flex-wrap gap-1.5">{linkTarget.accounts.map((a) => <AccountChip key={a.key} account={a} />)}</div>
                                  </div>
                                  <p className="text-[10px] text-zinc-500 leading-relaxed">{t.linkAddHint || 'The account on the left becomes theirs too. If it already belongs to somebody else, that person joins them, with their XP added together.'}</p>
                              </div>
                          ) : (
                              <>
                              <div className="flex items-center gap-2 mb-2">
                                  <DiscordIcon size={16} className="text-[#5865F2]" />
                                  <span className="text-xs font-black uppercase tracking-widest text-zinc-400">{t.discordIdentity || 'Discord Identity'}</span>
                                  {membersState === 'ready' && <span className="ml-auto text-[9px] text-zinc-600">{shownMembers.length} / {discordMembers.length}</span>}
                              </div>
                                  {discordPicker()}
                              </>
                          )}
                      </div>
                  </div>

                  <div className="p-6 border-t border-zinc-800 bg-zinc-950/50 flex justify-end items-center gap-3">
                      {linkError && <span className="mr-auto text-[11px] text-rose-400">{linkError}</span>}
                      <Button variant="secondary" onClick={() => setIsManualLinkModalOpen(false)}>Cancel</Button>
                      <Button 
                        onClick={executeManualLink} 
                        disabled={!canLink}
                        icon={<LinkIcon size={16} />}
                      >
                          {t.linkAccounts || 'Link Accounts'}
                      </Button>
                  </div>
              </div>
          </div>
      )}

      

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* LEFT COLUMN: INSTRUCTIONS & MAPPING */}
          <div className="space-y-6">
              {/* Instructions Card */}
              <div className={`glass-panel p-8 rounded-[40px] border ${activeTheme.borderClass} ${activeTheme.panelClass} relative overflow-hidden`}>
                  <div className="flex items-center gap-4 mb-6">
                      <div className="p-3 bg-indigo-500 rounded-2xl text-white shadow-lg"><LinkIcon size={24} /></div>
                      <div>
                          <h3 className="text-xl font-black uppercase tracking-tight">{t.linkTitle || 'Account linking'}</h3>
                          <p className="text-xs font-bold text-zinc-500">{t.linkSubtitle || 'One person, every account they have'}</p>
                      </div>
                  </div>

                  <div className="space-y-4 text-sm text-zinc-400" data-link-howto>
                      <p className="text-xs leading-relaxed">{t.linkIntro || 'Each viewer can have their Discord, Twitch, TikTok and YouTube accounts as one person: their XP is added together, and their Discord roles follow all of them. Link them here, or let viewers do it themselves.'}</p>

                      <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 space-y-3 text-[11px]">
                          <p className="font-bold text-white">{t.linkSelfTitle || 'Viewers link any two of their accounts themselves'}</p>
                          <p className="text-zinc-500">{t.linkSelfHow || 'On one platform they type !link and the other platform, with their name there. Then, on the other, the same the other way round. Within 15 minutes.'}</p>
                          <div className="space-y-1.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-zinc-500 w-20">Twitch</span><code className="bg-black/30 px-2 py-0.5 rounded text-purple-400 font-mono">!linkdiscord Ana</code>
                                  <span className="text-zinc-600">→</span>
                                  <span className="text-zinc-500">Discord</span><code className="bg-black/30 px-2 py-0.5 rounded text-indigo-400 font-mono">!linktwitch</code>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-zinc-500 w-20">Twitch</span><code className="bg-black/30 px-2 py-0.5 rounded text-purple-400 font-mono">!linktiktok ana.tt</code>
                                  <span className="text-zinc-600">→</span>
                                  <span className="text-zinc-500">TikTok</span><code className="bg-black/30 px-2 py-0.5 rounded text-pink-400 font-mono">!linktwitch AnaTV</code>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-zinc-500 w-20">YouTube</span><code className="bg-black/30 px-2 py-0.5 rounded text-red-400 font-mono">!linkdiscord Ana</code>
                                  <span className="text-zinc-600">→</span>
                                  <span className="text-zinc-500">Discord</span><code className="bg-black/30 px-2 py-0.5 rounded text-indigo-400 font-mono">!linkyoutube</code>
                              </div>
                          </div>
                          <p className="text-[10px] text-zinc-600">{t.linkSelfNote || 'In Discord the name can be left out: it confirms whatever asked for that Discord account. Both halves have to come from the accounts themselves, so nobody can link an account that is not theirs.'}</p>
                      </div>
                  </div>
              </div>

              {/* Role Mapping Section */}
              <div className={`glass-panel rounded-[40px] border ${activeTheme.borderClass} ${activeTheme.panelClass} overflow-hidden p-6`}>
                  <div className="flex justify-between items-center mb-6">
                      <div className="flex items-center gap-3">
                          <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl"><Shield size={18} /></div>
                          <h3 className="text-sm font-black uppercase tracking-tight">Role Synchronization</h3>
                      </div>
                      {/* Subscriptions that ran out are only found by asking Twitch — once a day. */}
                      <span className={`ml-auto mr-3 text-[10px] ${roleSyncSubsCheck && !roleSyncSubsCheck.ok ? 'text-amber-400' : 'text-zinc-500'}`} data-subs-check>
                          {!roleSyncSubsCheck ? (t.subsCheckNever || 'Subscriptions not checked yet')
                            : roleSyncSubsCheck.ok ? `${t.subsCheckOk || 'Subscriptions checked'} ${new Date(roleSyncSubsCheck.at).toLocaleString()}`
                              : `${t.subsCheckFailed || 'Could not check subscriptions'}: ${roleSyncSubsCheck.error}`}
                      </span>
                      <button 
                        onClick={handleRefreshRoles} 
                        className={`p-2 transition-colors bg-zinc-900/50 rounded-lg ${isRefreshing ? 'text-current-accent' : 'text-zinc-500 hover:text-white'}`}
                        title="Refresh Discord Roles"
                        disabled={isRefreshing}
                      >
                          {isRefreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                      </button>
                  </div>

                  {!discordGuildId ? (
                      <div className="text-center py-4 text-zinc-500 text-xs">
                          {t.connectDiscordFirst || 'Please connect your Discord bot and select a server in the Connections tab to enable this feature.'}
                      </div>
                  ) : (
                      <div className="space-y-6">
                          {/* Community Group */}
                          <div className="space-y-2">
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.commRoles || 'Community Roles'}</h4>
                              {renderMappingRow(t.followerRole || 'Follower', 'follower', FollowerIcon, 'bg-rose-500/10 border-rose-500/20 text-rose-500')}
                              {renderMappingRow(t.founderRole || 'Founder', 'founder', FounderIcon, 'bg-red-500/10 border-red-500/20 text-red-500')}
                          </div>

                          {/* Subscriptions Group */}
                          <div className="space-y-2">
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Subscriptions</h4>
                              {renderMappingRow('Tier 1 Subscriber', 'subscriberTier1', SubIcon, 'bg-violet-500/10 border-violet-500/20 text-violet-500')}
                              {renderMappingRow('Tier 2 Subscriber', 'subscriberTier2', SubIcon, 'bg-purple-500/10 border-purple-500/20 text-purple-500')}
                              {renderMappingRow('Tier 3 Subscriber', 'subscriberTier3', SubIcon, 'bg-fuchsia-500/10 border-fuchsia-500/20 text-fuchsia-500')}
                          </div>

                          {/* Specials Group */}
                          <div className="space-y-2">
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Special Roles</h4>
                              {renderMappingRow('VIP Member', 'vip', VipIcon, 'bg-pink-500/10 border-pink-500/20 text-pink-500')}
                              {renderMappingRow('Moderator', 'moderator', ModIcon, 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500')}
                          </div>

                          {/* Bits Group */}
                          <div className="space-y-2">
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.bitRoles || 'Bit Badges'}</h4>
                              {renderMappingRow(t.bits1k || '1k Bits', 'bits1k', BitIcon, 'bg-cyan-400/10 border-cyan-400/20 text-cyan-400')}
                              {renderMappingRow(t.bits5k || '5k Bits', 'bits5k', BitIcon, 'bg-blue-500/10 border-blue-500/20 text-blue-500')}
                              {renderMappingRow(t.bits10k || '10k Bits', 'bits10k', BitIcon, 'bg-orange-500/10 border-orange-500/20 text-orange-500')}
                              {renderMappingRow(t.bits25k || '25k Bits', 'bits25k', BitIcon, 'bg-amber-500/10 border-amber-500/20 text-amber-500')}
                          </div>
                          
                          {/* TikTok Group */}
                          <div className="space-y-2">
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1">
                                <TikTokIcon size={10} className="text-[#ff0050]" /> {t.tiktokRoles || 'TikTok Integration'}
                              </h4>
                              {renderMappingRow(t.tiktokFollowerRole || 'TikTok Follower', 'tiktokFollower', FollowerIcon, 'bg-[#ff0050]/10 border-[#ff0050]/20 text-[#ff0050]')}
                              {renderMappingRow(t.tiktokSubRole || 'TikTok Subscriber', 'tiktokSubscriber', SubIcon, 'bg-[#00f2ea]/10 border-[#00f2ea]/20 text-[#00f2ea]')}
                              {renderMappingRow(t.tiktokModRole || 'TikTok Moderator', 'tiktokModerator', ModIcon, 'bg-zinc-500/10 border-zinc-500/20 text-zinc-300')}
                              {renderMappingRow(t.tiktokGifterRole || 'TikTok Gifter', 'tiktokGifter', GiftIcon, 'bg-amber-500/10 border-amber-500/20 text-amber-500')}
                          </div>

                          {/* YouTube Group */}
                          <div className="space-y-2" data-youtube-roles>
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1">
                                <YouTubeIcon size={10} className="text-[#FF0000]" /> {t.youtubeRoles || 'YouTube Integration'}
                              </h4>
                              {renderMappingRow(t.youtubeMemberRole || 'YouTube Member', 'youtubeMember', SubIcon, 'bg-[#FF0000]/10 border-[#FF0000]/20 text-[#FF0000]')}
                              {renderMappingRow(t.youtubeModRole || 'YouTube Moderator', 'youtubeModerator', ModIcon, 'bg-zinc-500/10 border-zinc-500/20 text-zinc-300')}
                              {renderMappingRow(t.youtubeSuperChatRole || 'YouTube Super Chat', 'youtubeSuperChat', GiftIcon, 'bg-amber-500/10 border-amber-500/20 text-amber-500')}
                          </div>

                          {setLoyaltyRoles && <LoyaltyRoles rules={loyaltyRoles || []} roles={discordRoles || []} save={setLoyaltyRoles} t={t} />}

                          {moderation && (
                              <div className="space-y-2" data-mod-log>
                                  <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1"><Sword size={10} className="text-rose-400" /> {t.modLogTitle || 'Mod log'}</h4>
                                  <p className="text-[10px] text-zinc-600 leading-relaxed">{t.modLogHint || 'Bans and timeouts on Twitch and in Discord, and people taken out of TikTok\'s chat, written in a private channel with every other account of theirs — and buttons for a moderator to do the same there. Nothing is done on its own.'}</p>
                                  <select value={modSettings?.logChannelId || ''} onChange={(e) => moderation('settings', { settings: { logChannelId: e.target.value } })} className="w-full bg-zinc-950 border border-zinc-800 text-zinc-300 text-[11px] rounded-lg px-2 py-1.5" data-mod-log-channel>
                                      <option value="">{t.modLogNowhere || 'Nowhere (off)'}</option>
                                      {(system.connections.discordChannels || []).filter((c: any) => c.type === 0).map((c: any) => <option key={c.id} value={c.id}>#{c.name}</option>)}
                                  </select>
                                  <div className="flex flex-wrap gap-3">
                                      {([['logTwitch', 'Twitch'], ['logDiscord', 'Discord'], ['logTikTok', 'TikTok']] as const).map(([k, label]) => (
                                          <label key={k} className="flex items-center gap-1.5 cursor-pointer text-[10px] text-zinc-400"><input type="checkbox" checked={modSettings?.[k] !== false} onChange={(e) => moderation('settings', { settings: { [k]: e.target.checked } })} className="accent-current-accent" /> {label}</label>
                                      ))}
                                  </div>
                                  {(moderationLog || []).length > 0 && (
                                      <details>
                                          <summary className="text-[10px] text-zinc-500 cursor-pointer">{t.modLogRecent || 'Recently'}</summary>
                                          <div className="mt-1 space-y-0.5 max-h-40 overflow-y-auto">
                                              {(moderationLog || []).slice(0, 30).map((l: any, i: number) => (
                                                  <div key={i} className="text-[10px] text-zinc-400 truncate">{new Date(l.at).toLocaleString()} · {l.kind} · {l.platform} · {l.user}{l.done ? ' ✓' : ''}</div>
                                              ))}
                                          </div>
                                      </details>
                                  )}
                              </div>
                          )}
                      </div>
                  )}
              </div>
          </div>

          {/* RIGHT COLUMN: PENDING & LIST/LOGS */}
          <div className="space-y-4">
              {/* Pending Link Status - Iterating through map */}
              {pendingLinks && Object.entries(pendingLinks).length > 0 && (
                  <div className="space-y-2">
                      {Object.entries(pendingLinks).map(([key, data]: [string, any]) => {
                          const from = (data.platform || 'twitch') as PickPlatform;
                          const to = (data.want || 'discord') as PickPlatform;
                          return (
                              <div key={key} className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-5 flex items-center gap-4 animate-slide-up" data-link-waiting>
                                  <div className="p-2 bg-amber-500/20 rounded-full text-amber-500 animate-pulse shrink-0">
                                      <Clock size={18} />
                                  </div>
                                  <div className="min-w-0">
                                      <h4 className="text-xs font-bold text-amber-500 uppercase tracking-wide">{t.linkWaitingTitle || 'Waiting for the other half'}</h4>
                                      <p className="text-xs text-amber-200/70 mt-1 leading-relaxed">
                                          {(t.linkWaitingText || '{who} on {from} says they are {name} on {to}. Waiting for {name} to type {command} there.')
                                              .replace('{who}', data.twitchUser).replace('{from}', PLATFORM_LABEL[from]).replace(/\{name\}/g, data.discordName)
                                              .replace('{to}', PLATFORM_LABEL[to]).replace('{command}', `!link${from}`)}
                                      </p>
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              )}

              {/* Main Tabbed Panel */}
              <div className={`glass-panel rounded-[40px] border ${activeTheme.borderClass} ${activeTheme.panelClass} overflow-hidden flex flex-col h-[600px]`}>
                  {/* Header & Tabs */}
                  <div className="p-6 border-b border-zinc-800/50 flex flex-col gap-4">
                      <div className="flex justify-between items-center">
                          <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-zinc-800 self-start">
                              <button 
                                  onClick={() => setActiveTab('accounts')} 
                                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'accounts' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                              >
                                  <User size={14} /> Linked Accounts
                              </button>
                              <button 
                                  onClick={() => setActiveTab('activity')} 
                                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'activity' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                              >
                                  <List size={14} /> {t.syncLog || 'Sync Log'}
                              </button>
                          </div>
                          
                          {activeTab === 'accounts' && (
                              <div className="flex gap-2">
                                  <Button
                                      size="sm" 
                                      onClick={() => openManualLink()}
                                      icon={<LinkIcon size={14} />}
                                      disabled={!discordGuildId}
                                  >
                                      {t.manualLinkBtn || 'Manual Link'}
                                  </Button>
                              </div>
                          )}
                      </div>

                      {activeTab === 'accounts' && (
                          <div className="flex flex-col gap-2 animate-fade-in">
                              {/* Filter Bar */}
                              <div className="flex gap-2">
                                  <button onClick={() => setFilterPlatform('all')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${filterPlatform === 'all' ? 'bg-zinc-800 text-white' : 'bg-zinc-900/50 text-zinc-500 hover:text-zinc-300'}`}>All</button>
                                  <button onClick={() => setFilterPlatform('twitch')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-1 ${filterPlatform === 'twitch' ? 'bg-[#9146FF] text-white' : 'bg-zinc-900/50 text-zinc-500 hover:text-zinc-300'}`}><TwitchIcon size={10} /> Twitch</button>
                                  <button onClick={() => setFilterPlatform('tiktok')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-1 ${filterPlatform === 'tiktok' ? 'bg-[#ff0050] text-white' : 'bg-zinc-900/50 text-zinc-500 hover:text-zinc-300'}`}><TikTokIcon size={10} /> TikTok</button>
                                  <button onClick={() => setFilterPlatform('youtube')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-1 ${filterPlatform === 'youtube' ? 'bg-[#FF0000] text-white' : 'bg-zinc-900/50 text-zinc-500 hover:text-zinc-300'}`} data-link-filter="youtube"><YouTubeIcon size={10} /> YouTube</button>
                              </div>
                              
                              <div className="relative">
                                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
                                  <input 
                                    type="text" 
                                    placeholder="Search user or Discord name..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder-zinc-600 focus:border-current-accent outline-none"
                                  />
                              </div>
                          </div>
                      )}
                      
                      {activeTab === 'activity' && (
                          <div className="flex justify-between items-center animate-fade-in">
                              <span className="text-xs font-bold text-zinc-500">{syncLog?.length || 0} entries</span>
                              <button onClick={clearSyncLog} className="text-[10px] text-zinc-500 hover:text-red-500 flex items-center gap-1 transition-colors">
                                  <Trash2 size={12} /> {t.clearLog || 'Clear'}
                              </button>
                          </div>
                      )}
                  </div>
                  
                  <div className="p-2 flex-1 overflow-y-auto bg-black/10">
                      {activeTab === 'accounts' ? (
                          shownPeople.length === 0 ? (
                              <div className="text-center py-20 text-zinc-600">
                                  <p className="text-xs">{people.length ? (t.linkNobodyMatches || 'Nobody matches.') : (t.linkNobodyYet || 'Nobody is linked yet.')}</p>
                              </div>
                          ) : (
                              <div className="space-y-2" data-linked-people>
                                  {shownPeople.map((person) => {
                                      // Roles follow the stream accounts; any of them names the person to the server.
                                      const syncKey = person.accounts.find((a) => a.platform !== 'discord')?.key || person.accounts[0].key;
                                      const isSyncing = syncingUsers.has(syncKey);
                                      const hasDiscord = person.accounts.some((a) => a.platform === 'discord');
                                      return (
                                          <div key={person.uid} className="p-3 rounded-2xl bg-zinc-900/30 border border-zinc-800/60 hover:bg-zinc-900/50 transition-colors group animate-slide-up" data-linked-person={person.uid}>
                                              <div className="flex items-center gap-3">
                                                  {person.avatar ? <img src={person.avatar} alt="" className="w-9 h-9 rounded-full shrink-0" /> : <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center shrink-0"><User size={14} className="text-zinc-500" /></div>}
                                                  <div className="min-w-0 flex-1">
                                                      <div className="text-xs font-bold text-white truncate">{person.name}</div>
                                                      <div className="text-[9px] text-zinc-500">{(t.linkPersonLevel || 'Level {level} · {xp} XP').replace('{level}', String(person.level)).replace('{xp}', String(person.xp))}</div>
                                                  </div>
                                                  {hasDiscord && (
                                                      <button
                                                        onClick={() => handleForceSync(syncKey)}
                                                        className={`p-2 rounded-lg transition-colors ${isSyncing ? 'text-current-accent bg-current-accent/10' : 'text-zinc-600 hover:text-white hover:bg-zinc-700 opacity-0 group-hover:opacity-100'}`}
                                                        title={t.roleSyncNow || 'Sync roles now'}
                                                        disabled={isSyncing}
                                                      >
                                                          {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                                                      </button>
                                                  )}
                                                  <button onClick={() => openManualLink(person)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-[10px] font-bold text-zinc-300 hover:text-white hover:border-zinc-600" data-person-add>
                                                      <Plus size={11} /> {t.linkAddAccount || 'Add account'}
                                                  </button>
                                                  {moderation && person.accounts.some((a) => ['discord', 'twitch', 'youtube'].includes(a.platform)) && (
                                                      <button onClick={() => setModOpen(modOpen === person.uid ? '' : person.uid)} className={`p-1.5 rounded-lg border transition-colors ${modOpen === person.uid ? 'border-rose-500/50 text-rose-400' : 'border-zinc-800 text-zinc-500 hover:text-rose-400'}`} title={t.modModerate || 'Moderate'} data-person-moderate><Shield size={12} /></button>
                                                  )}
                                              </div>
                                              {modOpen === person.uid && (
                                                  <div className="mt-2 p-2 rounded-xl border border-rose-500/20 bg-rose-500/5 space-y-1.5" data-person-mod-menu>
                                                      {person.accounts.filter((a) => ['discord', 'twitch', 'youtube'].includes(a.platform)).map((a) => (
                                                          <div key={a.key} className="flex items-center gap-2 text-[10px]">
                                                              <span style={{ color: PLATFORM_COLOUR[a.platform] }} className="flex"><PlatformIcon platform={a.platform} size={11} /></span>
                                                              <span className="text-zinc-300 flex-1 truncate">{a.name}</span>
                                                              {(['timeout', 'ban'] as const).map((action) => {
                                                                  const key = `${a.key}:${action}`;
                                                                  return (
                                                                      <button key={action} onClick={async () => {
                                                                          if (modArmed !== key) { setModArmed(key); setTimeout(() => setModArmed((k) => (k === key ? '' : k)), 4000); return; }
                                                                          setModArmed('');
                                                                          try { await moderation('act', { uid: person.uid, platform: a.platform, action, key: a.key }); setModSaid((m) => ({ ...m, [person.uid]: `✅ ${action === 'ban' ? (t.modBanned || 'Banned') : (t.modTimedOut || 'Timed out')} · ${PLATFORM_LABEL[a.platform as PickPlatform]}` })); }
                                                                          catch (err: any) { setModSaid((m) => ({ ...m, [person.uid]: `⚠️ ${err?.message || err}` })); }
                                                                      }} className={`px-2 py-0.5 rounded-md border font-bold transition-colors ${modArmed === key ? 'bg-rose-500/30 border-rose-400 text-rose-200' : action === 'ban' ? 'border-rose-500/30 text-rose-400 hover:bg-rose-500/10' : 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10'}`} data-person-mod={key}>
                                                                          {modArmed === key ? (t.modSure || 'Again to confirm') : action === 'ban' ? (t.modBan || 'Ban') : (t.modTimeout || 'Timeout')}
                                                                      </button>
                                                                  );
                                                              })}
                                                          </div>
                                                      ))}
                                                      {modSaid[person.uid] && <p className="text-[10px] text-zinc-400">{modSaid[person.uid]}</p>}
                                                  </div>
                                              )}
                                              <div className="flex flex-wrap gap-1.5 mt-2.5">
                                                  {person.accounts.map((a) => (
                                                      <AccountChip key={a.key} account={a} armed={armedRemove === a.key} onRemove={() => removeAccount(a.key)} t={t} />
                                                  ))}
                                              </div>
                                          </div>
                                      );
                                  })}
                              </div>
                          )
                      ) : (
                          // ACTIVITY LOG TAB
                          syncLog && syncLog.length > 0 ? (
                              <div className="space-y-1">
                                  {syncLog.map((entry: SyncLogEntry) => {
                                      const logPlatform = (['tiktok', 'youtube'].includes(entry.platform as string) ? entry.platform : 'twitch') as LinkPlatform;
                                      return (
                                          <div key={entry.id} className="p-3 bg-zinc-900/30 border border-zinc-800/50 rounded-xl flex items-center justify-between animate-slide-up hover:bg-zinc-900/50 transition-colors">
                                              <div className="flex items-center gap-3">
                                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${entry.source === 'Auto' ? 'bg-indigo-500/10 text-indigo-500' : 'bg-orange-500/10 text-orange-500'}`}>
                                                      {entry.source === 'Auto' ? <Bot size={14} /> : <RefreshCcw size={14} />}
                                                  </div>
                                                  <div>
                                                      <div className="flex items-center gap-2">
                                                          <PlatformIcon platform={logPlatform} size={12} className={logPlatform === 'twitch' ? 'text-[#9146FF]' : logPlatform === 'tiktok' ? 'text-[#ff0050]' : 'text-[#FF0000]'} />
                                                          <span className="text-xs font-bold text-white">{entry.twitchUser}</span>
                                                          <span className="text-[9px] text-zinc-500">→</span>
                                                          <span className="text-[10px] font-black uppercase text-green-400 bg-green-900/20 px-1.5 py-0.5 rounded">
                                                              {entry.roleName}
                                                          </span>
                                                      </div>
                                                      <div className="text-[9px] text-zinc-500 mt-0.5">
                                                          Source: {entry.source === 'Auto' ? t.autoSync || 'Auto Sync' : t.manualSync || 'Manual Sync'}
                                                      </div>
                                                  </div>
                                              </div>
                                              <div className="text-[9px] font-mono text-zinc-600">
                                                  {new Date(entry.timestamp).toLocaleTimeString()}
                                              </div>
                                          </div>
                                      );
                                  })}
                              </div>
                          ) : (
                              <div className="text-center py-20 text-zinc-600">
                                  <p className="text-xs italic">{t.noSyncs || 'No sync activity recorded yet.'}</p>
                              </div>
                          )
                      )}
                  </div>
              </div>
          </div>
      </div>
    </div>
    );
};
