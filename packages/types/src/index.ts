export const MEALS = ["BREAKFAST", "LUNCH", "DINNER"] as const;
export type Meal = (typeof MEALS)[number];
export type Role = "STUDENT" | "MESS_ADMIN" | "ADMIN";
export type Intention = "COMING" | "NOT_COMING";
export interface User {
  id: string;
  email: string;
  role: Role;
  name: string;
  student_id: string | null;
}
export interface MealWindow {
  meal: Meal;
  start_time: string;
  end_time: string;
  cutoff_time: string;
}
export interface HistoryRow {
  date: string;
  meal: Meal;
  response: Intention | null;
  present: boolean;
  check_in_time: string | null;
  source: string | null;
}
export interface Student {
  id: string;
  user_id: string;
  student_id: string;
  name: string;
  registration_number: string;
  hostel: string;
  room_number: string;
  phone: string | null;
  status: string;
  email: string;
  fingerprint_id: number | null;
}
export interface Device {
  id: string;
  device_id: string;
  name: string;
  type: "FINGERPRINT_SCANNER" | "WASTE_MONITOR";
  status: "ACTIVE" | "DISABLED";
  last_seen: string | null;
  firmware_version: string | null;
  last_result: string | null;
  online: boolean;
  capacity_kg: number;
}
export interface MetricRow {
  date: string;
  meal: Meal;
  expected: number;
  actual: number;
  waste_kg: number;
  has_waste: boolean;
  prepared_kg: number | null;
  cost: number | null;
  predicted_attendance: number | null;
  predicted_waste: number | null;
}
export interface Totals {
  expected: number;
  actual: number;
  wasteKg: number;
  accuracy: number | null;
  wastePerStudent: number | null;
  wastePercentage: number | null;
  preparedKg: number;
  avoidedKg: number | null;
  savedMoney: number | null;
  wasteCost: number | null;
  co2Avoided: number | null;
  waterSaved: number | null;
}
export interface Settings {
  costPerKg: number | null;
  baselineWastePerStudent: number | null;
  co2PerKg: number | null;
  waterLitresPerKg: number | null;
  portionKg: number | null;
  onlineThresholdMinutes: number;
}
export interface Dashboard {
  date: string;
  time: string;
  currentMeal: MealWindow | null;
  windows: MealWindow[];
  rows: MetricRow[];
  totals: Totals;
  devices: Device[];
  settings: Settings;
  today: MetricRow[];
}
export interface StudentMeals {
  date: string;
  time: string;
  windows: MealWindow[];
  meals: {
    meal: Meal;
    response: Intention | null;
    present: boolean;
    closed: boolean;
  }[];
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface Prediction {
  id: string;
  date: string;
  meal: Meal;
  attendance: number;
  waste_kg: number | null;
  food_kg: number | null;
  source: string;
  sample_count: number;
  actual_attendance: number | null;
  actual_waste: number | null;
  absolute_error: number | null;
  accuracy: number | null;
}
export interface Audit {
  id: string;
  actor_email: string | null;
  actor_role: Role | null;
  action: string;
  entity: string;
  entity_id: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
}
export interface ApiErrorShape {
  success: false;
  error: { code: string; message: string; details?: unknown };
}
export type ApiResult<T> = { success: true; data: T } | ApiErrorShape;
