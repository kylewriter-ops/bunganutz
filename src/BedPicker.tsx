import React, { useState, useMemo, useEffect } from 'react';
import { ROOMS, Stay, Bed, Room } from './models';
import { supabase } from './supabaseClient';

// Helper: get all people scheduled for a given date
function getPeopleForDate(date: Date, stays: Stay[], members: any[]) {
  const staysForDate = stays.filter((stay) => {
    const start = new Date(stay.start_date);
    const end = new Date(stay.end_date);
    return date >= start && date <= end;
  });
  const memberIds = staysForDate.flatMap((stay) => stay.member_ids);
  const realMembers = members.filter((m) => memberIds.includes(m.id));
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
  const people = getPeopleForDate(selectedDate, stays, members);
  const [expandedRoom, setExpandedRoom] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<BedAssignment>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stayId = getCurrentStayId(selectedDate, stays);
  const assignedAt = selectedDate.toISOString(); // full ISO timestamp

  // Fetch assignments from Supabase on mount/date/stay change
  useEffect(() => {
    if (!stayId) {
      setAssignments({});
      return;
    }
    setLoading(true);
    supabase
      .from('bed_assignments')
      .select('*')
      .eq('stay_id', stayId)
      .eq('assigned_at', assignedAt)
      .then(({ data, error }) => {
        if (error) {
          setError(error.message);
          setAssignments({});
        } else if (data) {
          // Map assignments to {bedSlot: member_id}
          const a: BedAssignment = {};
          data.forEach((row) => {
            a[`${row.room_name}-${row.bed_name}`] = row.member_id;
          });
          setAssignments(a);
        }
        setLoading(false);
      });
  }, [stayId, assignedAt]);

  // Save assignment to Supabase
  async function saveAssignment(bedSlot: string, personId: string) {
    if (!stayId) return;
    const [roomName, bedName] = bedSlot.split('-');
    // Remove assignment if set to 'available'
    if (personId === 'available') {
      await supabase
        .from('bed_assignments')
        .delete()
        .eq('stay_id', stayId)
        .eq('assigned_at', assignedAt)
        .eq('room_name', roomName)
        .eq('bed_name', bedName);
      setAssignments((a) => ({ ...a, [bedSlot]: 'available' }));
      return;
    }
    // Upsert assignment
    await supabase
      .from('bed_assignments')
      .upsert([
        {
          stay_id: stayId,
          assigned_at: assignedAt,
          member_id: personId,
          room_name: roomName,
          bed_name: bedName,
        },
      ], { onConflict: 'stay_id,assigned_at,room_name,bed_name' });
    setAssignments((a) => ({ ...a, [bedSlot]: personId }));
  }

  // Get all assigned person ids
  const assignedPersonIds = useMemo(() =>
    Object.values(assignments).filter((pid) => pid !== 'available'),
    [assignments]
  );

  // List of people who still need a bed
  const unassignedPeople = people.filter((p) => !assignedPersonIds.includes(p.id));

  // Helper: for each bed, how many people are assigned?
  function getBedOccupancy(bed: Bed) {
    const capacity = bed.capacity || 1;
    let count = 0;
    for (let i = 0; i < capacity; i++) {
      const key = `${bed.id}-${i}`;
      if (assignments[key] && assignments[key] !== 'available') count++;
    }
    return count;
  }

  // Helper: for each room, how many open beds (by capacity)?
  function getRoomOpenBeds(room: Room) {
    return room.beds.reduce((sum, bed) => {
      const assigned = getBedOccupancy(bed);
      return sum + ((bed.capacity || 1) - assigned);
    }, 0);
  }

  // Total open beds across all rooms
  const totalOpenBeds = useMemo(() => {
    return ROOMS.reduce((sum, room) => sum + getRoomOpenBeds(room), 0);
  }, [assignments]);

  // For each bed, allow assignment up to its capacity
  function renderBedDropdowns(bed: Bed) {
    const capacity = bed.capacity || 1;
    const dropdowns = [];
    for (let i = 0; i < capacity; i++) {
      const key = `${bed.id}-${i}`;
      dropdowns.push(
        <select
          key={key}
          value={assignments[key] || 'available'}
          onChange={e => saveAssignment(key, e.target.value)}
          style={{ marginRight: 8, marginBottom: 4 }}
          disabled={loading}
        >
          <option value="available">Available</option>
          {people.map(person => (
            // Only allow a person to be assigned to one bed slot
            assignedPersonIds.includes(person.id) && assignments[key] !== person.id ? null : (
              <option key={person.id} value={person.id}>{person.first_name || person.name}</option>
            )
          ))}
        </select>
      );
    }
    return dropdowns;
  }

  // Bed assignment summary
  function renderAssignmentSummary() {
    return (
      <div style={{ marginTop: 32, background: '#f4f4f4', padding: 12, borderRadius: 8 }}>
        <b>Bed Assignment Summary</b>
        <ul style={{ margin: '8px 0 0 18px' }}>
          {ROOMS.map(room => {
            // For each bed in the room, list assigned people
            const bedAssignments: string[] = [];
            room.beds.forEach(bed => {
              const capacity = bed.capacity || 1;
              for (let i = 0; i < capacity; i++) {
                const key = `${bed.id}-${i}`;
                const personId = assignments[key];
                let label = 'Available';
                if (personId && personId !== 'available') {
                  const person = people.find(p => p.id === personId);
                  label = person ? (person.first_name || person.name) : 'Unknown';
                }
                bedAssignments.push(`${bed.description}: ${label}`);
              }
            });
            return (
              <li key={room.name} style={{ marginBottom: 8 }}>
                <b>{room.name}</b>
                <ul style={{ margin: '4px 0 0 18px' }}>
                  {bedAssignments.map((ba, i) => (
                    <li key={i}>{ba}</li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
        {error && <div style={{ color: 'red' }}>{error}</div>}
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <b>Date:</b> {selectedDate.toLocaleDateString()}
      </div>
      <div style={{ marginBottom: 16 }}>
        <b>Remaining Open Beds:</b> {totalOpenBeds}
      </div>
      <div>
        {ROOMS.map(room => (
          <div key={room.name} style={{ marginBottom: 12 }}>
            <div
              style={{ cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center' }}
              onClick={() => setExpandedRoom(expandedRoom === room.name ? null : room.name)}
            >
              <span>{room.name}</span>
              <span style={{ marginLeft: 12, color: '#555', fontWeight: 400 }}>
                Open beds: {getRoomOpenBeds(room)}
              </span>
            </div>
            {expandedRoom === room.name && (
              <div style={{ marginLeft: 16, marginTop: 8 }}>
                {room.beds.map(bed => (
                  <div key={bed.id} style={{ marginBottom: 8 }}>
                    <span>{bed.description}:</span> {renderBedDropdowns(bed)}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 24 }}>
        <b>Still Needs A Bed:</b>
        {unassignedPeople.length > 0 ? (
          <ul style={{ margin: '8px 0 0 18px' }}>
            {unassignedPeople.map((p) => (
              <li key={p.id}>{p.first_name || p.name}</li>
            ))}
          </ul>
        ) : (
          <span style={{ marginLeft: 8 }}>Everyone has a bed!</span>
        )}
      </div>
      {renderAssignmentSummary()}
    </div>
  );
};

export default BedPicker; 