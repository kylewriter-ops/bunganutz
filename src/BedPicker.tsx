import React, { useState, useEffect, useMemo } from 'react';
import { ROOMS, Stay, Bed, Room } from './models';
import { supabase } from './supabaseClient';

// Helper: for each bed, how many people are assigned?
function getBedOccupancy(bed: Bed, assignments: { [key: string]: string }) {
  const capacity = bed.capacity || 1;
  let count = 0;
  for (let i = 0; i < capacity; i++) {
    const key = `${bed.id}-${i}`;
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
}

const BedPicker: React.FC<BedPickerProps> = ({ selectedDate, stays, members }) => {
  const [assignments, setAssignments] = useState<BedAssignment>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRoom, setExpandedRoom] = useState<string | null>(null);

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
          .eq('stay_id', currentStayId);

        if (error) {
          console.error('Database error:', error);
          throw error;
        }

        const newAssignments: BedAssignment = {};
        data?.forEach((assignment: any) => {
          // Use bed_name as the key since it should be unique per bed
          newAssignments[assignment.bed_name] = assignment.member_id;
        });

        // Initialize all bed slots as available
        ROOMS.forEach(room => {
          room.beds.forEach(bed => {
            const capacity = bed.capacity || 1;
            for (let i = 0; i < capacity; i++) {
              const key = `${bed.id}|${i}`;
              if (!newAssignments[key]) {
                newAssignments[key] = 'available';
              }
            }
          });
        });

        setAssignments(newAssignments);
      } catch (err: any) {
        console.error('Full error details:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadAssignments();
  }, [currentStayId]);

  async function saveAssignment(bedSlot: string, personId: string) {
    if (!currentStayId) return;

    setLoading(true);
    setError(null);
    try {
      // Parse the bedSlot to get bed ID
      const [bedId] = bedSlot.split('|');
      
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
      
      // Check if this person is already assigned to another bed
      const existingAssignment = Object.entries(assignments).find(
        ([slot, id]) => id === personId && slot !== bedSlot
      );

      if (existingAssignment) {
        const [existingBedId] = existingAssignment[0].split('|');
        
        // Remove the existing assignment
        const { error: deleteError } = await supabase
          .from('bed_assignments')
          .delete()
          .eq('stay_id', currentStayId)
          .eq('bed_name', existingBedId);

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
        member_id: personId
      };
      
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

  // Total open beds across all rooms
  const totalOpenBeds = useMemo(() => {
    return ROOMS.reduce((sum, room) => sum + getRoomOpenBeds(room, assignments), 0);
  }, [assignments]);

  // For each bed, allow assignment up to its capacity
  function renderBedDropdowns(bed: Bed) {
    const capacity = bed.capacity || 1;
    const dropdowns = [];
    
    console.log('Rendering dropdowns for bed:', bed.id, 'capacity:', capacity, 'people:', people);
    
    for (let i = 0; i < capacity; i++) {
      const key = `${bed.id}|${i}`;
      dropdowns.push(
        <select
          key={key}
          value={assignments[key] || 'available'}
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
        <h3 className="text-heading-3 mb-4">Bed Assignment Summary</h3>
        <div className="space-y-4">
          {ROOMS.map(room => {
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-heading-2">{selectedDate.toLocaleDateString()}</div>
            <div className="text-caption">Selected Date</div>
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
        {ROOMS.map(room => (
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