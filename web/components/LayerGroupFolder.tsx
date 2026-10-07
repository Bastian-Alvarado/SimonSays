/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * A group of layers in the Overlays list: a folder holding its layers, which
 * move and resize together on the canvas (shared/layer-groups.js).
 *
 * The folder is one row of the list — dragged, it takes every layer in it to
 * the new place in the stack — and the layers inside are a list of their own,
 * dragged among themselves. Leaving the group is a button on the layer, not a
 * drag out of the folder: a drop that might or might not change what a layer
 * belongs to is a drop nobody can predict.
 */

import React from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Eye, EyeOff, Folder, FolderOpen, Lock, LockOpen, Ungroup } from 'lucide-react';
import { useDragOrder, DragGrip, DragOrder } from '../hooks/useDragOrder';
import { fill } from '../words';
import type { CanvasLayer } from './CanvasStage';

type Props = {
  group: { id: string; name: string };
  /** Its layers, front first, as the list shows them. */
  members: CanvasLayer[];
  /** The list the folder itself is a row of. */
  order: DragOrder;
  rowId: string;
  open: boolean;
  selected: boolean;
  onSelect: () => void;
  onToggleOpen: () => void;
  onMove: (delta: number) => void;
  onUngroup: () => void;
  onLock: (locked: boolean) => void;
  onShow: (visible: boolean) => void;
  onDropMember: (uid: string, gap: number) => void;
  /** One of its layers' rows, drawn by the screen that draws every other layer's. */
  renderMember: (layer: CanvasLayer, order: DragOrder) => React.ReactNode;
  /** What opens under the folder on a narrow screen when it is chosen. */
  editor?: React.ReactNode;
  t: any;
};

export const LayerGroupFolder = ({
  group, members, order, rowId, open, selected, onSelect, onToggleOpen, onMove, onUngroup, onLock, onShow, onDropMember, renderMember, editor, t,
}: Props) => {
  const memberOrder = useDragOrder(({ id, gap }) => onDropMember(id, gap));
  const allLocked = members.length > 0 && members.every((l) => l.locked);
  const anyShown = members.some((l) => l.visible);
  const Icon = open ? FolderOpen : Folder;
  return (
    <div
      {...order.row(rowId)}
      data-layer-group={group.id}
      className={`rounded-xl border transition-all ${
        selected ? 'border-current-accent bg-current-accent/10' : 'border-zinc-800 bg-zinc-900/40'
      } ${order.held === rowId ? 'opacity-40' : ''}`}
    >
      {/* On a narrow screen the buttons go under the name rather than squeezing it out. */}
      <div onClick={onSelect} className="flex flex-wrap items-center gap-x-2 gap-y-1 p-3 cursor-pointer">
        <DragGrip grip={order.grip(rowId)} title={t.layoutGroupDrag || 'Drag to move the whole group in front of or behind other layers'} className="-ml-2 -my-1" />
        <button
          onClick={(e) => { e.stopPropagation(); onToggleOpen(); }}
          title={open ? (t.layoutGroupFold || 'Fold') : (t.layoutGroupUnfold || 'Unfold')}
          className="-mx-1 p-0.5 text-zinc-500 hover:text-white"
          data-layer-group-fold
        >
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        <Icon size={14} className={`shrink-0 ${selected ? 'text-current-accent' : 'text-zinc-500'}`} />
        <span className="flex-1 min-w-[6rem] text-[10px] font-black uppercase tracking-widest text-zinc-200 truncate">
          {group.name}
          <span className="ml-1.5 font-medium normal-case tracking-normal text-zinc-500">
            {fill(t.layoutGroupCount || '{n} layers', { n: String(members.length) })}
          </span>
        </span>
        <div className="flex items-center ml-auto">
        <button
          onClick={(e) => { e.stopPropagation(); onLock(!allLocked); }}
          title={allLocked ? (t.layoutUnlock || 'Unlock') : (t.layoutLock || 'Lock')}
          className={`p-1 ${allLocked ? 'text-current-accent' : 'text-zinc-500 hover:text-white'}`}
        >
          {allLocked ? <Lock size={13} /> : <LockOpen size={13} />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onShow(!anyShown); }}
          title={anyShown ? (t.hide || 'Hide') : (t.show || 'Show')}
          className="p-1 text-zinc-500 hover:text-white"
        >
          {anyShown ? <Eye size={13} /> : <EyeOff size={13} />}
        </button>
        <button onClick={(e) => { e.stopPropagation(); onMove(1); }} className="p-1 text-zinc-500 hover:text-white">
          <ArrowUp size={13} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onMove(-1); }} className="p-1 text-zinc-500 hover:text-white">
          <ArrowDown size={13} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onUngroup(); }}
          title={t.layoutGroupUngroup || 'Ungroup'}
          className="p-1 text-zinc-500 hover:text-white"
          data-layer-ungroup
        >
          <Ungroup size={13} />
        </button>
        </div>
      </div>

      {selected && editor && <div className="px-3 pb-3 xl:hidden">{editor}</div>}

      {open && (
        <div ref={memberOrder.listRef} className={`relative space-y-2 pl-2 sm:pl-4 pr-2 pb-2 ml-1 sm:ml-3 border-l border-zinc-800 ${memberOrder.held ? 'select-none' : ''}`}>
          {memberOrder.line}
          {members.map((layer) => renderMember(layer, memberOrder))}
        </div>
      )}
    </div>
  );
};
