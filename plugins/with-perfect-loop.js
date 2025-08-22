// plugins/with-perfect-loop.js
const { withDangerousMod, withXcodeProject } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const SWIFT_FILE = "PerfectLoop.swift";
const OBJC_BRIDGE = "PerfectLoop.m";

const withPerfectLoop = (config) => {
  // Step 1: Copy the Swift and ObjC files to the iOS project
  config = withDangerousMod(config, ["ios", async (cfg) => {
    const projectRoot = cfg.modRequest.projectRoot;
    const iosDir = path.join(projectRoot, "ios");
    const appName = cfg.modRequest.projectName;
    const appTargetDir = path.join(iosDir, appName);
    const srcDir = path.join(projectRoot, "ios-native");

    // Ensure the target directory exists
    if (!fs.existsSync(appTargetDir)) {
      fs.mkdirSync(appTargetDir, { recursive: true });
    }

    // Copy both Swift and ObjC bridge files
    for (const f of [SWIFT_FILE, OBJC_BRIDGE]) {
      const src = path.join(srcDir, f);
      const dst = path.join(appTargetDir, f);
      
      if (!fs.existsSync(src)) {
        throw new Error(`Missing ios-native/${f} - Please ensure the file exists`);
      }
      
      fs.copyFileSync(src, dst);
      console.log(`Copied ${f} to iOS project`);
    }
    
    return cfg;
  }]);

  // Step 2: Add files to Xcode project and configure build settings
  config = withXcodeProject(config, (cfg) => {
    const proj = cfg.modResults;
    const appName = cfg.modRequest.projectName;
    
    // Find the main app group
    const group = proj.pbxGroupByName(appName);
    if (!group) {
      throw new Error(`Could not find PBX group for ${appName}`);
    }

    // Get the main app target
    const target = proj.getFirstTarget();
    if (!target) {
      throw new Error("Could not find main app target");
    }

    // Add files to the project navigator (visible in Xcode)
    const swiftFileRef = proj.addFile(SWIFT_FILE, group.key, {
      lastKnownFileType: 'sourcecode.swift',
      sourceTree: '<group>'
    });
    
    const objcFileRef = proj.addFile(OBJC_BRIDGE, group.key, {
      lastKnownFileType: 'sourcecode.c.objc',
      sourceTree: '<group>'
    });

    // Add files to Compile Sources build phase
    const targetUuid = target.uuid;
    
    // Add Swift file to build phase
    if (swiftFileRef && swiftFileRef.fileRef) {
      proj.addBuildFile(swiftFileRef.fileRef, 'PBXSourcesBuildPhase', {
        target: targetUuid
      });
      console.log("Added PerfectLoop.swift to Compile Sources");
    }
    
    // Add ObjC bridge file to build phase
    if (objcFileRef && objcFileRef.fileRef) {
      proj.addBuildFile(objcFileRef.fileRef, 'PBXSourcesBuildPhase', {
        target: targetUuid
      });
      console.log("Added PerfectLoop.m to Compile Sources");
    }

    // Configure Swift build settings for the target
    const buildConfigs = proj.pbxXCBuildConfigurationSection();
    for (const key in buildConfigs) {
      const buildConfig = buildConfigs[key];
      
      // Only modify configs for our app target
      if (buildConfig && buildConfig.buildSettings && buildConfig.name) {
        const settings = buildConfig.buildSettings;
        
        // Ensure Swift is enabled
        settings.SWIFT_VERSION = '5.0';
        settings.ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = 'YES';
        settings.SWIFT_OPTIMIZATION_LEVEL = buildConfig.name === 'Release' ? '-O' : '-Onone';
        
        // Ensure module name is set correctly
        if (!settings.PRODUCT_MODULE_NAME) {
          settings.PRODUCT_MODULE_NAME = appName;
        }
        
        // Set bridging header if needed (React Native usually handles this)
        if (!settings.SWIFT_OBJC_BRIDGING_HEADER) {
          settings.SWIFT_OBJC_BRIDGING_HEADER = `${appName}/${appName}-Bridging-Header.h`;
        }
      }
    }

    return cfg;
  });

  return config;
};

module.exports = withPerfectLoop;