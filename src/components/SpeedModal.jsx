import React from 'react';
import { usePlayer } from '../context/PlayerContext';

export default function SpeedModal() {
    const { isSpeedOpen, setIsSpeedOpen, playbackRate, changePlaybackRate } = usePlayer();

    if (!isSpeedOpen) return null;

    const rates = [0.75, 1.0, 1.25, 1.5, 2.0];

    return (
        <div
            onClick={() => setIsSpeedOpen(false)}
            className="fixed inset-0 z-[300] flex items-end justify-center bg-black/60"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="bg-[#181922] w-full max-w-md rounded-t-3xl p-6 border-t border-white/10 animate-slide-up-modal space-y-4"
            >
                <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3"></div>
                <h3 className="text-white font-bold text-base">Kecepatan Putar</h3>

                <div className="grid grid-cols-5 gap-2">
                    {rates.map((r) => {
                        const isAct = playbackRate === r;
                        return (
                            <button
                                key={r}
                                onClick={() => {
                                    changePlaybackRate(r);
                                    setIsSpeedOpen(false);
                                }}
                                className={`py-3 rounded-2xl font-bold text-xs transition-all ${
                                    isAct
                                        ? 'bg-white text-black shadow-lg scale-105'
                                        : 'bg-white/5 hover:bg-white/10 text-white'
                                }`}
                            >
                                {r}x
                            </button>
                        );
                    })}
                </div>

                <button
                    onClick={() => setIsSpeedOpen(false)}
                    className="w-full py-3 bg-white/10 text-white font-bold rounded-full border border-white/10 active:scale-95 transition"
                >
                    Tutup
                </button>
            </div>
        </div>
    );
}
