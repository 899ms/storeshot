"use client";
import * as React from "react";
import { IPAD_MK_RATIO } from "@/lib/constants";
import { img } from "@/lib/image-cache";
import type { FrameFinish } from "@/lib/types";

type FrameProps = {
  src: string;
  alt?: string;
  style?: React.CSSProperties;
  /** When true, hide EmptySlot placeholder (so it doesn't bake into exports). */
  hideEmpty?: boolean;
  /** Chassis finish for Phone/Tablet. "none" renders edge-to-edge, no bezel. */
  finish?: FrameFinish;
};

// Frameless full-bleed image (Desktop, or Phone/Tablet with finish "none").
function FramelessImage({
  src,
  alt = "",
  style,
  hideEmpty,
  aspectRatio,
}: FrameProps & { aspectRatio?: string }) {
  const resolved = img(src);
  if (!resolved) {
    if (hideEmpty) return <div style={{ width: "100%", height: "100%", ...style }} />;
    return (
      <div style={{ position: "relative", aspectRatio, ...style }}>
        <EmptySlot />
      </div>
    );
  }
  return (
    <div style={{ position: "relative", aspectRatio, ...style }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- canvas pixels, not LCP content */}
      <img
        src={resolved}
        alt={alt}
        style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
        draggable={false}
      />
    </div>
  );
}

// Desktop — frameless full-bleed canvas (Mac App Store style).
export function Frameless({ src, alt = "", style, hideEmpty }: FrameProps) {
  return <FramelessImage src={src} alt={alt} style={style} hideEmpty={hideEmpty} />;
}

const CHASSIS: Record<Exclude<FrameFinish, "none">, { background: string }> = {
  titanium: {
    background: "linear-gradient(150deg, #44444a 0%, #2b2b30 25%, #18181c 65%, #2a2a30 100%)",
  },
  black: {
    background: "linear-gradient(150deg, #1c1c20 0%, #0c0c0f 40%, #000000 70%, #17171b 100%)",
  },
  white: {
    background: "linear-gradient(150deg, #f2f2f5 0%, #cfcfd6 30%, #a9a9b2 65%, #e3e3e9 100%)",
  },
};

// 6.9" Phone (Pro Max) — Vector precision frame with Dynamic Island & chassis
export function Phone({ src, alt = "", style, hideEmpty, finish = "titanium" }: FrameProps) {
  const resolved = img(src);
  if (finish === "none") {
    return <FramelessImage src={src} alt={alt} style={style} hideEmpty={hideEmpty} aspectRatio="430 / 900" />;
  }
  const chassis = CHASSIS[finish] ?? CHASSIS.titanium;
  return (
    <div
      style={{
        position: "relative",
        aspectRatio: "430 / 900",
        ...style,
      }}
    >
        {/* Outer Chassis */}
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "13% / 6.25%",
            background: chassis.background,
          boxShadow:
            "inset 0 0 0 1.5px rgba(255, 255, 255, 0.22), inset 0 0 0 3px rgba(0, 0, 0, 0.8), 0 20px 50px -10px rgba(0, 0, 0, 0.65), 0 6px 18px rgba(0, 0, 0, 0.45)",
          position: "relative",
          overflow: "visible",
        }}
      >
        {/* Left Buttons: Action Button + Volume Buttons */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "16.5%",
            left: "-1.8%",
            width: "1.8%",
            height: "3.2%",
            borderRadius: "3px 0 0 3px",
            background: "linear-gradient(to right, #2c2c32, #484850)",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "23.5%",
            left: "-1.8%",
            width: "1.8%",
            height: "5.8%",
            borderRadius: "3px 0 0 3px",
            background: "linear-gradient(to right, #2c2c32, #484850)",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "31.5%",
            left: "-1.8%",
            width: "1.8%",
            height: "5.8%",
            borderRadius: "3px 0 0 3px",
            background: "linear-gradient(to right, #2c2c32, #484850)",
          }}
        />

        {/* Right Buttons: Power Button + Camera Control */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "23%",
            right: "-1.8%",
            width: "1.8%",
            height: "8.5%",
            borderRadius: "0 3px 3px 0",
            background: "linear-gradient(to left, #2c2c32, #484850)",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "65%",
            right: "-1.4%",
            width: "1.4%",
            height: "6.8%",
            borderRadius: "0 2px 2px 0",
            background: "linear-gradient(to left, #26262c, #3c3c44)",
          }}
        />

        {/* Top Speaker Ear-slit */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "0.5%",
            left: "50%",
            transform: "translateX(-50%)",
            width: "13%",
            height: "0.35%",
            borderRadius: "9999px",
            background: "#121215",
            border: "0.5px solid rgba(255,255,255,0.06)",
            zIndex: 30,
          }}
        />

        {/* Inner Screen Area */}
        <div
          style={{
            position: "absolute",
            left: "2.4%",
            top: "1.15%",
            width: "95.2%",
            height: "97.7%",
            borderRadius: "11.2% / 5.4%",
            overflow: "hidden",
            background: "#000",
            zIndex: 10,
          }}
        >
          {/* Dynamic Island */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: "1.6%",
              left: "50%",
              transform: "translateX(-50%)",
              width: "27.5%",
              height: "3.2%",
              borderRadius: "9999px",
              background: "#000000",
              boxShadow: "0 0 0 1px rgba(0,0,0,0.9), inset 0 0 1.5px rgba(255,255,255,0.12)",
              zIndex: 25,
              pointerEvents: "none",
            }}
          >
            {/* TrueDepth Sensor */}
            <div
              style={{
                position: "absolute",
                left: "17%",
                top: "50%",
                transform: "translateY(-50%)",
                width: "9%",
                height: "35%",
                borderRadius: "50%",
                background: "#07090f",
              }}
            />
            {/* Camera Lens */}
            <div
              style={{
                position: "absolute",
                right: "12%",
                top: "50%",
                transform: "translateY(-50%)",
                width: "16%",
                height: "58%",
                borderRadius: "50%",
                background: "radial-gradient(circle at 38% 38%, #1c2a4a 0%, #0c121e 60%, #03060a 100%)",
                boxShadow: "inset 0 0 1px 1px rgba(255,255,255,0.12)",
              }}
            />
          </div>

          {/* Screenshot Content */}
          {resolved ? (
            // eslint-disable-next-line @next/next/no-img-element -- canvas pixels, not LCP content
            <img
              src={resolved}
              alt={alt}
              style={{
                display: "block",
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "top",
              }}
              draggable={false}
            />
          ) : hideEmpty ? null : (
            <EmptySlot />
          )}
        </div>
      </div>
    </div>
  );
}

// 13" Tablet Pro — Vector precision frame, uniform bezel, top-center camera.
// Screen slot (94.8% × 96.0%) is exactly 2064/2752 aspect with the outer
// IPAD_MK_RATIO, so screenshots show fully.
export function IPad({ src, alt = "", style, hideEmpty, finish = "titanium" }: FrameProps) {
  const resolved = img(src);
  if (finish === "none") {
    return <FramelessImage src={src} alt={alt} style={style} hideEmpty={hideEmpty} aspectRatio={String(IPAD_MK_RATIO)} />;
  }
  const chassis = CHASSIS[finish] ?? CHASSIS.titanium;
  return (
    <div
      style={{
        position: "relative",
        aspectRatio: String(IPAD_MK_RATIO),
        ...style,
      }}
    >
      {/* Aluminum chassis */}
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "4% / 3%",
          background: chassis.background,
          boxShadow:
            "inset 0 0 0 1.5px rgba(255, 255, 255, 0.2), inset 0 0 0 3px rgba(0, 0, 0, 0.8), 0 20px 50px -10px rgba(0, 0, 0, 0.6), 0 6px 18px rgba(0, 0, 0, 0.4)",
          position: "relative",
          overflow: "visible",
        }}
      >
        {/* Power button (top edge) */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "-1%",
            right: "12%",
            width: "9%",
            height: "1%",
            borderRadius: "3px 3px 0 0",
            background: "linear-gradient(to bottom, #2c2c32, #484850)",
          }}
        />
        {/* Volume buttons (right edge) */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "9%",
            right: "-1%",
            width: "1%",
            height: "4%",
            borderRadius: "0 3px 3px 0",
            background: "linear-gradient(to left, #2c2c32, #484850)",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "14.5%",
            right: "-1%",
            width: "1%",
            height: "4%",
            borderRadius: "0 3px 3px 0",
            background: "linear-gradient(to left, #2c2c32, #484850)",
          }}
        />

        {/* Front camera centered in the top bezel */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "0.3%",
            left: "50%",
            transform: "translateX(-50%)",
            width: "2.1%",
            aspectRatio: "1 / 1",
            borderRadius: "50%",
            background: "radial-gradient(circle at 38% 38%, #1c2a4a 0%, #0c121e 60%, #03060a 100%)",
            boxShadow: "inset 0 0 1px 1px rgba(255,255,255,0.12)",
            zIndex: 30,
          }}
        />

        {/* Inner Screen Area */}
        <div
          style={{
            position: "absolute",
            left: "2.6%",
            top: "2%",
            width: "94.8%",
            height: "96%",
            borderRadius: "1.6% / 1.2%",
            overflow: "hidden",
            background: "#000",
            zIndex: 10,
          }}
        >
          {/* Screenshot Content */}
          {resolved ? (
            // eslint-disable-next-line @next/next/no-img-element -- canvas pixels, not LCP content
            <img
              src={resolved}
              alt={alt}
              style={{
                display: "block",
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "top",
              }}
              draggable={false}
            />
          ) : hideEmpty ? null : (
            <EmptySlot />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptySlot() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "rgba(255,255,255,0.4)",
        fontSize: "min(2vw, 14px)",
        background: "linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)",
        textAlign: "center",
        padding: "4%",
      }}
    >
      Drop a screenshot here
    </div>
  );
}
