#!/usr/bin/env bash
# Turns docs/demo/raw/tour.webm (from record.mjs) into docs/demo.mp4 and docs/demo.gif.
# The wait for travel times (raw/marks.json) is fast-forwarded 6×.
# Needs ffmpeg on PATH, or FFMPEG=/path/to/ffmpeg.
set -e
cd "$(dirname "$0")"
FF=${FFMPEG:-ffmpeg}
A=$(node -p "require('./raw/marks.json').waitStart")
B=$(node -p "const m=require('./raw/marks.json'); Math.max(m.waitEnd, m.waitStart + 0.5)")
CUT="[0:v]trim=0:${A},setpts=PTS-STARTPTS[v1];[0:v]trim=${A}:${B},setpts=(PTS-STARTPTS)/6[v2];[0:v]trim=start=${B},setpts=PTS-STARTPTS[v3];[v1][v2][v3]concat=n=3:v=1[cut]"
"$FF" -hide_banner -loglevel error -y -i raw/tour.webm -filter_complex "$CUT" -map "[cut]" \
  -c:v libx264 -pix_fmt yuv420p -crf 26 -preset slow -movflags +faststart -an ../demo.mp4
# GIF: 1.3× speed, 6 fps, 760 px, 64 colours keeps it ~6 MB for the README.
"$FF" -hide_banner -loglevel error -y -i ../demo.mp4 \
  -vf "setpts=PTS/1.3,fps=6,scale=760:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" \
  -loop 0 ../demo.gif
ls -lh ../demo.mp4 ../demo.gif
