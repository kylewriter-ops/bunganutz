import React, { useState, useEffect } from 'react';
import ScheduleStay from './ScheduleStay';
import CottageCalendar from './CottageCalendar';
import BedPicker from './BedPicker';
import MealPicker from './MealPicker';
import { supabase } from './supabaseClient';

// Use the Supabase schema for Stay
export interface Stay {
  id: string;
  organizer_id: string;
  member_ids: string[];
  guests: { type: string; quantity: number }[];
  start_date: string;
  end_date: string;
  created_at?: string;
}

function getFirstScheduledDay(stays: Stay[]): Date {
  const allDates = stays.flatMap((stay) => [new Date(stay.start_date)]);
  return allDates.length > 0 ? allDates.sort((a, b) => a.getTime() - b.getTime())[0] : new Date();
}

function App() {
  const [stays, setStays] = useState<Stay[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(getFirstScheduledDay([]));
  const [stayBeingEdited, setStayBeingEdited] = useState<Stay | null>(null);

  // Fetch stays from Supabase on mount
  useEffect(() => {
    async function fetchStays() {
      const { data, error } = await supabase
        .from('stays')
        .select('*');
      if (data) {
        setStays(data);
        if (data.length > 0) {
          setSelectedDate(getFirstScheduledDay(data));
        }
      }
      if (error) {
        console.error('Error fetching stays:', error.message);
      }
    }
    fetchStays();
  }, []);

  // Fetch members from Supabase on mount
  useEffect(() => {
    fetchMembers();
  }, []);

  async function fetchMembers() {
    const { data, error } = await supabase
      .from('members')
      .select('*');
    if (data) setMembers(data);
    if (error) console.error('Error fetching members:', error.message);
  }

  // Add a new stay to Supabase and update state
  async function handleAddStay(newStay: Omit<Stay, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('stays')
      .insert([newStay])
      .select();
    if (data) {
      setStays((prev) => [...prev, ...data]);
    }
    if (error) {
      alert('Error saving stay: ' + error.message);
    }
  }

  // Update an existing stay in Supabase and update state
  async function handleUpdateStay(updatedStay: Stay) {
    const { data, error } = await supabase
      .from('stays')
      .update({
        organizer_id: updatedStay.organizer_id,
        member_ids: updatedStay.member_ids,
        guests: updatedStay.guests,
        start_date: updatedStay.start_date,
        end_date: updatedStay.end_date,
      })
      .eq('id', updatedStay.id)
      .select();
    if (data) {
      setStays((prev) => prev.map((s) => (s.id === updatedStay.id ? data[0] : s)));
      setStayBeingEdited(null);
    }
    if (error) {
      alert('Error updating stay: ' + error.message);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-cottage">
      <div className="container-main py-8">
        {/* Header with Design System Typography */}
        <header className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-bunganut-burgundy to-bunganut-coral rounded-full mb-8 shadow-lg">
            <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-heading-1 mb-4">
            Welcome, Bunganutz!
          </h1>
          <p className="text-subheading max-w-2xl mx-auto">
            Plan your stay, pick your bed, and sign up for meals at our cozy cottage retreat
          </p>
        </header>

        {/* Main Content with Proper Spacing */}
        <main className="section-spacing">
          {/* Schedule a Stay Section */}
          <section className="card-elevated">
            <div className="mb-8">
              <h2 className="text-heading-2 mb-2">Schedule a Stay</h2>
              <p className="text-subheading">Plan your arrival and departure dates</p>
            </div>
            <ScheduleStay
              stays={stays}
              setStays={setStays}
              onAddStay={handleAddStay}
              editingStay={stayBeingEdited}
              onUpdateStay={handleUpdateStay}
              onCancelEdit={() => setStayBeingEdited(null)}
              members={members}
              onMemberAdded={fetchMembers}
            />
          </section>

          {/* Calendar View Section */}
          <section className="card-elevated">
            <div className="mb-8">
              <h2 className="text-heading-2 mb-2">
                Who's at the cottage?
              </h2>
              <p className="text-subheading">Calendar view of all scheduled stays</p>
            </div>
            <CottageCalendar
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              stays={stays}
              onEditStay={setStayBeingEdited}
              members={members}
            />
          </section>

          {/* Bed Picker Section */}
          <section className="card-elevated">
            <div className="mb-8">
              <h2 className="text-heading-2 mb-2">Bed Picker</h2>
              <p className="text-subheading">Assign beds to family members and guests</p>
            </div>
            <BedPicker selectedDate={selectedDate} stays={stays} members={members} />
          </section>

          {/* Meal Signup Section */}
          <section className="card-elevated">
            <div className="mb-8">
              <h2 className="text-heading-2 mb-2">Meal Signup</h2>
              <p className="text-subheading">Plan and assign cooking responsibilities</p>
            </div>
            <MealPicker selectedDate={selectedDate} stays={stays} members={members} />
          </section>
        </main>

        {/* Footer */}
        <footer className="text-center mt-20 pt-8 border-t border-gray-200">
          <p className="text-caption">
            © 2024 Bunganut Cottage. Made with ❤️ for family and friends.
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;
