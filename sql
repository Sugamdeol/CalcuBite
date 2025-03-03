-- Add placement column to ads table if it doesn't exist
ALTER TABLE ads ADD COLUMN IF NOT EXISTS placement VARCHAR(255) DEFAULT 'in-content';

-- Create ad_placements table if it doesn't exist
CREATE TABLE IF NOT EXISTS ad_placements (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  placement_key VARCHAR(255) NOT NULL UNIQUE,
  description TEXT
);

-- Insert some default placements if table is empty
INSERT INTO ad_placements (name, placement_key, description)
SELECT 'Header', 'header', 'Ad placement at the top of the page'
WHERE NOT EXISTS (SELECT 1 FROM ad_placements WHERE placement_key = 'header');

INSERT INTO ad_placements (name, placement_key, description)
SELECT 'In-Content', 'in-content', 'Ad placement within the main content'
WHERE NOT EXISTS (SELECT 1 FROM ad_placements WHERE placement_key = 'in-content');

INSERT INTO ad_placements (name, placement_key, description)
SELECT 'Results', 'results', 'Ad placement near results section'
WHERE NOT EXISTS (SELECT 1 FROM ad_placements WHERE placement_key = 'results');

INSERT INTO ad_placements (name, placement_key, description)
SELECT 'Footer', 'footer', 'Ad placement at the bottom of the page'
WHERE NOT EXISTS (SELECT 1 FROM ad_placements WHERE placement_key = 'footer');

