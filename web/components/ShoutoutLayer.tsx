/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The shoutout card: who is being shouted out — their picture, their name,
 * what they were playing and where to find them — for as long as the Twitch
 * screen says, whenever somebody raids or a "!so" goes out. The server keeps
 * the card (shoutoutCard); this only draws it.
 *
 * Plain on purpose; a look dresses it. Its parts name themselves
 * (data-shoutout="frame", "avatar", "text", "title", "name", "game", "link",
 * "viewers").
 */
import React from 'react';

export interface ShoutoutLayerConfig {
  title?: string;
  gameText?: string;
  viewersText?: string;
  showViewers?: boolean;
}

export interface ShoutoutCard {
  name: string;
  login: string;
  avatar?: string;
  game?: string;
  viewers?: number | string;
  at: number;
}

const KEYFRAMES = '@keyframes simonsaysShoutIn { from { transform: translateY(12%); opacity: 0; } to { transform: none; opacity: 1; } }';

export const ShoutoutLayer = ({ config, card }: { config: ShoutoutLayerConfig; card?: ShoutoutCard | null }) => {
  if (!card) return null;
  const viewers = Number(card.viewers) || 0;
  // Sized from the layer's box: the wrapper is that box, so the frame's own sizes can be measured against it.
  return (
    <div className="w-full h-full" style={{ containerType: 'size' }}>
    <style>{KEYFRAMES}</style>
    <div
      key={card.at}
      className="w-full h-full flex items-center overflow-hidden rounded-2xl text-white"
      data-shoutout="frame"
      style={{ background: 'rgba(10,10,11,.78)', padding: '0 6cqh', gap: '6cqh', animation: 'simonsaysShoutIn 450ms ease-out both' }}
    >
      {card.avatar && (
        <img src={card.avatar} alt="" className="shrink-0 rounded-full object-cover" data-shoutout="avatar" style={{ height: '70cqh', aspectRatio: '1 / 1' }} />
      )}
      <div className="min-w-0 flex-1 flex flex-col justify-center" data-shoutout="text" style={{ gap: '3cqh' }}>
        <span className="uppercase tracking-widest font-black truncate opacity-70" data-shoutout="title" style={{ fontSize: '11cqh' }}>
          {config.title || '¡Vayan a seguirle!'}
        </span>
        <span className="font-black truncate leading-none" data-shoutout="name" style={{ fontSize: '24cqh', color: 'var(--overlay-accent, #ffffff)' }}>{card.name}</span>
        {card.game && (
          <span className="font-bold truncate" data-shoutout="game" style={{ fontSize: '12cqh' }}>
            {(config.gameText || 'Estaba jugando {game}').split('{game}').join(card.game)}
          </span>
        )}
        <span className="font-bold truncate opacity-60" data-shoutout="link" style={{ fontSize: '10cqh' }}>twitch.tv/{card.login}</span>
      </div>
      {config.showViewers !== false && viewers > 0 && (
        <span className="shrink-0 font-black tabular-nums" data-shoutout="viewers" style={{ fontSize: '14cqh' }}>
          {(config.viewersText || '+{viewers}').split('{viewers}').join(viewers.toLocaleString())}
        </span>
      )}
    </div>
    </div>
  );
};
