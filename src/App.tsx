import React, { useState, useEffect, useRef } from 'react';
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
  arrival_meals?: string[];
  departure_meals?: string[];
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
  const scheduleStayRef = useRef<HTMLElement>(null);

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
        arrival_meals: updatedStay.arrival_meals,
        departure_meals: updatedStay.departure_meals,
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

  // Function to handle editing a stay and scroll to the Schedule a Stay section
  const handleEditStay = (stay: Stay) => {
    setStayBeingEdited(stay);
    // Scroll to the Schedule a Stay section with smooth animation
    scheduleStayRef.current?.scrollIntoView({ 
      behavior: 'smooth',
      block: 'start'
    });
  };

  // Navigation component
  const Navigation = () => {
    const scrollToSection = (sectionId: string) => {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    return (
      <div className="fixed left-4 top-1/2 transform -translate-y-1/2 z-50">
        <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 p-4">
          <nav className="space-y-3">
            <button
              onClick={() => scrollToSection('calendar-section')}
              className="block text-left text-sm font-medium text-gray-700 hover:text-bunganut-burgundy transition-colors"
            >
              Calendar
            </button>
            <button
              onClick={() => scrollToSection('reservations-section')}
              className="block text-left text-sm font-medium text-gray-700 hover:text-bunganut-burgundy transition-colors"
            >
              Reservations
            </button>
            <button
              onClick={() => scrollToSection('bed-picker-section')}
              className="block text-left text-sm font-medium text-gray-700 hover:text-bunganut-burgundy transition-colors"
            >
              Bed Picker
            </button>
            <button
              onClick={() => scrollToSection('meal-assignments-section')}
              className="block text-left text-sm font-medium text-gray-700 hover:text-bunganut-burgundy transition-colors"
            >
              Meal Assignments
            </button>
          </nav>
        </div>
      </div>
    );
  };

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
            Plan your stay, pick your bed, and sign up for meals at our family's camp.
          </p>
        </header>

        {/* Main Content with Proper Spacing */}
        <main className="section-spacing">
          {/* Calendar View Section */}
          <section id="calendar-section" className="card-elevated">
            <div className="mb-8">
              <h2 className="text-heading-2 mb-2">
                Who's at the camp?
              </h2>
              <p className="text-subheading">Calendar view of all scheduled stays</p>
            </div>
            <CottageCalendar
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              stays={stays}
              onEditStay={handleEditStay}
              members={members}
            />
          </section>

          {/* Schedule a Stay Section */}
          <section id="reservations-section" ref={scheduleStayRef} className="card-elevated">
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

          {/* Bed Picker Section */}
          <section id="bed-picker-section" className="card-elevated">
            <div className="mb-8">
              <h2 className="text-heading-2 mb-2">Bed Picker</h2>
              <p className="text-subheading">Assign beds to family members and guests</p>
            </div>
            <BedPicker 
              selectedDate={selectedDate} 
              stays={stays} 
              members={members} 
              onDateChange={setSelectedDate}
            />
          </section>

          {/* Meal Signup Section */}
          <section id="meal-assignments-section" className="card-elevated">
            <div className="mb-8">
              <h2 className="text-heading-2 mb-2">Meal Signup</h2>
              <p className="text-subheading">Plan and assign cooking responsibilities</p>
            </div>
            <MealPicker 
              selectedDate={selectedDate} 
              stays={stays} 
              members={members} 
              onDateChange={setSelectedDate}
            />
          </section>
        </main>

        {/* Footer */}
        <footer className="text-center mt-20 pt-8 border-t border-gray-200">
          <p className="text-caption">
            © 2025 Kyle Callahan. Made with ❤️ for family and friends.
          </p>
        </footer>
      </div>
      <Navigation />
    </div>
  );
}

export default App;
