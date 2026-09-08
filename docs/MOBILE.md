# Expo student application

React Native + Expo SDK 54 + TypeScript. The application uses the same API contracts, account identity and database as the web portal.

Screens: native splash/loading, login, Home dashboard, Meals for today/tomorrow, History with attendance/all-meal modes, Profile and Settings. Android back returns to Home before exiting. App foregrounding and pull-to-refresh reload server data. Failed saves show errors and never claim that an offline intention is saved. Meal cutoffs remain authoritative on the server.

Sessions use Expo SecureStore, with device-only unlocked keychain accessibility on iOS. Login restores a stored session against the API. Logout deletes local secure storage even if the network is unavailable; the remote session then remains valid until expiry unless revoked by an administrator. An admin attempting to log into the student app is directed to the website and the just-created session is revoked.

## Run

Start the API and set `EXPO_PUBLIC_API_BASE_URL` in `apps/mobile/.env`. Restart Expo after changing public environment variables. On a real phone use the development computer's LAN address. Android Emulator normally uses 10.0.2.2. Use HTTPS on a deployed API. Do not put AUTH_SECRET, a database URL or device tokens in Expo public variables.

```bash
pnpm --filter @messmate/mobile dev
pnpm mobile:check
pnpm mobile:export
```

A release requires a reachable real API URL. The default emulator address is a development convenience. The Android export bundles JavaScript/assets and verifies Metro resolution, not native installation or an APK.

## Android locally without cloud build credits

Install Android Studio, the supported Android SDK and JDK for the resolved Expo/React Native versions. From `apps/mobile` run:

```bash
pnpm exec expo prebuild --platform android
pnpm exec expo run:android
```

For a release, configure your own Android signing keystore outside Git and use the generated Gradle project (`gradlew assembleRelease` on Windows, `./gradlew assembleRelease` on Unix). A development APK is for testing; store distribution and release signing have their own requirements. This project does not invoke EAS or a paid cloud build.

iOS native compilation requires macOS/Xcode; it was not attempted in this Linux environment. Android emulator and physical-phone tests are listed separately in VERIFICATION.md.
