-- Reset schema (delete all tables, views, sequences, etc.)
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- Make sure search path is correct
SET search_path TO public;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,                 -- e.g. ROOM123
  description TEXT,
  is_private BOOLEAN NOT NULL DEFAULT false,
  passcode_hash TEXT,                         -- bcrypt, nullable
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Room memberships table
CREATE TABLE IF NOT EXISTS room_memberships (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- left_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT room_memberships_pkey PRIMARY KEY (user_id, room_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,         -- NULL for system
  content TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('text','system')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for better performance
-- 1) USERS
-- Authenticate & lookups by email/username
CREATE INDEX IF NOT EXISTS idx_users_email     ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username  ON users(username);

-- 2) ROOMS
-- getPublicRooms: WHERE is_private = false ORDER BY created_at DESC LIMIT
CREATE INDEX IF NOT EXISTS idx_rooms_public_created
  ON rooms (is_private, created_at DESC);

-- if frequently filter by creator
CREATE INDEX IF NOT EXISTS idx_rooms_created_by
  ON rooms (created_by);

-- 3) ROOM_MEMBERSHIPS
-- Fast list of active members per room (and ORDER BY joined_at in getRoomMembers)
CREATE INDEX IF NOT EXISTS idx_rm_room_active_joined
  ON room_memberships (room_id, joined_at)
  WHERE is_active = TRUE;

-- Fast “is user in room?” checks (user_id + room_id + is_active)
CREATE INDEX IF NOT EXISTS idx_rm_user_room_active
  ON room_memberships (user_id, room_id)
  WHERE is_active = TRUE;

-- getUserRooms: WHERE rm.user_id = $1 AND rm.is_active = true ORDER BY joined_at DESC
CREATE INDEX IF NOT EXISTS idx_rm_user_active_joined_desc
  ON room_memberships (user_id, joined_at DESC)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_room_memberships_user_id ON room_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_room_memberships_room_id ON room_memberships(room_id);

-- 4) MESSAGES
-- Message pagination & latest-first queries within a room, including cursor by created_at
CREATE INDEX IF NOT EXISTS idx_messages_room_created_desc
  ON messages (room_id, created_at DESC);

