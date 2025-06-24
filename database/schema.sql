-- Bunganutz Database Schema
-- Run this in your Supabase SQL editor to set up all required tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Members table (family members and guests)
CREATE TABLE members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  family_name TEXT,
  food_preferences TEXT,
  is_guest BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stays table (overnight reservations)
CREATE TABLE stays (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organizer_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  member_ids UUID[] NOT NULL,
  guests JSONB DEFAULT '[]'::jsonb,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Meal assignments table (who cooks what meals)
CREATE TABLE meal_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stay_id UUID NOT NULL REFERENCES stays(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'apps', 'dinner')),
  cook_id UUID REFERENCES members(id) ON DELETE SET NULL,
  menu TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(stay_id, date, meal_type)
);

-- Meal attendance table (day guests for meals)
CREATE TABLE meal_attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(date, member_id)
);

-- Bed assignments table
CREATE TABLE bed_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stay_id UUID NOT NULL REFERENCES stays(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  bed_id TEXT NOT NULL,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(stay_id, date, bed_id)
);

-- Enable Row Level Security on all tables
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE stays ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE bed_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for authenticated users
-- Allow all operations for authenticated users on all tables
CREATE POLICY "Allow all operations for authenticated users" ON members
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all operations for authenticated users" ON stays
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all operations for authenticated users" ON meal_assignments
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all operations for authenticated users" ON meal_attendance
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all operations for authenticated users" ON bed_assignments
  FOR ALL USING (auth.role() = 'authenticated');

-- Create indexes for better performance
CREATE INDEX idx_stays_dates ON stays(start_date, end_date);
CREATE INDEX idx_meal_assignments_stay_date ON meal_assignments(stay_id, date);
CREATE INDEX idx_meal_attendance_date ON meal_attendance(date);
CREATE INDEX idx_bed_assignments_stay_date ON bed_assignments(stay_id, date);
CREATE INDEX idx_members_guest ON members(is_guest);

-- Insert some sample family members (optional)
INSERT INTO members (first_name, family_name, is_guest) VALUES
  ('Kyle', 'Callahan', false),
  ('Wife', 'Callahan', false),
  ('Child', 'Callahan', false);

-- Comments for documentation
COMMENT ON TABLE members IS 'Family members and guests who can stay at or visit the cottage';
COMMENT ON TABLE stays IS 'Overnight stay reservations at the cottage';
COMMENT ON TABLE meal_assignments IS 'Meal planning assignments for specific dates and stays';
COMMENT ON TABLE meal_attendance IS 'Day guests who come for meals but do not stay overnight';
COMMENT ON TABLE bed_assignments IS 'Bed assignments for overnight guests'; 