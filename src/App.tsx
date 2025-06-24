import React, { useState, useEffect } from 'react';
import './App.css';
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
    <div className="App" style={{ fontFamily: 'sans-serif', padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <header style={{ marginBottom: 32 }}>
        <h1>Bunganut Cottage Planner</h1>
        <p>Plan your stay, pick your bed, and sign up for meals!</p>
      </header>
      <main>
        <section style={{ marginBottom: 40 }}>
          <h2>Schedule a Stay</h2>
          <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 24, minHeight: 120, background: '#f9f9f9' }}>
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
          </div>
        </section>
        <section style={{ marginBottom: 40 }}>
          <h2>1. Who's at the cottage? <span style={{ fontWeight: 'normal', fontSize: 16 }}>(Calendar View)</span></h2>
          <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 24, minHeight: 120, background: '#f9f9f9' }}>
            <CottageCalendar
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              stays={stays}
              onEditStay={setStayBeingEdited}
              members={members}
            />
          </div>
        </section>
        <section style={{ marginBottom: 40 }}>
          <h2>2. Bed Picker</h2>
          <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 24, minHeight: 120, background: '#f9f9f9' }}>
            <BedPicker selectedDate={selectedDate} stays={stays} members={members} />
          </div>
        </section>
        <section style={{ marginBottom: 40 }}>
          <h2>3. Meal Signup</h2>
          <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 24, minHeight: 120, background: '#f9f9f9' }}>
            <MealPicker selectedDate={selectedDate} stays={stays} members={members} />
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
