# Bunganutz - Family Cottage Planning App

A web application for managing family scheduling at a cottage, including stay reservations, bed assignments, meal planning, and guest management.

## Features

- **Stay Scheduling**: Plan and manage family stays at the cottage with arrival and departure dates
- **Bed Assignment**: Assign family members and guests to specific beds and rooms
- **Meal Planning**: Organize meal preparation with cook assignments and menu planning
- **Guest Management**: Add and manage guests for both overnight stays and day visits
- **Weather Integration**: View weather forecasts for planned stays
- **Food Preferences**: Track dietary restrictions and preferences for all attendees

## Tech Stack

- **Frontend**: React 18 with TypeScript
- **Backend**: Supabase (PostgreSQL database with real-time subscriptions)
- **Styling**: CSS with modern responsive design
- **Date Handling**: React DatePicker
- **Weather API**: OpenWeatherMap

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Supabase account and project

### Installation

1. Clone the repository:
```bash
git clone https://github.com/kylewriter-ops/bunganutz.git
cd bunganutz
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
   - Copy `.env.example` to `.env.local`
   - Add your Supabase URL and API key

4. Start the development server:
```bash
npm start
```

The app will open at [http://localhost:3000](http://localhost:3000).

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
REACT_APP_WEATHER_API_KEY=your_openweathermap_api_key
```

## Database Setup

The app requires the following Supabase tables:

- `members` - Family members and guests
- `stays` - Overnight stay reservations
- `meal_assignments` - Meal planning assignments
- `meal_attendance` - Day guests for meals
- `bed_assignments` - Bed assignments for stays

See the SQL setup scripts in the `database/` folder for detailed schema.

## Available Scripts

- `npm start` - Runs the app in development mode
- `npm test` - Launches the test runner
- `npm run build` - Builds the app for production
- `npm run eject` - Ejects from Create React App (one-way operation)

## Project Structure

```
src/
├── components/
│   ├── App.tsx              # Main application component
│   ├── ScheduleStay.tsx     # Stay scheduling interface
│   ├── CottageCalendar.tsx  # Calendar view of stays
│   ├── BedPicker.tsx        # Bed assignment interface
│   └── MealPicker.tsx       # Meal planning interface
├── models.ts                # TypeScript interfaces and data models
├── supabaseClient.ts        # Supabase client configuration
└── index.tsx                # Application entry point
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions, please open an issue on GitHub or contact the development team.
