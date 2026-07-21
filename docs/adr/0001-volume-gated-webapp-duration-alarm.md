# Volume-gated WebApp duration alarm

The `vcm-webapp-duration-*` warning uses Average Lambda Duration, which flaps under sparse traffic when a single cold-start first request (~4s) is the only sample in a 5-minute window. We keep Average and the existing thresholds (3s prod / 5s non-prod, 2×5 min), but only evaluate Average when `SAMPLE_COUNT(duration) ≥ 20`; otherwise the math expression returns 0 (not breaching). That prefers signal quality over quiet-hour latency visibility — errors/throttles remain the hard alerts, and sparse-period duration regressions stay silent until traffic rises.
