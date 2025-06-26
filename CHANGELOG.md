# Changelog

All notable changes to the Bunganutz project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **BedPicker dropdown selection**: Fixed critical issue preventing users from selecting names in bed assignment dropdowns
- **Database schema mismatch**: Corrected BedPicker to use actual database schema with `room_name`, `bed_name`, and `member_id` fields
- **Bunk Room bed handling**: Fixed issue where multiple bunk beds weren't being treated as separate beds
- **Key format conflicts**: Resolved parsing issues with bed IDs containing hyphens by using pipe separator
- **Assignment persistence**: Ensured bed assignments properly save to and load from database

### Technical
- Updated BedPicker to match actual `bed_assignments` table schema
- Fixed key format from `${bed.id}-${i}` to `${bed.id}|${i}` to avoid conflicts with hyphenated bed IDs
- Improved error handling and debugging for database operations
- Enhanced name display logic to properly show first and family names

### Added
- Meal attendance tracking for day guests
- Comprehensive database schema with SQL setup scripts
- Environment variable configuration
- Project documentation and contributing guidelines

### Changed
- Updated MealPicker to support day guests who don't stay overnight
- Enhanced README with detailed setup instructions
- Improved .gitignore with additional exclusions

## [0.0.3] - 2025-06-25

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