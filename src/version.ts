/**
 * Version Constants
 *
 * Single source of truth — reads from package.json at runtime.
 */

import { createRequire } from "node:module";

const _require = createRequire(import.meta.url);
const pkg = _require("../package.json") as { version: string; name: string };

/** Server version from package.json */
export const VERSION: string = pkg.version;

/** Package name from package.json */
export const NAME: string = pkg.name;
