# Database Setup Guide

This guide will help you set up the database for the Bunganutz cottage planning app.

## Prerequisites

- A Supabase account and project
- Access to the Supabase SQL editor

## Setup Steps

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Create a new project
3. Note down your project URL and anon key (you'll need these for environment variables)

### 2. Run the Schema Script

1. In your Supabase dashboard, go to the **SQL Editor**
2. Copy the contents of `schema.sql` and paste it into the editor
3. Click **Run** to execute the script

This will create all the necessary tables:
- `members` - Family members and guests
- `stays` - Overnight stay reservations  
- `meal_assignments` - Meal planning assignments
- `meal_attendance` - Day guests for meals
- `bed_assignments` - Bed assignments for stays

### 3. Configure Environment Variables

1. Copy `.env.example` to `.env.local` in your project root
2. Replace the placeholder values with your actual Supabase credentials:

```bash
REACT_APP_SUPABASE_URL=https://your-project-id.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_actual_anon_key_here
```

### 4. Test the Setup

1. Start your React app: `npm start`
2. Try creating a family member
3. Try scheduling a stay
4. Verify that data is being saved to your Supabase database

## Database Schema Overview

### Members Table
Stores family members and guests with their food preferences.

### Stays Table  
Tracks overnight reservations with member lists and date ranges.

### Meal Assignments Table
Records who is cooking which meals on specific dates.

### Meal Attendance Table
Tracks day guests who come for meals but don't stay overnight.

### Bed Assignments Table
Manages bed assignments for overnight guests.

## Troubleshooting

### Common Issues

1. **RLS Policy Errors**: Make sure you're authenticated in your app
2. **UUID Extension Missing**: The schema script includes the UUID extension creation
3. **Foreign Key Violations**: Ensure you're using valid member IDs when creating stays

### Getting Help

If you encounter issues:
1. Check the Supabase logs in your dashboard
2. Verify your environment variables are correct
3. Ensure all tables were created successfully
4. Check that RLS policies are in place

## Security Notes

- All tables have Row Level Security (RLS) enabled
- The current policies allow all operations for authenticated users
- Consider implementing more restrictive policies for production use
- Never commit your actual API keys to version control 