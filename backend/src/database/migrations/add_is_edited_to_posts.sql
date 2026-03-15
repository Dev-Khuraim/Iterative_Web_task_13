-- Add is_edited column to posts table
ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE;
