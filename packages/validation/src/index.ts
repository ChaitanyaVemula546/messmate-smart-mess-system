import { z } from "zod";
import { MEALS } from "@messmate/types";
export const meal = z.enum(MEALS);
export const newPassword = z
  .string()
  .min(12)
  .max(72)
  .refine(
    (value) => new TextEncoder().encode(value).byteLength <= 72,
    "Password must be at most 72 UTF-8 bytes.",
  );
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Invalid calendar date",
  );
export const login = z
  .object({
    email: z
      .string()
      .email()
      .max(200)
      .transform((v) => v.toLowerCase()),
    password: z.string().min(1).max(200),
  })
  .strict();
export const preference = z
  .object({ date, meal, response: z.enum(["COMING", "NOT_COMING"]) })
  .strict();
export const fingerprint = z
  .object({ fingerprintId: z.number().int().min(1).max(1000) })
  .strict();
export const fingerprintInventory = z
  .object({
    fingerprintIds: z
      .array(z.number().int().min(1).max(1000))
      .max(1000)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        "Fingerprint IDs must be unique.",
      ),
  })
  .strict();
export const mapping = fingerprint
  .extend({ studentId: z.string().uuid() })
  .strict();
export const waste = z
  .object({
    deviceId: z.string().min(1).max(60),
    weightKg: z.number().finite().min(0).max(1000),
    measurementId: z.string().uuid().optional(),
    tare: z.boolean().optional(),
  })
  .strict();
export const student = z
  .object({
    studentId: z.string().min(1).max(40),
    name: z.string().min(2).max(100),
    registrationNumber: z.string().min(1).max(60),
    hostel: z.string().min(1).max(60),
    roomNumber: z.string().min(1).max(30),
    email: z
      .string()
      .email()
      .max(200)
      .transform((v) => v.toLowerCase()),
    phone: z.string().max(30).nullable().optional(),
    password: newPassword.optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  })
  .strict();
export const device = z
  .object({
    deviceId: z.string().regex(/^[A-Za-z0-9_-]{2,60}$/),
    name: z.string().min(2).max(100),
    type: z.enum(["FINGERPRINT_SCANNER", "WASTE_MONITOR"]),
    capacityKg: z.number().positive().max(1000).default(20),
    firmwareVersion: z.string().max(40).nullable().optional(),
  })
  .strict();
export const deviceUpdate = z
  .object({
    status: z.enum(["ACTIVE", "DISABLED"]).optional(),
    rotate: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) => value.status !== undefined || value.rotate === true,
    "Use status or rotate.",
  );
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const windows = z
  .array(
    z
      .object({ meal, start_time: time, end_time: time, cutoff_time: time })
      .strict(),
  )
  .length(3)
  .superRefine((a, c) => {
    if (new Set(a.map((w) => w.meal)).size !== 3)
      c.addIssue({
        code: "custom",
        message: "Each meal must appear exactly once",
      });
    for (const w of a)
      if (w.start_time >= w.end_time || w.cutoff_time > w.start_time)
        c.addIssue({
          code: "custom",
          message: "Cutoff must be at or before start; start must precede end",
        });
    const sorted = [...a].sort((a, b) =>
      a.start_time.localeCompare(b.start_time),
    );
    if (sorted.some((w, i) => i > 0 && w.start_time < sorted[i - 1].end_time))
      c.addIssue({ code: "custom", message: "Meal windows cannot overlap" });
  });
export const assumptions = z
  .object({
    costPerKg: z.number().min(0).max(100000).nullable(),
    baselineWastePerStudent: z.number().min(0).max(10).nullable(),
    co2PerKg: z.number().min(0).max(10000).nullable(),
    waterLitresPerKg: z.number().min(0).max(1000000).nullable(),
    portionKg: z.number().positive().max(10).nullable(),
    onlineThresholdMinutes: z.number().int().min(1).max(1440),
  })
  .strict();
export const preparation = z
  .object({
    date,
    meal,
    weightKg: z.number().positive().max(100000),
    estimatedCost: z.number().nonnegative().max(10000000),
  })
  .strict();
// A single meal record; values are kilograms with up to three decimal places.
const wasteKg = z.number().finite().min(0).max(5000)
  .refine((n) => Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-6,
    "Use at most three decimal places (grams precision)");
export const manualWaste = z.object({
  date,
  meal,
  unservedKg: wasteKg,
  plateKg: wasteKg,
  measurementMethod: z.enum(["WEIGHED", "ESTIMATED"]),
  remarks: z.string().max(500).default(""),
}).strict();
export const manualWasteUpdate = manualWaste.pick({
  unservedKg: true, plateKg: true,
  measurementMethod: true, remarks: true,
}).partial().refine((v) => Object.keys(v).length > 0,
  "Supply at least one field to update");
export const manual = z
  .object({
    studentId: z.string().uuid(),
    date,
    meal,
    reason: z.string().min(5).max(500),
  })
  .strict();
export const predictionInput = z
  .object({
    date,
    holiday: z.boolean().default(false),
    specialEvent: z.string().max(200).default(""),
  })
  .strict();
export const adminUser = z
  .object({
    email: z.string().email().max(200),
    name: z.string().min(2).max(100),
    password: newPassword,
    role: z.enum(["MESS_ADMIN", "ADMIN"]),
  })
  .strict();
