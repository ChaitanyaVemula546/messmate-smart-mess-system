# MessMate Android app

[Download MessMate 1.0.0 for Android](https://messmate-smart-mess-system.vercel.app/downloads/messmate-1.0.0.apk)
— 17,950,404 bytes (17.12 MiB), Android 7.0 or newer, ARM64 and ARMv7.

The signed release build completed on 12 September 2026. APK Signature Scheme v2
verification passed, the manifest is not debuggable, and the embedded bundle
contains the production API URL and fingerprint profile/history screens. The
release sourcemap contains one React implementation after Expo's module-resolution
deduplication. Configured production/signing credentials were absent from the app
bundle. Installation on a physical Android phone has not been tested here.

APK SHA-256:
`5fe1ba552ff1cd52ac27b55a0e16d5869323640c94bcfdaf6ad601554bcb1aae`.

The student app uses the same production API and accounts as the website:
`https://messmate-smart-mess-system.vercel.app/api`.
Administrators continue to use the website. Students sign in with their existing
email and password, view their assigned fingerprint ID in Profile, and pull to
refresh Attendance history to see scanner check-ins. Fingerprint templates remain
inside the R307; the app receives the student's ID and attendance records.

The APK is a standalone release, with no Expo Go or laptop development server
required. Its application ID is `org.messmate.student`, version 1.0.0 (code 1).
It requires Android 7.0/API 24 or newer and internet access to use the API.

## Rebuild a signed release

Use Node 22+, the repository's pinned pnpm, JDK 17, and Android SDK 36 with
Build Tools 36.0.0, NDK 27.1.12297006 and CMake 3.22.1. Set `JAVA_HOME` and
`ANDROID_HOME` to those local installations. On Windows, use a short checkout
path: deeply nested pnpm paths can exceed native CMake/compiler path limits.
For the Windows APK build, use a fresh build copy and set `nodeLinker: hoisted`
in that copy's `pnpm-workspace.yaml` before installing. Keep the normal application
checkout's dependency layout unchanged. Switching layouts over an existing install
can leave old workspace junctions pointing at long paths.

From the repository root in PowerShell:

```powershell
pnpm install --frozen-lockfile --prod=false
$env:EXPO_PUBLIC_API_BASE_URL = 'https://messmate-smart-mess-system.vercel.app/api'
Push-Location apps/mobile
node ../../node_modules/expo/bin/cli prebuild --platform android --no-install --skip-dependency-update react,react-native
Pop-Location
node scripts/prepare-android-release.mjs
```

Load these four private values into the build process environment:

- `MESSMATE_ANDROID_KEYSTORE`: absolute path to the release PKCS12 keystore
- `MESSMATE_ANDROID_KEYSTORE_PASSWORD`
- `MESSMATE_ANDROID_KEY_ALIAS`
- `MESSMATE_ANDROID_KEY_PASSWORD`

The existing local key is in the ignored `.android-signing` directory; its private
settings are in `.env.android.local`. Preserve and securely back up both. Future
updates must use the same signing key and an increased Android version code.
Never commit or upload the keystore or its passwords. Generated Android folders
are also ignored; rerun the signing preparation after a fresh Expo prebuild.

```powershell
$env:NODE_ENV = 'production'
$env:GRADLE_USER_HOME = 'C:\mm-gradle'
$env:EXPO_NO_METRO_WORKSPACE_ROOT = '1'
Push-Location apps/mobile/android
.\gradlew.bat :app:assembleRelease --no-daemon --max-workers=2 '-PreactNativeArchitectures=arm64-v8a,armeabi-v7a' '-Pexpo.useLegacyPackaging=true'
Pop-Location
```

Keep the Gradle cache path short as well: Ninja also reads React Native libraries
from that cache. `EXPO_NO_METRO_WORKSPACE_ROOT=1` keeps Android's relative
`index.ts` entry rooted in the mobile app during Expo's embedded bundle export.
The checked-in Metro config keeps shared workspace packages visible in that mode.
Expo's `experiments.autolinkingModuleResolution` selects the mobile app's React
version throughout the bundle, including dependencies with separate hoisted
copies. Preserve these settings when rebuilding this SDK 54 application.

The output is `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`.
Verify it with the SDK's `apksigner verify --verbose --print-certs`, check its
package/version/permissions with `aapt dump badging`, and confirm the bundled API
URL before publication. Copy the verified APK to
`apps/web/public/downloads/messmate-1.0.0.apk` for a Vercel deployment. APK binaries
are ignored by Git but included in the deployment upload. Preserve that file for
subsequent CLI deployments so the existing download stays available.

This is a direct APK distribution, not a Google Play listing. On the phone, open
the download and allow that browser to install the app if Android asks. Use the
student account created by the mess administrator.

## Fingerprint connection

The ESP32 sends fingerprint inventory and attendance directly to the cloud API;
the phone does not pair with the R307. The ESP32 can use any compatible internet
connection, independently of the phone's connection. When changing its hotspot,
update only the private `WIFI_SSID` and `WIFI_PASSWORD` in firmware `config.h`,
then compile and upload the fingerprint sketch. Keep the API address and scanner
token. See [fingerprint setup](FINGERPRINT_SETUP.md) for wiring, enrollment,
student assignment and real scan verification.
