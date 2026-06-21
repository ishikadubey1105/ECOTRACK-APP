import { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line
} from 'recharts';
import { CarbonLog, UserProfile, ActivityCategory } from '../types';
import { CATEGORIES } from '../carbonData';
import { 
  Leaf, Target, Flame, Trophy, Award, Zap, ChevronRight, 
  TrendingDown, TrendingUp, HelpCircle
} from 'lucide-react';

interface DashboardProps {
  logs: CarbonLog[];
  profile: UserProfile;
  onNavigate: (tab: string) => void;
}

export default function Dashboard({ logs, profile, onNavigate }: DashboardProps) {
  
  // Calculate stats based on logs of the current month
  const stats = useMemo(() => {
    const totalEmissions = logs.reduce((sum, log) => sum + log.co2Equivalent, 0);
    
    // Category Breakdown
    const categoriesSum: Record<ActivityCategory, number> = {
      transport: 0,
      energy: 0,
      food: 0,
      waste: 0
    };
    
    logs.forEach(log => {
      if (categoriesSum[log.category] !== undefined) {
        categoriesSum[log.category] += log.co2Equivalent;
      }
    });

    const categoryData = (Object.keys(categoriesSum) as ActivityCategory[]).map(catKey => {
      return {
        name: CATEGORIES[catKey].name,
        value: Number(categoriesSum[catKey].toFixed(1)),
        colorRaw: catKey === 'transport' ? '#4A6741' : catKey === 'energy' ? '#D4A373' : catKey === 'food' ? '#8BA888' : '#C4A484'
      };
    });

    // Trend by Date (Grouped last 7 days or sorted logs dates)
    const groupedByDate: Record<string, number> = {};
    const sortedLogs = [...logs].sort((a, b) => a.date.localeCompare(b.date));
    
    // Last 15 unique active days
    sortedLogs.forEach(log => {
      const formattedDate = log.date.substring(5); // MM-DD
      groupedByDate[formattedDate] = (groupedByDate[formattedDate] || 0) + log.co2Equivalent;
    });

    const trendData = Object.keys(groupedByDate).map(date => ({
      date,
      co2: Number(groupedByDate[date].toFixed(1))
    })).slice(-10); // Display last 10 log days

    // Day streaks
    let streak = 0;
    const uniqueDates = Array.from(new Set(logs.map(l => l.date))).sort();
    if (uniqueDates.length > 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      
      const containsTodayVal = uniqueDates.includes(todayStr);
      const containsYesterdayVal = uniqueDates.includes(yesterdayStr);
      
      if (containsTodayVal || containsYesterdayVal) {
        let currentStreak = 1;
        let lastDate = new Date(uniqueDates[uniqueDates.length - 1]);
        
        for (let i = uniqueDates.length - 2; i >= 0; i--) {
          const checkDate = new Date(uniqueDates[i]);
          const diffDays = (lastDate.getTime() - checkDate.getTime()) / (1000 * 3600 * 24);
          if (diffDays <= 1.1) {
            currentStreak++;
            lastDate = checkDate;
          } else {
            break;
          }
        }
        streak = currentStreak;
      }
    }

    return {
      totalEmissions,
      categoryData,
      trendData,
      streak
    };
  }, [logs]);

  // Target calculation indicators
  const carbonBudgetPercent = Math.min(Math.round((stats.totalEmissions / (profile.carbonGoal || 450)) * 100), 100);
  const isOverBudget = stats.totalEmissions > (profile.carbonGoal || 450);
  
  // XP mechanics
  const nextLevelXp = profile.level * 300;
  const currentLevelProgress = Math.min(Math.round((profile.xp / nextLevelXp) * 100), 100);

  // Suggested category color helper
  const getBudgetMeterColor = () => {
    if (carbonBudgetPercent < 60) return 'from-emerald-500 to-green-400 bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
    if (carbonBudgetPercent < 90) return 'from-amber-500 to-amber-400 bg-amber-500/10 border-amber-500/20 text-amber-400';
    return 'from-red-500 to-rose-400 bg-red-500/10 border-red-500/20 text-red-400';
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner with Eco Streak & Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* User Card */}
        <div className="bg-white border border-[#E0E7DE] rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden shadow-xs">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#4A6741]/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between z-10">
            <div>
              <p className="text-[10px] font-bold text-[#4A6741] uppercase tracking-widest font-mono">ECO CITIZEN</p>
              <h3 className="text-xl font-serif font-bold text-[#2D332C] mt-1">{profile.displayName || "Eco Guardian"}</h3>
              <p className="text-xs text-[#5A6359] mt-0.5">{profile.email}</p>
            </div>
            <div className="bg-[#FDF6F0] p-2.5 rounded-xl border border-[#E0E7DE]">
              <Leaf className="w-6 h-6 text-[#4A6741]" />
            </div>
          </div>
          
          <div className="mt-6 z-10">
            <div className="flex justify-between items-end mb-2">
              <span className="text-xs font-bold text-[#2D332C] font-mono">LEVEL {profile.level}</span>
              <span className="text-xs text-[#5A6359] font-mono">{profile.xp} / {nextLevelXp} XP</span>
            </div>
            <div className="w-full bg-[#FDF6F0] rounded-full h-2.5 overflow-hidden border border-[#E0E7DE]">
              <div 
                className="bg-[#4A6741] h-full rounded-full transition-all duration-500"
                style={{ width: `${currentLevelProgress}%` }}
              />
            </div>
            <p className="text-[10px] text-[#5A6359] mt-2 font-mono">
              Earn XP by completing challenges and logging eco-friendly actions!
            </p>
          </div>
        </div>

        {/* Carbon Budget */}
        <div className="bg-white border border-[#E0E7DE] rounded-2xl p-5 flex flex-col justify-between shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4A373]/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-[#D4A373] uppercase tracking-widest font-mono">MONTHLY CO2 BUDGET</p>
              <h3 className="text-2xl font-serif font-bold text-[#2D332C] mt-1">
                {stats.totalEmissions.toFixed(1)} <span className="text-xs font-semibold text-[#5A6359]">kg CO2e</span>
              </h3>
              <p className="text-xs text-[#5A6359] mt-1">
                Spent of {profile.carbonGoal || 450} kg monthly limit
              </p>
            </div>
            <div className="bg-[#FDF6F0] p-2.5 rounded-xl border border-[#E0E7DE] text-[#D4A373]">
              <Target className="w-6 h-6" />
            </div>
          </div>

          <div className="mt-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-[#5A6359] font-medium">Budget Consumed ({carbonBudgetPercent}%)</span>
              <span className="text-xs font-mono font-bold text-[#2D332C]">
                {Math.max(0, Number(((profile.carbonGoal || 450) - stats.totalEmissions).toFixed(1)))} kg left
              </span>
            </div>
            <div className="w-full bg-[#FDF6F0] rounded-full h-2.5 overflow-hidden border border-[#E0E7DE]">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  carbonBudgetPercent < 65 ? 'bg-[#4A6741]' :
                  carbonBudgetPercent < 90 ? 'bg-[#D4A373]' : 'bg-rose-500'
                }`}
                style={{ width: `${carbonBudgetPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Achievements / Streak Card */}
        <div className="bg-white border border-[#E0E7DE] rounded-2xl p-5 flex flex-col justify-between shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#8BA888]/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-[#4A6741] uppercase tracking-widest font-mono">ECO DEEDS STREAK</p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-3xl font-serif font-bold text-[#2D332C]">{stats.streak}</span>
                <span className="text-xs font-semibold text-[#4A6741]">Days Active</span>
              </div>
            </div>
            <div className={`p-2.5 rounded-xl border border-[#E0E7DE] ${stats.streak > 0 ? 'text-[#D4A373]' : 'text-[#5A6359]'} bg-[#FDF6F0]`}>
              <Flame className="w-6 h-6 animate-pulse" />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <div className="flex -space-x-2 overflow-hidden">
              {profile.badges.slice(0, 4).map((badgeId, ix) => (
                <div key={badgeId} className="inline-block h-8 w-8 rounded-full bg-[#EED7C1] p-[1.5px]">
                  <div className="h-full w-full rounded-full bg-[#FDF6F0] flex items-center justify-center text-[10px] text-[#4A6741] font-bold border border-[#E0E7DE]">
                    🏆
                  </div>
                </div>
              ))}
            </div>
            <div className="flex-1">
              <button 
                onClick={() => onNavigate('challenges')}
                className="text-xs text-[#4A6741] hover:text-[#3F5737] font-semibold cursor-pointer flex items-center gap-1 transition-all hover:underline"
              >
                View Badges & Challenges
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Dashboard Visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Footprint Category Breakdown Chart */}
        <div className="bg-white border border-[#E0E7DE] rounded-2xl p-5 lg:col-span-1 flex flex-col h-[340px] shadow-xs">
          <h3 className="text-sm font-serif font-bold text-[#2D332C] tracking-wide flex items-center gap-2 mb-4">
            <Trophy className="w-4 h-4 text-[#4A6741]" />
            Emissions by Category ({stats.totalEmissions.toFixed(1)} kg)
          </h3>
          
          <div className="flex-1 w-full min-h-0">
            {stats.totalEmissions === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <p className="text-xs text-[#5A6359] max-w-[200px] mb-3">No carbon footprints logged yet. Add your activities to populate charts!</p>
                <button 
                  onClick={() => onNavigate('tracker')}
                  className="px-3.5 py-1.5 bg-[#FDF6F0] border border-[#E0E7DE] hover:border-[#4A6741]/40 rounded-xl text-xs font-semibold text-[#2D332C] transition-all cursor-pointer"
                >
                  Log First Action +
                </button>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="95%">
                <BarChart data={stats.categoryData} margin={{ left: -10, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E0E7DE" opacity={0.5} />
                  <XAxis dataKey="name" stroke="#5A6359" fontSize={11} tickLine={false} />
                  <YAxis stroke="#5A6359" fontSize={11} tickLine={false} unit="kg" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#FDF6F0', border: '1px solid #E0E7DE', borderRadius: '12px' }}
                    labelStyle={{ color: '#2D332C', fontSize: '12px', fontWeight: 'bold' }}
                    itemStyle={{ color: '#4A6741', fontSize: '13px' }}
                  />
                  <Bar dataKey="value" name="CO2e (kg)">
                    {stats.categoryData.map((entry, index) => (
                      <rect key={`cell-${index}`} fill={entry.colorRaw} radius={[4, 4, 0, 0]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Weekly Footprint Trend Chart */}
        <div className="bg-white border border-[#E0E7DE] rounded-2xl p-5 lg:col-span-2 flex flex-col h-[340px] shadow-xs">
          <h3 className="text-sm font-serif font-bold text-[#2D332C] tracking-wide flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-[#D4A373]" />
            Emissions Growth Trend (Active Days)
          </h3>
          
          <div className="flex-1 w-full min-h-0">
            {stats.totalEmissions === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <p className="text-xs text-[#5A6359] max-w-[200px] mb-3">Daily carbon trending is generated dynamically once you start logging records.</p>
                <button 
                  onClick={() => onNavigate('calculator')}
                  className="px-3.5 py-1.5 bg-[#FDF6F0] border border-[#E0E7DE] rounded-xl text-xs font-semibold text-[#4A6741] transition-all cursor-pointer hover:border-[#4A6741]/50"
                >
                  Examine Calculators
                </button>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="95%">
                <LineChart data={stats.trendData} margin={{ left: -10, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E0E7DE" opacity={0.5} />
                  <XAxis dataKey="date" stroke="#5A6359" fontSize={11} tickLine={false} />
                  <YAxis stroke="#5A6359" fontSize={11} tickLine={false} unit="kg" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#FDF6F0', border: '1px solid #E0E7DE', borderRadius: '12px' }}
                    labelStyle={{ color: '#2D332C', fontSize: '12px', fontWeight: 'bold' }}
                    itemStyle={{ color: '#4A6741', fontSize: '13px' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="co2" 
                    stroke="#4A6741" 
                    strokeWidth={3} 
                    dot={{ fill: '#white', stroke: '#4A6741', strokeWidth: 2, r: 4 }} 
                    activeDot={{ r: 6 }}
                    name="Emissions (kg CO2e)"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

      {/* Sustainable Quick Action Guides */}
      <div className="bg-[#FDF6F0] border border-[#E0E7DE] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <HelpCircle className="w-5 h-5 text-[#4A6741]" />
          <h4 className="text-sm font-serif font-bold text-[#2D332C]">How is my impact measured?</h4>
        </div>
        <p className="text-xs text-[#5A6359] leading-relaxed mb-4">
          Each time you log details in Carbofree, our calculators use standardized factors derived from environmental research to assess your footprint. These represent equivalent carbon emissions (CO2e), taking into account factors like gasoline burning efficiency, direct electricity mix, agricultural methane emissions, and landfill organic decomp energy.
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3.5 bg-white rounded-xl border border-[#E0E7DE]">
            <span className="text-[10px] font-mono font-bold text-[#4A6741] block mb-1">TRANSPORTATION</span>
            <span className="text-xs text-[#2D332C] font-semibold">Drive less or EV transition</span>
            <p className="text-[10px] text-[#5A6359] mt-1">Car combustion emits ~0.36kg CO2e per average mile driven. Opt for trains, bikes, or shared carpools.</p>
          </div>
          <div className="p-3.5 bg-white rounded-xl border border-[#E0E7DE]">
            <span className="text-[10px] font-mono font-bold text-[#D4A373] block mb-1">HOME UTILITY</span>
            <span className="text-xs text-[#2D332C] font-semibold">Unplug idle phantom loads</span>
            <p className="text-[10px] text-[#5A6359] mt-1">Grid averages emit 0.42kg CO2e per kWh. Solar and renewables drop that to near zero.</p>
          </div>
          <div className="p-3.5 bg-white rounded-xl border border-[#E0E7DE]">
            <span className="text-[10px] font-mono font-bold text-[#8BA888] block mb-1">DIETARY DIAL</span>
            <span className="text-xs text-[#2D332C] font-semibold">Try swapping beef for vegan</span>
            <p className="text-[10px] text-[#5A6359] mt-1">Livestock beef releases massive methane (~5.8kg CO2e a serving), while beans reflect merely ~0.35kg CO2e.</p>
          </div>
          <div className="p-3.5 bg-white rounded-xl border border-[#E0E7DE]">
            <span className="text-[10px] font-mono font-bold text-amber-800 block mb-1">CIRCULAR WASTE</span>
            <span className="text-xs text-[#2D332C] font-semibold">Activate compost or recycle</span>
            <p className="text-[10px] text-[#5A6359] mt-1">Recyclable sorting gives carbon offsets (-0.35kg credit per bin) because packaging bypasses raw mining cycles.</p>
          </div>
        </div>
      </div>

    </div>
  );
}
