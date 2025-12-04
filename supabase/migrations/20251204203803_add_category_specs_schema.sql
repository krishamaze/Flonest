-- Add specs_schema JSONB column to master_categories
-- This allows platform admins to configure category-specific fields dynamically
-- 
-- Schema format:
-- {
--   "fields": [
--     { "name": "storage", "label": "Storage", "type": "select", "options": ["32GB", "64GB"], "required": false, "order": 1 },
--     { "name": "color", "label": "Color", "type": "select", "options": ["Black", "White"], "required": false, "order": 2 }
--   ]
-- }
--
-- Supported field types: "select", "text", "number"

-- Add column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'master_categories' 
    AND column_name = 'specs_schema'
  ) THEN
    ALTER TABLE master_categories ADD COLUMN specs_schema JSONB DEFAULT NULL;
    COMMENT ON COLUMN master_categories.specs_schema IS 'Platform-configurable field schema for category-specific product attributes';
  END IF;
END $$;

-- Seed initial specs for common categories (idempotent - only if specs_schema is null)

-- Mobile Phones category
UPDATE master_categories
SET specs_schema = '{
  "fields": [
    { "name": "brand", "label": "Brand", "type": "text", "required": true, "order": 1 },
    { "name": "model_number", "label": "Model Number", "type": "text", "required": false, "order": 2 },
    { "name": "model_name", "label": "Model Name", "type": "text", "required": true, "order": 3 },
    { "name": "storage", "label": "Storage", "type": "select", "options": ["32GB", "64GB", "128GB", "256GB", "512GB", "1TB"], "required": false, "order": 4 },
    { "name": "ram", "label": "RAM", "type": "select", "options": ["2GB", "3GB", "4GB", "6GB", "8GB", "12GB", "16GB"], "required": false, "order": 5 },
    { "name": "color", "label": "Color", "type": "select", "options": ["Black", "White", "Silver", "Gold", "Blue", "Red", "Green", "Purple", "Pink", "Space Gray", "Midnight", "Starlight"], "required": false, "order": 6 }
  ]
}'::jsonb
WHERE (LOWER(name) LIKE '%mobile%' OR LOWER(name) LIKE '%phone%' OR hsn_code = '8517')
AND specs_schema IS NULL;

-- Television category
UPDATE master_categories
SET specs_schema = '{
  "fields": [
    { "name": "brand", "label": "Brand", "type": "text", "required": true, "order": 1 },
    { "name": "model_name", "label": "Model Name", "type": "text", "required": true, "order": 2 },
    { "name": "screen_size", "label": "Screen Size", "type": "select", "options": ["24\"", "32\"", "40\"", "43\"", "50\"", "55\"", "65\"", "75\"", "85\""], "required": false, "order": 3 },
    { "name": "resolution", "label": "Resolution", "type": "select", "options": ["HD", "Full HD", "4K UHD", "8K"], "required": false, "order": 4 },
    { "name": "display_type", "label": "Display Type", "type": "select", "options": ["LED", "OLED", "QLED", "Mini LED", "LCD"], "required": false, "order": 5 },
    { "name": "smart_type", "label": "Smart TV", "type": "select", "options": ["Basic", "Smart", "Google TV", "Android TV", "WebOS", "Tizen"], "required": false, "order": 6 }
  ]
}'::jsonb
WHERE (LOWER(name) LIKE '%television%' OR LOWER(name) LIKE '%tv%' OR hsn_code = '8528')
AND specs_schema IS NULL;

-- Laptop category
UPDATE master_categories
SET specs_schema = '{
  "fields": [
    { "name": "brand", "label": "Brand", "type": "text", "required": true, "order": 1 },
    { "name": "model_name", "label": "Model Name", "type": "text", "required": true, "order": 2 },
    { "name": "processor", "label": "Processor", "type": "text", "required": false, "order": 3 },
    { "name": "ram", "label": "RAM", "type": "select", "options": ["4GB", "8GB", "16GB", "32GB", "64GB"], "required": false, "order": 4 },
    { "name": "storage", "label": "Storage", "type": "select", "options": ["128GB SSD", "256GB SSD", "512GB SSD", "1TB SSD", "1TB HDD", "2TB HDD"], "required": false, "order": 5 },
    { "name": "screen_size", "label": "Screen Size", "type": "select", "options": ["11\"", "13\"", "14\"", "15.6\"", "16\"", "17\""], "required": false, "order": 6 }
  ]
}'::jsonb
WHERE (LOWER(name) LIKE '%laptop%' OR LOWER(name) LIKE '%notebook%' OR hsn_code = '8471')
AND specs_schema IS NULL;

-- Tablet category
UPDATE master_categories
SET specs_schema = '{
  "fields": [
    { "name": "brand", "label": "Brand", "type": "text", "required": true, "order": 1 },
    { "name": "model_name", "label": "Model Name", "type": "text", "required": true, "order": 2 },
    { "name": "storage", "label": "Storage", "type": "select", "options": ["32GB", "64GB", "128GB", "256GB", "512GB", "1TB"], "required": false, "order": 3 },
    { "name": "connectivity", "label": "Connectivity", "type": "select", "options": ["WiFi Only", "WiFi + Cellular"], "required": false, "order": 4 },
    { "name": "color", "label": "Color", "type": "select", "options": ["Black", "White", "Silver", "Gold", "Space Gray"], "required": false, "order": 5 }
  ]
}'::jsonb
WHERE (LOWER(name) LIKE '%tablet%' OR LOWER(name) LIKE '%ipad%')
AND specs_schema IS NULL;

-- Earphones/Headphones category
UPDATE master_categories
SET specs_schema = '{
  "fields": [
    { "name": "brand", "label": "Brand", "type": "text", "required": true, "order": 1 },
    { "name": "model_name", "label": "Model Name", "type": "text", "required": true, "order": 2 },
    { "name": "type", "label": "Type", "type": "select", "options": ["In-Ear", "Over-Ear", "On-Ear", "True Wireless", "Neckband"], "required": false, "order": 3 },
    { "name": "connectivity", "label": "Connectivity", "type": "select", "options": ["Wired", "Bluetooth", "Wireless"], "required": false, "order": 4 },
    { "name": "color", "label": "Color", "type": "select", "options": ["Black", "White", "Blue", "Red", "Green"], "required": false, "order": 5 }
  ]
}'::jsonb
WHERE (LOWER(name) LIKE '%earphone%' OR LOWER(name) LIKE '%headphone%' OR LOWER(name) LIKE '%earbud%' OR LOWER(name) LIKE '%airpod%')
AND specs_schema IS NULL;

