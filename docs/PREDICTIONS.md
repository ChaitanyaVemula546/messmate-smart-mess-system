# Prediction architecture and limitations

`apps/api/src/predictions.ts` defines `PredictionService` with predictAttendance, predictWaste and predictFoodRequirement methods. `generate` accepts an injected provider; the default is `DemoPredictionProvider`. Providers return attendance, nullable waste/food estimates, sample count and source. Forecasts and inputs are stored in PostgreSQL; the current UI labels every generated baseline **DEMO PREDICTION**.

The demo attendance forecast is the rounded mean of the latest at most 28 observed dates for that meal in the previous 90 days. At least three distinct observed meal dates are required. Dates with no recorded arrivals are excluded, so this baseline has selection bias and is unsuitable as a validated demand model. Waste averages only observed non-tare meal waste; missing sensor data remains unknown. Recommended food is predicted attendance multiplied by an explicitly configured portion size. Holiday and special-event inputs are stored for future training and do not currently change the baseline. Confidence is not calculated.

Forecasts are generated only for the next 1–7 days and uniquely stored per meal/date. Historical evaluation runs on days before today, comparing recorded attendance and waste. Actual waste remains null without sensor observations. Absolute attendance error and a bounded percentage agreement are displayed; percentage is null for zero attendance. A recorded attendance count is not proof that all physical arrivals were captured.

## Real ML work still required

Collect representative, consented campus data with reliable measurement coverage; include known closures/zero-service days, holidays, special events, meal menus, expected attendance, portions and sensor calibration. Label data provenance and missingness. Use chronological train/validation/test splits and compare against this baseline. Evaluate MAE/WAPE and waste/food error, calibrate uncertainty, check drift and avoid leakage from actual outcomes. Document operating thresholds with the mess manager before using predictions to change preparation volumes.

Implement a trained provider behind the same interface and add a model/version identifier and input schema. Update the UI source label to distinguish validated models from demo baselines. Store sufficient model/input provenance before enabling retraining or automated operational decisions. No external AI API, model-training service, or subscription is required by the present implementation.
