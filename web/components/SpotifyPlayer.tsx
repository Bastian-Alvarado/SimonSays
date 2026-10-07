
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
*/
import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Music, AlertCircle } from 'lucide-react';
import { SpotifyState } from '../types';

interface SpotifyPlayerProps {
  spotify: {
    state: SpotifyState;
    controls: {
      next: () => void;
      previous: () => void;
      play: () => void;
      pause: () => void;
      refresh: () => void;
    };
  };
  // Optional config for overlay customization
  config?: {
      showProgress?: boolean;
      showControls?: boolean;
      showBlur?: boolean;
      transparentCard?: boolean;
      enableAnimation?: boolean;
  }
}

export const SpotifyIcon = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.48.66.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.32z"/>
  </svg>
);

export const SpotifyPlayer: React.FC<SpotifyPlayerProps> = ({ spotify, config }) => {
  const { state, controls } = spotify;
  
  const showProgress = config?.showProgress !== false;
  const showControls = config?.showControls !== false;
  const showBlur = config?.showBlur !== false;
  const transparentCard = config?.transparentCard || false;
  const enableAnimation = config?.enableAnimation !== false;

  if (!state.isConnected) return null;

  const progressPercent = state.track ? (state.track.progress / state.track.duration) * 100 : 0;

  return (
    <div className={`rounded-3xl p-6 w-full max-w-sm relative overflow-hidden group animate-fade-in ${transparentCard ? 'bg-transparent' : 'bg-[#191414] border border-[#1DB954]/20 shadow-[0_0_30px_-10px_rgba(29,185,84,0.3)]'}`}>
      {/* Background Blur Effect */}
      {showBlur && !transparentCard && state.track?.coverUrl && (
        <div 
          className="absolute inset-0 opacity-20 blur-2xl z-0 transition-opacity duration-1000"
          style={{ backgroundImage: `url(${state.track.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        />
      )}
      
      <div className="relative z-10 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between text-[#1DB954]">
          <SpotifyIcon size={24} />
          <span className="text-[10px] font-black uppercase tracking-widest bg-[#1DB954]/10 px-2 py-1 rounded-full">
            {state.track ? 'Now Playing' : 'Spotify Connected'}
          </span>
        </div>

        {state.track ? (
          <>
            <div className="flex items-center gap-4">
              <div className="relative group/cover">
                <img 
                  src={state.track.coverUrl} 
                  alt="Album Art" 
                  className={`w-20 h-20 rounded-2xl shadow-lg object-cover border border-white/10 ${state.track.isPlaying && enableAnimation ? 'animate-pulse-slow' : ''}`} 
                />
                <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover/cover:opacity-100 transition-opacity flex items-center justify-center">
                    <Music size={20} className="text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-white font-bold text-lg truncate leading-tight mb-1">{state.track.name}</h4>
                <p className="text-zinc-400 text-xs font-medium truncate">{state.track.artist}</p>
                <p className="text-zinc-500 text-[10px] truncate mt-0.5 opacity-60">{state.track.album}</p>
              </div>
            </div>

            {/* Progress Bar */}
            {showProgress && (
                <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden mt-1">
                  <div 
                    className="h-full bg-[#1DB954] transition-all duration-1000 ease-linear"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
            )}

            {/* Controls */}
            {showControls && (
                <div className="flex items-center justify-center gap-6 pt-1">
                  <button onClick={controls.previous} className="text-zinc-400 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full">
                    <SkipBack size={20} fill="currentColor" />
                  </button>
                  <button 
                    onClick={state.track.isPlaying ? controls.pause : controls.play}
                    className="w-12 h-12 bg-[#1DB954] hover:bg-[#1ed760] text-black rounded-full flex items-center justify-center transition-all hover:scale-105 shadow-lg shadow-[#1DB954]/20"
                  >
                    {state.track.isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                  </button>
                  <button onClick={controls.next} className="text-zinc-400 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full">
                    <SkipForward size={20} fill="currentColor" />
                  </button>
                </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-zinc-500 gap-2">
            <AlertCircle size={32} className="opacity-50" />
            <div className="text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">No Active Playback</p>
                <p className="text-[10px] text-zinc-600 mt-1">Play something on Spotify to see it here.</p>
            </div>
            {showControls && (
                <button onClick={controls.refresh} className="mt-2 text-[10px] text-[#1DB954] hover:underline">
                    Refresh Status
                </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
