-- Manual Database Migration Script
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/editor

-- ============================================
-- CREATE TABLES
-- ============================================

-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    password TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create data_rooms table
CREATE TABLE IF NOT EXISTS public.data_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT data_rooms_user_id_fkey FOREIGN KEY (user_id) 
        REFERENCES public.users(id) ON DELETE CASCADE
);

-- Create folders table
CREATE TABLE IF NOT EXISTS public.folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    data_room_id UUID NOT NULL,
    parent_folder_id UUID,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT folders_data_room_id_fkey FOREIGN KEY (data_room_id) 
        REFERENCES public.data_rooms(id) ON DELETE CASCADE,
    CONSTRAINT folders_user_id_fkey FOREIGN KEY (user_id) 
        REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT folders_parent_folder_id_fkey FOREIGN KEY (parent_folder_id) 
        REFERENCES public.folders(id) ON DELETE CASCADE
);

-- Create files table
CREATE TABLE IF NOT EXISTS public.files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    data_room_id UUID NOT NULL,
    folder_id UUID,
    user_id UUID NOT NULL,
    file_size BIGINT,
    mime_type TEXT,
    file_path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT files_data_room_id_fkey FOREIGN KEY (data_room_id) 
        REFERENCES public.data_rooms(id) ON DELETE CASCADE,
    CONSTRAINT files_folder_id_fkey FOREIGN KEY (folder_id) 
        REFERENCES public.folders(id) ON DELETE CASCADE,
    CONSTRAINT files_user_id_fkey FOREIGN KEY (user_id) 
        REFERENCES public.users(id) ON DELETE CASCADE
);

-- ============================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================

-- Indexes for data_rooms
CREATE INDEX IF NOT EXISTS data_rooms_user_id_idx ON public.data_rooms(user_id);
CREATE INDEX IF NOT EXISTS data_rooms_created_at_idx ON public.data_rooms(created_at);

-- Indexes for folders
CREATE INDEX IF NOT EXISTS folders_data_room_id_idx ON public.folders(data_room_id);
CREATE INDEX IF NOT EXISTS folders_parent_folder_id_idx ON public.folders(parent_folder_id);
CREATE INDEX IF NOT EXISTS folders_user_id_idx ON public.folders(user_id);
CREATE INDEX IF NOT EXISTS folders_data_room_id_parent_folder_id_idx ON public.folders(data_room_id, parent_folder_id);
CREATE INDEX IF NOT EXISTS folders_created_at_idx ON public.folders(created_at);

-- Indexes for files
CREATE INDEX IF NOT EXISTS files_folder_id_idx ON public.files(folder_id);
CREATE INDEX IF NOT EXISTS files_data_room_id_idx ON public.files(data_room_id);
CREATE INDEX IF NOT EXISTS files_user_id_idx ON public.files(user_id);
CREATE INDEX IF NOT EXISTS files_data_room_id_folder_id_idx ON public.files(data_room_id, folder_id);
CREATE INDEX IF NOT EXISTS files_created_at_idx ON public.files(created_at);

-- ============================================
-- CREATE TRIGGER FOR updated_at
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for each table
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_data_rooms_updated_at ON public.data_rooms;
CREATE TRIGGER update_data_rooms_updated_at
    BEFORE UPDATE ON public.data_rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_folders_updated_at ON public.folders;
CREATE TRIGGER update_folders_updated_at
    BEFORE UPDATE ON public.folders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_files_updated_at ON public.files;
CREATE TRIGGER update_files_updated_at
    BEFORE UPDATE ON public.files
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VERIFICATION
-- ============================================

-- Check if all tables exist
SELECT 
    schemaname,
    tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('users', 'data_rooms', 'folders', 'files')
ORDER BY tablename;

-- Check tables structure
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name IN ('users', 'data_rooms', 'folders', 'files')
ORDER BY table_name, ordinal_position;

