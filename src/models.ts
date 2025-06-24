// Room and Bed Data Model for Bunganut Cottage

export type RoomName =
  | "Kathy & Wayne's Room"
  | "Bunk Room"
  | "Porch"
  | "Loft"
  | "Tent Stand"
  | "Main Room";

export type BedType = 'queen' | 'single' | 'double' | 'bunk-single' | 'bunk-double' | 'mattress' | 'tent';

export interface Bed {
  id: string;
  description: string;
  type: BedType;
  room: RoomName;
  capacity?: number; // number of people this bed can hold
}

export interface Room {
  name: RoomName;
  beds: Bed[];
  description?: string;
}

export const ROOMS: Room[] = [
  {
    name: "Kathy & Wayne's Room",
    beds: [
      { id: 'kw-queen', description: 'Queen sized bed', type: 'queen', room: "Kathy & Wayne's Room", capacity: 2 },
    ],
    description: "Queen sized bed",
  },
  {
    name: 'Bunk Room',
    beds: [
      { id: 'bunk-top-1', description: 'Top bunk (single)', type: 'bunk-single', room: 'Bunk Room', capacity: 1 },
      { id: 'bunk-bottom-1', description: 'Bottom bunk (double)', type: 'bunk-double', room: 'Bunk Room', capacity: 2 },
      { id: 'bunk-top-2', description: 'Top bunk (single)', type: 'bunk-single', room: 'Bunk Room', capacity: 1 },
      { id: 'bunk-bottom-2', description: 'Bottom bunk (double)', type: 'bunk-double', room: 'Bunk Room', capacity: 2 },
    ],
    description: "2 bunk beds: top bunks are singles, bottom bunks are doubles",
  },
  {
    name: 'Porch',
    beds: [
      { id: 'porch-queen', description: 'Queen sized bed', type: 'queen', room: 'Porch', capacity: 2 },
    ],
    description: "Queen sized bed",
  },
  {
    name: 'Loft',
    beds: [
      { id: 'loft-mattress-1', description: 'Single mattress', type: 'mattress', room: 'Loft', capacity: 1 },
      { id: 'loft-mattress-2', description: 'Single mattress', type: 'mattress', room: 'Loft', capacity: 1 },
      { id: 'loft-mattress-3', description: 'Single mattress', type: 'mattress', room: 'Loft', capacity: 1 },
      { id: 'loft-mattress-4', description: 'Single mattress', type: 'mattress', room: 'Loft', capacity: 1 },
      { id: 'loft-mattress-5', description: 'Single mattress', type: 'mattress', room: 'Loft', capacity: 1 },
    ],
    description: "Five single-bed mattresses",
  },
  {
    name: 'Main Room',
    beds: [
      { id: 'main-pullout', description: 'Pull-out', type: 'single', room: 'Main Room', capacity: 1 },
      { id: 'main-couch', description: 'Couch', type: 'single', room: 'Main Room', capacity: 1 },
    ],
    description: "Pull-out and couch",
  },
  {
    name: 'Tent Stand',
    beds: [
      { id: 'tent-stand', description: 'Tent stand (bring your own tent, up to 4 people)', type: 'tent', room: 'Tent Stand', capacity: 4 },
    ],
    description: "Capable of holding a four person tent",
  },
];

export type MealType = 'breakfast' | 'lunch' | 'apps' | 'dinner';

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'apps', 'dinner'];

export interface GuestSelection {
  type: 'adult-guest' | 'child-guest';
  quantity: number;
}

// Represents a stay/reservation at the cottage
export interface Stay {
  id: string;
  organizer_id: string;
  member_ids: string[];
  guests: { type: string; quantity: number }[];
  start_date: string;
  end_date: string;
  created_at?: string;
}

// Example: an array to hold all stays (in a real app, this would be in a database)
export const STAYS: Stay[] = []; 