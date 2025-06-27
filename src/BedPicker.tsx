import React, { useState, useEffect, useMemo } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ROOMS, Stay, Bed, Room, BedType, RoomName } from './models';
import { supabase } from './supabaseClient';

// Helper: for each bed, how many people are assigned?
function getBedOccupancy(bed: Bed, assignments: { [key: string]: string }) {
  const capacity = bed.capacity || 1;
  let count = 0;
  for (let i = 0; i < capacity; i++) {
    const key = `${bed.id}|${i}`;
    if (assignments[key] && assignments[key] !== 'available') count++;
  }
  return count;
}

// Helper: for each room, how many open beds (by capacity)?
function getRoomOpenBeds(room: Room, assignments: { [key: string]: string }) {
  return room.beds.reduce((sum, bed) => {
    const assigned = getBedOccupancy(bed, assignments);
    return sum + ((bed.capacity || 1) - assigned);
  }, 0);
}

function getPeopleForDate(date: Date, stays: Stay[], members: any[]) {
  const staysForDate = stays.filter((stay) => {
    const start = new Date(stay.start_date);
    const end = new Date(stay.end_date);
    return date >= start && date <= end;
  });
  const memberIds = staysForDate.flatMap((stay) => stay.member_ids);
  const realMembers = members.filter((m: any) => memberIds.includes(m.id) && !m.is_guest);
  const guestCount = staysForDate.reduce((sum, stay) => sum + stay.guests.reduce((gSum, g) => gSum + g.quantity, 0), 0);
  const guests = Array.from({ length: guestCount }, (_, i) => ({ id: `guest-${i+1}`, first_name: `Guest ${i+1}` }));
  return { members: realMembers, guests };
}

function getCurrentStayId(date: Date, stays: Stay[]): string | null {
  const stay = stays.find((s) => {
    const start = new Date(s.start_date);
    const end = new Date(s.end_date);
    return date >= start && date <= end;
  });
  return stay ? stay.id : null;
}

// For demo, we'll keep bed assignments in local state
interface BedAssignment {
  [bedSlot: string]: string; // person id or 'available'
}

interface BedPickerProps {
  selectedDate: Date;
  stays: Stay[];
  members: any[];
  onDateChange?: (date: Date) => void;
}

const BedPicker: React.FC<BedPickerProps> = ({ selectedDate, stays, members, onDateChange }) => {
  const [assignments, setAssignments] = useState<BedAssignment>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRoom, setExpandedRoom] = useState<string | null>(null);
  const [yardSpaces, setYardSpaces] = useState<number>(0);
  const [newYardSpaces, setNewYardSpaces] = useState<string>('');
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  // Get people for the selected date
  const { members: peopleForDate, guests } = getPeopleForDate(selectedDate, stays, members);
  const people = [...peopleForDate, ...guests];

  console.log('People for date:', selectedDate.toLocaleDateString(), 'members:', peopleForDate, 'guests:', guests, 'total people:', people);

  // Get current stay ID for this date
  const currentStayId = getCurrentStayId(selectedDate, stays);

  // Load existing assignments
  useEffect(() => {
    if (!currentStayId) {
      setAssignments({});
      return;
    }

    async function loadAssignments() {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from('bed_assignments')
          .select('*')
          .eq('stay_id', currentStayId)
          .eq('date', selectedDate.toISOString().split('T')[0]);

        if (error) {
          console.error('Database error:', error);
          throw error;
        }

        console.log('Raw database data:', data);
        console.log('Database fields available:', data && data.length > 0 ? Object.keys(data[0]) : 'No data');

        const newAssignments: BedAssignment = {};
        
        // Initialize all bed slots as available first
        ROOMS.forEach(room => {
          room.beds.forEach(bed => {
            const capacity = bed.capacity || 1;
            for (let i = 0; i < capacity; i++) {
              const key = `${bed.id}|${i}`;
              newAssignments[key] = 'available';
            }
          });
        });

        // Now overlay the actual assignments from database
        data?.forEach((assignment: any) => {
          const bedId = assignment.bed_name;
          const bedSlot = assignment.bed_slot || 0;
          const key = `${bedId}|${bedSlot}`;
          newAssignments[key] = assignment.member_id;
        });

        // Detect existing yard space assignments and set yardSpaces count
        const yardSpaceAssignments = data?.filter((assignment: any) => 
          assignment.bed_name?.startsWith('yard-space-')
        ) || [];
        
        if (yardSpaceAssignments.length > 0) {
          // Extract the highest space number from existing assignments
          const spaceNumbers = yardSpaceAssignments.map((assignment: any) => {
            const match = assignment.bed_name?.match(/yard-space-(\d+)/);
            return match ? parseInt(match[1]) : 0;
          });
          const maxSpaceNumber = Math.max(...spaceNumbers);
          setYardSpaces(maxSpaceNumber);
        }

        console.log('Loaded assignments:', newAssignments);
        setAssignments(newAssignments);
      } catch (err: any) {
        console.error('Full error details:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadAssignments();
  }, [currentStayId, selectedDate]);

  async function saveAssignment(bedSlot: string, personId: string) {
    if (!currentStayId) return;

    setLoading(true);
    setError(null);
    try {
      // Parse the bedSlot to get bed ID and slot number
      const [bedId, slotIndex] = bedSlot.split('|');
      const bedSlotNumber = parseInt(slotIndex) || 0;
      
      // Find the bed and room information
      let bedInfo: Bed | null = null;
      let roomInfo: Room | null = null;
      
      for (const room of ROOMS) {
        const bed = room.beds.find(b => b.id === bedId);
        if (bed) {
          bedInfo = bed;
          roomInfo = room;
          break;
        }
      }
      
      if (!bedInfo || !roomInfo) {
        throw new Error('Bed not found');
      }

      // If setting to available, delete the assignment
      if (personId === 'available') {
        const { error: deleteError } = await supabase
          .from('bed_assignments')
          .delete()
          .eq('stay_id', currentStayId)
          .eq('date', selectedDate.toISOString().split('T')[0])
          .eq('bed_name', bedId)
          .eq('bed_slot', bedSlotNumber);

        if (deleteError) {
          console.error('Delete error:', deleteError);
          throw deleteError;
        }

        setAssignments(prev => ({
          ...prev,
          [bedSlot]: 'available'
        }));
        return;
      }
      
      // Check if this person is already assigned to another bed
      const existingAssignment = Object.entries(assignments).find(
        ([slot, id]) => id === personId && slot !== bedSlot
      );

      if (existingAssignment) {
        const [existingBedId, existingSlotIndex] = existingAssignment[0].split('|');
        const existingBedSlotNumber = parseInt(existingSlotIndex) || 0;
        
        // Remove the existing assignment
        const { error: deleteError } = await supabase
          .from('bed_assignments')
          .delete()
          .eq('stay_id', currentStayId)
          .eq('date', selectedDate.toISOString().split('T')[0])
          .eq('bed_name', existingBedId)
          .eq('bed_slot', existingBedSlotNumber);

        if (deleteError) {
          console.error('Delete error:', deleteError);
          throw deleteError;
        }
      }

      // Save the new assignment
      const assignmentData = {
        stay_id: currentStayId,
        room_name: roomInfo.name,
        bed_name: bedId,
        member_id: personId,
        date: selectedDate.toISOString().split('T')[0],
        bed_slot: bedSlotNumber
      };
      
      console.log('Saving assignment:', assignmentData);
      const { error } = await supabase
        .from('bed_assignments')
        .upsert(assignmentData);

      if (error) {
        console.error('Upsert error:', error);
        throw error;
      }

      setAssignments(prev => ({
        ...prev,
        [bedSlot]: personId
      }));
    } catch (err: any) {
      console.error('Save assignment error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const assignedPersonIds = useMemo(() =>
    Object.values(assignments).filter((pid) => pid !== 'available'),
    [assignments]
  );

  // List of people who still need a bed
  const unassignedPeople = people.filter((p) => !assignedPersonIds.includes(p.id));

  // Function to get dynamic rooms (including yard with dynamic beds)
  const getDynamicRooms = useMemo(() => {
    const dynamicRooms = [...ROOMS];
    
    // Find the Yard room and add dynamic beds
    const yardRoom = dynamicRooms.find(room => room.name === 'Yard');
    if (yardRoom) {
      yardRoom.beds = Array.from({ length: yardSpaces }, (_, i) => ({
        id: `yard-space-${i + 1}`,
        description: `Personal space ${i + 1} (tent/camper)`,
        type: 'personal-tent' as BedType,
        room: 'Yard' as RoomName,
        capacity: 1 // Changed from 4 to 1 - each personal space is one bed
      }));
    }
    
    return dynamicRooms;
  }, [yardSpaces]);

  // Total open beds across all rooms
  const totalOpenBeds = useMemo(() => {
    return getDynamicRooms.reduce((sum, room) => sum + getRoomOpenBeds(room, assignments), 0);
  }, [assignments, getDynamicRooms]);

  // Function to add yard spaces
  const addYardSpaces = () => {
    const spaces = parseInt(newYardSpaces);
    if (spaces > 0) {
      setYardSpaces(prev => prev + spaces);
      setNewYardSpaces('');
    }
  };

  // Function to remove yard spaces
  const removeYardSpace = () => {
    if (yardSpaces > 0) {
      // Remove the last personal space
      const lastSpaceId = `yard-space-${yardSpaces}`;
      
      // Clear any assignments to this space
      setAssignments(prev => {
        const newAssignments = { ...prev };
        delete newAssignments[`${lastSpaceId}|0`];
        return newAssignments;
      });
      
      setYardSpaces(prev => prev - 1);
    }
  };

  // For each bed, allow assignment up to its capacity
  function renderBedDropdowns(bed: Bed) {
    const capacity = bed.capacity || 1;
    const dropdowns = [];
    
    console.log('Rendering dropdowns for bed:', bed.id, 'capacity:', capacity, 'people:', people);
    
    for (let i = 0; i < capacity; i++) {
      const key = `${bed.id}|${i}`;
      const currentValue = assignments[key] || 'available';
      console.log(`Bed slot ${key} current value:`, currentValue);
      
      dropdowns.push(
        <select
          key={key}
          value={currentValue}
          onChange={e => saveAssignment(key, e.target.value)}
          className="select-field"
          disabled={loading}
        >
          <option value="available">Available</option>
          {people.map(person => {
            // Get the display name with correct database field names
            const displayName = person.first_name || 
                              person.name || 
                              person.display_name || 
                              `Person ${person.id}`;
            
            // Add family name if available
            const fullName = person.family_name ? 
              `${displayName} ${person.family_name}` : 
              displayName;
            
            return (
              <option key={person.id} value={person.id}>
                {fullName}
                {assignedPersonIds.includes(person.id) && assignments[key] !== person.id ? ' (Assigned)' : ''}
              </option>
            );
          })}
        </select>
      );
    }
    return dropdowns;
  }

  // Bed assignment summary
  function renderAssignmentSummary() {
    return (
      <div className="bg-gradient-card p-6 rounded-lg border border-bunganut-sage/30">
        <div 
          className="flex justify-between items-center cursor-pointer mb-4"
          onClick={() => setSummaryExpanded(!summaryExpanded)}
        >
          <h3 className="text-heading-3">Bed Assignment Summary</h3>
          <div className="flex items-center space-x-2">
            <span className="text-caption">
              {summaryExpanded ? 'Collapse' : 'Expand'}
            </span>
            <svg 
              className={`w-5 h-5 text-gray-500 transition-transform ${summaryExpanded ? 'rotate-180' : ''}`}
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
        
        {summaryExpanded && (
          <div className="space-y-4">
            {getDynamicRooms.map(room => {
              // For each bed in the room, list assigned people
              const bedAssignments: string[] = [];
              room.beds.forEach(bed => {
                const capacity = bed.capacity || 1;
                for (let i = 0; i < capacity; i++) {
                  const key = `${bed.id}|${i}`;
                  const personId = assignments[key];
                  let label = 'Available';
                  if (personId && personId !== 'available') {
                    const person = people.find(p => p.id === personId);
                    if (person) {
                      const displayName = person.first_name || person.name || `Person ${person.id}`;
                      const fullName = person.family_name ? 
                        `${displayName} ${person.family_name}` : 
                        displayName;
                      label = fullName;
                    } else {
                      label = 'Unknown';
                    }
                  }
                  bedAssignments.push(`${bed.description}: ${label}`);
                }
              });
              return (
                <div key={room.name} className="card">
                  <h4 className="text-subheading font-medium mb-2">{room.name}</h4>
                  <ul className="space-y-1">
                    {bedAssignments.map((ba, i) => (
                      <li key={i} className="text-caption">{ba}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
        {error && <div className="text-red-500 mt-4">{error}</div>}
      </div>
    );
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
          <div className="md:col-span-2">
            <label className="block text-caption font-medium mb-2">Select Date for Bed Assignments</label>
            <DatePicker
              selected={selectedDate}
              onChange={(date: Date | null) => date && onDateChange?.(date)}
              className="input-field w-full"
              dateFormat="MMM dd, yyyy"
            />
          </div>
          <div>
            <div className="text-heading-2 text-bunganut-sage">{totalOpenBeds}</div>
            <div className="text-caption">Remaining Open Beds</div>
          </div>
          <div>
            <div className="text-heading-2 text-bunganut-coral">{people.length}</div>
            <div className="text-caption">Total People</div>
          </div>
        </div>
      </div>

      {/* Unassigned People Alert */}
      {unassignedPeople.length > 0 && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-6 rounded-lg">
          <div className="flex items-center">
            <svg className="w-6 h-6 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <h4 className="text-subheading font-medium">Still Needs a Bed:</h4>
              <div className="mt-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {unassignedPeople.map((p) => {
                  const displayName = p.first_name || p.name || `Person ${p.id}`;
                  const fullName = p.family_name ? 
                    `${displayName} ${p.family_name}` : 
                    displayName;
                  return (
                    <span key={p.id} className="status-badge status-badge-warning">
                      {fullName}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Room Selection */}
      <div className="space-y-4">
        {getDynamicRooms.map(room => (
          <div key={room.name} className="card overflow-hidden">
            <div
              className="cursor-pointer p-6 hover:bg-gray-50 transition-colors border-b border-gray-100"
              onClick={() => setExpandedRoom(expandedRoom === room.name ? null : room.name)}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-heading-3">{room.name}</h3>
                  <p className="text-caption mt-1">Open beds: {getRoomOpenBeds(room, assignments)}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-caption">
                    {expandedRoom === room.name ? 'Collapse' : 'Expand'}
                  </span>
                  <svg 
                    className={`w-5 h-5 text-gray-500 transition-transform ${expandedRoom === room.name ? 'rotate-180' : ''}`}
                    fill="currentColor" 
                    viewBox="0 0 20 20"
                  >
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>
            
            {expandedRoom === room.name && (
              <div className="p-6 bg-gray-50">
                {room.name === 'Yard' && (
                  <div className="p-4 bg-blue-50 border-l-4 border-blue-400 mb-4">
                    <p className="text-sm text-blue-800 mb-3">
                      If you're bringing your own tent or camper, add as many spaces as you need and assign them.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={newYardSpaces}
                        onChange={(e) => setNewYardSpaces(e.target.value)}
                        placeholder="Number of spaces"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                        onKeyPress={(e) => e.key === 'Enter' && addYardSpaces()}
                      />
                      <button
                        onClick={addYardSpaces}
                        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                      >
                        Add
                      </button>
                    </div>
                    {yardSpaces > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm text-blue-600 font-medium">
                          Current personal spaces:
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {Array.from({ length: yardSpaces }, (_, i) => (
                            <div key={i} className="flex items-center justify-between p-2 bg-white rounded border">
                              <span className="text-sm">Personal space {i + 1}</span>
                              {i === yardSpaces - 1 && (
                                <button
                                  onClick={removeYardSpace}
                                  className="text-red-500 hover:text-red-700 text-sm px-2 py-1 rounded"
                                  title="Remove this space"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="space-y-4">
                  {room.beds.map(bed => (
                    <div key={bed.id} className="card">
                      <h4 className="text-subheading font-medium mb-3">{bed.description}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {renderBedDropdowns(bed)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Assignment Summary */}
      {renderAssignmentSummary()}
    </div>
  );
};

export default BedPicker; 