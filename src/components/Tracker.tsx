import { useState, useMemo } from 'react';
import { CarbonLog, ActivityCategory } from '../types';
import { CATEGORIES } from '../carbonData';
import { db } from '../firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { 
  Car, Home, Utensils, Trash2, Calendar, ClipboardList, 
  Search, Filter, ArrowUpRight, Leaf, ShieldAlert
} from 'lucide-react';

interface TrackerProps {
  logs: CarbonLog[];
  onLogDeleted: (id: string) => void;
}

export default function Tracker({ logs, onLogDeleted }: TrackerProps) {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchNotes, setSearchNotes] = useState<string>('');
  
  const [deletingId, setDeletingId] = useState<string>('');

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchCat = filterCategory === 'all' || log.category === filterCategory;
      const matchSearch = !searchNotes.trim() || 
        (log.notes?.toLowerCase().includes(searchNotes.toLowerCase())) ||
        (log.subCategory.toLowerCase().includes(searchNotes.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [logs, filterCategory, searchNotes]);

  const categorySubtotals = useMemo(() => {
    let transport = 0;
    let energy = 0;
    let food = 0;
    let waste = 0;

    filteredLogs.forEach(l => {
      if (l.category === 'transport') transport += l.co2Equivalent;
      else if (l.category === 'energy') energy += l.co2Equivalent;
      else if (l.category === 'food') food += l.co2Equivalent;
      else if (l.category === 'waste') waste += l.co2Equivalent;
    });

    return { transport, energy, food, waste };
  }, [filteredLogs]);

  const handleDeleteLog = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this footprint log?")) return;
    
    setDeletingId(id);
    try {
      // Delete document in Firestore
      await deleteDoc(doc(db, 'carbonLogs', id));
      onLogDeleted(id);
    } catch (err) {
      console.error(err);
      alert("Failed to delete log from Firestore database.");
    } finally {
      setDeletingId('');
    }
  };

  const getCategoryTheme = (cat: ActivityCategory) => {
    switch (cat) {
      case 'transport': return { color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: <Car className="w-5 h-5" /> };
      case 'energy': return { color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: <Home className="w-5 h-5" /> };
      case 'food': return { color: 'text-teal-400 bg-teal-500/10 border-teal-500/20', icon: <Utensils className="w-5 h-5" /> };
      case 'waste': return { color: 'text-indigo-400 bg-indigo-500/10 border-indigo-505/20', icon: <Trash2 className="w-5 h-5" /> };
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Search and Filters Strip */}
      <div className="bg-white border border-[#E0E7DE] rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-xs">
        <div className="relative w-full md:w-72">
          <input
            type="text"
            value={searchNotes}
            onChange={(e) => setSearchNotes(e.target.value)}
            placeholder="Search notes or categories..."
            className="w-full h-10 pl-9 pr-4 bg-white border border-[#E0E7DE] rounded-xl text-xs text-[#2D332C] placeholder-[#5A6359]/40 focus:outline-none focus:ring-2 focus:ring-[#4A6741]/40"
          />
          <Search className="w-4 h-4 text-[#5A6359] absolute left-3 top-3 pointer-events-none" />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
          <Filter className="w-4 h-4 text-[#5A6359] flex-shrink-0" />
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold font-mono uppercase transition-colors cursor-pointer ${
              filterCategory === 'all' 
                ? 'bg-[#4A6741] text-white border-[#4A6741]' 
                : 'bg-white border-[#E0E7DE] text-[#5A6359] hover:bg-[#FDF6F0] hover:text-[#2D332C]'
            }`}
          >
            All Logs
          </button>
          
          {(Object.keys(CATEGORIES) as ActivityCategory[]).map(catKey => (
            <button
              key={catKey}
              onClick={() => setFilterCategory(catKey)}
              className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold font-mono uppercase transition-colors cursor-pointer ${
                filterCategory === catKey 
                  ? 'bg-[#4A6741] text-white border-[#4A6741]' 
                  : 'bg-white border-[#E0E7DE] text-[#5A6359] hover:bg-[#FDF6F0] hover:text-[#2D332C]'
              }`}
            >
              {CATEGORIES[catKey].name}
            </button>
          ))}
        </div>
      </div>

      {/* Subtotal summaries */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E0E7DE] p-3.5 rounded-xl shadow-xs">
          <span className="text-[9px] font-bold text-[#4A6741] block font-mono uppercase tracking-wider">TRANSPORT TOTAL</span>
          <span className="text-base font-bold font-mono text-[#2D332C]">{categorySubtotals.transport.toFixed(1)} kg</span>
        </div>
        <div className="bg-white border border-[#E0E7DE] p-3.5 rounded-xl shadow-xs">
          <span className="text-[9px] font-bold text-[#D4A373] block font-mono uppercase tracking-wider">ENERGY TOTAL</span>
          <span className="text-base font-bold font-mono text-[#2D332C]">{categorySubtotals.energy.toFixed(1)} kg</span>
        </div>
        <div className="bg-white border border-[#E0E7DE] p-3.5 rounded-xl shadow-xs">
          <span className="text-[9px] font-bold text-[#8BA888] block font-mono uppercase tracking-wider">DIET/FOOD TOTAL</span>
          <span className="text-base font-bold font-mono text-[#2D332C]">{categorySubtotals.food.toFixed(1)} kg</span>
        </div>
        <div className="bg-white border border-[#E0E7DE] p-3.5 rounded-xl shadow-xs">
          <span className="text-[9px] font-bold text-amber-800 block font-mono uppercase tracking-wider">WASTE TOTAL</span>
          <span className="text-base font-bold font-mono text-[#2D332C]">{categorySubtotals.waste.toFixed(1)} kg</span>
        </div>
      </div>

      {/* Log Feed */}
      <div className="bg-white border border-[#E0E7DE] rounded-2xl p-5 shadow-xs">
        
        <div className="flex items-center justify-between pb-3.5 border-b border-[#E0E7DE] mb-5">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-[#4A6741]" />
            <span className="text-xs font-bold text-[#2D332C] uppercase tracking-widest font-mono">Historical Logs Feed ({filteredLogs.length})</span>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <div className="p-3 bg-[#FDF6F0] border border-[#E0E7DE] text-[#5A6359] rounded-xl mb-3">
              <ClipboardList className="w-7 h-7" />
            </div>
            <p className="text-sm font-serif font-semibold text-[#2D332C]">No matching logs discovered.</p>
            <p className="text-xs text-[#5A6359] mt-1 max-w-sm leading-relaxed">Use the Carbon Log Wizard tab to enter transportation, meals, utility billing, or recycle values.</p>
          </div>
        ) : (
          <div className="space-y-3.5 overflow-y-auto max-h-[480px] pr-1">
            {filteredLogs.map((log) => {
              const theme = getCategoryTheme(log.category);
              
              return (
                <div 
                  key={log.id} 
                  className="bg-white border border-[#E0E7DE] p-4 rounded-xl flex items-center justify-between hover:border-[#4A6741]/45 transition-all gap-4 shadow-2xs"
                >
                  <div className="flex items-center gap-3.5">
                    
                    {/* Category Icon */}
                    <div className={`p-2.5 rounded-xl border ${theme?.color} flex-shrink-0`}>
                      {theme?.icon}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#2D332C] font-mono">{log.subCategory}</span>
                        <span className="text-[9px] text-[#5A6359] font-semibold bg-[#FDF6F0] px-1.5 py-0.5 rounded border border-[#E0E7DE]">
                          {log.value} {log.unit}
                        </span>
                      </div>
                      
                      {log.notes && (
                        <p className="text-xs text-[#5A6359] mt-1 max-w-lg italic font-medium leading-relaxed">
                          &ldquo;{log.notes}&rdquo;
                        </p>
                      )}

                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-[#5A6359] font-bold font-mono">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3" />
                          <span>{log.date}</span>
                        </div>
                      </div>
                    </div>

                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-[9px] text-[#5A6359] block font-bold font-mono">EMISSION</span>
                      <span className="text-sm font-serif font-bold text-[#2D332C]">
                        {log.co2Equivalent.toFixed(2)} <span className="text-[10px] font-semibold text-[#5A6359]">kg</span>
                      </span>
                    </div>

                    <button
                      onClick={() => handleDeleteLog(log.id)}
                      disabled={deletingId === log.id}
                      className="p-2 text-[#5A6359] hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-100 transition-all cursor-pointer"
                      title="Delete Entry"
                    >
                      {deletingId === log.id ? (
                        <div className="w-4 h-4 border-2 border-[#5A6359] border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
