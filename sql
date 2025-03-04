-- Replace the entire SQL file with this simpler version that just handles the basic table creation
CREATE OR REPLACE FUNCTION create_ads_table_if_needed() RETURNS void AS $$
BEGIN
  -- Create ads table if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ads') THEN
    CREATE TABLE ads (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255),
      provider VARCHAR(50) DEFAULT 'custom',
      placement VARCHAR(50) DEFAULT 'in-content',
      type VARCHAR(50) DEFAULT 'banner',
      active BOOLEAN DEFAULT true,
      file_url TEXT,
      ad_code TEXT,
      size VARCHAR(20) DEFAULT 'medium',
      duration INT DEFAULT 30,
      impressions INT DEFAULT 0,
      clicks INT DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  END IF;
END;
$$ LANGUAGE plpgsql;


