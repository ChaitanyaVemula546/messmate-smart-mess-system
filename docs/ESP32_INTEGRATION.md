# Fingerprint station

**SOFTWARE VERIFIED:** simulated HTTP requests exercise authentication, student mapping, active meal resolution, duplicates and error responses. **REQUIRES PHYSICAL HARDWARE VERIFICATION:** actual sensor communication, wiring, power, Wi-Fi, enrollment and compiled firmware.

## Wiring and enrollment

| R307 function | ESP32 connection |
|---|---|
| Sensor TX | UART2 RX GPIO16 |
| Sensor RX | UART2 TX GPIO17 |
| GND | Common ground |
| VCC | Supply specified by the exact R307 module datasheet |

Do not infer connector pin numbers or voltage from wire colors. Verify the module's supply and UART logic levels with its vendor datasheet before connecting it. ESP32 GPIOs are 3.3V logic; use suitable level conversion if the sensor output exceeds that. Do not power a 5V-required sensor from an insufficient 3.3V rail. Secure the correct supply/common ground and consult your board's UART pin availability.

Install the Espressif ESP32 Arduino core and Adafruit Fingerprint Sensor Library. Use the library enrollment example to enroll a finger onto the sensor, then assign its numeric enrollment ID to a student in MessMate's Fingerprints page. Actual template capacity depends on your sensor; the server range 1–1000 does not promise that the module stores 1,000 templates.

Copy `firmware/fingerprint/config.example.h` to private `config.h` in the same sketch directory. Set Wi-Fi, your HTTPS API origin, the individually provisioned scanner token and the real CA root certificate. Never upload `config.h`. The sample uses certificate verification and waits for network time; it never uses insecure TLS. API_ORIGIN has no trailing `/api`.

## Contract

POST `/api/iot/attendance`, Content-Type application/json and Authorization Bearer with a scanner device token. Payload: `{ "fingerprintId": 1 }`. Server supplies date and meal, using Asia/Kolkata.

A successful response has `success: true`, `status: recorded` or `already_recorded`, student identity, meal and date, mirrored inside `data` for the common client format. Student/date/meal uniqueness is enforced in the database. Concurrent duplicate requests return exactly one newly recorded attendance.

| HTTP | Error / meaning |
|---|---|
| 400 | INVALID_FINGERPRINT_ID |
| 401 | UNAUTHORIZED_DEVICE |
| 403 | DEVICE_DISABLED or DEVICE_TYPE_MISMATCH |
| 404 | FINGERPRINT_NOT_REGISTERED, including inactive student mappings |
| 409 | NO_ACTIVE_MEAL |
| 429 | RATE_LIMITED |

The sketch retries a transient failure briefly and waits for finger removal. It does not promise offline attendance reconciliation: a request arriving after a meal boundary uses the new server window. For real deployment, provide visible success/failure feedback and avoid treating a local sensor match as successful server attendance.

## Primary references

- [Adafruit fingerprint library and enrollment examples](https://github.com/adafruit/Adafruit-Fingerprint-Sensor-Library)
- [Adafruit class API](https://adafruit.github.io/Adafruit-Fingerprint-Sensor-Library/html/class_adafruit___fingerprint.html)
- [Espressif secure client guidance](https://github.com/espressif/arduino-esp32/blob/master/libraries/NetworkClientSecure/README.md)

These library references do not replace the datasheet for your particular R307 hardware.
