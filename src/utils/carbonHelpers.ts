import { ActivityLog, AiTip, CountryBenchmark, NotificationItem } from '../types';

// Initial logs to ensure and seed interactive gameplay
export const INITIAL_LOGS_SEED: ActivityLog[] = [
  {
    id: 'seed-1',
    timestamp: Date.now() - 4 * 24 * 60 * 60 * 1000,
    description: '15km drive to city in gasoline car (alternative skipped)',
    category: 'transport',
    co2eKg: 3.8,
    source: 'manual',
    range: '3.4 - 4.2 kg',
    reasoning: 'Medium passenger gasoline car estimated footprint.'
  },
  {
    id: 'seed-2',
    timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000,
    description: 'Fresh Vegan Falafel Bowl (Ate vegan instead of beef!)',
    category: 'food',
    co2eKg: 0.35,
    source: 'choice',
    range: '0.2 - 0.5 kg',
    reasoning: 'Swapped red meat meal with plant-based protein bowl.',
    avoidedKg: 5.45
  },
  {
    id: 'seed-3',
    timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000,
    description: 'Polyester fast-fashion sweater purchase',
    category: 'shopping',
    co2eKg: 14.5,
    source: 'manual',
    range: '12.0 - 17.0 kg',
    reasoning: 'Polyester synthetic fibers have high coal manufacturing overheads.'
  },
  {
    id: 'seed-4',
    timestamp: Date.now() - 1 * 24 * 60 * 60 * 1000,
    description: 'Short electric bus ride instead of solo car driving',
    category: 'transport',
    co2eKg: 0.45,
    source: 'choice',
    range: 'approx 0.45 kg',
    reasoning: 'Clean municipal passenger transit emissions.',
    avoidedKg: 1.35
  }
];

export const DEFAULT_AI_TIPS: AiTip[] = [
  {
    title: 'Swap Solo Driving for Local Bus',
    tip: "You have several solo commute gasoline records. Swapping just 3 of these trips with public transit cuts down footprint instantly.",
    whyMatters: "Standard cars release ~400g CO2e per passenger mile, while shared electric transits sit below 50g.",
    estimatedSavings: 4.2
  },
  {
    title: 'Ditch Synthetic Polyester Apparel',
    tip: "A shopping log accounted for 14.5 kg of shopping emissions. Committing to upcycled cotton or verified thrift garments can drop this category close to zero.",
    whyMatters: "Polyester production demands double the active energy input of organic cotton, releasing severe global fossil emissions.",
    estimatedSavings: 8.5
  },
  {
    title: 'Incorporate Plant-Based Diet Swaps',
    tip: "Substituting a standard red beef serving with premium organic vegan salad of similar caloric count reduces personal diet weight significantly.",
    whyMatters: "Methane and land depletion make meat production hold a major percentage of worldwide global agriculture warming.",
    estimatedSavings: 5.45
  }
];

export const COUNTRIES_BENCHMARKS: Record<string, CountryBenchmark> = {
  'United Kingdom': {
    country: 'United Kingdom',
    dailyAverageKg: 12.0,
    contextText: 'The UK grid is mixed with wind power, but high household heating gas increases winter emission loads.'
  },
  'United States': {
    country: 'United States',
    dailyAverageKg: 16.2,
    contextText: 'Suburban travel distances and reliance on heating/cooling systems drive a high national carbon average.'
  },
  'Germany': {
    country: 'Germany',
    dailyAverageKg: 11.5,
    contextText: 'Heavy industrial production and coal-related energy sources keep overall averages moderately high.'
  },
  'India': {
    country: 'India',
    dailyAverageKg: 3.5,
    contextText: 'Low per-capita energy footprints overall, but rapid coal dependency expansion is actively shifting models.'
  },
  'Canada': {
    country: 'Canada',
    dailyAverageKg: 15.5,
    contextText: 'Severe cold seasonal warming profiles and active high extraction sector values inflate benchmarks.'
  },
  'Japan': {
    country: 'Japan',
    dailyAverageKg: 9.8,
    contextText: 'High public transport density balances dense urban energy grids and fossil importing pipelines.'
  },
  'Australia': {
    country: 'Australia',
    dailyAverageKg: 14.8,
    contextText: 'High domestic coal power grids and massive private transport travel distances.'
  }
};

export const DEFAULT_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    title: '🚗 Commuting Tip',
    content: 'Swapping solo car trips with cycling or transit avoids up to 5.4kg of CO₂e instantly. Try it on your next journey!',
    type: 'tip',
    timestamp: Date.now() - 3600000, 
    read: false
  },
  {
    id: 'notif-2',
    title: '🌱 Challenge Available',
    content: 'The "Meat-Free Days Pledge" is open. Tap and accept to log salads or plant food to earn 35 XP!',
    type: 'challenge',
    timestamp: Date.now() - 7200000, 
    read: false
  },
  {
    id: 'notif-3',
    title: '🌎 EcoTrack Active',
    content: 'Welcome! Your carbon tracking budget is calibrated. Tap any of the quick-add buttons below to register today\'s footprint activities.',
    type: 'general',
    timestamp: Date.now() - 14400000, 
    read: false
  }
];

export const getRelativeTimeString = (timestamp: number): string => {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return 'Just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

/**
 * Calculates current environmental equivalence parameters
 * based on saved/avoided kg of carbon.
 */
export const calculateEquivalenceImpact = (avoidedTotal: number) => {
  const treeDays = Math.max(1, Math.round(avoidedTotal * 15));
  const gasSavings = (avoidedTotal * 0.113).toFixed(1);
  return {
    treeAbsorptionDays: treeDays,
    gasGallonsSaved: gasSavings
  };
};

export interface IndiaRegionConfig {
  name: string;
  lat: number;
  lng: number;
  gridFactor: number; // kg CO2e per kWh
  description: string;
  tip: string;
  surroundings: string;
}

export const INDIAN_STATES_CENTROIDS: IndiaRegionConfig[] = [
  { 
    name: 'Maharashtra / Western Grid', 
    lat: 19.75, 
    lng: 75.71, 
    gridFactor: 0.8, 
    description: 'Western Grid relying heavily on coal power sources.',
    tip: 'Shift laundry and high-power geysers to non-peak afternoon slots (11 AM to 3 PM) to prevent peak oil/coal startups.',
    surroundings: 'Mumbai, Pune, Nagpur, and surrounding industrial belts. Active local train integration absorbs high travel loads.'
  },
  { 
    name: 'Delhi NCR / Northern Grid', 
    lat: 28.61, 
    lng: 77.20, 
    gridFactor: 0.78, 
    description: 'Northern Grid with significant seasonal heating/cooling peaks and fossil-fuel power feeds.',
    tip: 'Select Delhi Metro over private taxis and adopt smart power strips to cut stand-by power draw.',
    surroundings: 'Delhi, Noida, Gurgaon, Ghaziabad. Extreme seasonal temperature swings amplify residential HVAC emissions.'
  },
  { 
    name: 'Karnataka / Southern Grid', 
    lat: 12.97, 
    lng: 77.59, 
    gridFactor: 0.6, 
    description: 'Southern Grid supported by major solar parks like Pavagada.',
    tip: 'Take advantage of daylight solar abundance by scheduling EV scooter charging during high-intensity solar hours (9 AM to 4 PM).',
    surroundings: 'Bengaluru, Mysuru, Hubli. Rapid tech-sector growth is driving smart microgrids and localized rooftop solar systems.'
  },
  { 
    name: 'Tamil Nadu / Southern Grid', 
    lat: 11.12, 
    lng: 78.65, 
    gridFactor: 0.58, 
    description: 'Southern Grid with exceptionally high wind turbine density in Muppandal.',
    tip: 'Rely on dynamic natural sea-breeze ventilation instead of constant high HVAC cycles during high wind periods.',
    surroundings: 'Chennai, Coimbatore, Madurai. Strong wind power integration dramatically offsets coastal municipal loads.'
  },
  { 
    name: 'Kerala / Southern Grid', 
    lat: 10.85, 
    lng: 76.27, 
    gridFactor: 0.45, 
    description: 'High hydroelectric reservoir outputs make this regional grid much cleaner.',
    tip: 'Focus on green transit swaps (e.g. e-boats or electric auto-rickshaws) and replace biomass cooking stoves with smart electric cooking plates.',
    surroundings: 'Kochi, Thiruvananthapuram, backwaters. Lush green cover aids regional carbon sequestration; protecting waterways lowers local heat loops.'
  },
  { 
    name: 'West Bengal / Eastern Grid', 
    lat: 22.98, 
    lng: 87.85, 
    gridFactor: 0.85, 
    description: 'Eastern Grid dominated by regional thermal coal mines.',
    tip: 'Adopt BEE 5-star rated appliances and shift away from old carbon-heavy heating systems to localized inverter air conditioners.',
    surroundings: 'Kolkata, Siliguri, Asansol, coal-belt towns. Energy conservation has double the carbon benefits here due to high regional grid intensity.'
  },
  { 
    name: 'Uttar Pradesh / Northern Grid', 
    lat: 26.84, 
    lng: 80.94, 
    gridFactor: 0.82, 
    description: 'Northern Grid with coal-heavy plants and high farming waste burning.',
    tip: 'Encourage bio-composting of agricultural residue to bypass burning emissions; use solar irrigation pumps in off-grid farmlands.',
    surroundings: 'Lucknow, Kanpur, Varanasi, Agra. High agricultural density creates opportunities for biomass recycling and rural crop residue management.'
  }
];

