# ESP32 + R307 fingerprint setup

**Status — 11 September 2026:** the fingerprint update is deployed at the existing public URL. The 48-test suite, lint, TypeScript, Next.js build and 17 live fingerprint workflow checks passed; the fourth cloud migration is applied. Fingerprint-only firmware uploaded and booted successfully on COM4 using DIO/40 MHz, with its written hash verified and the previous ESP32 flash backed up. Wi-Fi and time synchronized, and the R307 reported 12 saved IDs. An outdated scanner token was refreshed privately and re-flashed. The sensor then stopped responding after restart; its physical connection and final cloud sync are being checked. This guide covers the fingerprint work currently in scope.

## 1. Use the prepared fingerprint sketch

The ready Arduino sketch is saved at **`C:\Arduino\epics project\messmate_fingerprint\messmate_fingerprint.ino`**. Open that file in the configured Arduino toolchain. Its source also lives at [`firmware/messmate_fingerprint/messmate_fingerprint.ino`](../firmware/messmate_fingerprint/messmate_fingerprint.ino) in the repository. Keep `trusted-roots.h` and private `config.h` beside the sketch. It uses the ESP32 board package and Adafruit Fingerprint Sensor Library.

For this connected board, select **ESP32 Dev Module**, port **COM4**, **DIO** flash mode, **40 MHz** flash frequency, **4 MB** flash size, and **115200** upload speed. These settings booted successfully after the initial default build encountered a boot loop. Serial Monitor also uses **115200**. The equivalent Arduino CLI board setting is `esp32:esp32:esp32:FlashMode=dio,FlashFreq=40,UploadSpeed=115200`.

The real scanner **`ESP32_R307_01`** is already provisioned in MessMate. Its private `config.h` is populated locally; reuse that device and configuration. Do not create another scanner or overwrite the file with example placeholders. For a new installation only, copy `config.example.h` to `config.h` and privately configure `WIFI_SSID`, `WIFI_PASSWORD`, `API_ORIGIN` and `SCANNER_TOKEN`. The scanner token is separate from administrator/student passwords. Never upload `config.h` to GitHub or share it.

Use one ESP32 with these R307 connections:

| R307 connection | ESP32 connection |
| --- | --- |
| TX | GPIO **16** (ESP32 receive) |
| RX | GPIO **17** (ESP32 transmit) |
| GND | Common GND |
| Power | The supply rated for your R307 module; UART signals must be compatible with ESP32 3.3 V logic |

The sensor UART runs at **57600 baud**. After the correct sketch is uploaded to the connected ESP32, open Serial Monitor at **115200 baud**, with **Newline** selected. Send `status`; wait for Wi-Fi connected, time ready and R307 ready. HTTPS uses the included trusted roots; keep certificate verification enabled.

Clock synchronization begins after Wi-Fi connects and retries each minute until time is available. If it remains waiting, check that the Wi-Fi network has internet access and allows NTP. See [Espressif's boot/upload troubleshooting](https://docs.espressif.com/projects/esptool/en/latest/esp32/troubleshooting.html) if the board cannot start.

## 2. Enroll and see the sensor ID

| Serial command | What it does |
| --- | --- |
| `e 1` | Enroll an unused ID, here `1`; follow the place/remove/place-same-finger prompts |
| `sync` | Read and upload the complete sensor ID inventory again |
| `status` | Show Wi-Fi, clock, sensor and inventory state |
| `?` | Show help |

Use the supported ID range printed by your sensor, starting at **1**. Existing occupied IDs are refused, and an already-enrolled finger reports its existing ID. This sketch has no delete or overwrite command. Enrollment does not record a meal arrival.

After enrollment, look for **`Fingerprint inventory HTTP 200`**. Open [Admin → Fingerprints](https://messmate-smart-mess-system.vercel.app/admin/fingerprints). The page refreshes every 10 seconds and shows ID, scanner, student assignment and last-seen time. The device also refreshes its inventory periodically; `sync` requests it immediately.

“On sensor” describes the latest successful inventory. “Missing from sensor” means a later complete inventory omitted that ID; its history and student mapping are retained. An incomplete sensor read preserves the website's previous inventory. Fingerprint images and templates stay inside the R307; the website receives numeric IDs only.

## 3. Assign the ID to a student

1. In **Admin → Students**, create the real student account, or use an existing active student.
2. In **Fingerprints**, find the sensor ID and select **Assign**. The existing assignment form opens with that ID filled in.
3. Choose the student and save. The inventory and student-assignment tables refresh together. Manual ID entry remains available.
4. To move an ID to a different student, remove its current student mapping first. Removing a mapping does not erase the sensor template.

The student continues to sign in using their **email and password**. Their profile shows the assigned fingerprint ID. Fingerprint enrollment is for meal attendance, not website login.

## 4. Record attendance

During a configured meal window in **Asia/Kolkata**, place the enrolled finger on the sensor. Wait for attendance HTTP **200**, then remove the finger. A repeat scan for the same student/date/meal reports “already recorded” without creating another arrival.

Check **Admin → Attendance** for the current date and meal. Attendance and student history/profile refresh every 10 seconds; the existing student meal view refreshes every 20 seconds. The student should see the same arrival in their own history.

| Result | Next step |
| --- | --- |
| ID appears, but attendance HTTP 404 | Assign it to an active student |
| Attendance HTTP 409 | Scan during a configured active meal window |
| HTTP 401/403 | Check the existing scanner's enabled status and private token |
| No inventory rows | Check `status`, send `sync`, and confirm inventory HTTP 200 |
| R307 unavailable | Check sensor power, common ground and the crossed TX/RX connections; detection retries |
| Wi-Fi/time waiting or request not confirmed | Restore connectivity, remove the finger and scan again |

Offline scans are not queued for a later meal. A physical scan is complete only after the server confirms it and the correct student's attendance appears. See [verification status](DEPLOYMENT_VERIFICATION.md#fingerprint-inventory-update--11-september-2026) for completed and pending checks.
