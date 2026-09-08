-- Missing sensor observations must remain unknown during prediction evaluation.
ALTER TABLE prediction_results ALTER COLUMN actual_waste DROP NOT NULL;
