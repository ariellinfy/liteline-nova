import { Pool } from "pg";
import fs from "fs";
import bcrypt from "bcryptjs";
import {
  User,
  Room,
  Message,
  RoomMembership,
  MessageResponse,
} from "../utils/types";
import { logger } from "../utils/logger";

const log = logger.child({ mod: "db" });

const connectionString =
  process.env.POSTGRES_URL ||
  `postgresql://${process.env.DB_USER || "postgres"}:${
    process.env.DB_PASSWORD || "password"
  }@${process.env.DB_HOST || "localhost"}:${process.env.DB_PORT || "5432"}/${
    process.env.DB_NAME || "chat_db"
  }`;

// Decide SSL based on host, not NODE_ENV
const isLocal =
  /@(?:localhost|127\.0\.0\.1|\[?::1\]?)[:/]/.test(connectionString) ||
  ["localhost", "127.0.0.1", "::1"].includes(
    (process.env.DB_HOST || "").trim()
  );

export class DatabaseService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString,
      ssl: {
        // rejectUnauthorized: false,
        ca: fs.readFileSync("/etc/secrets/prod-ca-2021.crt").toString(),
      },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on("error", (err) => {
      log.error(err, "Database pool error");
    });
  }

  // Auth operations
  async createUser(
    username: string,
    email: string,
    password: string
  ): Promise<User> {
    log.debug({ username, email }, "createUser");
    const passwordHash = await bcrypt.hash(password, 12);

    const query = `
      INSERT INTO users (username, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, username, email, created_at
    `;

    const result = await this.pool.query(query, [
      username,
      email,
      passwordHash,
    ]);
    const row = result.rows[0];

    return {
      id: row.id,
      username: row.username,
      email: row.email,
      createdAt: row.created_at.toISOString(),
    };
  }

  async authenticateUser(
    email: string,
    password: string
  ): Promise<User | null> {
    log.debug("authenticateUser");
    const query = `
      SELECT id, username, email, password_hash, created_at
      FROM users 
      WHERE email = $1
    `;

    const result = await this.pool.query(query, [email]);

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.created_at.toISOString(),
    };
  }

  async getUserById(userId: string): Promise<User | null> {
    log.debug("getUserById");
    const query = `
      SELECT id, username, email, created_at
      FROM users 
      WHERE id = $1
    `;

    const result = await this.pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      createdAt: row.created_at.toISOString(),
    };
  }

  // Room operations
  async createRoom(
    name: string,
    description: string | undefined,
    isPrivate: boolean,
    passcode: string | undefined,
    createdBy: string
  ): Promise<Room> {
    log.debug("createRoom");
    const passcodeHash = passcode ? await bcrypt.hash(passcode, 12) : null;

    const query = `
      INSERT INTO rooms (name, description, is_private, passcode_hash, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, description, is_private, created_by, created_at
    `;

    const result = await this.pool.query(query, [
      name,
      description,
      isPrivate,
      passcodeHash,
      createdBy,
    ]);
    const row = result.rows[0];

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      isPrivate: row.is_private,
      createdBy: row.created_by,
      createdAt: row.created_at.toISOString(),
    };
  }

  async validateRoomPasscode(
    roomId: string,
    passcode: string
  ): Promise<boolean> {
    log.debug("validateRoomPasscode");
    const query = `
      SELECT passcode_hash FROM rooms 
      WHERE id = $1 AND is_private = true
    `;

    const result = await this.pool.query(query, [roomId]);

    if (result.rows.length === 0 || !result.rows[0].passcode_hash) {
      return false;
    }

    return await bcrypt.compare(passcode, result.rows[0].passcode_hash);
  }

  async getRoomById(roomId: string): Promise<Room | null> {
    log.debug("getRoomById");

    const query = `
      SELECT r.id, r.name, r.description, r.is_private, r.created_by, r.created_at,
             COUNT(rm.user_id) as member_count
      FROM rooms r
      LEFT JOIN room_memberships rm ON r.id = rm.room_id AND rm.is_active = true
      WHERE r.id = $1
      GROUP BY r.id, r.name, r.description, r.is_private, r.created_by, r.created_at
    `;

    const result = await this.pool.query(query, [roomId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      isPrivate: row.is_private,
      createdBy: row.created_by,
      createdAt: row.created_at.toISOString(),
      memberCount: parseInt(row.member_count),
    };
  }

  async getRoomByName(roomName: string): Promise<Room | null> {
    log.debug("getRoomByName");

    const query = `
      SELECT r.id, r.name, r.description, r.is_private, r.created_by, r.created_at,
             COUNT(rm.user_id) as member_count
      FROM rooms r
      LEFT JOIN room_memberships rm ON r.id = rm.room_id AND rm.is_active = true
      WHERE r.name = $1
      GROUP BY r.id, r.name, r.description, r.is_private, r.created_by, r.created_at
    `;

    const result = await this.pool.query(query, [roomName]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      isPrivate: row.is_private,
      createdBy: row.created_by,
      createdAt: row.created_at.toISOString(),
      memberCount: parseInt(row.member_count),
    };
  }

  // Room membership operations
  async addUserToRoom(userId: string, roomId: string): Promise<RoomMembership> {
    log.debug("addUserToRoom");
    const insertSql = `
      INSERT INTO room_memberships (user_id, room_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, room_id) 
      DO UPDATE SET is_active = true, joined_at = NOW()
      WHERE NOT room_memberships.is_active
      RETURNING user_id, room_id, joined_at, is_active
    `;

    const result = await this.pool.query(insertSql, [userId, roomId]);

    if (result.rows.length > 0) {
      const row = result.rows[0];
      return {
        userId: row.user_id,
        roomId: row.room_id,
        joinedAt: row.joined_at.toISOString(),
        isActive: row.is_active,
      };
    }

    const selectSql = `
    SELECT user_id, room_id, joined_at, is_active
    FROM room_memberships
    WHERE user_id = $1 AND room_id = $2
    LIMIT 1
  `;
    const existing = await this.pool.query(selectSql, [userId, roomId]);
    const row = existing.rows[0];

    return {
      userId: row.user_id,
      roomId: row.room_id,
      joinedAt: row.joined_at.toISOString(),
      isActive: row.is_active,
    };
  }

  async removeUserFromRoom(userId: string, roomId: string): Promise<void> {
    log.debug("removeUserFromRoom");
    const query = `
      UPDATE room_memberships 
      SET is_active = false
      WHERE user_id = $1 AND room_id = $2
    `;

    await this.pool.query(query, [userId, roomId]);
  }

  async getRoomMembers(roomId: string): Promise<User[]> {
    log.debug("getRoomMembers");
    const query = `
      SELECT u.id, u.username, u.email, u.created_at
      FROM users u
      INNER JOIN room_memberships rm ON u.id = rm.user_id
      WHERE rm.room_id = $1 AND rm.is_active = true
      ORDER BY rm.joined_at ASC
    `;

    const result = await this.pool.query(query, [roomId]);

    return result.rows.map((row) => ({
      id: row.id,
      username: row.username,
      email: row.email,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async isUserInRoom(userId: string, roomId: string): Promise<boolean> {
    log.debug("isUserInRoom");
    const query = `
      SELECT 1 FROM room_memberships 
      WHERE user_id = $1 AND room_id = $2 AND is_active = true
    `;

    const result = await this.pool.query(query, [userId, roomId]);
    return result.rows.length > 0;
  }

  // currently limited to 50 for simplicity
  async getPublicRooms(userId?: string, limit: number = 50): Promise<Room[]> {
    log.debug("getPublicRooms");

    let query: string;
    let params: any[];

    if (userId) {
      // Exclude rooms the user is already a member of
      query = `
      SELECT r.id, r.name, r.description, r.is_private, r.created_by, r.created_at,
             COUNT(rm.user_id) as member_count
      FROM rooms r
      LEFT JOIN room_memberships rm ON r.id = rm.room_id AND rm.is_active = true
      LEFT JOIN room_memberships user_rm ON r.id = user_rm.room_id 
                                          AND user_rm.user_id = $1 
                                          AND user_rm.is_active = true
      WHERE r.is_private = false
        AND user_rm.user_id IS NULL
      GROUP BY r.id, r.name, r.description, r.is_private, r.created_by, r.created_at
      ORDER BY r.created_at DESC
      LIMIT $2
    `;
      params = [userId, limit];
    } else {
      // get all public rooms
      query = `
      SELECT r.id, r.name, r.description, r.is_private, r.created_by, r.created_at,
             COUNT(rm.user_id) as member_count
      FROM rooms r
      LEFT JOIN room_memberships rm ON r.id = rm.room_id AND rm.is_active = true
      WHERE r.is_private = false
      GROUP BY r.id, r.name, r.description, r.is_private, r.created_by, r.created_at
      ORDER BY r.created_at DESC
      LIMIT $1
    `;
      params = [limit];
    }

    const result = await this.pool.query(query, params);

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      isPrivate: row.is_private,
      createdBy: row.created_by,
      createdAt: row.created_at.toISOString(),
      memberCount: parseInt(row.member_count),
    }));
  }

  async getUserRooms(userId: string): Promise<Room[]> {
    log.debug("getUserRooms");
    const query = `
      SELECT r.id, r.name, r.description, r.is_private, r.created_by, r.created_at,
             COUNT(rm2.user_id) as member_count, MAX(rm.joined_at) AS joined_at
      FROM rooms r
      INNER JOIN room_memberships rm ON r.id = rm.room_id
      LEFT JOIN room_memberships rm2 ON r.id = rm2.room_id AND rm2.is_active = true
      WHERE rm.user_id = $1 AND rm.is_active = true
      GROUP BY r.id, r.name, r.description, r.is_private, r.created_by, r.created_at
      ORDER BY joined_at DESC
    `;

    const result = await this.pool.query(query, [userId]);

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      isPrivate: row.is_private,
      createdBy: row.created_by,
      createdAt: row.created_at.toISOString(),
      memberCount: parseInt(row.member_count),
    }));
  }

  async getUserRoomIds(userId: string): Promise<string[]> {
    log.debug("getUserRoomIds");
    const query = `
      SELECT r.id
      FROM rooms r
      INNER JOIN room_memberships rm ON r.id = rm.room_id
      WHERE rm.user_id = $1 AND rm.is_active = true
    `;

    const result = await this.pool.query(query, [userId]);
    return result.rows.map((row) => row.id);
  }

  // Message operations
  async storeMessage(
    roomId: string,
    userId: string,
    content: string,
    messageType: "text" | "system" = "text"
  ): Promise<Message> {
    log.debug("storeMessage");
    const query = `
      INSERT INTO messages (room_id, user_id, content, message_type)
      VALUES ($1, $2, $3, $4)
      RETURNING id, room_id, user_id, content, message_type, created_at
    `;

    const result = await this.pool.query(query, [
      roomId,
      userId,
      content,
      messageType,
    ]);
    const row = result.rows[0];

    // Get username
    const user = await this.getUserById(userId);

    return {
      id: row.id,
      roomId: row.room_id,
      userId: row.user_id,
      username: user?.username || "Unknown",
      content: row.content,
      type: row.message_type,
      timestamp: row.created_at.toISOString(),
    };
  }

  // Get messages from PostgreSQL with pagination
  async getMessagesFromDB(
    roomId: string,
    limit: number = 50,
    beforeMessageId?: string
  ): Promise<MessageResponse> {
    log.debug("getMessagesFromDB");
    let query: string;
    let params: any[];

    if (beforeMessageId) {
      // Get the timestamp of the beforeMessageId for pagination
      const beforeQuery = `
        SELECT created_at FROM messages WHERE id = $1
      `;
      const beforeResult = await this.pool.query(beforeQuery, [
        beforeMessageId,
      ]);

      if (beforeResult.rows.length === 0) {
        return { messages: [], hasMore: false };
      }

      const beforeTimestamp = beforeResult.rows[0].created_at;

      query = `
        SELECT m.id, m.room_id, m.user_id, u.username, m.content, m.message_type, m.created_at
        FROM messages m
        LEFT JOIN users u ON m.user_id = u.id
        WHERE m.room_id = $1 AND m.created_at < $2
        ORDER BY m.created_at DESC
        LIMIT $3
      `;
      params = [roomId, beforeTimestamp, limit + 1];
    } else {
      query = `
        SELECT m.id, m.room_id, m.user_id, u.username, m.content, m.message_type, m.created_at
        FROM messages m
        LEFT JOIN users u ON m.user_id = u.id
        WHERE m.room_id = $1
        ORDER BY m.created_at DESC
        LIMIT $2
      `;
      params = [roomId, limit + 1];
    }

    const result = await this.pool.query(query, params);
    const rows = result.rows;

    const hasMore = rows.length > limit;
    const messages = rows.slice(0, limit);

    const formattedMessages = messages.map((row) => ({
      id: row.id,
      roomId: row.room_id,
      userId: row.user_id,
      username: row.username,
      content: row.content,
      type: row.message_type,
      timestamp: row.created_at.toISOString(),
    }));

    // Return in chronological order (oldest first)
    formattedMessages.reverse();

    return {
      messages: formattedMessages,
      hasMore,
      nextCursor: hasMore ? messages[messages.length - 1].id : undefined,
    };
  }

  // Get most recent messages (used when Redis is empty)
  async getRecentMessagesFromDB(
    roomId: string,
    limit: number = 50
  ): Promise<Message[]> {
    log.debug("getRecentMessagesFromDB");
    const query = `
      SELECT m.id, m.room_id, m.user_id, u.username, m.content, m.message_type, m.created_at
      FROM messages m
      LEFT JOIN users u ON m.user_id = u.id
      WHERE m.room_id = $1
      ORDER BY m.created_at DESC
      LIMIT $2
    `;

    const result = await this.pool.query(query, [roomId, limit]);

    return result.rows
      .map((row) => ({
        id: row.id,
        roomId: row.room_id,
        userId: row.user_id,
        username: row.username,
        content: row.content,
        type: row.message_type,
        timestamp: row.created_at.toISOString(),
      }))
      .reverse(); // Return in chronological order
  }

  async disconnect(): Promise<void> {
    log.debug("disconnect");
    await this.pool.end();
  }
}
