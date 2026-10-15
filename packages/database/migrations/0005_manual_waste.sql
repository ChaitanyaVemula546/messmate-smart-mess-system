-- Manual food-waste observations. Historical IoT events remain untouched.
CREATE TABLE manual_waste_records(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  meal text NOT NULL REFERENCES meal_windows(meal),
  unserved_kg numeric(12,3) NOT NULL CHECK(unserved_kg >= 0 AND unserved_kg <= 5000),
  plate_kg numeric(12,3) NOT NULL CHECK(plate_kg >= 0 AND plate_kg <= 5000),
  measurement_method text NOT NULL CHECK(measurement_method IN ('WEIGHED','ESTIMATED')),
  remarks text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES users(id),
  updated_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(date,meal)
);
CREATE INDEX manual_waste_date_meal ON manual_waste_records(date,meal);
CREATE TABLE manual_waste_revisions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL REFERENCES manual_waste_records(id),
  changed_by uuid NOT NULL REFERENCES users(id),
  before_data jsonb,
  after_data jsonb NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX manual_waste_revisions_record ON manual_waste_revisions(record_id,changed_at);
