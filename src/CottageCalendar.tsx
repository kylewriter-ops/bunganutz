import React from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { Stay } from './models';

// Helper: get all stays for a given date
function getStaysForDate(date: Date, stays: Stay[]): Stay[] {
  return stays.filter((stay) => {
    const start = new Date(stay.start_date);
    const end = new Date(stay.end_date);
    // Inclusive range
    return date >= start && date <= end;
  });
}

// Helper: get all people for a given date
function getPeopleForDate(date: Date, stays: Stay[], members: any[]): { members: any[]; guests: any[] } {
  const staysForDate = getStaysForDate(date, stays);
  const memberIds = staysForDate.flatMap((stay) => stay.member_ids);
  const allMembers = members.filter((m) => memberIds.includes(m.id));
  const realMembers = allMembers.filter((m) => !m.is_guest);
  const guests = allMembers.filter((m) => m.is_guest);
  return { members: realMembers, guests };
}

interface CottageCalendarProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  stays: Stay[];
  onEditStay?: (stay: Stay) => void;
  members: any[];
}

const CottageCalendar: React.FC<CottageCalendarProps> = ({ selectedDate, onDateChange, stays, onEditStay, members }) => {
  return (
    <div>
      <Calendar
        value={selectedDate}
        onChange={(val) => onDateChange(val as Date)}
        tileContent={({ date, view }) => {
          if (view !== 'month') return null;
          const { members: realMembers, guests } = getPeopleForDate(date, stays, members);
          const total = realMembers.length + guests.length;
          if (total === 0) return null;
          return (
            <div style={{ fontSize: 12, marginTop: 2, textAlign: 'center', fontWeight: 600 }}>
              {total}
            </div>
          );
        }}
      />
      <div style={{ marginTop: 24, background: '#f4f4f4', padding: 12, borderRadius: 8 }}>
        <strong>Who's at the cottage on {selectedDate.toLocaleDateString()}?</strong>
        <div style={{ marginTop: 8 }}>
          {(() => {
            const staysForDate = getStaysForDate(selectedDate, stays);
            if (staysForDate.length === 0) return <em>No one scheduled.</em>;
            return (
              <div>
                {staysForDate.map(stay => {
                  const memberNames = members.filter((m: any) => stay.member_ids.includes(m.id) && !m.is_guest).map((m: any) => m.first_name).join(', ');
                  const guestNames = members.filter((m: any) => stay.member_ids.includes(m.id) && m.is_guest).map((m: any) => m.first_name).join(', ');
                  return (
                    <div key={stay.id} style={{ marginBottom: 12, display: 'flex', alignItems: 'center' }}>
                      <span>
                        <b>Organizer:</b> {members.find((m: any) => m.id === stay.organizer_id)?.first_name || stay.organizer_id}<br />
                        <b>Family Members:</b> {memberNames || 'None'}<br />
                        <b>Guests:</b> {guestNames || 'None'}
                      </span>
                      {onEditStay && (
                        <button style={{ marginLeft: 16 }} onClick={() => onEditStay(stay)}>Edit</button>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

export default CottageCalendar; 