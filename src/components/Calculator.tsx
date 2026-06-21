import React, { useState, useMemo } from 'react';
import { CarbonLog, ActivityCategory } from '../types';
import { CATEGORIES } from '../carbonData';
import { db, auth } from '../firebase';
import { collection, addDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { 
  Calculator, Check, Car, Home, Utensils, Trash2, 
  Sparkles, Calendar, PlusCircle
} from 'lucide-react';

interface CalculatorProps {
  onLogAdded: (newLog: CarbonLog) => void;
  xp: number;
  level: number;
  badges: string[];
  onXpChange: (newXp: number, newLevel: number, newBadges: string[]) => void;
}

export default function CalculatorComponent({ onLogAdded, xp, level, badges, onXpChange }: CalculatorProps) {
  const [activeCategory, setActiveCategory] = useState<ActivityCategory>('transport');
  const [selectedSubId, setSelectedSubId] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const currentCategoryData = CATEGORIES[activeCategory];

  // Set default subcategory on category change
  useMemo(() => {
    if (currentCategoryData && currentCategoryData.subCategories.length > 0) {
      setSelectedSubId(currentCategoryData.subCategories[0].id);
    }
  }, [activeCategory, currentCategoryData]);

  const activeSubCategory = useMemo(() => {
    return currentCategoryData.subCategories.find(sub => sub.id === selectedSubId);
  }, [currentCategoryData, selectedSubId]);

  // Live CO2 emission calculation preview
  const calculatedCo2 = useMemo(() => {
    if (!activeSubCategory || isNaN(Number(inputValue)) || Number(inputValue) <= 0) return 0;
    return Number((Number(inputValue) * activeSubCategory.factor).toFixed(2));
  }, [activeSubCategory, inputValue]);

  const handleSaveLog = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedVal = Number(inputValue);
    if (!parsedVal || isNaN(parsedVal) || parsedVal <= 0) {
      alert("Please enter a valid positive numeric quantity.");
      return;
    }

    const { currentUser } = auth;
    if (!currentUser) return;

    setSaving(true);
    setSuccessMsg('');

    try {
      const co2e = calculatedCo2;
      const logData = {
        uid: currentUser.uid,
        date,
        category: activeCategory,
        subCategory: activeSubCategory?.name || selectedSubId,
        value: parsedVal,
        unit: activeSubCategory?.unit || '',
        co2Equivalent: co2e,
        notes: notes.trim(),
        createdAt: new Date().toISOString()
      };

      // 1. Save log to Firestore
      const docRef = await addDoc(collection(db, 'carbonLogs'), logData);
      
      // 2. Reward +15 XP for logging
      const xpGained = 15;
      let newXp = xp + xpGained;
      let newLevel = level;
      const nextLevelReq = newLevel * 300;
      
      if (newXp >= nextLevelReq) {
        newXp = newXp - nextLevelReq;
        newLevel += 1;
      }

      // Check if unlocked the "first_log" badge
      const updatedBadges = [...badges];
      if (!updatedBadges.includes('first_log')) {
        updatedBadges.push('first_log');
      }

      // Batch update the user profile in Firestore
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        xp: newXp,
        level: newLevel,
        badges: updatedBadges
      });

      // Update state in main app layout
      onLogAdded({
        id: docRef.id,
        ...logData
      });

      onXpChange(newXp, newLevel, updatedBadges);

      setSuccessMsg(`Log recorded successfully! Gained +${xpGained} XP!`);
      setInputValue('');
      setNotes('');
      
    } catch (err) {
      console.error(err);
      alert("Failed to save log. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const getCategoryIcon = (cat: ActivityCategory) => {
    switch (cat) {
      case 'transport': return <Car className="w-5 h-5" />;
      case 'energy': return <Home className="w-5 h-5" />;
      case 'food': return <Utensils className="w-5 h-5" />;
      case 'waste': return <Trash2 className="w-5 h-5" />;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      
      {/* Category selector left sidebar */}
      <div className="bg-[#FDF6F0] border border-[#E0E7DE] rounded-2xl p-4 md:col-span-1 space-y-2 shadow-xs">
        <h3 className="text-[10px] font-bold text-[#5A6359] font-mono tracking-widest uppercase mb-4 px-2">Select Category</h3>
        
        {(Object.keys(CATEGORIES) as ActivityCategory[]).map((catKey) => {
          const cat = CATEGORIES[catKey];
          const isActive = activeCategory === catKey;
          
          return (
            <button
              key={catKey}
              onClick={() => {
                setActiveCategory(catKey);
                setSuccessMsg('');
              }}
              className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                isActive 
                  ? 'bg-[#4A6741] border-[#4A6741] text-white shadow-xs' 
                  : 'bg-white border-[#E0E7DE] text-[#5A6359] hover:bg-white hover:border-[#4A6741]/40 hover:text-[#2D332C]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {getCategoryIcon(catKey)}
                <span>{cat.name}</span>
              </div>
              {isActive && <div className="w-2 h-2 rounded-full bg-white" />}
            </button>
          );
        })}

        <div className="pt-6 px-2 text-[#5A6359] text-[11px] leading-relaxed font-sans">
          Each selection links to specific conversion criteria, automatically transforming physical metrics into atmospheric carbon values.
        </div>
      </div>

      {/* Main calculation logging form */}
      <div className="bg-white border border-[#E0E7DE] rounded-2xl p-5 md:col-span-2 shadow-xs">
        <div className="flex justify-between items-center border-b border-[#E0E7DE] pb-4 mb-5">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-[#4A6741]" />
            <h3 className="text-sm font-bold text-[#2D332C] uppercase tracking-wider font-mono">Carbon Log Wizard</h3>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#FDF6F0] border border-[#E0E7DE] text-[#2D332C]">
            {CATEGORIES[activeCategory].name} Mode
          </span>
        </div>

        {successMsg && (
          <div className="p-4 bg-[#4A6741]/10 border border-[#4A6741]/20 rounded-xl text-xs text-[#2D332C] font-semibold mb-5 flex items-center gap-2">
            <Check className="w-4 h-4 bg-[#4A6741]/20 rounded-full p-0.5 text-[#4A6741]" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSaveLog} className="space-y-4">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Sub category dropdown */}
            <div>
              <label className="block text-xs font-bold text-[#2D332C] uppercase tracking-wider mb-2">
                Activity Instance
              </label>
              <select
                value={selectedSubId}
                onChange={(e) => {
                  setSelectedSubId(e.target.value);
                  setSuccessMsg('');
                }}
                className="w-full h-11 px-3 bg-white border border-[#E0E7DE] rounded-xl text-[#2D332C] placeholder-[#5A6359]/40 focus:outline-none focus:ring-2 focus:ring-[#4A6741]/40 focus:border-transparent transition-all text-sm cursor-pointer"
              >
                {CATEGORIES[activeCategory].subCategories.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Picker */}
            <div>
              <label className="block text-xs font-bold text-[#2D332C] uppercase tracking-wider mb-2">
                Date of Activity
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={date}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full h-11 px-3 pl-10 bg-white border border-[#E0E7DE] rounded-xl text-[#2D332C] focus:outline-none focus:ring-2 focus:ring-[#4A6741]/40 focus:border-transparent transition-all text-sm"
                />
                <Calendar className="w-4 h-4 text-[#4A6741] absolute left-3.5 top-3.5 pointer-events-none" />
              </div>
            </div>

          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            
            {/* Value Input */}
            <div>
              <label className="block text-xs font-bold text-[#2D332C] uppercase tracking-wider mb-2">
                Quantity ({activeSubCategory?.unit || ''})
              </label>
              <input
                type="number"
                step="any"
                required
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setSuccessMsg('');
                }}
                placeholder={activeSubCategory?.placeholder || ''}
                className="w-full h-11 px-3.5 bg-white border border-[#E0E7DE] rounded-xl text-[#2D332C] placeholder-[#5A6359]/40 focus:outline-none focus:ring-2 focus:ring-[#4A6741]/40 focus:border-transparent transition-all text-sm"
              />
              <span className="text-[10px] text-[#5A6359] inline-block mt-1 font-mono">
                Multiplier: {activeSubCategory?.factor} kg CO2e per {activeSubCategory?.unit}.
              </span>
            </div>

            {/* Live calculation card */}
            <div className="p-4 bg-[#FDF6F0] border border-[#E0E7DE] rounded-xl flex items-center justify-between min-h-[72px]">
              <div>
                <p className="text-[9px] font-bold text-[#5A6359] uppercase tracking-wider">CO2 EQUIV. PREVIEW</p>
                <p className="text-xl font-bold font-mono text-[#2D332C] mt-0.5">
                  {calculatedCo2.toFixed(2)} <span className="text-xs text-[#5A6359]">kg CO2e</span>
                </p>
              </div>
              <Sparkles className={`w-6 h-6 ${calculatedCo2 > 0 ? 'text-[#D4A373]' : 'text-[#E0E7DE]'} transition-all`} />
            </div>

          </div>

          {/* Description/Notes */}
          <div>
            <label className="block text-xs font-bold text-[#2D332C] uppercase tracking-wider mb-2">
              Context Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., 'Weekly shopping batch', 'Commute under rainy weather', etc."
              className="w-full h-11 px-3.5 bg-white border border-[#E0E7DE] rounded-xl text-[#2D332C] placeholder-[#5A6359]/40 focus:outline-none focus:ring-2 focus:ring-[#4A6741]/40 focus:border-transparent transition-all text-sm"
            />
          </div>

          <div className="pt-4 flex items-center justify-between border-t border-[#E0E7DE]">
            <div className="text-[11px] text-[#5A6359] font-medium">
              * Logging achievements grants +15 XP towards level expansion.
            </div>
            
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 h-11 bg-[#4A6741] hover:bg-[#3F5737] text-white font-semibold rounded-xl text-xs tracking-wider uppercase transition-all disabled:opacity-40 cursor-pointer shadow-xs"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <PlusCircle className="w-4 h-4" />
                  <span>Log Carbon Entry</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>

    </div>
  );
}
