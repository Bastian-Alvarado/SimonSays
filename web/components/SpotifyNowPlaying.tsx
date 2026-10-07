/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * What is playing, as a thing a stylesheet can rearrange.
 *
 * Separate from the player on the dashboard, which has buttons and hover
 * states and is a card because it is a card. Those are what forced its shape:
 * a browser source cannot be clicked, so on stream they are dead weight, and
 * arranging around them is arranging around nothing.
 *
 * The one idea here is that **every part is a sibling**. Nothing wraps
 * anything, so nothing groups anything, so a stylesheet is free to place them
 * however it likes — the container is a grid and each part names an area. A
 * card and a single-line bar are then the same markup with a different
 * `grid-template-areas`, which is the difference between a layer you can
 * restyle and a layer you can reshape.
 *
 * Nesting is what usually stops that. Art wrapped together with the title in
 * one row, the progress in another, means CSS can only ever move those two
 * rows about: pulling the title out to sit beside the progress is impossible
 * without rewriting the component, which is exactly the wall this is here to
 * take down.
 *
 * Two more things travel with the markup, because a layout is not the only
 * thing somebody wants to drive:
 *
 *   --spotify-progress   how far through, as a percentage. The fill uses it,
 *                        and so can anything else: a gradient stop, a mask, a
 *                        width on something that is not the fill at all.
 *   data-spotify-state   playing, paused or idle, so a rule can answer the
 *                        state without anything being told to add a class.
 */
import React from 'react';
import { SpotifyState } from '../types';

export interface SpotifyNowPlayingConfig {
  /** Sample values, so the editor can draw one before anything is playing. */
  preview?: boolean;
}

interface Props {
  spotify: { state: SpotifyState };
  config?: SpotifyNowPlayingConfig;
  /** The words, in the stream's language on stream. */
  t?: any;
}

/** m:ss, from milliseconds. */
const clock = (ms: number) => {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/*
  A stand-in cover rather than none: a record. Without one the art is not
  rendered at all, and the layout would have a hole where the biggest part of
  it goes — in a library card, and on stream between songs.
*/
const RECORD = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
  + '<rect width="64" height="64" fill="#1f1f27"/>'
  + '<circle cx="32" cy="32" r="13" fill="none" stroke="#3f3f4a" stroke-width="6"/>'
  + '<circle cx="32" cy="32" r="3" fill="#3f3f4a"/></svg>');

const SAMPLE = {
  name: 'Blue Monday',
  artist: 'New Order',
  album: 'Power, Corruption & Lies',
  coverUrl: RECORD,
  progress: 132000,
  duration: 448000,
  isPlaying: true,
};

export const SpotifyNowPlaying = ({ spotify, config, t }: Props) => {
  const live = spotify?.state?.track;
  const track = config?.preview ? SAMPLE : live;

  /*
    Nothing playing is the same player with nothing in it, not a hole. A
    layer that vanished between songs left an empty space in whatever was
    designed around it, so it keeps its shape: the record for a cover, words
    saying so where the song would be, times that have not started and an
    empty bar — and its state named idle, for a look that wants to dim it.

    To have it go away between songs instead, the layer's "A song is playing"
    condition does that, the same way any other layer appears only when it
    has something to say.
  */
  if (!track) {
    return (
      <div className="spotify-now-playing" data-spotify="player" data-spotify-state="idle" style={{ ['--spotify-progress' as any]: '0%' }}>
        <img className="spotify-art" data-spotify="art" src={RECORD} alt="" />
        <span className="spotify-label" data-spotify="label">{t?.spotifyNowPlaying || 'Now playing'}</span>
        <span className="spotify-title" data-spotify="title">{t?.spotifyIdleTitle || 'Nothing right now'}</span>
        <span className="spotify-artist" data-spotify="artist">Spotify</span>
        <span className="spotify-album" data-spotify="album" />
        <span className="spotify-elapsed" data-spotify="elapsed">-:--</span>
        <span className="spotify-duration" data-spotify="duration">-:--</span>
        <div className="spotify-progress" data-spotify="progress">
          <div className="spotify-fill" data-spotify="fill" />
        </div>
      </div>
    );
  }

  const pct = track.duration ? Math.max(0, Math.min(100, (track.progress / track.duration) * 100)) : 0;

  return (
    <div
      className="spotify-now-playing" data-spotify="player" data-spotify-state={track.isPlaying ? 'playing' : 'paused'}
      style={{ ['--spotify-progress' as any]: `${pct}%` }}
    >
      {/*
        Every one of these is a direct child, and that is the whole design.
        Wrapping any two of them together would decide for a stylesheet that
        those two belong side by side.
      */}
      {Boolean(track.coverUrl) && <img className="spotify-art" data-spotify="art" src={track.coverUrl} alt="" />}
      <span className="spotify-label" data-spotify="label">{t?.spotifyNowPlaying || 'Now playing'}</span>
      <span className="spotify-title" data-spotify="title">{track.name}</span>
      <span className="spotify-artist" data-spotify="artist">{track.artist}</span>
      <span className="spotify-album" data-spotify="album">{track.album}</span>
      <span className="spotify-elapsed" data-spotify="elapsed">{clock(track.progress)}</span>
      <span className="spotify-duration" data-spotify="duration">{clock(track.duration)}</span>

      {/*
        The one nesting there is, because a fill has to sit inside something
        to be clipped by it. A look that would rather draw its own can hide
        this pair and use --spotify-progress on whatever it likes.
      */}
      <div className="spotify-progress" data-spotify="progress">
        <div className="spotify-fill" data-spotify="fill" />
      </div>
    </div>
  );
};
