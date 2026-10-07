
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
*/
import React, { useState } from 'react';
import { X, Hash } from 'lucide-react';

export const STANDARD_EMOJIS = {
    "Smileys": ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗", "🤔", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯", "😦", "😧", "😮", "😲", "🥱", "😴", "🤤", "😪", "😵", "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕", "🤑", "🤠", "😈", "👿", "👹", "👺", "🤡", "💩", "👻", "💀", "☠️", "👽", "👾", "🤖", "🎃", "😺", "😸", "😹", "😻", "😼", "😽", "🙀", "😿", "😾"],
    "Hand": ["👋", "🤚", "✋", "🖖", "👌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "💅", "🤳", "💪", "🦾", "🦿", "🦵", "🦶", "👂", "🦻", "👃", "🧠", "🫀", "🫁", "🦷", "🦴", "👀", "👁️", "👅", "👄", "💋"],
    "Hearts": ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟"],
    "Objects": ["🎮", "🕹️", "🎲", "🎯", "🎳", "🎧", "🎤", "🎼", "🎹", "🥁", "🎷", "🎺", "🎸", "🪕", "🎻", "🎨", "🎬", "💎", "💍", "👑", "🧢", "👟", "🎒", "👓", "🕶️", "☂️", "🔥", "💧", "⚡", "✨", "🌟", "⭐", "🌙", "☀️", "☁️", "🌈", "🍔", "🍟", "🍕", "🌭", "🥪", "🌮", "🌯", "🥗", "🥘", "🍝", "🍜", "🍲", "🍛", "🍣", "🍱", "🥟", "🍤", "🍙", "🍚", "🍘", "🍥", "🥠", "🍢", "🍡", "🍧", "🍨", "🍦", "🥧", "🧁", "🍰", "🎂", "🍮", "🍭", "🍬", "🍫", "🍿", "🍩", "🍪", "🌰", "🥜", "🍯", "🥛", "🍼", "☕️", "🍵", "🧃", "🥤", "🍶", "🍺", "🍻", "🥂", "🍷", "🥃", "🍸", "🍹", "🧉", "🍾", "🧊", "🥄", "🍴", "🍽️", "🥣", "🥡", "🥢", "🧂"],
    "Symbols": ["✅", "❎", "✳️", "❇️", "❌", "🚫", "🛑", "💯", "💢", "♨️", "🚷", "🚯", "🚱", "🚳", "🚭", "🔞", "📵", "❗️", "❕", "❓", "❔", "‼️", "⁉️", "🔅", "🔆", "⚠️", "🚸", "🔱", "⚜️", "🔰", "♻️", "🈯️", "💹", "❇️", "✳️", "❎", "🌐", "💠", "Ⓜ️", "🌀", "💤", "🏧", "🚾", "♿️", "🅿️", "🈳", "🈂️", "🛂", "🛃", "🛄", "🛅"],
    "Flags": ["🏳️", "🏴", "🏁", "🚩", "🏳️‍🌈", "🏳️‍⚧️", "🇦🇨", "🇦🇩", "🇦🇪", "🇦🇫", "🇦🇬", "🇦🇮", "🇦🇱", "🇦🇲", "🇦🇴", "🇦🇶", "🇦🇷", "🇦🇸", "🇦🇹", "🇦🇺", "🇦🇼", "🇦🇽", "🇦🇿", "🇧🇦", "🇧🇧", "🇧🇩", "🇧🇪", "🇧🇫", "🇧🇬", "🇧🇭", "🇧🇮", "🇧🇯", "🇧🇱", "🇧🇲", "🇧🇳", "🇧🇴", "🇧bq", "🇧🇷", "🇧🇸", "🇧🇹", "🇧🇻", "🇧🇼", "🇧🇾", "🇧🇿", "🇨🇦", "🇨🇨", "🇨🇩", "🇨🇫", "🇨🇬", "🇨🇭", "🇨🇮", "🇨🇰", "🇨🇱", "🇨🇲", "🇨🇳", "🇨🇴", "🇨🇵", "🇨🇷", "🇨🇺", "🇨🇻", "🇨🇼", "🇨🇽", "🇨🇾", "🇨🇿", "🇩🇪", "🇩🇬", "🇩🇯", "🇩🇰", "🇩🇲", "🇩🇴", "🇩🇿", "🇪🇦", "🇪🇨", "🇪🇪", "🇪🇬", "🇪🇭", "🇪🇷", "🇪🇸", "🇪🇹", "🇪🇺", "🇫🇮", "🇫🇯", "🇫🇰", "🇫🇲", "🇫🇴", "🇫🇷", "🇬🇦", "🇬🇧", "🇬🇩", "🇬🇪", "🇬🇫", "🇬🇬", "🇬🇭", "🇬🇮", "🇬🇱", "🇬🇲", "🇬🇳", "🇬🇵", "🇬🇶", "🇬🇷", "🇬🇸", "🇬🇹", "🇬🇺", "🇬🇼", "🇬🇾", "🇭🇰", "🇭🇲", "🇭🇳", "🇭🇷", "🇭🇹", "🇭🇺", "🇮🇨", "🇮🇩", "🇮🇪", "🇮🇱", "🇮🇲", "🇮🇳", "🇮🇴", "🇮🇶", "🇮🇷", "🇮🇸", "🇮🇹", "🇯🇪", "🇯🇲", "🇯🇴", "🇯🇵", "🇰🇪", "🇰🇬", "🇰🇭", "🇰🇮", "🇰🇲", "🇰🇳", "🇰🇵", "🇰🇷", "🇰🇼", "🇰🇾", "🇰🇿", "🇱🇦", "🇱🇧", "🇱🇨", "🇱🇮", "🇱🇰", "🇱🇷", "🇱🇸", "🇱🇹", "🇱🇺", "🇱🇻", "🇱🇾", "🇲🇦", "🇲🇨", "🇲🇩", "🇲🇪", "🇲🇫", "🇲🇬", "🇲🇭", "🇲🇰", "🇲🇱", "🇲🇲", "🇲🇳", "🇲🇴", "🇲🇵", "🇲🇶", "🇲🇷", "🇲🇸", "🇲🇹", "🇲🇺", "🇲🇻", "🇲🇼", "🇲🇽", "🇲🇾", "🇲🇿", "🇳🇦", "🇳🇨", "🇳🇪", "🇳🇫", "🇳🇬", "🇳🇮", "🇳🇱", "🇳🇴", "🇳🇵", "🇳🇷", "🇳🇺", "🇳🇿", "🇴🇲", "🇵🇦", "🇵🇪", "🇵🇫", "🇵🇬", "🇵🇭", "🇵🇰", "🇵🇱", "🇵🇲", "🇵🇳", "🇵🇷", "🇵🇸", "🇵🇹", "🇵🇼", "🇵🇾", "🇶🇦", "🇷🇪", "🇷🇴", "🇷🇸", "🇷🇺", "🇷🇼", "🇸🇦", "🇸🇧", "🇸🇨", "🇸🇩", "🇸🇪", "🇸🇬", "🇸🇭", "🇸🇮", "🇸🇯", "🇸🇰", "🇸🇱", "🇸🇲", "🇸🇳", "🇸🇴", "🇸🇷", "🇸🇸", "🇸🇹", "🇸🇻", "🇸🇽", "🇸🇾", "🇸🇿", "🇹🇦", "🇹🇨", "🇹🇩", "🇹🇫", "🇹🇬", "🇹🇭", "🇹🇯", "🇹🇰", "🇹🇱", "🇹🇲", "🇹🇳", "🇹🇴", "🇹🇷", "🇹🇹", "🇹🇻", "🇹🇼", "🇹🇿", "🇺🇦", "🇺🇬", "🇺🇲", "🇺🇳", "🇺🇸", "🇺🇾", "🇺🇿", "🇻🇦", "🇻🇨", "🇻🇪", "🇻🇬", "🇻🇮", "🇻🇳", "🇻🇺", "🇼🇫", "🇼🇸", "🇽🇰", "🇾🇪", "🇾🇹", "🇿🇦", "🇿🇲", "🇿🇼"]
};

interface EmojiPickerProps {
    style: React.CSSProperties;
    onSelect: (emoji: string) => void;
    onClose: () => void;
    customEmojis?: any[];
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ 
    style, 
    onSelect, 
    onClose, 
    customEmojis 
}) => {
    const [category, setCategory] = useState<string>("Smileys");

    return (
        <div 
            className="fixed z-[9999] bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl p-4 w-80 max-h-[400px] overflow-hidden animate-fade-in flex flex-col gap-2"
            style={style}
            onMouseDown={(e) => e.stopPropagation()} // Prevent closing when clicking inside
        >
            <div className="flex justify-between items-center pb-2 border-b border-zinc-800 shrink-0">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Select Emoji</span>
                <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={14} /></button>
            </div>

            {/* Custom Server Emojis */}
            {customEmojis && customEmojis.length > 0 && (
                <div className="shrink-0 mb-2">
                    <div className="text-[10px] font-bold text-indigo-400 mb-2 uppercase tracking-wider flex items-center gap-2">
                        <Hash size={10} /> Server Emojis
                    </div>
                    <div className="grid grid-cols-7 gap-1 max-h-32 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-700">
                        {customEmojis.map(emoji => (
                            <button 
                                key={emoji.id} 
                                onClick={(e) => { 
                                    e.preventDefault();
                                    // Format: <name:id> or <a:name:id> for animated
                                    const format = `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`;
                                    onSelect(format); 
                                    onClose(); 
                                }} 
                                className="p-1 hover:bg-zinc-800 rounded flex items-center justify-center transition-colors"
                                title={`:${emoji.name}:`}
                            >
                                <img 
                                    src={`https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? 'gif' : 'png'}`} 
                                    alt={emoji.name} 
                                    className="w-6 h-6 object-contain" 
                                />
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Category Tabs */}
            <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide border-b border-zinc-800 shrink-0">
                {Object.keys(STANDARD_EMOJIS).map(cat => (
                    <button 
                        key={cat}
                        onClick={(e) => { e.preventDefault(); setCategory(cat); }}
                        className={`px-2 py-1 text-[9px] font-bold uppercase rounded-md whitespace-nowrap transition-colors ${category === cat ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Standard Emojis Grid */}
            <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-700">
                <div className="grid grid-cols-7 gap-1">
                    {/* @ts-ignore */}
                    {STANDARD_EMOJIS[category].map(emoji => (
                        <button 
                            key={emoji} 
                            onClick={(e) => { e.preventDefault(); onSelect(emoji); onClose(); }} 
                            className="p-1 hover:bg-zinc-800 rounded text-xl flex items-center justify-center transition-colors h-8 w-8"
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
