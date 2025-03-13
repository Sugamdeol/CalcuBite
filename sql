-- Create health goals table if it doesn't exist
CREATE TABLE IF NOT EXISTS health_goals (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_type VARCHAR(100) NOT NULL,
  target TEXT NOT NULL,
  timeline VARCHAR(100),
  notes TEXT,
  progress INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups by user
CREATE INDEX IF NOT EXISTS idx_health_goals_user_id ON health_goals(user_id);

