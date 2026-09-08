import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  date,
  boolean,
  doublePrecision,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
const id = () => uuid("id").primaryKey().defaultRandom();
const created = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(),
  status: text("status").notNull().default("ACTIVE"),
  createdAt: created(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const students = pgTable("students", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id),
  studentId: text("student_id").notNull().unique(),
  registrationNumber: text("registration_number").notNull(),
  hostel: text("hostel").notNull(),
  roomNumber: text("room_number").notNull(),
  phone: text("phone"),
  status: text("status").notNull().default("ACTIVE"),
  createdAt: created(),
});
export const sessions = pgTable("sessions", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: created(),
});
export const mealWindows = pgTable("meal_windows", {
  meal: text("meal").primaryKey(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  cutoffTime: text("cutoff_time").notNull(),
});
export const mealPreferences = pgTable(
  "meal_preferences",
  {
    id: id(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id),
    date: date("date").notNull(),
    meal: text("meal").notNull(),
    response: text("response").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("preference_student_meal_date").on(t.studentId, t.date, t.meal),
    index("preferences_date_meal").on(t.date, t.meal),
  ],
);
export const fingerprintMappings = pgTable("fingerprint_mappings", {
  id: id(),
  studentId: uuid("student_id")
    .notNull()
    .unique()
    .references(() => students.id),
  fingerprintId: integer("fingerprint_id").notNull().unique(),
  createdAt: created(),
});
export const devices = pgTable("devices", {
  id: id(),
  deviceId: text("device_id").notNull().unique(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull().default("ACTIVE"),
  tokenHash: text("token_hash").notNull().unique(),
  lastSeen: timestamp("last_seen", { withTimezone: true }),
  lastResult: text("last_result"),
  firmwareVersion: text("firmware_version"),
  capacityKg: doublePrecision("capacity_kg").notNull().default(20),
  highWaterKg: doublePrecision("high_water_kg").notNull().default(0),
  tareSession: integer("tare_session").notNull().default(0),
  createdAt: created(),
});
export const attendance = pgTable(
  "attendance",
  {
    id: id(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id),
    date: date("date").notNull(),
    meal: text("meal").notNull(),
    checkInTime: timestamp("check_in_time", {
      withTimezone: true,
    }).defaultNow(),
    fingerprintId: integer("fingerprint_id"),
    source: text("source").notNull(),
    deviceId: uuid("device_id").references(() => devices.id),
    reason: text("reason"),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("attendance_student_meal_date").on(t.studentId, t.date, t.meal),
    index("attendance_date_meal").on(t.date, t.meal),
  ],
);
export const wasteMeasurements = pgTable(
  "waste_measurements",
  {
    id: id(),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id),
    measurementId: uuid("measurement_id").notNull(),
    weightKg: doublePrecision("weight_kg").notNull(),
    deltaKg: doublePrecision("delta_kg").notNull(),
    tare: boolean("tare").notNull().default(false),
    tareSession: integer("tare_session").notNull(),
    date: date("date").notNull(),
    meal: text("meal"),
    measuredAt: timestamp("measured_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("measurement_device_event").on(t.deviceId, t.measurementId),
    index("waste_date_meal").on(t.date, t.meal),
  ],
);
export const foodPreparations = pgTable(
  "food_preparations",
  {
    id: id(),
    date: date("date").notNull(),
    meal: text("meal").notNull(),
    weightKg: doublePrecision("weight_kg").notNull(),
    estimatedCost: doublePrecision("estimated_cost").notNull(),
  },
  (t) => [uniqueIndex("preparation_date_meal").on(t.date, t.meal)],
);
export const systemSettings = pgTable("system_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});
export const predictions = pgTable(
  "predictions",
  {
    id: id(),
    date: date("date").notNull(),
    meal: text("meal").notNull(),
    attendance: integer("attendance").notNull(),
    wasteKg: doublePrecision("waste_kg"),
    foodKg: doublePrecision("food_kg"),
    source: text("source").notNull(),
    sampleCount: integer("sample_count").notNull(),
    inputs: jsonb("inputs").notNull(),
    createdAt: created(),
  },
  (t) => [uniqueIndex("prediction_date_meal").on(t.date, t.meal)],
);
export const predictionResults = pgTable("prediction_results", {
  predictionId: uuid("prediction_id")
    .primaryKey()
    .references(() => predictions.id),
  actualAttendance: integer("actual_attendance").notNull(),
  actualWaste: doublePrecision("actual_waste"),
  evaluatedAt: timestamp("evaluated_at", { withTimezone: true }).notNull(),
});
export const auditLogs = pgTable("audit_logs", {
  id: id(),
  actorId: uuid("actor_id").references(() => users.id),
  actorRole: text("actor_role"),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: created(),
});
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
