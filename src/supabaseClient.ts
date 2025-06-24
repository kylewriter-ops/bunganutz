import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wnbncvobttwweqyphcgy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduYm5jdm9idHR3d2VxeXBoY2d5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3OTA5NDIsImV4cCI6MjA2NjM2Njk0Mn0.6UVBcIUheNuSnQTHztqRTH2W47qc3oys3_lPXf4fZM0';

export const supabase = createClient(supabaseUrl, supabaseKey);
