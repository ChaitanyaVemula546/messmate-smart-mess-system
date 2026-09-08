# Waste station: four load sensors, HX711 and ESP32

**SOFTWARE VERIFIED:** device identity/type, negative/capacity/malformed input, persistence, retry deduplication, explicit tare and aggregate increments. **REQUIRES PHYSICAL HARDWARE VERIFICATION:** bridge wiring, mechanical assembly, calibration, noise, power and native firmware compilation.

Four sensors rated 5kg each do not automatically make a safe 20kg platform. Capacity depends on load distribution, mounting, overload protection and the exact sensor specification. Configure the API device capacity to the verified safe assembled capacity.

## Determine your sensor type first

Three-wire bathroom-scale sensors are usually half-bridge elements. Four of them require an appropriate combining arrangement into a complete Wheatstone bridge, commonly using a purpose-built combiner. Four-wire full-bridge load cells are different: do not apply the half-bridge wiring diagram. Use a load-cell junction/summing board or appropriate separate ADC channels and calibration for that assembly. No wiring is inferred from color alone.

A compatible combined bridge connects to HX711 excitation/signal terminals according to the board's markings and datasheet. HX711 communicates with ESP32 via digital data/clock; the sample uses GPIO32/GPIO33. Confirm ESP32-compatible logic voltage and common ground. The browser never connects to a load cell directly.

## Calibration

1. Mount the complete platform rigidly with free sensor deflection and no bypass load path.
2. Verify wiring and HX711 readiness with its library examples.
3. With an empty bin, record the offset using tare.
4. Place a known mass. Set scale factor to one and obtain offset-subtracted counts; divide those counts by the known mass in **kilograms**. Use the resulting signed counts/kg as CALIBRATION_FACTOR.
5. Verify zero, several known masses and off-centre placement throughout the usable capacity. Adjust mounting and repeat if readings depend excessively on position.
6. Assess settling time, electrical noise, drift and tare repeatability. The sample averages readings and compares two windows; its thresholds need physical validation.

The supplied firmware refuses operation with the placeholder zero calibration factor. It persists its tare offset across restarts and requires explicit empty-bin tare; it never silently zeroes a loaded bin at reboot.

## Cumulative measurement contract

POST `/api/iot/waste` with a WASTE_MONITOR bearer credential. Required fields are deviceId and weightKg. Optional measurementId is a UUID, and optional tare is boolean.

```json
{"deviceId":"WASTE_BIN_01","weightKg":3.42,"measurementId":"00000000-0000-4000-8000-000000000001"}
```

This UUID illustrates format only: each new physical reading must use a fresh ID, and retries must reuse the same ID. A repeated ID with a different payload returns 409 IDEMPOTENCY_CONFLICT. Device identifier must match the authenticated token. Server timestamps and meal attribution are authoritative.

The server locks the device row and compares the reading to that tare session's high-water weight. Positive increments add waste; identical or lower snapshots add zero. Raw readings are retained. Send an empty-bin reading with `tare: true` after physically emptying and re-zeroing the bin. It resets the baseline and increments the session without adding waste. Do not use tare to erase loaded waste.

For example, 3.42, 3.42, 3.00 and 3.42kg produce 3.42kg total, not 13.26kg. A subsequent explicit zero tare followed by 1.00kg adds another 1.00kg. Removal without a tare does not reset the baseline; the platform must follow the empty/tare procedure. Upward noise can still overstate a high-water reading, which is why physical filtering and calibration are essential.

Readings outside meal windows have a null meal and appear as unassigned waste. Meal dashboards and savings use meal-attributed increments; the waste page separately shows unassigned amounts. Reporting after a connectivity outage uses the server receipt time; the sample's persistent single-event retry queue does not reconstruct a historical meal timeline.

The sample firmware preserves one pending event in ESP32 NVS across reboot and blocks new readings/tare until it is delivered. More elaborate bounded offline queues and operator calibration workflows are future hardware hardening, not claimed verified features.

## Primary references

- [bogde HX711 library](https://github.com/bogde/HX711)
- [HX711 full library example](https://github.com/bogde/HX711/blob/master/examples/HX711_full_example/HX711_full_example.ino)
- [Espressif secure client guidance](https://github.com/espressif/arduino-esp32/blob/master/libraries/NetworkClientSecure/README.md)
