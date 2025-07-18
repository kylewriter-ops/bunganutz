import React, { useState, useEffect, useMemo } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Stay, ROOMS, MEAL_TYPES } from './models';
import { supabase } from './supabaseClient';

interface NewMember {
  first_name: string;
  family_name: string;
  food_preferences: string;
  is_guest: boolean;
}

interface MemberPrefs {
  [memberId: string]: string;
}

interface ScheduleStayProps {
  stays: Stay[];
  setStays: React.Dispatch<React.SetStateAction<Stay[]>>;
  onAddStay: (newStay: Omit<Stay, 'id' | 'created_at'>) => Promise<void>;
  editingStay?: Stay | null;
  onUpdateStay?: (updatedStay: Stay) => Promise<void>;
  onCancelEdit?: () => void;
  members: any[];
  onMemberAdded?: () => void;
}

function getPeopleForDate(date: Date, stays: Stay[], allMembers: any[]) {
  const staysForDate = stays.filter((stay) => {
    const start = new Date(stay.start_date);
    const end = new Date(stay.end_date);
    return date >= start && date <= end;
  });
  const memberIds = staysForDate.flatMap((stay) => stay.member_ids);
  const realMembers = allMembers.filter((m: any) => memberIds.includes(m.id) && !m.is_guest);
  const guestCount = staysForDate.reduce((sum, stay) => sum + stay.guests.reduce((gSum, g) => gSum + g.quantity, 0), 0);
  const guests = Array.from({ length: guestCount }, (_, i) => ({ id: `guest-${i+1}`, first_name: `Guest ${i+1}` }));
  return { members: realMembers, guests };
}

function getTotalBeds() {
  return ROOMS.reduce((sum, room) => sum + room.beds.reduce((s, bed) => s + (bed.capacity || 1), 0), 0);
}

function getDatesInRange(start: Date, end: Date) {
  const dates = [];
  let current = new Date(start);
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

const WEATHER_API_KEY = 'd484910d38d6372e2df05bac6186f79a';
const WEATHER_LAT = 43.507855;
const WEATHER_LON = -70.701264;

// WeatherWidget using 5-day/3-hour forecast
const WeatherWidget: React.FC<{ start: Date | null; end: Date | null }> = ({ start, end }) => {
  const [forecast, setForecast] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!start || !end) {
      setForecast(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${WEATHER_LAT}&lon=${WEATHER_LON}&appid=${WEATHER_API_KEY}&units=imperial`
    )
      .then((res) => res.json())
      .then((data) => {
        if (data && data.list) {
          setForecast(data.list);
        } else {
          setError('No forecast data available.');
        }
        setLoading(false);
      })
      .catch((e) => {
        setError('Failed to fetch weather.');
        setLoading(false);
      });
  }, [start, end]);

  let content = null;
  if (!start || !end) {
    content = 'Select a date range to see the weather forecast.';
  } else if (loading) {
    content = 'Loading weather...';
  } else if (error) {
    content = error;
  } else if (forecast) {
    // Group forecast by day
    const dates = getDatesInRange(start, end);
    // OpenWeatherMap forecast is for next 5 days (3-hour intervals)
    // Group by date string (YYYY-MM-DD)
    const forecastByDay: { [date: string]: any[] } = {};
    forecast.forEach((item) => {
      const date = new Date(item.dt * 1000);
      const dateStr = date.toISOString().slice(0, 10);
      if (!forecastByDay[dateStr]) forecastByDay[dateStr] = [];
      forecastByDay[dateStr].push(item);
    });
    content = (
      <ul className="mt-2 ml-4 space-y-1">
        {dates.map((date: Date) => {
          const dateStr = date.toISOString().slice(0, 10);
          const dayForecasts = forecastByDay[dateStr];
          if (!dayForecasts) {
            return (
              <li key={dateStr} className="text-sm">
                <span className="font-semibold">{date.toLocaleDateString()}:</span> <span className="text-gray-500">Too Far to Forecast</span>
              </li>
            );
          }
          // Find min/max temp and most common weather
          const temps = dayForecasts.map(f => f.main.temp);
          const min = Math.round(Math.min(...temps));
          const max = Math.round(Math.max(...temps));
          const weatherCounts: { [desc: string]: number } = {};
          dayForecasts.forEach(f => {
            const desc = f.weather[0]?.main;
            if (desc) weatherCounts[desc] = (weatherCounts[desc] || 0) + 1;
          });
          const summary = Object.entries(weatherCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
          return (
            <li key={dateStr} className="text-sm">
              <span className="font-semibold">{date.toLocaleDateString()}:</span> {summary} {min}°F - {max}°F
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="mt-4 p-4 bg-gradient-card rounded-lg border border-bunganut-coral/30">
      <h4 className="text-heading-3 mb-2">Weather Forecast at Bunganut</h4>
      <p className="text-body">{content}</p>
    </div>
  );
};

const ScheduleStay: React.FC<ScheduleStayProps> = ({ stays, setStays, onAddStay, editingStay, onUpdateStay, onCancelEdit, members, onMemberAdded }) => {
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [memberPrefs, setMemberPrefs] = useState<MemberPrefs>({});
  const [arrivalMeals, setArrivalMeals] = useState<string[]>(['breakfast', 'lunch', 'dinner']);
  const [departureMeals, setDepartureMeals] = useState<string[]>(['breakfast', 'lunch', 'dinner']);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [newMember, setNewMember] = useState<NewMember>({
    first_name: '',
    family_name: '',
    food_preferences: '',
    is_guest: false
  });
  const [showNewMemberForm, setShowNewMemberForm] = useState(false);
  const [addingMember, setAddingMember] = useState(false);

  const family = members.filter((m: any) => !m.is_guest);
  const guests = members.filter((m: any) => m.is_guest);

  useEffect(() => {
    if (editingStay) {
      setDateRange([
        new Date(editingStay.start_date),
        new Date(editingStay.end_date),
      ]);
      setSelectedMembers(editingStay.member_ids);
      setArrivalMeals(editingStay.arrival_meals || ['breakfast', 'lunch', 'dinner']);
      setDepartureMeals(editingStay.departure_meals || ['breakfast', 'lunch', 'dinner']);
      // Optionally, load food prefs if you persist them
    } else {
      setDateRange([null, null]);
      setSelectedMembers([]);
      setMemberPrefs({});
      setArrivalMeals(['breakfast', 'lunch', 'dinner']);
      setDepartureMeals(['breakfast', 'lunch', 'dinner']);
      setSearchQuery('');
      setShowSearchResults(false);
    }
  }, [editingStay]);

  // Close search results when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Element;
      if (!target.closest('.search-container')) {
        setShowSearchResults(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleMemberChange(id: string) {
    setSelectedMembers(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  }

  function handlePrefChange(id: string, value: string) {
    setMemberPrefs(prefs => ({ ...prefs, [id]: value }));
  }

  function handleRemovePref(id: string) {
    setMemberPrefs(prefs => {
      const newPrefs = { ...prefs };
      delete newPrefs[id];
      return newPrefs;
    });
  }

  function handleMealToggle(mealType: string, mealArray: string[], setMealArray: React.Dispatch<React.SetStateAction<string[]>>) {
    setMealArray(prev => 
      prev.includes(mealType) 
        ? prev.filter(m => m !== mealType)
        : [...prev, mealType]
    );
  }

  // Search functionality
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const query = searchQuery.toLowerCase();
    const allMembers = [...family, ...guests];
    
    // Filter members that match the search query and aren't already selected
    return allMembers.filter(member => {
      const fullName = `${member.first_name} ${member.family_name || ''}`.toLowerCase();
      const firstName = member.first_name.toLowerCase();
      const lastName = member.family_name?.toLowerCase() || '';
      
      return (fullName.includes(query) || firstName.includes(query) || lastName.includes(query)) &&
             !selectedMembers.includes(member.id);
    });
  }, [searchQuery, family, guests, selectedMembers]);

  function handleAddMemberFromSearch(memberId: string) {
    setSelectedMembers(prev => [...prev, memberId]);
    setSearchQuery('');
    setShowSearchResults(false);
  }

  function handleRemoveMember(memberId: string) {
    setSelectedMembers(prev => prev.filter(id => id !== memberId));
  }

  function handleQuickAddGuest() {
    const names = searchQuery.trim().split(' ');
    const firstName = names[0] || '';
    const lastName = names.slice(1).join(' ') || '';
    
    setNewMember({
      first_name: firstName,
      family_name: lastName,
      food_preferences: '',
      is_guest: true
    });
    setShowNewMemberForm(true);
    setSearchQuery('');
    setShowSearchResults(false);
  }

  async function handleAddMember() {
    if (!newMember.first_name.trim()) return;
    
    setAddingMember(true);
    try {
      const { data, error } = await supabase
        .from('members')
        .insert([newMember])
        .select();
      
      if (error) {
        alert('Error adding member: ' + error.message);
      } else if (data) {
        // Add the new member to the selected members if they're a guest
        if (newMember.is_guest) {
          setSelectedMembers(prev => [...prev, data[0].id]);
        }
        // Reset form
        setNewMember({
          first_name: '',
          family_name: '',
          food_preferences: '',
          is_guest: false
        });
        setShowNewMemberForm(false);
        // Refresh members list
        if (onMemberAdded) {
          onMemberAdded();
        }
      }
    } catch (error) {
      alert('Error adding member: ' + error);
    } finally {
      setAddingMember(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dateRange[0] || !dateRange[1] || selectedMembers.length === 0) return;
    const stayData = {
      organizer_id: selectedMembers[0],
      member_ids: selectedMembers,
      guests: [], // No more guest counts, all guests are now members
      start_date: dateRange[0].toISOString().slice(0, 10),
      end_date: dateRange[1].toISOString().slice(0, 10),
      arrival_meals: arrivalMeals,
      departure_meals: departureMeals,
    };
    if (editingStay && onUpdateStay) {
      await onUpdateStay({ ...editingStay, ...stayData });
    } else {
      await onAddStay(stayData);
    }
    setDateRange([null, null]);
    setSelectedMembers([]);
    setMemberPrefs({});
    setArrivalMeals(['breakfast', 'lunch', 'dinner']);
    setDepartureMeals(['breakfast', 'lunch', 'dinner']);
  }

  // Sidebar summary for each date in range (use stays prop)
  let sidebar = null;
  if (dateRange[0] && dateRange[1]) {
    const dates = getDatesInRange(dateRange[0], dateRange[1]);
    sidebar = (
      <div className="bg-gradient-card p-6 rounded-lg border border-bunganut-sage/30">
        <h4 className="text-heading-3 mb-4">Attendance & Beds Summary</h4>
        <div className="space-y-4">
          {dates.map(date => {
            const { members: realMembers, guests } = getPeopleForDate(date, stays, members);
            const allNames = [...realMembers.map((m: any) => m.first_name), ...guests.map((g: any) => g.first_name)];
            const totalBeds = getTotalBeds();
            const remainingBeds = totalBeds - (realMembers.length + guests.length);
            return (
              <div key={date.toISOString()} className="card">
                <div className="text-heading-3 mb-2">{date.toLocaleDateString()}</div>
                <div className="text-caption mb-1">
                  <span className="font-medium">In attendance:</span> {allNames.length > 0 ? allNames.join(', ') : 'None'}
                </div>
                <div className="text-caption">
                  <span className="font-medium">Remaining beds:</span> {remainingBeds}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <form onSubmit={handleSubmit} className="card-spacing">
        {/* Date Range Selection */}
        <div>
          <label className="block text-subheading mb-3">
            Arrival & Departure Dates
          </label>
          <DatePicker
            selectsRange
            startDate={dateRange[0]}
            endDate={dateRange[1]}
            onChange={update => setDateRange(update as [Date | null, Date | null])}
            isClearable
            placeholderText="Select a date range"
            className="input-field"
          />
          <WeatherWidget start={dateRange[0]} end={dateRange[1]} />
        </div>

        {/* Meal Attendance */}
        {dateRange[0] && dateRange[1] && (
          <div className="space-y-6">
            {/* Arrival Day Meals */}
            <div>
              <label className="block text-subheading mb-3">
                Meals on Arrival Day ({dateRange[0]?.toLocaleDateString()})
              </label>
              <div className="grid grid-cols-3 gap-3">
                {MEAL_TYPES.map(mealType => (
                  <label key={mealType} className="interactive-card">
                    <input
                      type="checkbox"
                      checked={arrivalMeals.includes(mealType)}
                      onChange={() => handleMealToggle(mealType, arrivalMeals, setArrivalMeals)}
                      className="checkbox-field mr-2"
                    />
                    <span className="text-body capitalize">{mealType}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Departure Day Meals */}
            <div>
              <label className="block text-subheading mb-3">
                Meals on Departure Day ({dateRange[1]?.toLocaleDateString()})
              </label>
              <div className="grid grid-cols-3 gap-3">
                {MEAL_TYPES.map(mealType => (
                  <label key={mealType} className="interactive-card">
                    <input
                      type="checkbox"
                      checked={departureMeals.includes(mealType)}
                      onChange={() => handleMealToggle(mealType, departureMeals, setDepartureMeals)}
                      className="checkbox-field mr-2"
                    />
                    <span className="text-body capitalize">{mealType}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* People Selection */}
        <div>
          <label className="block text-subheading mb-3">
            People Attending
          </label>
          
          {/* Selected People Display */}
          {selectedMembers.length > 0 && (
            <div className="mb-4">
              <div className="text-caption font-medium mb-2">Selected People:</div>
              <div className="flex flex-wrap gap-2">
                {selectedMembers.map(memberId => {
                  const member = members.find(m => m.id === memberId);
                  return member ? (
                    <div key={memberId} className="flex items-center bg-bunganut-sage/20 text-bunganut-sage px-3 py-1 rounded-full">
                      <span className="text-sm">
                        {member.first_name} {member.family_name}
                        {member.is_guest && <span className="text-xs ml-1">(Guest)</span>}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(memberId)}
                        className="ml-2 text-bunganut-sage hover:text-bunganut-sage/70 text-sm"
                      >
                        ×
                      </button>
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          )}

          {/* Search Interface */}
          <div className="relative search-container">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchResults(e.target.value.trim().length > 0);
              }}
              onFocus={() => setShowSearchResults(searchQuery.trim().length > 0)}
              placeholder="Search for family members or guests..."
              className="input-field w-full"
            />
            
            {/* Search Results Dropdown */}
            {showSearchResults && (searchResults.length > 0 || searchQuery.trim()) && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {/* Existing Members */}
                {searchResults.map(member => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => handleAddMemberFromSearch(member.id)}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="font-medium">{member.first_name} {member.family_name}</div>
                    <div className="text-sm text-gray-500">
                      {member.is_guest ? 'Guest' : 'Family Member'}
                      {member.food_preferences && ` • ${member.food_preferences}`}
                    </div>
                  </button>
                ))}
                
                {/* Quick Add Option */}
                {searchQuery.trim() && searchResults.length === 0 && (
                  <button
                    type="button"
                    onClick={handleQuickAddGuest}
                    className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 text-blue-600"
                  >
                    <div className="font-medium">Add "{searchQuery}" as new guest</div>
                    <div className="text-sm text-blue-500">Create new guest profile</div>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Manual Add Guest Button */}
          <div className="mt-3">
            <button 
              type="button" 
              onClick={() => setShowNewMemberForm(true)}
              className="btn-outline btn-small"
            >
              + Add New Guest Manually
            </button>
          </div>
        </div>

        {/* Add New Guest Form */}
        {showNewMemberForm && (
          <div className="bg-gradient-card p-6 rounded-lg border border-bunganut-coral/30">
            <h4 className="text-heading-3 mb-4">Add New Guest</h4>
            <div className="card-spacing">
              <div>
                <label className="block text-caption font-medium mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  value={newMember.first_name}
                  onChange={e => setNewMember(prev => ({ ...prev, first_name: e.target.value }))}
                  required
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-caption font-medium mb-1">
                  Family Name
                </label>
                <input
                  type="text"
                  value={newMember.family_name}
                  onChange={e => setNewMember(prev => ({ ...prev, family_name: e.target.value }))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-caption font-medium mb-1">
                  Food Preferences
                </label>
                <input
                  type="text"
                  value={newMember.food_preferences}
                  onChange={e => setNewMember(prev => ({ ...prev, food_preferences: e.target.value }))}
                  placeholder="e.g., vegetarian, no seafood"
                  className="input-field"
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={newMember.is_guest}
                  onChange={e => setNewMember(prev => ({ ...prev, is_guest: e.target.checked }))}
                  className="checkbox-field"
                />
                <label className="text-caption">
                  This is a guest (not a family member)
                </label>
              </div>
              <div className="flex space-x-3">
                <button 
                  type="button" 
                  onClick={handleAddMember} 
                  disabled={addingMember}
                  className="btn-primary btn-small flex-1"
                >
                  {addingMember ? 'Adding...' : 'Add Guest'}
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowNewMemberForm(false)}
                  className="btn-outline btn-small flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Food Preferences */}
        <div>
          <label className="block text-subheading mb-3">
            Food Preferences
          </label>
          <div className="space-y-3">
            {selectedMembers.length === 0 && (
              <p className="text-caption italic">No members selected.</p>
            )}
            {selectedMembers.map(id => {
              const member = members.find((m: any) => m.id === id);
              return member ? (
                <div key={id} className="flex items-center space-x-3">
                  <span className="w-24 font-medium text-caption">{member.first_name}:</span>
                  <input
                    type="text"
                    value={memberPrefs[id] || member.food_preferences || ''}
                    onChange={e => handlePrefChange(id, e.target.value)}
                    placeholder="e.g., vegetarian, no seafood"
                    className="input-field flex-1"
                  />
                  {memberPrefs[id] && (
                    <button 
                      type="button" 
                      onClick={() => handleRemovePref(id)}
                      className="text-red-500 hover:text-red-700 text-caption font-medium"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ) : null;
            })}
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex space-x-4 pt-4">
          <button type="submit" className="btn-primary">
            {editingStay ? 'Update Stay' : 'Schedule Stay'}
          </button>
          {editingStay && onCancelEdit && (
            <button type="button" onClick={onCancelEdit} className="btn-outline">
              Cancel
            </button>
          )}
        </div>
      </form>
      
      {/* Sidebar */}
      {sidebar && <div className="lg:col-span-1">{sidebar}</div>}
    </div>
  );
};

export default ScheduleStay; 