import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ROOMS, Stay, Bed, Room } from './models';
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

function getFirstScheduledDay(stays: Stay[]): Date {
  const allDates = stays.flatMap((stay) => [new Date(stay.start_date)]);
  return allDates.length > 0 ? allDates.sort((a, b) => a.getTime() - b.getTime())[0] : new Date();
}

function getRoomOpenBeds(room: Room, assigned: number) {
  return room.beds.reduce((sum, bed) => sum + (bed.capacity || 1), 0) - assigned;
}

function getTotalBeds() {
  return ROOMS.reduce((sum, room) => sum + room.beds.reduce((s, bed) => s + (bed.capacity || 1), 0), 0);
}

const WEATHER_API_KEY = 'd484910d38d6372e2df05bac6186f79a';
const WEATHER_LAT = 43.507855;
const WEATHER_LON = -70.701264;

function getDatesInRange(start: Date, end: Date) {
  const dates = [];
  let current = new Date(start);
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

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
      <ul style={{ margin: '8px 0 0 18px' }}>
        {dates.map((date: Date) => {
          const dateStr = date.toISOString().slice(0, 10);
          const dayForecasts = forecastByDay[dateStr];
          if (!dayForecasts) {
            return (
              <li key={dateStr}>
                <b>{date.toLocaleDateString()}:</b> <span>Too Far to Forecast</span>
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
            <li key={dateStr}>
              <b>{date.toLocaleDateString()}:</b> {summary} {min}°F - {max}°F
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div style={{ margin: '16px 0', padding: 12, background: '#e6f2ff', borderRadius: 8, minHeight: 60 }}>
      <b>Weather Forecast at Bunganut:</b><br />
      {content}
    </div>
  );
};

const ScheduleStay: React.FC<ScheduleStayProps> = ({ stays, setStays, onAddStay, editingStay, onUpdateStay, onCancelEdit, members, onMemberAdded }) => {
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [memberPrefs, setMemberPrefs] = useState<MemberPrefs>({});
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
      // Optionally, load food prefs if you persist them
    } else {
      setDateRange([null, null]);
      setSelectedMembers([]);
      setMemberPrefs({});
    }
  }, [editingStay]);

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
    };
    if (editingStay && onUpdateStay) {
      await onUpdateStay({ ...editingStay, ...stayData });
    } else {
      await onAddStay(stayData);
    }
    setDateRange([null, null]);
    setSelectedMembers([]);
    setMemberPrefs({});
  }

  // Sidebar summary for each date in range (use stays prop)
  let sidebar = null;
  if (dateRange[0] && dateRange[1]) {
    const dates = getDatesInRange(dateRange[0], dateRange[1]);
    sidebar = (
      <div style={{ marginTop: 16, background: '#f4f4f4', padding: 12, borderRadius: 8 }}>
        <b>Attendance & Beds:</b>
        <ul style={{ margin: '8px 0 0 18px' }}>
          {dates.map(date => {
            const { members: realMembers, guests } = getPeopleForDate(date, stays, members);
            const allNames = [...realMembers.map((m: any) => m.first_name), ...guests.map((g: any) => g.first_name)];
            const totalBeds = getTotalBeds();
            const remainingBeds = totalBeds - (realMembers.length + guests.length);
            return (
              <li key={date.toISOString()} style={{ marginBottom: 6 }}>
                <b>{date.toLocaleDateString()}:</b><br />
                In attendance: {allNames.length > 0 ? allNames.join(', ') : 'None'}; <br />
                Remaining beds: {remainingBeds}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 32 }}>
      <form style={{ flex: 1 }} onSubmit={handleSubmit}>
        <div style={{ marginBottom: 24 }}>
          <label><strong>Arrival & Departure Dates:</strong></label><br />
          <DatePicker
            selectsRange
            startDate={dateRange[0]}
            endDate={dateRange[1]}
            onChange={update => setDateRange(update as [Date | null, Date | null])}
            isClearable
            placeholderText="Select a date range"
          />
          <WeatherWidget start={dateRange[0]} end={dateRange[1]} />
        </div>
        
        <div style={{ marginBottom: 24 }}>
          <strong>Family Members Attending:</strong>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
            {family.map((member: any) => (
              <label key={member.id} style={{ minWidth: 120 }}>
                <input
                  type="checkbox"
                  checked={selectedMembers.includes(member.id)}
                  onChange={() => handleMemberChange(member.id)}
                />
                {member.first_name}
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <strong>Guests Attending:</strong>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
            {guests.map((guest: any) => (
              <label key={guest.id} style={{ minWidth: 120 }}>
                <input
                  type="checkbox"
                  checked={selectedMembers.includes(guest.id)}
                  onChange={() => handleMemberChange(guest.id)}
                />
                {guest.first_name} {guest.family_name}
              </label>
            ))}
          </div>
          <button 
            type="button" 
            onClick={() => setShowNewMemberForm(true)}
            style={{ marginTop: 8, padding: '4px 12px', fontSize: 12 }}
          >
            + Add New Guest
          </button>
        </div>

        {showNewMemberForm && (
          <div style={{ marginBottom: 24, padding: 16, border: '1px solid #ccc', borderRadius: 8, background: '#f9f9f9' }}>
            <strong>Add New Guest:</strong>
            <div style={{ marginTop: 8 }}>
              <div style={{ marginBottom: 8 }}>
                <label>
                  First Name: *
                  <input
                    type="text"
                    value={newMember.first_name}
                    onChange={e => setNewMember(prev => ({ ...prev, first_name: e.target.value }))}
                    required
                    style={{ marginLeft: 8, width: 150 }}
                  />
                </label>
              </div>
              <div style={{ marginBottom: 8 }}>
                <label>
                  Family Name:
                  <input
                    type="text"
                    value={newMember.family_name}
                    onChange={e => setNewMember(prev => ({ ...prev, family_name: e.target.value }))}
                    style={{ marginLeft: 8, width: 150 }}
                  />
                </label>
              </div>
              <div style={{ marginBottom: 8 }}>
                <label>
                  Food Preferences:
                  <input
                    type="text"
                    value={newMember.food_preferences}
                    onChange={e => setNewMember(prev => ({ ...prev, food_preferences: e.target.value }))}
                    placeholder="e.g., vegetarian, no seafood"
                    style={{ marginLeft: 8, width: 200 }}
                  />
                </label>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label>
                  <input
                    type="checkbox"
                    checked={newMember.is_guest}
                    onChange={e => setNewMember(prev => ({ ...prev, is_guest: e.target.checked }))}
                  />
                  This is a guest (not a family member)
                </label>
              </div>
              <div>
                <button type="button" onClick={handleAddMember} disabled={addingMember} style={{ marginRight: 8 }}>
                  {addingMember ? 'Adding...' : 'Add Guest'}
                </button>
                <button type="button" onClick={() => setShowNewMemberForm(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{ marginBottom: 24 }}>
          <strong>Food Preferences:</strong>
          <div style={{ marginTop: 8 }}>
            {selectedMembers.length === 0 && <em>No members selected.</em>}
            {selectedMembers.map(id => {
              const member = members.find((m: any) => m.id === id);
              return member ? (
                <div key={id} style={{ marginBottom: 10, display: 'flex', alignItems: 'center' }}>
                  <span style={{ width: 120 }}>{member.first_name}:</span>
                  <input
                    type="text"
                    value={memberPrefs[id] || member.food_preferences || ''}
                    onChange={e => handlePrefChange(id, e.target.value)}
                    placeholder="e.g., vegetarian, no seafood"
                    style={{ marginRight: 8, flex: 1 }}
                  />
                  {memberPrefs[id] && (
                    <button type="button" onClick={() => handleRemovePref(id)} style={{ marginLeft: 4 }}>
                      Remove
                    </button>
                  )}
                </div>
              ) : null;
            })}
          </div>
        </div>
        <button type="submit" style={{ marginTop: 16, padding: '8px 20px', fontWeight: 600 }}>
          {editingStay ? 'Update Stay' : 'Schedule Stay'}
        </button>
        {editingStay && onCancelEdit && (
          <button type="button" onClick={onCancelEdit} style={{ marginLeft: 12, marginTop: 16 }}>
            Cancel
          </button>
        )}
      </form>
      {sidebar && <div style={{ flex: 1, minWidth: 260 }}>{sidebar}</div>}
    </div>
  );
};

export default ScheduleStay; 