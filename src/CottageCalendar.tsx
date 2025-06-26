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
    <div className="section-spacing">
      {/* Calendar with Enhanced Styling */}
      <div className="card">
        <Calendar
          value={selectedDate}
          onChange={(val) => onDateChange(val as Date)}
          className="w-full border-0"
          tileContent={({ date, view }) => {
            if (view !== 'month') return null;
            const { members: realMembers, guests } = getPeopleForDate(date, stays, members);
            const total = realMembers.length + guests.length;
            if (total === 0) return null;
            return (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="w-6 h-6 bg-bunganut-burgundy text-white text-xs font-bold rounded-full flex items-center justify-center mt-1">
                  {total}
                </div>
              </div>
            );
          }}
          tileClassName={({ date, view }) => {
            if (view !== 'month') return '';
            const { members: realMembers, guests } = getPeopleForDate(date, stays, members);
            const total = realMembers.length + guests.length;
            if (total === 0) return '';
            return 'bg-bunganut-coral/20 border-2 border-bunganut-coral/40 hover:bg-bunganut-coral/30 transition-colors';
          }}
        />
      </div>

      {/* Who's at the cottage section with better layout */}
      <div className="bg-gradient-card p-6 rounded-lg border border-bunganut-sage/30">
        <h3 className="text-heading-3 mb-4">
          Who's at the cottage on {selectedDate.toLocaleDateString()}?
        </h3>
        <div className="space-y-4">
          {(() => {
            const staysForDate = getStaysForDate(selectedDate, stays);
            if (staysForDate.length === 0) {
              return (
                <div className="text-center py-8">
                  <p className="text-caption italic">No one scheduled for this date.</p>
                </div>
              );
            }
            return (
              <div className="grid gap-4">
                {staysForDate.map(stay => {
                  const memberNames = members
                    .filter((m: any) => stay.member_ids.includes(m.id) && !m.is_guest)
                    .map((m: any) => m.first_name);
                  const guestNames = members
                    .filter((m: any) => stay.member_ids.includes(m.id) && m.is_guest)
                    .map((m: any) => m.first_name);
                  const organizer = members.find((m: any) => m.id === stay.organizer_id);
                  
                  return (
                    <div key={stay.id} className="card">
                      <div className="flex justify-between items-start">
                        <div className="space-y-3">
                          <div>
                            <span className="text-subheading font-medium">Organizer:</span>
                            <span className="ml-2 text-body">{organizer?.first_name || 'Unknown'}</span>
                          </div>
                          
                          {memberNames.length > 0 && (
                            <div>
                              <span className="text-subheading font-medium">Family Members:</span>
                              <div className="mt-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                {memberNames.map((name, index) => (
                                  <span key={index} className="status-badge status-badge-success">
                                    {name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {guestNames.length > 0 && (
                            <div>
                              <span className="text-subheading font-medium">Guests:</span>
                              <div className="mt-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                {guestNames.map((name, index) => (
                                  <span key={index} className="status-badge status-badge-info">
                                    {name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {onEditStay && (
                          <button 
                            onClick={() => onEditStay(stay)}
                            className="btn-primary btn-small"
                          >
                            Edit
                          </button>
                        )}
                      </div>
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