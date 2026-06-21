import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, Smartphone, Sparkles, RefreshCw, Trophy, Club, Share2, AlertCircle, CheckCircle2, ArrowRight, Activity, HelpCircle
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { ActivityLog } from '../types';

interface HealthSyncProps {
  logs: ActivityLog[];
  onAddLog: (newLog: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
  showNotification: (text: string, type?: 'success' | 'error' | 'levelUp' | 'badge') => void;
  addXp: (amount: number) => void;
  playGamificationSound?: (type: 'success' | 'error' | 'challenge' | 'levelUp') => void;
}

export default function HealthSync({ 
  logs, 
  onAddLog, 
  showNotification, 
  addXp,
  playGamificationSound 
}: HealthSyncProps) {
  // Connectivity status states
  const [googleFitConnected, setGoogleFitConnected] = useState<boolean>(() => {
    return localStorage.getItem('ecotrack_hl_gfit') === 'true';
  });
  const [stravaConnected, setStravaConnected] = useState<boolean>(() => {
    return localStorage.getItem('ecotrack_hl_strava') === 'true';
  });
  const [fitbitConnected, setFitbitConnected] = useState<boolean>(() => {
    return localStorage.getItem('ecotrack_hl_fitbit') === 'true';
  });

  // Simulator flow states
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncLogs, setSyncLogs] = useState<{ id: string; type: 'run' | 'walk' | 'bike'; distance: number; co2Saved: number; timestamp: number }[]>(() => {
    const cached = localStorage.getItem('ecotrack_hl_sync_logs');
    return cached ? JSON.parse(cached) : [
      { id: 'hs-1', type: 'run', distance: 2.0, co2Saved: 0.42, timestamp: Date.now() - 3600000 * 24 },
      { id: 'hs-2', type: 'bike', distance: 5.5, co2Saved: 1.21, timestamp: Date.now() - 3600000 * 48 },
      { id: 'hs-3', type: 'walk', distance: 1.2, co2Saved: 0.25, timestamp: Date.now() - 3600000 * 72 }
    ];
  });

  // Custom simulation slider states
  const [simDistance, setSimDistance] = useState<number>(2.0);
  const [simType, setSimType] = useState<'run' | 'walk' | 'bike'>('run');

  // Multipliers (kg CO2e avoided per km compared to default internal combustion car)
  // Average economy petrol car prints ~0.21 kg per km commute.
  // Biking offsets even more if replacing medium transit (~0.22 kg/km)
  const multipliers = {
    run: 0.21,
    walk: 0.21,
    bike: 0.22
  };

  useEffect(() => {
    localStorage.setItem('ecotrack_hl_sync_logs', JSON.stringify(syncLogs));
  }, [syncLogs]);

  const toggleConnection = (provider: 'gfit' | 'strava' | 'fitbit') => {
    if (playGamificationSound) playGamificationSound('challenge');
    
    if (provider === 'gfit') {
      const next = !googleFitConnected;
      setGoogleFitConnected(next);
      localStorage.setItem('ecotrack_hl_gfit', String(next));
      if (next) {
        showNotification("Google Fit linked successfully! Watching active workouts.", "success");
      } else {
        showNotification("Google Fit disconnected.", "error");
      }
    } else if (provider === 'strava') {
      const next = !stravaConnected;
      setStravaConnected(next);
      localStorage.setItem('ecotrack_hl_strava', String(next));
      if (next) {
        showNotification("Strava API Link established! Auto-detecting green commutes.", "success");
      } else {
        showNotification("Strava API Link severed.", "error");
      }
    } else if (provider === 'fitbit') {
      const next = !fitbitConnected;
      setFitbitConnected(next);
      localStorage.setItem('ecotrack_hl_fitbit', String(next));
      if (next) {
        showNotification("Fitbit wearables sync online! Tracking heart strides.", "success");
      } else {
        showNotification("Fitbit sync offline.", "error");
      }
    }
  };

  // Run a real-time smart simulation process
  const triggerSimulation = (distance: number, type: 'run' | 'walk' | 'bike') => {
    if (!googleFitConnected && !stravaConnected && !fitbitConnected) {
      showNotification("Please connect at least one Health App above to enable live sync!", "error");
      if (playGamificationSound) playGamificationSound('error');
      return;
    }

    setIsSyncing(true);
    if (playGamificationSound) playGamificationSound('challenge');

    setTimeout(() => {
      const co2eSaved = Number((distance * multipliers[type]).toFixed(2));
      const xpReward = Math.round(15 + distance * 5);

      // 1. Add log to parent app
      const activeApp = googleFitConnected ? 'Google Fit' : stravaConnected ? 'Strava' : 'Fitbit';
      const label = type === 'run' ? 'Morning Commute Run' : type === 'walk' ? 'Locality Green Walk' : 'Bicycle Eco-Commute';
      
      onAddLog({
        description: `Synced ${type.toUpperCase()}: ${distance.toFixed(1)} km active travel via ${activeApp}`,
        category: 'transport',
        co2eKg: 0, // Since it replaced carbon-heavy commutes, raw carbon added is zero!
        source: 'choice', // Choice means alternative transport, so it is counted under avoided carbon
        avoidedKg: co2eSaved,
        range: `${co2eSaved} kg avoided`,
        reasoning: `Avoided standard auto fuel combustion (~${multipliers[type]} kg CO₂e per km) because you walked, ran, or cycled instead!`
      });

      // 2. Add local logs for Trends Visualization
      const newSyncLog = {
        id: `hsl-${Date.now()}`,
        type,
        distance,
        co2Saved: co2eSaved,
        timestamp: Date.now()
      };

      setSyncLogs(prev => [newSyncLog, ...prev]);
      addXp(xpReward);
      
      if (playGamificationSound) playGamificationSound('success');
      showNotification(`🏆 Sync Success! Simulated ${distance.toFixed(1)} km ${type} from ${activeApp}. Saved ${co2eSaved} kg CO₂e & earned +${xpReward} XP!`, "success");
      setIsSyncing(false);
    }, 1800);
  };

  // Prepare Trends and Statistics charts data (grouped by date)
  const chartData = useMemo(() => {
    // Generate dates for the last 7 days
    const days = Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - idx));
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
    });

    // Populate data
    const map = new Map<string, { distance: number; co2Saved: number }>();
    days.forEach(day => map.set(day, { distance: 0, co2Saved: 0 }));

    syncLogs.forEach(log => {
      const dateStr = new Date(log.timestamp).toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
      if (map.has(dateStr)) {
        const current = map.get(dateStr)!;
        map.set(dateStr, {
          distance: current.distance + log.distance,
          co2Saved: Number((current.co2Saved + log.co2Saved).toFixed(2))
        });
      }
    });

    return days.map(day => ({
      name: day,
      Distance: Number(map.get(day)!.distance.toFixed(1)),
      AvoidedCO2: Number(map.get(day)!.co2Saved.toFixed(2))
    }));
  }, [syncLogs]);

  // Aggregate aggregate totals
  const totalOffset = syncLogs.reduce((acc, curr) => acc + curr.co2Saved, 0);
  const totalDistance = syncLogs.reduce((acc, curr) => acc + curr.distance, 0);

  return (
    <div className="space-y-6" id="health-sync-panel-container">
      
      {/* Upper Status Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Core Live Synchronizer Device Status */}
        <div className="bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-zinc-800 p-6 rounded-3xl shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[190px]">
          <div className="absolute top-2 right-2 p-1 text-[8px] font-mono font-black tracking-widest text-[#10b981]/15 bg-emerald-500/5 uppercase rounded-lg border border-emerald-500/10 select-none">
            Device Link
          </div>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="p-2.5 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-xl relative">
                <Heart className="w-5 h-5 fill-rose-500 text-rose-500 animate-pulse" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
              </span>
              <div>
                <span className="text-[9px] font-mono tracking-widest font-bold uppercase text-zinc-400 block leading-none">Fitness Connection</span>
                <span className="text-sm font-black text-zinc-800 dark:text-zinc-150 leading-tight block">Eco-Sync Health Link</span>
              </div>
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed mt-2.5">
              Integrate live step sensors and GPS distance tracking to automatically record carbon offset reductions whenever you choose active travel.
            </p>
          </div>

          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px]">
            <span className="text-zinc-500 dark:text-zinc-400">Sensor Monitoring:</span>
            <span className={`font-black uppercase font-mono tracking-wider px-2 py-0.5 rounded-lg border flex items-center gap-1.5 ${
              (googleFitConnected || stravaConnected || fitbitConnected)
                ? 'bg-emerald-500/10 border-emerald-500/20 text-[#10b981]'
                : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                (googleFitConnected || stravaConnected || fitbitConnected)
                  ? 'bg-emerald-500 animate-ping'
                  : 'bg-zinc-400'
              }`} />
              {(googleFitConnected || stravaConnected || fitbitConnected) ? 'ONLINE & ACTIVE' : 'DISCONNECTED'}
            </span>
          </div>
        </div>

        {/* Total Avoided Carbon Metrics Card */}
        <div className="bg-zinc-950 text-white p-6 rounded-3xl shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[190px]">
          <div className="absolute top-[-50px] right-[-50px] w-48 h-48 bg-[#10b981]/15 rounded-full blur-xl pointer-events-none" />
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[9px] font-mono font-black tracking-widest text-[#10b981] uppercase block">SAVIOR POINTS GAINED</span>
              <Trophy className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-5xl font-black text-white tracking-tight">{Math.round(totalOffset * 100)}</span>
              <span className="text-xs font-semibold text-emerald-400">Green Commuter Pts</span>
            </div>
          </div>

          <p className="text-[11px] text-zinc-400 leading-normal mb-1">
            Replaced average petrol-vehicle commutes with 100% manual energy. Equivalent to saving <span className="font-extrabold text-white">{totalOffset.toFixed(2)} kg CO₂e</span> in total atmospheric fumes!
          </p>

          <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-500">
            <span>Synchronized Distance:</span>
            <span className="font-black text-white font-mono text-xs">{totalDistance.toFixed(1)} km</span>
          </div>
        </div>

        {/* Environmental Equivalence Card */}
        <div className="bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-zinc-800 p-6 rounded-3xl shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[190px]">
          <div>
            <span className="text-[9px] font-mono tracking-widest font-black text-emerald-700 dark:text-emerald-400 uppercase block mb-1">ATMOSPHERIC EQUIVALENCE</span>
            <h3 className="text-sm font-extrabold text-emerald-950 dark:text-zinc-100 font-serif mb-2 leading-snug">The Forest Protection Impact</h3>
            
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Your self-commuted fitness offset of <span className="font-extrabold text-zinc-800 dark:text-zinc-200">{totalOffset.toFixed(2)} kg CO₂e</span> corresponds to the clean carbon-absorption capability of:
            </p>

            <div className="mt-3.5 bg-emerald-50 dark:bg-zinc-950/70 border border-emerald-100 dark:border-zinc-800 p-3 rounded-2xl flex items-center gap-3">
              <div className="w-9 h-9 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center justify-center rounded-xl font-black text-[15px]">
                🌳
              </div>
              <div>
                <span className="text-xs font-bold block text-zinc-800 dark:text-zinc-200">
                  {Math.max(1, Math.round(totalOffset / 0.15))} Fully Grown Fir Needles
                </span>
                <span className="text-[10px] text-zinc-400 block leading-none">Filtering local cities for 24 hours</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Fitness Service Providers Connection Manager */}
      <div id="health-app-providers-panel" className="bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-zinc-800 p-6 sm:p-8 rounded-3xl shadow-xs">
        <h3 className="text-base sm:text-lg font-bold font-serif text-emerald-950 dark:text-zinc-50 mb-2">
          Connect Your Physical Activity Account
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6 leading-relaxed">
          Link any of your preferred health applications. Once authorized, our system polls distance telemetry, automatically identifies 2+ km walks or run workouts, parses the physical energy spent, and logs carbon avoidance equivalents seamlessly.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4.5">
          
          {/* Google Fit Panel */}
          <div className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
            googleFitConnected 
              ? 'border-emerald-200 dark:border-emerald-950/80 bg-emerald-50/20 dark:bg-emerald-950/10' 
              : 'border-zinc-200 dark:border-zinc-800 bg-transparent hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30'
          }`}>
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-orange-150 text-orange-600 flex items-center justify-center font-black shrink-0 text-xl border border-orange-200/50">
                  🧡
                </div>
                <div>
                  <span className="text-[10px] font-mono font-black text-zinc-400 block leading-none">Google Inc.</span>
                  <span className="text-sm font-extrabold text-zinc-800 dark:text-zinc-200 leading-tight block mt-0.5">Google Fit</span>
                </div>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed mb-4">
                Sync steps, pedestrian distance meters, and cycling telemetry directly from your Android device.
              </p>
            </div>

            <button
              id="connect-btn-googlefit"
              onClick={() => toggleConnection('gfit')}
              className={`w-full py-2.5 rounded-xl text-[10px] uppercase font-black tracking-widest cursor-pointer transition-all ${
                googleFitConnected 
                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 dark:text-rose-400 border border-rose-200/30' 
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
              }`}
            >
              {googleFitConnected ? 'Disconnect Google Fit' : 'Link Google Fit'}
            </button>
          </div>

          {/* Strava Client Panel */}
          <div className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
            stravaConnected 
              ? 'border-emerald-200 dark:border-emerald-950/80 bg-emerald-50/20 dark:bg-emerald-950/10' 
              : 'border-zinc-200 dark:border-zinc-800 bg-transparent hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30'
          }`}>
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-black shrink-0 text-xl border border-orange-200/30">
                  🏃
                </div>
                <div>
                  <span className="text-[10px] font-mono font-black text-zinc-400 block leading-none">GPS Track Logs</span>
                  <span className="text-sm font-extrabold text-zinc-800 dark:text-zinc-200 leading-tight block mt-0.5">Strava App Link</span>
                </div>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed mb-4">
                Sync outdoor athletic training runs, bicycle maps, and commute logs. Highly accurate GPS telemetry.
              </p>
            </div>

            <button
              id="connect-btn-strava"
              onClick={() => toggleConnection('strava')}
              className={`w-full py-2.5 rounded-xl text-[10px] uppercase font-black tracking-widest cursor-pointer transition-all ${
                stravaConnected 
                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 dark:text-rose-400 border border-rose-200/30' 
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
              }`}
            >
              {stravaConnected ? 'Disconnect Strava' : 'Link Strava Link'}
            </button>
          </div>

          {/* Fitbit Wearable Panel */}
          <div className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
            fitbitConnected 
              ? 'border-emerald-200 dark:border-emerald-950/80 bg-emerald-50/20 dark:bg-emerald-950/10' 
              : 'border-zinc-200 dark:border-zinc-800 bg-transparent hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30'
          }`}>
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#00b0b9]/15 text-[#00b0b9] flex items-center justify-center font-black shrink-0 text-xl border border-[#00b0b9]/30">
                  🛸
                </div>
                <div>
                  <span className="text-[10px] font-mono font-black text-zinc-400 block leading-none">Wearable IoT</span>
                  <span className="text-sm font-extrabold text-zinc-800 dark:text-zinc-200 leading-tight block mt-0.5">Fitbit Wearable</span>
                </div>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed mb-4">
                Fetch smartwatch passive pedometer readings to compute cumulative walking commutes over time.
              </p>
            </div>

            <button
              id="connect-btn-fitbit"
              onClick={() => toggleConnection('fitbit')}
              className={`w-full py-2.5 rounded-xl text-[10px] uppercase font-black tracking-widest cursor-pointer transition-all ${
                fitbitConnected 
                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 dark:text-rose-400 border border-rose-200/30' 
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
              }`}
            >
              {fitbitConnected ? 'Disconnect Fitbit' : 'Link Fitbit Sync'}
            </button>
          </div>

        </div>

      </div>

      {/* Main Core Body Grid: Left Interactive Sync simulator, Right Trend Analyzer charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: ACTIVE INTERACTIVE SYNC SIMULATOR SANDBOX (5 grid columns) */}
        <div className="lg:col-span-5 bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-zinc-800 p-6 rounded-3xl shadow-xs space-y-6">
          <div>
            <span className="text-[9px] font-mono tracking-widest font-black text-emerald-700 dark:text-[#10b981] uppercase block mb-1">AUTOMATED DEMONSTRATION</span>
            <h3 className="text-base sm:text-lg font-bold font-serif text-emerald-950 dark:text-zinc-50 leading-tight">
              Test Real-Time Telemetry Tracking
            </h3>
            <p className="text-[11px] text-zinc-400 leading-normal mt-1 w-full md:max-w-md">
              Trigger a live physics simulation of your health metrics. This emulates walking or running commutes and instantly translates them into carbon offset ledgers.
            </p>
          </div>

          {/* Quick preset activities */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-zinc-400 block uppercase font-mono">Quick Preset Commutes</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                id="preset-run-2km"
                onClick={() => triggerSimulation(2.0, 'run')}
                disabled={isSyncing}
                className="py-2.5 px-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-150/50 dark:hover:bg-zinc-850 rounded-xl text-left font-sans text-xs transition-all disabled:opacity-40 cursor-pointer"
              >
                <div className="text-[15px] mb-1">🏃‍♂️</div>
                <div className="font-extrabold text-zinc-800 dark:text-zinc-300">2.0 km Run</div>
                <div className="text-[9px] text-[#10b981] font-mono mt-0.5">Avoids 0.42 kg CO₂e</div>
              </button>

              <button
                id="preset-walk-15km"
                onClick={() => triggerSimulation(1.5, 'walk')}
                disabled={isSyncing}
                className="py-2.5 px-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-150/50 dark:hover:bg-zinc-850 rounded-xl text-left font-sans text-xs transition-all disabled:opacity-40 cursor-pointer"
              >
                <div className="text-[15px] mb-1">🚶‍♀️</div>
                <div className="font-extrabold text-[#38bdf8] dark:text-[#7dd3fc]">1.5 km Walk</div>
                <div className="text-[9px] text-[#10b981] font-mono mt-0.5">Avoids 0.32 kg CO₂e</div>
              </button>

              <button
                id="preset-bike-5km"
                onClick={() => triggerSimulation(5.0, 'bike')}
                disabled={isSyncing}
                className="py-2.5 px-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-150/50 dark:hover:bg-zinc-850 rounded-xl text-left font-sans text-xs transition-all disabled:opacity-40 cursor-pointer"
              >
                <div className="text-[15px] mb-1">🚴‍♀️</div>
                <div className="font-extrabold text-amber-500">5.0 km Cycle</div>
                <div className="text-[9px] text-[#10b981] font-mono mt-0.5">Avoids 1.10 kg CO₂e</div>
              </button>
            </div>
          </div>

          <div className="border-t border-zinc-100 dark:border-zinc-800/80 my-4" />

          {/* Custom sandbox scheduler */}
          <div className="space-y-4">
            <span className="text-[10px] font-bold text-zinc-400 block uppercase font-mono">Custom Activity Simulator</span>
            
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500 dark:text-zinc-400">Activity Commute Type:</span>
                <span className="font-mono text-emerald-800 dark:text-emerald-400 uppercase font-black">{simType} ({multipliers[simType]} kg saved/km)</span>
              </div>
              <div className="flex gap-2">
                {(['run', 'walk', 'bike'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setSimType(type)}
                    className={`flex-1 py-1 px-3 border rounded-xl text-xs font-bold leading-normal transition-all cursor-pointer capitalize ${
                      simType === type
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-850'
                        : 'bg-transparent border-zinc-200 dark:border-zinc-800 text-zinc-500'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500 dark:text-zinc-400">Distance Travelled:</span>
                <span className="font-mono font-black text-emerald-800 dark:text-emerald-400">{simDistance.toFixed(1)} km</span>
              </div>
              <input 
                type="range"
                min="0.5"
                max="15"
                step="0.5"
                value={simDistance}
                onChange={e => setSimDistance(Number(e.target.value))}
                className="w-full accent-emerald-500 h-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg cursor-pointer"
              />
            </div>

            <div className="pt-2">
              <button
                id="execute-health-sync-simulator-btn"
                onClick={() => triggerSimulation(simDistance, simType)}
                disabled={isSyncing}
                className="w-full py-3.5 bg-[#10b981] hover:bg-[#059669] text-zinc-950 font-extrabold uppercase rounded-2xl text-[11px] tracking-widest cursor-pointer shadow-sm relative overflow-hidden transition-all flex items-center justify-center gap-2.5 active:scale-[0.98] disabled:opacity-40"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-zinc-950" />
                    <span>SYNCHRONIZING TELEMETRY...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 text-zinc-950" />
                    <span>SIMULATE AUTOMATED DEVICE SYNC</span>
                  </>
                )}
              </button>
            </div>
            
            {/* Sync warning message */}
            {(!googleFitConnected && !stravaConnected && !fitbitConnected) && (
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-100 dark:border-amber-900/40 text-[10.5px] text-amber-800 dark:text-amber-400 flex items-start gap-2 animate-pulse leading-normal">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
                <span>Device syncing requires establishing at least one Fitness App link above first before you can synchronize activities.</span>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: RECHARTS ADVANCED TREND ANALYSER FOR NORMAL USERS (7 grid columns) */}
        <div className="lg:col-span-7 bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-zinc-800 p-6 sm:p-8 rounded-3xl shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-5 pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
              <div>
                <span className="text-[9px] font-mono tracking-widest font-black text-emerald-700 dark:text-[#10b981] uppercase block mb-0.5">Eco Analytics Insights</span>
                <h3 className="text-base sm:text-lg font-bold font-serif text-emerald-950 dark:text-zinc-50 leading-tight">
                  Your Green Active Commute Trends
                </h3>
              </div>
              <div className="flex gap-1.5 self-start sm:self-center font-mono text-[9px] uppercase tracking-wider font-extrabold border border-emerald-100 dark:border-emerald-950/60 bg-emerald-500/5 px-2.5 py-1 rounded-xl text-emerald-800 dark:text-emerald-400">
                <span>Updated Live</span>
              </div>
            </div>

            <p className="text-xs text-zinc-550 dark:text-zinc-400 leading-relaxed mb-6">
              Track how your athletic walking & bicycling offsets default petrol combustion emissions over consecutive days in a clean, highly understandable interactive visual trend chart.
            </p>

            {/* Area Chart Container */}
            <div className="h-64 sm:h-72 w-full mt-4" id="health-sync-chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorDistance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorCO2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    tickLine={false} 
                    axisLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 9, fontFamily: 'monospace' }} 
                  />
                  <YAxis 
                    tickLine={false} 
                    axisLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 9, fontFamily: 'monospace' }} 
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '16px', 
                      backgroundColor: 'rgba(9, 9, 11, 0.9)', 
                      borderColor: '#1e293b', 
                      color: '#f8fafc',
                      fontSize: '11px',
                      fontFamily: 'sans-serif'
                    }} 
                  />
                  <Area 
                    type="monotone" 
                    name="Distance (km)"
                    dataKey="Distance" 
                    stroke="#10b981" 
                    strokeWidth={2.5}
                    fillOpacity={1} 
                    fill="url(#colorDistance)" 
                  />
                  <Area 
                    type="monotone" 
                    name="Avoided CO₂ (kg)"
                    dataKey="AvoidedCO2" 
                    stroke="#38bdf8" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorCO2)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sync history logs list preview */}
          <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800/80 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-zinc-700 dark:text-zinc-300">Device Tracking History</span>
              <span className="font-mono text-[10px] text-zinc-400">{syncLogs.length} active logs synced</span>
            </div>

            <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
              {syncLogs.length === 0 ? (
                <div className="p-4 text-center text-[11px] text-zinc-400">
                  No synced workouts detected yet. Connect and simulate!
                </div>
              ) : (
                syncLogs.slice(0, 3).map((log, i) => (
                  <div key={log.id} className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-850 p-2.5 rounded-xl text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="text-[14px]">
                        {log.type === 'run' ? '🏃‍♂️' : log.type === 'walk' ? '🚶‍♀️' : '🚴‍♀️'}
                      </span>
                      <div>
                        <span className="font-extrabold text-zinc-800 dark:text-zinc-200 capitalize">
                          {log.distance.toFixed(1)} km {log.type} Commute
                        </span>
                        <span className="text-[9px] text-zinc-400 block leading-none select-none mt-0.5">
                          Detected Automatically • {new Date(log.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold font-mono text-[#10b981] block">-{log.co2Saved.toFixed(2)} kg CO₂e</span>
                      <span className="font-black font-mono text-[9px] text-emerald-700 dark:text-[#a3e635] leading-none">+{Math.round(15 + log.distance * 5)} XP</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Production Guide Info Accordion */}
      <div className="p-5.5 bg-emerald-500/5 dark:bg-zinc-950/40 border border-emerald-100 dark:border-emerald-950/60 rounded-3xl space-y-2 text-left">
        <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-400 font-bold text-xs">
          <HelpCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Real Health App OAuth Production Info</span>
        </div>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed md:max-w-4xl">
          To synchronize raw athletic telemetry dynamically from production users, establish secure OAuth client applications inside your <b>Google Cloud Consent console</b> or your <b>Strava Developer App settings</b>. Set your production environment callback callback URI strictly to:
        </p>
        <div className="bg-zinc-100 dark:bg-zinc-950/80 p-2.5 font-mono text-[9px] text-zinc-500 rounded-xl border border-zinc-250 dark:border-zinc-850 select-all overflow-x-auto">
          {window.location.origin}/auth/callback
        </div>
      </div>

    </div>
  );
}
