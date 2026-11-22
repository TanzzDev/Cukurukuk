import React from 'react';
import { usePlayer } from '../context/PlayerContext';

export default function SleepTimerModal() {
    const { isSleepTimerOpen, setIsSleepTimerOpen, sleepSecondsLeft, setSleepTimer } = usePlayer();

    if (!isSleepTimerOpen) return null;

    const options = [
        { label: 'Matikan', minutes: 0 },
        { label: '15 Menit', minutes: 15 },
        { label: '30 Menit', minutes: 30 },
        { label: '45 Menit', minutes: 45 },
        { label: '60 Menit', minutes: 60 },
    ];

    const currentMins = Math.ceil(sleepSecondsLeft / 60);

    return (
        <div
            onClick={() => setIsSleepTimerOpen(false)}
            className="fixed inset-0 z-[300] flex items-end justify-center bg-black/60"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="bg-[#181922] w-full max-w-md rounded-t-3xl p-6 border-t border-white/10 animate-slide-up-modal space-y-4"
            >
                <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3"></div>
                <div className="flex items-center justify-between">
                    <h3 className="text-white font-bold text-base">Sleep Timer</h3>
                    {sleepSecondsLeft > 0 && (
                        <span className="text-xs text-white font-bold">{currentMins} menit tersisa</span>
                    )}
                </div>

                <div className="space-y-2">
                    {options.map((opt) => (
                        <button
                            key={opt.minutes}
                            onClick={() => {
                                setSleepTimer(opt.minutes);
                                setIsSleepTimerOpen(false);
                            }}
                            className="w-full text-left p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-98 transition flex items-center justify-between text-white text-sm font-medium"
                        >
                            <span>{opt.label}</span>
                            {((opt.minutes === 0 && sleepSecondsLeft === 0) || (opt.minutes > 0 && Math.abs(currentMins - opt.minutes) <= 1)) && (
                                <span className="text-xs text-white font-bold">Aktif</span>
                            )}
                        </button>
                    ))}
                </div>

                <button
                    onClick={() => setIsSleepTimerOpen(false)}
                    className="w-full py-3 bg-white/10 text-white font-bold rounded-full border border-white/10 active:scale-95 transition"
                >
                    Tutup
                </button>
            </div>
        </div>
    );
}
