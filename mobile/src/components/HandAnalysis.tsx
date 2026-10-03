import { useEffect, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import type { CameraPrediction } from "../../modules/signify-camera";

const fingers = [
  [0, 1, 2, 3, 4],
  [0, 5, 6, 7, 8],
  [5, 9, 10, 11, 12],
  [9, 13, 14, 15, 16],
  [13, 17, 18, 19, 20],
  [0, 17],
];
export function HandAnalysis({
  frame,
  width,
  height,
  reducedMotion,
}: {
  frame: CameraPrediction | null;
  width: number;
  height: number;
  reducedMotion: boolean;
}) {
  const [sweep] = useState(() => new Animated.Value(0));
  const visible = !!frame?.hasHand;
  useEffect(() => {
    if (!visible || reducedMotion) {
      sweep.setValue(0.5);
      return;
    }
    const motion = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, {
          toValue: 1,
          duration: 950,
          useNativeDriver: true,
        }),
        Animated.timing(sweep, {
          toValue: 0,
          duration: 950,
          useNativeDriver: true,
        }),
      ]),
    );
    motion.start();
    return () => motion.stop();
  }, [visible, reducedMotion, sweep]);
  if (!visible) return null;
  const points = frame?.landmarks || [];
  const iw = frame?.width || width,
    ih = frame?.height || height;
  const scale = Math.max(width / iw, height / ih);
  const mapped = points.map((p) => ({
    x: width - (p.x * iw * scale - (iw * scale - width) / 2),
    y: p.y * ih * scale - (ih * scale - height) / 2,
  }));
  const minX = mapped.length
    ? Math.max(10, Math.min(...mapped.map((p) => p.x)) - 20)
    : width * 0.22;
  const maxX = mapped.length
    ? Math.min(width - 10, Math.max(...mapped.map((p) => p.x)) + 20)
    : width * 0.78;
  const minY = mapped.length
    ? Math.max(10, Math.min(...mapped.map((p) => p.y)) - 20)
    : height * 0.28;
  const maxY = mapped.length
    ? Math.min(height - 10, Math.max(...mapped.map((p) => p.y)) + 20)
    : height * 0.62;
  if (maxX <= minX || maxY <= minY) return null;
  return (
    <View
      pointerEvents="none"
      accessible={false}
      style={StyleSheet.absoluteFill}
    >
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        {mapped.length === 21 && (
          <>
            <Path
              d={fingers
                .map((f) =>
                  f
                    .map(
                      (i, j) => `${j ? "L" : "M"}${mapped[i].x},${mapped[i].y}`,
                    )
                    .join(" "),
                )
                .join(" ")}
              stroke="#DDE9DF"
              strokeWidth={1.25}
              strokeOpacity={0.65}
              fill="none"
            />
            {mapped.map((p, i) => (
              <Circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={i === 0 ? 4 : 2.4}
                fill="#E7F4E2"
                fillOpacity={0.9}
              />
            ))}
          </>
        )}
        <Path
          d={`M${minX + 17},${minY}h-17v17 M${maxX - 17},${minY}h17v17 M${minX},${maxY - 17}v17h17 M${maxX},${maxY - 17}v17h-17`}
          stroke="#C7DEBE"
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
      <Animated.View
        style={{
          position: "absolute",
          left: minX,
          top: minY,
          width: maxX - minX,
          height: 1,
          backgroundColor: "#D1E7C7",
          opacity: 0.55,
          transform: [
            {
              translateY: sweep.interpolate({
                inputRange: [0, 1],
                outputRange: [0, maxY - minY],
              }),
            },
          ],
        }}
      />
    </View>
  );
}
