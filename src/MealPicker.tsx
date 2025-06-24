import React, { useState, useMemo, useEffect } from 'react';
import { MEAL_TYPES, Stay } from './models';
import { supabase } from './supabaseClient';

// New interface for meal attendance
interface MealAttendance {
  id: string;
  date: string;
  member_id: string;
  created_at?: string;
}

function getPeopleForDate(date: Date, stays: Stay[], members: any[], mealAttendance: MealAttendance[]) {
  // Get people from overnight stays
  const staysForDate = stays.filter((stay) => {
    const start = new Date(stay.start_date);
    const end = new Date(stay.end_date);
    return date >= start && date <= end;
  });
  const stayMemberIds = staysForDate.flatMap((stay) => stay.member_ids);
  
  // Get people from meal attendance (day guests)
  const dateStr = date.toISOString().slice(0, 10);
  const mealAttendanceMemberIds = mealAttendance
    .filter(att => att.date === dateStr)
    .map(att => att.member_id);
  
  // Combine both sets of member IDs and remove duplicates
  const allMemberIds = [...stayMemberIds, ...mealAttendanceMemberIds].filter((id, index, array) => array.indexOf(id) === index);
  const realMembers = members.filter((m) => allMemberIds.includes(m.id));
  
  return realMembers;
}

function getCurrentStayId(date: Date, stays: Stay[]): string | null {
  const stay = stays.find((stay) => {
    const start = new Date(stay.start_date);
    const end = new Date(stay.end_date);
    return date >= start && date <= end;
  });
  return stay ? stay.id : null;
}

interface MealPickerProps {
  selectedDate: Date;
  stays: Stay[];
  members: any[];
}

interface MealAssignments {
  [mealType: string]: { cook: string; menu: string };
}

const MealPicker: React.FC<MealPickerProps> = ({ selectedDate, stays, members }) => {
  const [mealAttendance, setMealAttendance] = useState<MealAttendance[]>([]);
  const [assignments, setAssignments] = useState<MealAssignments>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [selectedGuestId, setSelectedGuestId] = useState<string>('');

  const dateStr = selectedDate.toISOString().slice(0, 10);
  const people = getPeopleForDate(selectedDate, stays, members, mealAttendance);
  const stayId = getCurrentStayId(selectedDate, stays);

  // Available guests (not already attending this date)
  const availableGuests = members.filter(m => 
    m.is_guest && 
    !mealAttendance.some(att => att.date === dateStr && att.member_id === m.id) &&
    !stays.some(stay => {
      const start = new Date(stay.start_date);
      const end = new Date(stay.end_date);
      return selectedDate >= start && selectedDate <= end && stay.member_ids.includes(m.id);
    })
  );

  // Fetch meal attendance and assignments from Supabase
  useEffect(() => {
    setLoading(true);
    
    // Fetch meal attendance for this date
    supabase
      .from('meal_attendance')
      .select('*')
      .eq('date', dateStr)
      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching meal attendance:', error);
        } else if (data) {
          setMealAttendance(data);
        }
      });

    // Fetch meal assignments (only if there's a stay)
    if (stayId) {
      supabase
        .from('meal_assignments')
        .select('*')
        .eq('stay_id', stayId)
        .eq('date', dateStr)
        .then(({ data, error }) => {
          if (error) {
            setError(error.message);
            setAssignments({});
          } else if (data) {
            const a: MealAssignments = {};
            data.forEach((row) => {
              a[row.meal_type] = { cook: row.cook_id, menu: row.menu || '' };
            });
            setAssignments(a);
          }
          setLoading(false);
        });
    } else {
      setAssignments({});
      setLoading(false);
    }
  }, [dateStr, stayId]);

  // Add guest to meal attendance
  async function addGuestToMeal() {
    if (!selectedGuestId) return;
    
    try {
      const { data, error } = await supabase
        .from('meal_attendance')
        .insert([{
          date: dateStr,
          member_id: selectedGuestId
        }])
        .select();
      
      if (error) {
        setError(error.message);
      } else if (data) {
        setMealAttendance(prev => [...prev, ...data]);
        setSelectedGuestId('');
        setShowAddGuest(false);
      }
    } catch (err) {
      setError('Failed to add guest');
    }
  }

  // Remove guest from meal attendance
  async function removeGuestFromMeal(memberId: string) {
    try {
      const { error } = await supabase
        .from('meal_attendance')
        .delete()
        .eq('date', dateStr)
        .eq('member_id', memberId);
      
      if (error) {
        setError(error.message);
      } else {
        setMealAttendance(prev => prev.filter(att => !(att.date === dateStr && att.member_id === memberId)));
      }
    } catch (err) {
      setError('Failed to remove guest');
    }
  }

  // Save assignment to Supabase
  async function saveAssignment(meal: string, cook: string, menu: string) {
    if (!stayId) return;
    // Remove assignment if cook is 'available' and menu is empty
    if ((cook === 'available' || !cook) && !menu) {
      await supabase
        .from('meal_assignments')
        .delete()
        .eq('stay_id', stayId)
        .eq('date', dateStr)
        .eq('meal_type', meal);
      setAssignments((a) => {
        const copy = { ...a };
        delete copy[meal];
        return copy;
      });
      return;
    }
    // Upsert assignment
    await supabase
      .from('meal_assignments')
      .upsert([
        {
          stay_id: stayId,
          date: dateStr,
          meal_type: meal,
          cook_id: cook,
          menu,
        },
      ], { onConflict: 'stay_id,date,meal_type' });
    setAssignments((a) => ({ ...a, [meal]: { cook, menu } }));
  }

  // Get food preferences for people scheduled for this date
  const preferences = useMemo(() => {
    const prefs = people
      .map((p) => p.food_preferences)
      .filter((pref): pref is string => !!pref);
    // Unique preferences
    return Array.from(new Set(prefs));
  }, [people]);

  function handleAssignCook(meal: string, personId: string) {
    saveAssignment(meal, personId, assignments[meal]?.menu || '');
  }

  function handleMenuChange(meal: string, menu: string) {
    saveAssignment(meal, assignments[meal]?.cook || 'available', menu);
  }

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <b>Date:</b> {selectedDate.toLocaleDateString()}
      </div>
      <div style={{ marginBottom: 16 }}>
        <b>Total People in Attendance:</b> {people.length}
      </div>
      
      {/* Day Guests Section */}
      <div style={{ marginBottom: 16, padding: 12, background: '#f0f8ff', borderRadius: 6 }}>
        <b>Day Guests (Meals Only):</b>
        <div style={{ marginTop: 8 }}>
          {mealAttendance
            .filter(att => att.date === dateStr)
            .map(att => {
              const guest = members.find(m => m.id === att.member_id);
              return guest ? (
                <div key={att.id} style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ marginRight: 8 }}>
                    {guest.first_name} {guest.family_name}
                    {guest.food_preferences && ` (${guest.food_preferences})`}
                  </span>
                  <button 
                    onClick={() => removeGuestFromMeal(guest.id)}
                    style={{ padding: '2px 6px', fontSize: 10, background: '#ff6b6b', color: 'white', border: 'none', borderRadius: 3 }}
                  >
                    Remove
                  </button>
                </div>
              ) : null;
            })}
          {mealAttendance.filter(att => att.date === dateStr).length === 0 && (
            <em>No day guests added</em>
          )}
        </div>
        
        {/* Add Day Guest */}
        {!showAddGuest ? (
          <button 
            onClick={() => setShowAddGuest(true)}
            style={{ marginTop: 8, padding: '4px 12px', fontSize: 12 }}
          >
            + Add Day Guest
          </button>
        ) : (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <select 
              value={selectedGuestId} 
              onChange={e => setSelectedGuestId(e.target.value)}
              style={{ flex: 1 }}
            >
              <option value="">Select a guest...</option>
              {availableGuests.map(guest => (
                <option key={guest.id} value={guest.id}>
                  {guest.first_name} {guest.family_name}
                </option>
              ))}
            </select>
            <button 
              onClick={addGuestToMeal}
              disabled={!selectedGuestId}
              style={{ padding: '4px 8px', fontSize: 12 }}
            >
              Add
            </button>
            <button 
              onClick={() => {
                setShowAddGuest(false);
                setSelectedGuestId('');
              }}
              style={{ padding: '4px 8px', fontSize: 12 }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {preferences.length > 0 && (
        <div style={{ marginBottom: 16, background: '#f8f8e8', padding: 10, borderRadius: 6 }}>
          <b>Food Preferences for this date:</b> {preferences.join(', ')}
        </div>
      )}
      
      <div>
        {MEAL_TYPES.map((meal) => (
          <div key={meal} style={{ marginBottom: 20, display: 'flex', alignItems: 'center' }}>
            <span style={{ width: 120, fontWeight: 600, textTransform: 'capitalize' }}>{meal}:</span>
            <select
              value={assignments[meal]?.cook || 'available'}
              onChange={e => handleAssignCook(meal, e.target.value)}
              style={{ marginRight: 12 }}
              disabled={loading}
            >
              <option value="available">Available</option>
              <option value="on-your-own">On Your Own</option>
              {people.map(person => (
                <option key={person.id} value={person.id}>{person.first_name || person.name}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Menu details (optional)"
              value={assignments[meal]?.menu || ''}
              onChange={e => handleMenuChange(meal, e.target.value)}
              style={{ marginRight: 12, flex: 1 }}
              disabled={loading}
            />
            <span style={{ color: '#555' }}>
              {assignments[meal]?.cook && assignments[meal]?.cook !== 'available' && assignments[meal]?.cook !== 'on-your-own'
                ? people.find(p => p.id === assignments[meal]?.cook)?.first_name || people.find(p => p.id === assignments[meal]?.cook)?.name
                : assignments[meal]?.cook === 'on-your-own'
                  ? 'On Your Own'
                  : 'No one assigned'}
            </span>
          </div>
        ))}
      </div>
      {error && <div style={{ color: 'red' }}>{error}</div>}
    </div>
  );
};

export default MealPicker; 