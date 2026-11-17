#!/bin/zsh
# peek.sh <out.png> <cols> <spec...>   spec = name@t  — renders stills and tiles them over a flat backdrop
out=$1; cols=$2; shift 2
dir=.peek; rm -rf $dir; mkdir -p $dir
node "${0:A:h}/../render.mjs" --out $dir --px 720 --still ${(j:,:)@} || exit 1
i=0; for s in "$@"; do f="$dir/${s/:/-}.png"; printf -v n "%03d" $i
  ffmpeg -y -loglevel error -f lavfi -i color=c=0xdfe6ee:s=720x720 -i "$f" -filter_complex "[0][1]overlay,crop=${CROP:-560:440:80:270}" -frames:v 1 $dir/t$n.png; i=$((i+1)); done
rows=$(( (i + cols - 1) / cols ))
ffmpeg -y -loglevel error -pattern_type glob -i "$dir/t*.png" -vf "tile=${cols}x${rows}:padding=4:color=0x8fa3b8,scale=iw*${SCALE:-0.6}:-1" -frames:v 1 $out
