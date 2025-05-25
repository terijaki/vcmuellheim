import * as migration_20250525_144552 from './20250525_144552';
import * as migration_20250525_211855 from './20250525_211855';

export const migrations = [
  {
    up: migration_20250525_144552.up,
    down: migration_20250525_144552.down,
    name: '20250525_144552',
  },
  {
    up: migration_20250525_211855.up,
    down: migration_20250525_211855.down,
    name: '20250525_211855'
  },
];
