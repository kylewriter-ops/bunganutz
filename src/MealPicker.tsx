import React, { useState, useMemo, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { MEAL_TYPES, Stay } from './models';
import { supabase } from './supabaseClient';

// New interface for meal attendance
interface MealAttendance {
  id: string;
  date: string;
  member_id: string;
  created_at?: string;
}

// New interface for meal cooks
interface MealCook {
  id: string;
  meal_assignment_id: string;
  cook_id: string;
  role?: string;
  created_at?: string;
}

// Updated interface for meal assignments
interface MealAssignments {
  [mealType: string]: { 
    id: string; // meal_assignment_id
    menu: string;
    cooks: MealCook[];
  };
}

function getPeopleForDate(date: Date, stays: Stay[], members: any[], mealAttendance: MealAttendance[], mealType?: string) {
  const dateStr = date.toISOString().slice(0, 10);
  const people: any[] = [];
  
  // Get people from overnight stays
  stays.forEach((stay) => {
    const start = new Date(stay.start_date);
    const end = new Date(stay.end_date);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);
    
    if (dateStr >= startStr && dateStr <= endStr) {
      // Check if this is arrival day and if people are attending this meal
      if (dateStr === startStr) {
        // It's arrival day - only include people if they're attending this specific meal on arrival day
        if (stay.arrival_meals && stay.arrival_meals.includes(mealType || '')) {
          stay.member_ids.forEach(memberId => {
            const member = members.find(m => m.id === memberId);
            if (member && !people.some(p => p.id === memberId)) {
              people.push(member);
            }
          });
        }
      }
      // Check if this is departure day and if people are attending this meal
      else if (dateStr === endStr) {
        // It's departure day - only include people if they're attending this specific meal on departure day
        if (stay.departure_meals && stay.departure_meals.includes(mealType || '')) {
          stay.member_ids.forEach(memberId => {
            const member = members.find(m => m.id === memberId);
            if (member && !people.some(p => p.id === memberId)) {
              people.push(member);
            }
          });
        }
      }
      // It's a middle day - include all people (they're staying overnight so attending all meals)
      else {
        stay.member_ids.forEach(memberId => {
          const member = members.find(m => m.id === memberId);
          if (member && !people.some(p => p.id === memberId)) {
            people.push(member);
          }
        });
      }
    }
  });
  
  // Get people from meal attendance (day guests)
  const mealAttendanceMemberIds = mealAttendance
    .filter(att => att.date === dateStr)
    .map(att => att.member_id);
  
  mealAttendanceMemberIds.forEach(memberId => {
    const member = members.find(m => m.id === memberId);
    if (member && !people.some(p => p.id === memberId)) {
      people.push(member);
    }
  });
  
  return people;
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
  onDateChange: (date: Date) => void;
}

const MealPicker: React.FC<MealPickerProps> = ({ selectedDate, stays, members, onDateChange }) => {
  const [mealAttendance, setMealAttendance] = useState<MealAttendance[]>([]);
  const [assignments, setAssignments] = useState<MealAssignments>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [selectedGuestId, setSelectedGuestId] = useState<string>('');

  const dateStr = selectedDate.toISOString().slice(0, 10);
  const people = getPeopleForDate(selectedDate, stays, members, mealAttendance);
  const stayId = getCurrentStayId(selectedDate, stays);

  // Check if any meal has people attending
  const hasAnyMealAttendance = useMemo(() => {
    return MEAL_TYPES.some(mealType => {
      const mealPeople = getPeopleForDate(selectedDate, stays, members, mealAttendance, mealType);
      return mealPeople.length > 0;
    });
  }, [selectedDate, stays, members, mealAttendance]);

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

    // Fetch meal assignments and cooks (only if there's a stay)
    if (stayId) {
      supabase
        .from('meal_assignments')
        .select(`
          *,
          meal_cooks (*)
        `)
        .eq('stay_id', stayId)
        .eq('date', dateStr)
        .then(({ data, error }) => {
          if (error) {
            setError(error.message);
            setAssignments({});
          } else if (data) {
            const a: MealAssignments = {};
            data.forEach((row) => {
              a[row.meal_type] = {
                id: row.id,
                menu: row.menu || '',
                cooks: row.meal_cooks || []
              };
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

  // Add cook to meal
  async function addCookToMeal(mealType: string, cookId: string, role?: string) {
    if (!stayId) return;
    
    const assignment = assignments[mealType];
    let mealAssignmentId = assignment?.id;
    
    // If no meal assignment exists, create one
    if (!mealAssignmentId) {
      const { data: mealData, error: mealError } = await supabase
        .from('meal_assignments')
        .insert([{
          stay_id: stayId,
          date: dateStr,
          meal_type: mealType,
          menu: ''
        }])
        .select();
      
      if (mealError) {
        setError(mealError.message);
        return;
      }
      
      mealAssignmentId = mealData[0].id;
    }
    
    // Add cook to meal
    const { data, error } = await supabase
      .from('meal_cooks')
      .insert([{
        meal_assignment_id: mealAssignmentId,
        cook_id: cookId,
        role: role
      }])
      .select();
    
    if (error) {
      setError(error.message);
    } else if (data) {
      setAssignments(prev => ({
        ...prev,
        [mealType]: {
          id: mealAssignmentId,
          menu: prev[mealType]?.menu || '',
          cooks: [...(prev[mealType]?.cooks || []), ...data]
        }
      }));
    }
  }

  // Remove cook from meal
  async function removeCookFromMeal(mealType: string, cookId: string) {
    const assignment = assignments[mealType];
    if (!assignment) return;
    
    const cookToRemove = assignment.cooks.find(c => c.cook_id === cookId);
    if (!cookToRemove) return;
    
    const { error } = await supabase
      .from('meal_cooks')
      .delete()
      .eq('id', cookToRemove.id);
    
    if (error) {
      setError(error.message);
    } else {
      setAssignments(prev => ({
        ...prev,
        [mealType]: {
          ...prev[mealType],
          cooks: prev[mealType].cooks.filter(c => c.cook_id !== cookId)
        }
      }));
    }
  }

  // Save menu to Supabase
  async function saveMenu(mealType: string, menu: string) {
    if (!stayId) return;
    
    const assignment = assignments[mealType];
    let mealAssignmentId = assignment?.id;
    
    // If no meal assignment exists, create one
    if (!mealAssignmentId) {
      const { data: mealData, error: mealError } = await supabase
        .from('meal_assignments')
        .insert([{
          stay_id: stayId,
          date: dateStr,
          meal_type: mealType,
          menu: menu
        }])
        .select();
      
      if (mealError) {
        setError(mealError.message);
        return;
      }
      
      mealAssignmentId = mealData[0].id;
    } else {
      // Update existing meal assignment
      const { error } = await supabase
        .from('meal_assignments')
        .update({ menu })
        .eq('id', mealAssignmentId);
      
      if (error) {
        setError(error.message);
        return;
      }
    }
    
    setAssignments(prev => ({
      ...prev,
      [mealType]: {
        id: mealAssignmentId,
        menu,
        cooks: prev[mealType]?.cooks || []
      }
    }));
  }

  if (!hasAnyMealAttendance) {
    return (
      <div className="text-center py-12">
        <p className="text-caption italic">No one scheduled for this date.</p>
      </div>
    );
  }

  return (
    <div className="section-spacing">
      {/* Day Guests Section */}
      <div className="bg-gradient-card p-6 rounded-lg border border-bunganut-coral/30">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-heading-3">Day Guests (Meals Only)</h3>
          <div className="w-48">
            <label className="block text-caption font-medium mb-2">Select Date for Meals</label>
            <DatePicker
              selected={selectedDate}
              onChange={(date: Date | null) => date && onDateChange(date)}
              className="input-field w-full"
              dateFormat="MMM dd, yyyy"
            />
          </div>
        </div>
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
      
      {/* Meal Assignments */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {MEAL_TYPES.map((meal) => {
          const assignment = assignments[meal];
          const mealPeople = getPeopleForDate(selectedDate, stays, members, mealAttendance, meal);
          const mealPreferences = mealPeople
            .map((p) => p.food_preferences)
            .filter((pref): pref is string => !!pref);
          const uniqueMealPreferences = Array.from(new Set(mealPreferences));
          
          const cookNames = assignment?.cooks
            ?.map((cook) => {
              const person = mealPeople.find(p => p.id === cook.cook_id);
              return person ? person.first_name || person.name : 'Unknown';
            })
            .filter((name): name is string => !!name) || [];
          
          return (
            <div key={meal} className="card-hover">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-heading-3 capitalize">{meal}</h3>
                <div className="text-right">
                  <div className="text-heading-2 text-bunganut-sage">{mealPeople.length}</div>
                  <div className="text-caption">People</div>
                </div>
              </div>
              
              <div className="card-spacing">
                {/* Food Preferences for this meal */}
                {uniqueMealPreferences.length > 0 && (
                  <div>
                    <label className="block text-caption font-medium mb-2">Food Preferences</label>
                    <div className="grid grid-cols-2 gap-2">
                      {uniqueMealPreferences.map((pref, index) => (
                        <span key={index} className="status-badge status-badge-info text-xs">
                          {pref}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cook Assignment */}
                <div>
                  <label className="block text-caption font-medium mb-2">Cooks</label>
                  <div className="space-y-2">
                    {assignment?.cooks?.map((cook) => {
                      const person = mealPeople.find(p => p.id === cook.cook_id);
                      return (
                        <div key={cook.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="text-sm">{person?.first_name || person?.name || 'Unknown'}</span>
                          <button
                            onClick={() => removeCookFromMeal(meal, cook.cook_id)}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                    
                    {/* Add Cook Dropdown */}
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          if (e.target.value === 'on-your-own') {
                            // Handle "On Your Own" - could set a special flag or just leave empty
                            // For now, we'll just not add any cooks
                          } else {
                            addCookToMeal(meal, e.target.value);
                          }
                          e.target.value = '';
                        }
                      }}
                      className="select-field"
                      disabled={loading}
                    >
                      <option value="">Add a cook...</option>
                      <option value="on-your-own">On Your Own</option>
                      {mealPeople
                        .filter(person => !assignment?.cooks?.some(cook => cook.cook_id === person.id))
                        .map(person => (
                          <option key={person.id} value={person.id}>
                            {person.first_name || person.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Menu Details */}
                <div>
                  <label className="block text-caption font-medium mb-2">Menu Details (Optional)</label>
                  <input
                    type="text"
                    placeholder="What's on the menu?"
                    value={assignment?.menu || ''}
                    onChange={e => saveMenu(meal, e.target.value)}
                    className="input-field"
                    disabled={loading}
                  />
                </div>

                {/* Status Display */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-caption mb-1">Current Assignment:</div>
                  <div className="font-medium text-body">
                    {cookNames.length > 0 ? cookNames.join(', ') : 'On Your Own'}
                  </div>
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