
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
*/
import React from 'react';
import { AppView, ThemeConfig } from '../../types';
import { Button } from '../Button';
import { ArrowRight, Monitor, MessageSquare, Heart, Coins, Activity, BookOpen } from 'lucide-react';
import { fill } from '../../words';
import { SpotifyPlayer } from '../SpotifyPlayer';

interface DashboardViewProps {
  activeTheme: ThemeConfig;
  t: any;
  setView: (view: AppView) => void;
  spotify: any;
  /** The setup checklist, once the server has said enough to work it out. */
  setup?: { left: number; needed: number } | null;
}

const FloatingCard = ({ icon, label, color, delay, className }: { icon: React.ReactNode, label: string, color: string, delay: string, className?: string }) => (
  <div className={`absolute glass-panel p-4 rounded-2xl border border-zinc-800/50 flex items-center gap-3 shadow-2xl animate-float ${delay} ${className}`}>
    <div className={`p-2 rounded-lg ${color} text-white`}>
      {icon}
    </div>
    <span className="text-xs font-bold uppercase tracking-wide text-zinc-300">{label}</span>
  </div>
);

export const DashboardView: React.FC<DashboardViewProps> = ({ activeTheme, t, setView, spotify, setup }) => {
  return (
    <div className="animate-fade-in relative min-h-[80vh] flex flex-col items-center justify-center overflow-hidden">
      
      {/* Background Decor Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <FloatingCard 
          icon={<MessageSquare size={18} />} 
          label="Twitch Chat" 
          color="bg-[#9146FF]" 
          delay="" 
          className="top-10 left-[10%] opacity-40 md:opacity-100 hidden md:flex" 
        />
        <FloatingCard 
          icon={<Heart size={18} />} 
          label="New Follower" 
          color="bg-rose-500" 
          delay="animation-delay-2000" 
          className="bottom-20 right-[15%] opacity-40 md:opacity-100 hidden md:flex" 
        />
        <FloatingCard 
          icon={<Activity size={18} />} 
          label="OBS Active" 
          color="bg-emerald-500" 
          delay="animation-delay-4000" 
          className="top-32 right-[10%] opacity-30 md:opacity-80 hidden md:flex" 
        />
        <FloatingCard 
          icon={<Coins size={18} />} 
          label="Donation" 
          color="bg-amber-500" 
          delay="animation-delay-1000" 
          className="bottom-40 left-[20%] opacity-30 md:opacity-80 hidden md:flex" 
        />
      </div>

      <div className="text-center relative z-10 max-w-4xl mx-auto px-4 flex flex-col items-center">
        
        {/* Spotify Player (Shows if connected) */}
        {spotify.state.isConnected && (
            <div className="mb-8 w-full max-w-sm animate-slide-up">
                <SpotifyPlayer spotify={spotify} />
            </div>
        )}

        <h1 className={`text-5xl sm:text-6xl md:text-8xl font-black mb-8 ${activeTheme.id === 'light' ? 'text-zinc-900' : 'text-zinc-100'} tracking-tighter uppercase leading-[0.9] animate-slide-up`}>
          {t.heroTitle} <br />
          <span className={`text-transparent bg-clip-text bg-gradient-to-r ${activeTheme.id === 'light' ? 'from-rose-500 via-rose-600 to-rose-700' : 'from-rose-400 via-rose-500 to-rose-700'}`}>
            {t.heroTitleGradient}
          </span>
        </h1>
        
        <p className={`${activeTheme.id === 'light' ? 'text-zinc-600' : 'text-zinc-400'} text-base md:text-lg max-w-2xl mx-auto mb-12 font-medium leading-relaxed animate-slide-up`} style={{animationDelay: '100ms'}}>
          {t.heroDesc}
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up" style={{animationDelay: '200ms'}}>
          <Button size="lg" onClick={() => setView('gallery')} icon={<ArrowRight size={20} />} className="w-full sm:w-auto h-14 text-sm shadow-xl shadow-rose-500/20">
            {t.connectPlatforms}
          </Button>
          <Button size="lg" variant="secondary" onClick={() => setView('assets')} icon={<Monitor size={20} />} className="w-full sm:w-auto h-14 text-sm bg-zinc-900/80 backdrop-blur-md">
            {t.openChatDock}
          </Button>
        </div>

        {/* Where somebody new starts: the checklist while it has steps left, the guides after. */}
        <button
          type="button"
          onClick={() => setView('guides')}
          className={`mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-bold transition-colors animate-slide-up ${setup && setup.left ? 'border-current-accent/50 text-current-accent bg-current-accent/10 hover:bg-current-accent/20' : 'border-zinc-800 text-zinc-500 hover:text-zinc-200'}`}
          style={{ animationDelay: '300ms' }}
          data-dashboard-guides={setup ? setup.left : 'unknown'}
        >
          <BookOpen size={14} />
          {setup && setup.left
            ? fill(t.guidesDashboardLeft || 'Setting up: {done} of {needed} done — carry on', { done: String(setup.needed - setup.left), needed: String(setup.needed) })
            : (t.guidesDashboard || 'Guides: how to do anything here')}
        </button>
      </div>
    </div>
  );
};
