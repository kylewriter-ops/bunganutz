# Changelog

All notable changes to the Bunganutz project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Meal attendance tracking for day guests
- Comprehensive database schema with SQL setup scripts
- Environment variable configuration
- Project documentation and contributing guidelines

### Changed
- Updated MealPicker to support day guests who don't stay overnight
- Enhanced README with detailed setup instructions
- Improved .gitignore with additional exclusions

### Fixed
- TypeScript compilation error with Set spread operator

## [1.0.0] - 2024-01-XX

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