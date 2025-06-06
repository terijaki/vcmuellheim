import * as migration_20250525_144552 from './20250525_144552';
import * as migration_20250525_211855 from './20250525_211855';
import * as migration_20250530_103315 from './20250530_103315';
import * as migration_20250531_135223 from './20250531_135223';
import * as migration_20250531_194703 from './20250531_194703';
import * as migration_20250601_074703 from './20250601_074703';
import * as migration_20250606_074551 from './20250606_074551';

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
    name: '20250530_103315',
  },
  {
    up: migration_20250531_135223.up,
    down: migration_20250531_135223.down,
    name: '20250531_135223',
  },
  {
    up: migration_20250531_194703.up,
    down: migration_20250531_194703.down,
    name: '20250531_194703',
  },
  {
    up: migration_20250601_074703.up,
    down: migration_20250601_074703.down,
    name: '20250601_074703',
  },
  {
    up: migration_20250606_074551.up,
    down: migration_20250606_074551.down,
    name: '20250606_074551'
  },
];
