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

  if (people.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-caption italic">No one scheduled for this date.</p>
      </div>
    );
  }

  return (
    <div className="section-spacing">
      {/* Header Info */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-heading-2">{selectedDate.toLocaleDateString()}</div>
            <div className="text-caption">Selected Date</div>
          </div>
          <div>
            <div className="text-heading-2 text-bunganut-sage">{people.length}</div>
            <div className="text-caption">Total People in Attendance</div>
          </div>
        </div>
      </div>
      
      {/* Day Guests Section */}
      <div className="bg-gradient-card p-6 rounded-lg border border-bunganut-coral/30">
        <h3 className="text-heading-3 mb-4">Day Guests (Meals Only)</h3>
        <div className="space-y-4">
          {mealAttendance
            .filter(att => att.date === dateStr)
            .map(att => {
              const guest = members.find(m => m.id === att.member_id);
              return guest ? (
                <div key={att.id} className="flex items-center justify-between card">
                  <div>
                    <span className="font-medium text-body">{guest.first_name} {guest.family_name}</span>
                    {guest.food_preferences && (
                      <span className="ml-2 text-caption">({guest.food_preferences})</span>
                    )}
                  </div>
                  <button 
                    onClick={() => removeGuestFromMeal(guest.id)}
                    className="bg-red-500 hover:bg-red-600 text-white text-caption font-medium py-1 px-3 rounded-lg transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ) : null;
            })}
          {mealAttendance.filter(att => att.date === dateStr).length === 0 && (
            <p className="text-caption italic text-center py-4">No day guests added</p>
          )}
          
          {/* Add Day Guest */}
          {!showAddGuest ? (
            <button 
              onClick={() => setShowAddGuest(true)}
              className="btn-outline w-full"
            >
              + Add Day Guest
            </button>
          ) : (
            <div className="card space-y-3">
              <select 
                value={selectedGuestId} 
                onChange={e => setSelectedGuestId(e.target.value)}
                className="select-field"
              >
                <option value="">Select a guest...</option>
                {availableGuests.map(guest => (
                  <option key={guest.id} value={guest.id}>
                    {guest.first_name} {guest.family_name}
                  </option>
                ))}
              </select>
              <div className="flex space-x-3">
                <button 
                  onClick={addGuestToMeal}
                  disabled={!selectedGuestId}
                  className="btn-primary flex-1"
                >
                  Add Guest
                </button>
                <button 
                  onClick={() => {
                    setShowAddGuest(false);
                    setSelectedGuestId('');
                  }}
                  className="btn-outline flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Food Preferences */}
      {preferences.length > 0 && (
        <div className="bg-gradient-card p-6 rounded-lg border border-bunganut-sage/30">
          <h3 className="text-heading-3 mb-3">Food Preferences</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {preferences.map((pref, index) => (
              <span key={index} className="status-badge status-badge-info">
                {pref}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {/* Meal Assignments */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {MEAL_TYPES.map((meal) => {
          const assignment = assignments[meal];
          const cookName = assignment?.cook && assignment.cook !== 'available' && assignment.cook !== 'on-your-own'
            ? people.find(p => p.id === assignment.cook)?.first_name || people.find(p => p.id === assignment.cook)?.name
            : assignment?.cook === 'on-your-own'
              ? 'On Your Own'
              : 'No one assigned';
          
          return (
            <div key={meal} className="card-hover">
              <h3 className="text-heading-3 mb-4 capitalize">{meal}</h3>
              
              <div className="card-spacing">
                {/* Cook Assignment */}
                <div>
                  <label className="block text-caption font-medium mb-2">Cook</label>
                  <select
                    value={assignment?.cook || 'available'}
                    onChange={e => handleAssignCook(meal, e.target.value)}
                    className="select-field"
                    disabled={loading}
                  >
                    <option value="available">Available</option>
                    <option value="on-your-own">On Your Own</option>
                    {people.map(person => (
                      <option key={person.id} value={person.id}>{person.first_name || person.name}</option>
                    ))}
                  </select>
                </div>

                {/* Menu Details */}
                <div>
                  <label className="block text-caption font-medium mb-2">Menu Details (Optional)</label>
                  <input
                    type="text"
                    placeholder="What's on the menu?"
                    value={assignment?.menu || ''}
                    onChange={e => handleMenuChange(meal, e.target.value)}
                    className="input-field"
                    disabled={loading}
                  />
                </div>

                {/* Status Display */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-caption mb-1">Current Assignment:</div>
                  <div className="font-medium text-body">{cookName}</div>
                  {assignment?.menu && (
                    <div className="text-caption mt-1">
                      <span className="font-medium">Menu:</span> {assignment.menu}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
};

export default MealPicker; 