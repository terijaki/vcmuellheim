import * as migration_20250525_144552 from './20250525_144552';
import * as migration_20250525_211855 from './20250525_211855';
import * as migration_20250530_103315 from './20250530_103315';

export const migrations = [
  {
    up: migration_20250525_144552.up,
    down: migration_20250525_144552.down,
    name: '20250525_144552',
  },
  {
    up: migration_20250525_211855.up,
    down: migration_20250525_211855.down,
    name: '20250525_211855',
  },
  {
    up: migration_20250530_103315.up,
    down: migration_20250530_103315.down,
    name: '20250530_103315'
  },
];
