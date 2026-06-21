import { ActivityCategory, Challenge, Badge } from './types';

export interface SubCategory {
  id: string;
  name: string;
  factor: number; // kg CO2e per unit
  unit: string;
  placeholder: string;
  examples: string;
}

export const CATEGORIES: Record<ActivityCategory, { name: string; color: string; iconName: string; subCategories: SubCategory[] }> = {
  transport: {
    name: 'Transport',
    color: 'emerald',
    iconName: 'Car',
    subCategories: [
      { id: 'gasoline_car', name: 'Gasoline Car', factor: 0.36, unit: 'miles', placeholder: 'Miles driven', examples: 'Standard sedan, SUV driver' },
      { id: 'ev_car', name: 'Electric Vehicle', factor: 0.11, unit: 'miles', placeholder: 'Miles driven', examples: 'EV charged on grid power' },
      { id: 'bus_transit', name: 'Public Bus', factor: 0.09, unit: 'miles', placeholder: 'Passenger miles', examples: 'City bus commute' },
      { id: 'train_transit', name: 'Subway/Rail Train', factor: 0.05, unit: 'miles', placeholder: 'Passenger miles', examples: 'Metropolitan rail commute' },
      { id: 'short_flight', name: 'Short-Haul Flight (<3h)', factor: 0.24, unit: 'miles', placeholder: 'Flight miles', examples: 'Domestic flight' },
      { id: 'long_flight', name: 'Long-Haul Flight (>3h)', factor: 0.18, unit: 'miles', placeholder: 'Flight miles', examples: 'International flight' },
    ]
  },
  energy: {
    name: 'Home Energy',
    color: 'amber',
    iconName: 'Home',
    subCategories: [
      { id: 'grid_electricity', name: 'Grid Electricity', factor: 0.42, unit: 'kWh', placeholder: 'Electricity in kilowatt-hours', examples: 'Typical household utility bill' },
      { id: 'renewable_electricity', name: 'Green/Solar Energy', factor: 0.02, unit: 'kWh', placeholder: 'kWh generated/used', examples: 'Rooftop solar or green grid tariff' },
      { id: 'natural_gas', name: 'Natural Gas', factor: 2.05, unit: 'therms', placeholder: 'Therms used', examples: 'Heating or stove consumption' },
      { id: 'heating_oil', name: 'Heating Oil', factor: 10.15, unit: 'gallons', placeholder: 'Gallons burned', examples: 'Oil furnace heating' },
    ]
  },
  food: {
    name: 'Diet & Food',
    color: 'teal',
    iconName: 'Utensils',
    subCategories: [
      { id: 'beef_lamb_meals', name: 'Beef or Lamb Meal', factor: 5.80, unit: 'servings', placeholder: 'Number of servings/meals', examples: 'Steak, hamburgers' },
      { id: 'chicken_pork_meals', name: 'Poultry or Pork Meal', factor: 1.45, unit: 'servings', placeholder: 'Number of servings/meals', examples: 'Chicken fingers, pork chops' },
      { id: 'fish_seafood_meals', name: 'Fish or Seafood', factor: 1.10, unit: 'servings', placeholder: 'Number of servings/meals', examples: 'Salmon, shrimp' },
      { id: 'vegetarian_meals', name: 'Vegetarian Meal', factor: 0.65, unit: 'servings', placeholder: 'Dairy/egg active portion', examples: 'Cheese pizza, eggs' },
      { id: 'vegan_meals', name: 'Vegan Meal', factor: 0.35, unit: 'servings', placeholder: '100% plant-based servings', examples: 'Rice and beans, tofu stir-fry' },
    ]
  },
  waste: {
    name: 'Waste & Recycling',
    color: 'indigo',
    iconName: 'Trash2',
    subCategories: [
      { id: 'general_landfill', name: 'Landfill Trash', factor: 1.15, unit: 'bags', placeholder: 'Standard garbage bags', examples: 'Non-recycled municipal waste' },
      { id: 'recycled_materials', name: 'Recycled Waste', factor: -0.35, unit: 'bins', placeholder: 'Standard blue bins', examples: 'Paper, plastics, glass recycled (gives co2 credit!)' },
      { id: 'food_organic_compost', name: 'Food/Organic Compost', factor: 0.08, unit: 'gallons', placeholder: 'Organic waste composted', examples: 'Compost bin credits instead of rotting in landfill' },
    ]
  }
};

export const INSTANT_CHALLENGES: Challenge[] = [
  {
    id: 'car_free_day',
    title: 'Car-Free Commute',
    description: 'Use public transit, a bicycle, or walk for all transport trips today.',
    category: 'transport',
    xpReward: 120,
    co2Saved: 8.5,
    difficulty: 'medium',
    period: 'daily',
    requirement: 'Log zero gasoline car transportation for 24 hours.'
  },
  {
    id: 'vegan_power',
    title: 'Plant Powered Hero',
    description: 'Eat 100% plant-based meals (vegan) for an entire day to bypass livestock impact.',
    category: 'food',
    xpReward: 150,
    co2Saved: 5.2,
    difficulty: 'medium',
    period: 'daily',
    requirement: 'Log only vegan meals for one day.'
  },
  {
    id: 'unplug_master',
    title: 'Phantom Slayer',
    description: 'Unplug idle electronics, dim household lights, and shave off 5 kWh of home electricity.',
    category: 'energy',
    xpReward: 100,
    co2Saved: 3.1,
    difficulty: 'easy',
    period: 'daily',
    requirement: 'Turn off standby mode on home displays and entertainment consoles.'
  },
  {
    id: 'zero_waste_chef',
    title: 'Zero Waste Chef',
    description: 'Prepare a meal using ingredients that would otherwise go to waste—no trash generated.',
    category: 'waste',
    xpReward: 110,
    co2Saved: 2.5,
    difficulty: 'easy',
    period: 'daily',
    requirement: 'Eliminate leftovers and compose zero food trash bags.'
  },
  {
    id: 'flight_less_quarter',
    title: 'Sky Staycation',
    description: 'Opt for virtual Zoom meetings or scenic regional trains instead of a boarding pass flight.',
    category: 'transport',
    xpReward: 400,
    co2Saved: 280.0,
    difficulty: 'hard',
    period: 'weekly',
    requirement: 'Stay grounded by avoiding air travel during your target period.'
  },
  {
    id: 'energy_audit',
    title: 'Thermal Wizardry',
    description: 'Nudge your home thermostat down by 2°C (winter) or up 2°C (summer) for a full week.',
    category: 'energy',
    xpReward: 250,
    co2Saved: 18.2,
    difficulty: 'medium',
    period: 'weekly',
    requirement: 'Keep active AC or heaters in thermostat eco-zones.'
  }
];

export const BADGES: Badge[] = [
  {
    id: 'first_step',
    name: 'First Green Step',
    description: 'Initialized Carbofree application and took responsibility for personal emissions',
    icon: 'Compass',
    rarity: 'common'
  },
  {
    id: 'first_log',
    name: 'Data Citizen',
    description: 'Successfully logged your very first footprint carbon data record',
    icon: 'Database',
    rarity: 'common'
  },
  {
    id: 'carbon_shaver',
    name: 'Decarbonization Novice',
    description: 'Logged actions resulting in a cumulative footprint reduction',
    icon: 'Scissors',
    rarity: 'rare'
  },
  {
    id: 'challenge_master',
    name: 'Challenger Champ',
    description: 'Successfully enrolled and completed 3 sustainability challenges',
    icon: 'Trophy',
    rarity: 'epic'
  },
  {
    id: 'level_5',
    name: 'Ecological Sentinel',
    description: 'Earned enough sustainability XP to scale to level 5 or above',
    icon: 'Crown',
    rarity: 'epic'
  },
  {
    id: 'perfect_target',
    name: 'Carbon Balanced',
    description: 'Kept monthly aggregated footprint safely below the personal goals cap',
    icon: 'CheckCircle',
    rarity: 'legendary'
  }
];
