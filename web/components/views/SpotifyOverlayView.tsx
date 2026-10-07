
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
*/
import React, { useState } from 'react';
import { ThemeConfig } from '../../types';
import { Button } from '../Button';
import { SpotifyPlayer, SpotifyIcon } from '../SpotifyPlayer';
import { Check, Copy, Eye, EyeOff, Layers, ExternalLink, Activity } from 'lucide-react';
import { copyText } from '../../utils';

interface SpotifyOverlayViewProps {
  activeTheme: ThemeConfig;
  t: any;
  spotify: any;
}

export const SpotifyOverlayView: React.FC<SpotifyOverlayViewProps> = ({ activeTheme, t, spotify }) => {
  const [showProgress, setShowProgress] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [showBlur, setShowBlur] = useState(true);
  const [transparentCard, setTransparentCard] = useState(false);
  const [enableAnimation, setEnableAnimation] = useState(true);

  // Generate URL
  const getOverlayUrl = () => {
      const url = new URL(window.location.href);
      url.search = '';
      url.searchParams.set('mode', 'spotify');
      url.searchParams.set('showProgress', String(showProgress));
      url.searchParams.set('showControls', String(showControls));
      url.searchParams.set('showBlur', String(showBlur));
      url.searchParams.set('transparentCard', String(transparentCard));
      url.searchParams.set('enableAnimation', String(enableAnimation));
      // Re-add required auth params if present in current URL context logic, usually handled by localStorage in standalone
      return url.toString();
  };

  const overlayUrl = getOverlayUrl();

  return (
    <div className="animate-fade-in h-[calc(100vh-12rem)] flex flex-col md:flex-row gap-6 relative">
      
      {/* Settings Panel */}
      <aside className="w-full md:w-80 flex-shrink-0 flex flex-col gap-6 md:h-full">
        <div className={`glass-panel p-6 rounded-3xl flex flex-col gap-6 h-full border ${activeTheme.borderClass} ${activeTheme.panelClass} overflow-y-auto`}>
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-[#1DB954]/10 rounded-xl text-[#1DB954]"><SpotifyIcon size={20} /></div>
                <h3 className="text-lg font-black uppercase tracking-tight text-white">Overlay Settings</h3>
            </div>

            <div className="space-y-3">
                <button onClick={() => setShowProgress(!showProgress)} className={`w-full px-4 py-3 rounded-xl text-[10px] font-black border transition-all uppercase tracking-widest flex items-center justify-between ${showProgress ? 'bg-current-accent/10 border-current-accent text-current-accent' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800'}`}>
                    <span>Show Progress Bar</span>
                    {showProgress ? <Check size={14} /> : <EyeOff size={14} />}
                </button>
                <button onClick={() => setShowControls(!showControls)} className={`w-full px-4 py-3 rounded-xl text-[10px] font-black border transition-all uppercase tracking-widest flex items-center justify-between ${showControls ? 'bg-current-accent/10 border-current-accent text-current-accent' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800'}`}>
                    <span>Show Controls</span>
                    {showControls ? <Check size={14} /> : <EyeOff size={14} />}
                </button>
                <button onClick={() => setShowBlur(!showBlur)} className={`w-full px-4 py-3 rounded-xl text-[10px] font-black border transition-all uppercase tracking-widest flex items-center justify-between ${showBlur ? 'bg-current-accent/10 border-current-accent text-current-accent' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800'}`}>
                    <span>Blur Background</span>
                    {showBlur ? <Check size={14} /> : <EyeOff size={14} />}
                </button>
                <button onClick={() => setTransparentCard(!transparentCard)} className={`w-full px-4 py-3 rounded-xl text-[10px] font-black border transition-all uppercase tracking-widest flex items-center justify-between ${transparentCard ? 'bg-current-accent/10 border-current-accent text-current-accent' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800'}`}>
                    <span>Transparent Card</span>
                    {transparentCard ? <Check size={14} /> : <Layers size={14} />}
                </button>
                <button onClick={() => setEnableAnimation(!enableAnimation)} className={`w-full px-4 py-3 rounded-xl text-[10px] font-black border transition-all uppercase tracking-widest flex items-center justify-between ${enableAnimation ? 'bg-current-accent/10 border-current-accent text-current-accent' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800'}`}>
                    <span>Animations</span>
                    {enableAnimation ? <Check size={14} /> : <EyeOff size={14} />}
                </button>
            </div>

            <div className="pt-6 border-t border-zinc-800/50 mt-auto">
                <div className="space-y-1">
                    <label className="text-[9px] text-zinc-500 uppercase font-bold">OBS Browser Source URL</label>
                    <div className="flex bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
                        <input readOnly type="text" value={overlayUrl} className="bg-transparent text-[10px] font-mono text-zinc-400 p-2 w-full outline-none" />
                        <button onClick={() => copyText(overlayUrl)} className="px-3 hover:bg-zinc-800 text-zinc-500 hover:text-white border-l border-zinc-800 transition-colors"><Copy size={12} /></button>
                    </div>
                </div>
                <Button 
                    size="sm" 
                    variant="secondary" 
                    icon={<ExternalLink size={14} />} 
                    onClick={() => window.open(overlayUrl, '_blank', 'width=400,height=200,menubar=no,toolbar=no,location=no,status=no')} 
                    className="w-full mt-4 bg-zinc-800/50"
                >
                    Open Popout
                </Button>
            </div>
        </div>
      </aside>

      {/* Preview Panel */}
      <div className={`flex-1 flex items-center justify-center glass-panel rounded-3xl overflow-hidden border ${activeTheme.borderClass} relative ${activeTheme.id === 'light' ? 'bg-zinc-100' : 'bg-black/40'} min-h-[400px]`}>
          <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: `linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #333 75%), linear-gradient(-45deg, transparent 75%, #333 75%)`, backgroundSize: `20px 20px`, backgroundPosition: `0 0, 0 10px, 10px -10px, -10px 0px` }}></div>
          
          <div className="relative z-10 w-full max-w-sm transform scale-110">
              <SpotifyPlayer 
                  spotify={spotify} 
                  config={{ 
                      showProgress, 
                      showControls, 
                      showBlur, 
                      transparentCard,
                      enableAnimation
                  }} 
              />
          </div>
          
          <div className="absolute bottom-4 text-[10px] font-mono text-zinc-500 bg-black/50 px-2 py-1 rounded">
              Preview Mode
          </div>
      </div>

    </div>
  );
};
