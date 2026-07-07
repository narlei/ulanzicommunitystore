const { execFileSync } = require('node:child_process');
const path = require('node:path');

// We don't have an Apple Developer certificate, so electron-builder never
// signs the app (CSC_IDENTITY_AUTO_DISCOVERY=false). On Apple Silicon, macOS
// refuses to launch a completely unsigned binary and reports it as "damaged"
// instead of the friendlier "unidentified developer" warning. Ad-hoc signing
// (identity "-") is free, needs no Apple account, and fixes that.
module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  );

  execFileSync(
    'codesign',
    ['--force', '--deep', '--sign', '-', appPath],
    { stdio: 'inherit' },
  );
};
