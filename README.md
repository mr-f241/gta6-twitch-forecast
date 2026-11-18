# GTA VI Twitch CCU Forecast

make.fun bounty repo for `gta6-twitch-ccu-forecast-01`: hourly forecasts of Twitch
average concurrent viewers for game-launch days, emitted as quantile forecasts
(levels 0.05/0.25/0.5/0.75/0.95) for hours 2..24 after unlock.

[![bounty](https://make.fun/badge/gta6-twitch-ccu-forecast-01.svg)](https://make.fun/bounty/gta6-twitch-ccu-forecast-01)
[![rank](https://make.fun/badge/gta6-twitch-ccu-forecast-01/mr-f241/gta6-twitch-forecast/rank.svg)](https://make.fun/bounty/gta6-twitch-ccu-forecast-01)
[![reward](https://make.fun/badge/gta6-twitch-ccu-forecast-01/mr-f241/gta6-twitch-forecast/reward.svg)](https://make.fun/bounty/gta6-twitch-ccu-forecast-01)

## Run

```sh
MAKEFUN_INPUT_DIR=/data/data/com.termux/files/home/bounties/gta6-twitch-ccu-forecast-01-kit/input \
MAKEFUN_OUTPUT_DIR=/data/data/com.termux/files/home/bounties/gta6-out \
node main.ts
```

Reads every `*.in` case from `MAKEFUN_INPUT_DIR` and writes one `<id>.out` per
case to `MAKEFUN_OUTPUT_DIR` with 23 rows (hours 2..24), each holding five
finite, positive, nondecreasing quantiles. Requires Node >= 22 (runs TypeScript
via native type stripping).
