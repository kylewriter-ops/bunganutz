# Changelog

All notable changes to the Bunganutz project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.2] - 2025-06-26

### Fixed
- **BedPicker dropdown selection**: Fixed critical issue preventing users from selecting names in bed assignment dropdowns
- **Database schema mismatch**: Corrected BedPicker to use actual database schema with `room_name`, `bed_name`, and `member_id` fields
- **Bunk Room bed handling**: Fixed issue where multiple bunk beds weren't being treated as separate beds
- **Key format conflicts**: Resolved parsing issues with bed IDs containing hyphens by using pipe separator
- **Assignment persistence**: Ensured bed assignments properly save to and load from database
- **Bed assignment display**: Fixed issue where existing bed assignments weren't showing in dropdowns
- **Total open beds calculation**: Corrected calculation to properly count available beds when assignments change
- **Personal space capacity**: Fixed issue where personal tent spaces were creating 4 beds instead of 1
- **Yard space assignment display**: Fixed issue where personal space assignments weren't showing in the assignment summary after page refresh

### Technical
- Updated BedPicker to match actual `bed_assignments` table schema with `date` and `bed_slot` fields
- Fixed key format from `${bed.id}-${i}` to `${bed.id}|${i}` to avoid conflicts with hyphenated bed IDs
- Improved error handling and debugging for database operations
- Enhanced name display logic to properly show first and family names
- Added dynamic room generation for yard spaces with proper state management
- Implemented proper database queries with date filtering for bed assignments

### Added
- **Dynamic yard spaces**: Added ability to create personal tent/camper spaces in the yard as needed
- **Personal space management**: Users can add and remove personal spaces with visual feedback
- **Date-specific bed assignments**: Bed assignments now properly filter by specific dates within stays
- **Multi-capacity bed support**: Proper handling of beds that can accommodate multiple people
- **Assignment cleanup**: Automatic cleanup of assignments when personal spaces are removed
- **Auto-scroll on edit**: Automatically scrolls to the Schedule a Stay section when editing a stay from the calendar
- **Meal attendance tracking**: Added arrival_meals and departure_meals fields to track which meals people attend on arrival/departure days
- **Meal selection UI**: Added meal attendance selection to Schedule a Stay form with checkboxes for breakfast, lunch, apps, and dinner
- **Smart meal attendance**: MealPicker now automatically shows only people who are attending meals on arrival/departure days based on their meal selections
- **Per-meal attendance tracking**: Updated MealPicker to show attendance counts and food preferences on a per-meal basis rather than per-day
- **Search interface for people selection**: Replaced checkbox lists with a clean search + autocomplete interface for selecting family members and guests
- **Collapsible bed assignment summary**: Added expand/collapse functionality to the bed assignment summary to reduce scrolling
- **Navigation sidebar**: Added a fixed navigation menu on the left side for quick section jumping
- **Inline date pickers**: Added date pickers directly to Bed Picker and Meal Picker sections for easier date switching
- Comprehensive database schema with SQL setup scripts
- Environment variable configuration
- Project documentation and contributing guidelines

### Changed
- Updated MealPicker to support day guests who don't stay overnight
- Enhanced README with detailed setup instructions
- Improved .gitignore with additional exclusions

## [0.0.1] - 2025-06-25

### Added
- Initial release of Bunganutz cottage planning app
- Stay scheduling with arrival and departure dates
- Bed assignment system for cottage rooms
- Meal planning with cook assignments
- Guest management for family members and visitors
- Weather integration for planned stays
- Food preferences tracking
- Calendar view of cottage occupancy
- Supabase integration for data persistence
- React TypeScript frontend with modern UI

### Features
- **Stay Management**: Schedule and edit overnight stays
- **Bed Assignment**: Assign family members to specific beds and rooms
- **Meal Planning**: Organize meal preparation with cook assignments
- **Guest Management**: Add and manage family members and guests
- **Weather Widget**: View weather forecasts for planned stays
- **Responsive Design**: Works on desktop and mobile devices

### Technical
- React 18 with TypeScript
- Supabase backend with PostgreSQL
- Row Level Security (RLS) policies
- Real-time data synchronization
- Modern CSS styling
- Date handling with React DatePicker 