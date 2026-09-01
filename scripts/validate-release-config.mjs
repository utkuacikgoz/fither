import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readJson = async (relativePath) =>
  JSON.parse(await readFile(new URL(`../${relativePath}`, import.meta.url), "utf8"));

const [appConfig, appPackage, easConfig] = await Promise.all([
  readJson("app/app.json"),
  readJson("app/package.json"),
  readJson("app/eas.json"),
]);

const expo = appConfig.expo;

assert.equal(expo.name, "FITHER", "The App Store display name must stay FITHER");
assert.equal(expo.slug, "fither", "The EAS project slug must stay stable");
assert.equal(expo.scheme, "fither", "Deep links require the stable fither scheme");
assert.deepEqual(expo.platforms, ["ios"], "Version 1 is deliberately iOS-only");
assert.match(expo.version, /^\d+\.\d+\.\d+$/, "App version must use semver");
assert.equal(
  appPackage.version,
  expo.version,
  "package.json and the native app version must move together",
);

assert.equal(expo.ios.supportsTablet, false, "Version 1 is designed for iPhone");
assert.match(
  expo.ios.bundleIdentifier,
  /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/,
  "iOS bundle identifier must be a reverse-domain identifier",
);
assert.match(expo.ios.buildNumber, /^[1-9]\d*$/, "iOS build number must be positive");
assert.ok(expo.plugins.includes("expo-router"), "Expo Router plugin is required");
assert.ok(
  expo.plugins.includes("expo-dev-client"),
  "Development builds require the Expo development client plugin",
);
assert.ok(
  appPackage.dependencies["expo-dev-client"],
  "Development builds require expo-dev-client as an app dependency",
);

assert.equal(
  easConfig.cli.appVersionSource,
  "remote",
  "EAS must own monotonically increasing store build numbers",
);
assert.equal(
  easConfig.cli.version,
  ">= 23.2.0",
  "EAS builds require the currently validated CLI generation",
);

const expectedEnvironments = {
  development: "development",
  preview: "preview",
  production: "production",
};

for (const [profile, environment] of Object.entries(expectedEnvironments)) {
  assert.ok(easConfig.build[profile], `Missing EAS ${profile} profile`);
  assert.equal(
    easConfig.build[profile].environment,
    environment,
    `${profile} builds must use the ${environment} EAS environment`,
  );
}

assert.equal(easConfig.build.development.developmentClient, true);
assert.equal(easConfig.build.development.distribution, "internal");
assert.equal(easConfig.build["development-simulator"].extends, "development");
assert.equal(easConfig.build["development-simulator"].ios.simulator, true);
assert.equal(easConfig.build.preview.distribution, "internal");
assert.equal(easConfig.build.production.autoIncrement, true);
assert.equal(
  easConfig.build.production.distribution,
  undefined,
  "Production must retain EAS's store distribution default",
);

for (const [profile, config] of Object.entries(easConfig.build)) {
  assert.equal(
    Object.hasOwn(config, "env"),
    false,
    `${profile} must use named EAS environments, not committed inline variables`,
  );
}

console.log(
  `Release config OK — FITHER ${expo.version} (${expo.ios.buildNumber}), ${expo.ios.bundleIdentifier}; development/preview/production profiles isolated`,
);
