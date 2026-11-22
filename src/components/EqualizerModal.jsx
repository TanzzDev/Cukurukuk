import React from 'react';
import { Volume2 } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

export default function EqualizerModal() {
    const {
        isEqualizerOpen,
        setIsEqualizerOpen,
        eqValues,
        setEqPreset,
        applyEqualizer,
        preampBoost,
        setPreampBoostLevel
    } = usePlayer();

    if (!isEqualizerOpen) return null;

    const presets = ['Normal', 'Bass Boost', 'Treble', 'Vocal', 'Electronic', 'Rock', 'Pop'];

    return (
        <div
            onClick={() => setIsEqualizerOpen(false)}
            className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="glass-strong rounded-3xl p-6 max-w-sm w-full space-y-5 animate-card-up border border-white/10"
                style={{ background: 'var(--bg-color)' }}
            >
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <h3 className="font-bold text-white text-base">Equalizer & Audio Boost</h3>
                    <button
                        onClick={() => setIsEqualizerOpen(false)}
                        className="text-white/60 hover:text-white text-xs px-2.5 py-1 rounded-full bg-white/5 cursor-pointer"
                    >
                        Tutup
                    </button>
                </div>

                {/* Preamp Volume Booster */}
                <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-white/90 font-bold flex items-center gap-1.5">
                            <Volume2 className="w-3.5 h-3.5 text-white" />
                            <span>Loudness Booster (Preamp)</span>
                        </span>
                        <span className="text-[11px] font-mono font-bold text-white bg-white/15 px-2 py-0.5 rounded-full border border-white/10">
                            {preampBoost || 1.8}x
                        </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                        {[
                            { label: 'Normal 1.0x', val: 1.0 },
                            { label: 'Loud 1.8x', val: 1.8 },
                            { label: 'Max 2.5x', val: 2.5 }
                        ].map((b) => (
                            <button
                                key={b.val}
                                type="button"
                                onClick={() => setPreampBoostLevel(b.val)}
                                className={`py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                    Math.abs((preampBoost || 1.8) - b.val) < 0.1
                                        ? 'bg-white text-black font-bold shadow-md'
                                        : 'bg-white/10 text-white/70 hover:text-white'
                                }`}
                            >
                                {b.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Preset Chips */}
                <div>
                    <p className="text-xs text-white/60 font-semibold mb-2">Preset Equalizer</p>
                    <div className="flex gap-1.5 overflow-x-auto hide-scrollbar pb-1">
                        {presets.map((p) => {
                            const isAct = eqValues.preset === p;
                            return (
                                <button
                                    key={p}
                                    onClick={() => setEqPreset(p)}
                                    className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                                        isAct
                                            ? 'bg-white text-black font-bold shadow-md'
                                            : 'bg-white/10 text-white/70 hover:text-white'
                                    }`}
                                >
                                    {p}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Slider Bars */}
                <div className="grid grid-cols-3 gap-4 pt-1 text-center">
                    <div>
                        <div className="h-28 flex items-center justify-center mb-2">
                            <input
                                type="range"
                                min="-10"
                                max="10"
                                value={eqValues.bass}
                                onChange={(e) => applyEqualizer(parseFloat(e.target.value), eqValues.mid, eqValues.treble)}
                                className="eq-slider"
                            />
                        </div>
                        <p className="text-xs font-bold text-white">Bass</p>
                        <p className="text-[10px] text-white/50">{eqValues.bass} dB</p>
                    </div>

                    <div>
                        <div className="h-28 flex items-center justify-center mb-2">
                            <input
                                type="range"
                                min="-10"
                                max="10"
                                value={eqValues.mid}
                                onChange={(e) => applyEqualizer(eqValues.bass, parseFloat(e.target.value), eqValues.treble)}
                                className="eq-slider"
                            />
                        </div>
                        <p className="text-xs font-bold text-white">Mid</p>
                        <p className="text-[10px] text-white/50">{eqValues.mid} dB</p>
                    </div>

                    <div>
                        <div className="h-28 flex items-center justify-center mb-2">
                            <input
                                type="range"
                                min="-10"
                                max="10"
                                value={eqValues.treble}
                                onChange={(e) => applyEqualizer(eqValues.bass, eqValues.mid, parseFloat(e.target.value))}
                                className="eq-slider"
                            />
                        </div>
                        <p className="text-xs font-bold text-white">Treble</p>
                        <p className="text-[10px] text-white/50">{eqValues.treble} dB</p>
                    </div>
                </div>

                <button
                    onClick={() => setIsEqualizerOpen(false)}
                    className="w-full btn-chrome py-2.5 rounded-xl font-bold text-xs cursor-pointer"
                >
                    Selesai
                </button>
            </div>
        </div>
    );
}
