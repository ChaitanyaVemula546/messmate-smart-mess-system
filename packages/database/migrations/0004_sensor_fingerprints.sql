CREATE TABLE sensor_fingerprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  fingerprint_id integer NOT NULL CHECK (fingerprint_id BETWEEN 1 AND 1000),
  present boolean NOT NULL DEFAULT true,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sensor_fingerprint_device_slot UNIQUE (device_id, fingerprint_id)
);
