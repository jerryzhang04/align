const { withXcodeProject } = require("expo/config-plugins");

const unsafeCommand = `\`"$NODE_BINARY" --print "require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'"\``;
const safeCommand = `REACT_NATIVE_XCODE_SCRIPT="$("$NODE_BINARY" --print "require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'")"
"$REACT_NATIVE_XCODE_SCRIPT"`;

function patchBundleScript(script) {
  if (script.includes("REACT_NATIVE_XCODE_SCRIPT=")) return script;
  if (!script.includes(unsafeCommand)) {
    throw new Error("react_native_bundle_phase_changed");
  }
  return script.replace(unsafeCommand, safeCommand);
}

function withSpaceSafeIosBuild(config) {
  return withXcodeProject(config, (mod) => {
    const phases = mod.modResults.hash.project.objects.PBXShellScriptBuildPhase;
    let found = false;

    for (const phase of Object.values(phases)) {
      if (!phase || typeof phase !== "object" || !String(phase.name).includes("Bundle React Native code and images")) {
        continue;
      }

      const encoded = phase.shellScript;
      const decoded = encoded.startsWith('"') ? JSON.parse(encoded) : encoded;
      const patched = patchBundleScript(decoded);
      phase.shellScript = encoded.startsWith('"') ? JSON.stringify(patched) : patched;
      found = true;
    }

    if (!found) throw new Error("react_native_bundle_phase_missing");
    return mod;
  });
}

module.exports = withSpaceSafeIosBuild;
module.exports.patchBundleScript = patchBundleScript;
