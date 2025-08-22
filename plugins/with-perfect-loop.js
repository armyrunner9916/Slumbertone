// plugins/with-perfect-loop.js
const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const SWIFT_FILE = "PerfectLoop.swift";
const OBJC_BRIDGE = "PerfectLoop.m";

const withPerfectLoop = (config) => {
  // Simply copy the files to the iOS project directory
  config = withDangerousMod(config, ["ios", async (cfg) => {
    const projectRoot = cfg.modRequest.projectRoot;
    const iosDir = path.join(projectRoot, "ios");
    const appName = cfg.modRequest.projectName || "Slumbertone";
    const appTargetDir = path.join(iosDir, appName);
    const srcDir = path.join(projectRoot, "ios-native");

    // Ensure the target directory exists
    if (!fs.existsSync(appTargetDir)) {
      fs.mkdirSync(appTargetDir, { recursive: true });
    }

    // Copy both Swift and ObjC bridge files
    let filescopied = false;
    for (const f of [SWIFT_FILE, OBJC_BRIDGE]) {
      const src = path.join(srcDir, f);
      const dst = path.join(appTargetDir, f);
      
      if (!fs.existsSync(src)) {
        console.warn(`⚠️  Warning: ios-native/${f} not found`);
        continue;
      }
      
      try {
        fs.copyFileSync(src, dst);
        console.log(`✅ Copied ${f} to iOS project`);
        filescopied = true;
      } catch (err) {
        console.error(`❌ Failed to copy ${f}:`, err.message);
      }
    }
    
    if (filescopied) {
      console.log("\n📝 IMPORTANT: After prebuild completes successfully:");
      console.log("   1. Open ios/Slumbertone.xcworkspace in Xcode");
      console.log("   2. Right-click on 'Slumbertone' folder in navigator");
      console.log("   3. Select 'Add Files to Slumbertone...'");
      console.log("   4. Select PerfectLoop.swift and PerfectLoop.m");
      console.log("   5. Ensure 'Add to targets: Slumbertone' is checked");
      console.log("   6. Click 'Add'");
      console.log("\n   OR run: eas build --platform ios --profile preview");
      console.log("   (EAS Build will handle this automatically)\n");
    }
    
    return cfg;
  }]);

  return config;
};

module.exports = withPerfectLoop;