/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Add a typeface, from wherever a font picker is.
 *
 * Next to the picker rather than on a screen of its own, because wanting a
 * font you do not have happens while you are looking at the list of fonts you
 * do have. There is nothing to configure afterwards: the server declares the
 * face, the picker lists the name, and the name is what a layer stores.
 *
 * The @font-face declarations are a generated stylesheet the page linked at
 * load, so a first upload needs a reload before it will draw. Said plainly
 * rather than hidden, because a font that is selected and still not drawing
 * is the kind of thing somebody restarts OBS over.
 */
import React, { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { forgetCustomFonts } from '../hooks/useCustomFonts';
import { refusalWords } from '../words';

const EXTENSIONS = '.woff2,.woff,.ttf,.otf';

export const FontUploadButton = ({ onUploaded, t }: { onUploaded?: () => void; t: any }) => {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const upload = async (file: File) => {
    setState('busy');
    setMessage('');
    try {
      const res = await fetch(`/api/assets/${encodeURIComponent(file.name)}`, { method: 'POST', body: file });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `Upload failed (${res.status})`);
      forgetCustomFonts();
      setState('done');
      onUploaded?.();
    } catch (err: any) {
      setState('error');
      setMessage(refusalWords(t, err) || t.uploadFailed || 'Upload failed');
    }
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <input
        ref={input}
        type="file"
        accept={EXTENSIONS}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Cleared so the same file can be chosen again after a failure.
          e.target.value = '';
          if (file) upload(file);
        }}
      />
      <button
        onClick={() => input.current?.click()}
        disabled={state === 'busy'}
        className="flex items-center gap-1 px-1.5 py-1 rounded text-[8px] font-black uppercase tracking-widest border bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-700 disabled:opacity-50"
      >
        <Upload size={9} />
        {state === 'busy' ? (t.uploading || 'Sending') : (t.addFont || 'Add font')}
      </button>

      {state === 'done' && (
        <p className="text-[9px] text-zinc-500 mt-1 leading-relaxed">
          {t.fontAdded || 'Added. Reload this page and any open overlay to use it.'}
        </p>
      )}
      {state === 'error' && <p className="text-[9px] text-rose-400 mt-1 leading-relaxed">{message}</p>}
    </div>
  );
};
