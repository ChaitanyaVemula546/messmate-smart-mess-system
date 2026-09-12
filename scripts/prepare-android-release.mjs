// Run after Expo Android prebuild. Credentials are read by Gradle from the
// build environment; no signing secret is written into generated source.
import { readFileSync, writeFileSync } from "node:fs";
const path = "apps/mobile/android/app/build.gradle";
let source = readFileSync(path, "utf8");
if (!source.includes("namespace 'org.messmate.student'"))
  throw new Error("Unexpected Android application; refusing signing patch.");
if (!source.includes("messmateRelease {")) {
  if (!source.includes("    signingConfigs {"))
    throw new Error("Android signing configuration was not found.");
  source = source.replace("    signingConfigs {", `    signingConfigs {
        messmateRelease {
            def releaseStore = System.getenv("MESSMATE_ANDROID_KEYSTORE")
            if (releaseStore) {
                storeFile file(releaseStore)
                storePassword System.getenv("MESSMATE_ANDROID_KEYSTORE_PASSWORD")
                keyAlias System.getenv("MESSMATE_ANDROID_KEY_ALIAS")
                keyPassword System.getenv("MESSMATE_ANDROID_KEY_PASSWORD")
            }
        }`);
}
source = source.replace(
  /(release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
  "$1signingConfig signingConfigs.messmateRelease",
);
if (!source.includes("signingConfig signingConfigs.messmateRelease"))
  throw new Error("Release signing patch could not be verified.");
writeFileSync(path, source);
console.log("Android release uses private MessMate signing credentials.");
