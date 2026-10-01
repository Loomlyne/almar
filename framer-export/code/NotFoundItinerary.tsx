import {
    addPropertyControls,
    ControlType,
    useIsStaticRenderer,
} from "framer"
import { motion, useReducedMotion } from "framer-motion"
import { type CSSProperties, useMemo } from "react"

interface NotFoundItineraryProps {
    accentColor: string
    inkColor: string
    paperColor: string
    goldColor: string
    watermarkColor: string
    style?: CSSProperties
}

const STOPS = [
    { id: "ctg", label: "Cartagena", x: 58, y: 118 },
    { id: "coffee", label: "Coffee Region", x: 168, y: 78 },
    { id: "missing", label: "?", x: 286, y: 108 },
]

const ROUTE =
    "M 58 118 C 98 92, 128 86, 168 78 C 210 70, 248 82, 286 108"

/**
 * @framerIntrinsicWidth 460
 * @framerIntrinsicHeight 340
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 */
export default function NotFoundItinerary(props: NotFoundItineraryProps) {
    const {
        accentColor = "#0f677d",
        inkColor = "#1f3a40",
        paperColor = "rgba(255, 250, 240, 0.96)",
        goldColor = "#c4a882",
        watermarkColor = "rgba(31, 58, 64, 0.1)",
        style,
    } = props

    const isStatic = useIsStaticRenderer()
    const reduceMotion = useReducedMotion()
    const shouldAnimate = !isStatic && !reduceMotion

    const pathTransition = useMemo(
        () => ({
            duration: 2.4,
            ease: [0.45, 0, 0.2, 1] as [number, number, number, number],
        }),
        []
    )

    const isFullWidth = style?.width === "100%"

    return (
        <div
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                minHeight: 300,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                ...(isFullWidth ? style : { minWidth: "max-content", ...style }),
            }}
            aria-hidden="true"
        >
            <link
                href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&display=swap"
                rel="stylesheet"
            />

            <div
                style={{
                    position: "absolute",
                    fontFamily: '"Playfair Display", Georgia, serif',
                    fontWeight: 700,
                    fontSize: 108,
                    lineHeight: 1,
                    letterSpacing: "-0.05em",
                    color: watermarkColor,
                    userSelect: "none",
                    pointerEvents: "none",
                    bottom: 0,
                }}
            >
                404
            </div>

            <motion.div
                animate={
                    shouldAnimate
                        ? { y: [0, -6, 0], rotate: [0, 0.4, 0] }
                        : undefined
                }
                transition={
                    shouldAnimate
                        ? { duration: 7, repeat: Infinity, ease: "easeInOut" }
                        : undefined
                }
                style={{
                    position: "relative",
                    width: 380,
                    height: 260,
                    borderRadius: 18,
                    background: paperColor,
                    boxShadow:
                        "0 24px 60px rgba(31, 58, 64, 0.1), inset 0 0 0 1px rgba(31, 58, 64, 0.06)",
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        left: "50%",
                        top: 0,
                        bottom: 0,
                        width: 1,
                        background:
                            "linear-gradient(180deg, transparent, rgba(31,58,64,0.08), transparent)",
                    }}
                />

                <div
                    style={{
                        position: "absolute",
                        top: 22,
                        left: 28,
                        fontFamily: '"Playfair Display", Georgia, serif',
                        fontStyle: "italic",
                        fontSize: 13,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: accentColor,
                        opacity: 0.85,
                    }}
                >
                    ALMAR Private Journeys
                </div>

                <svg
                    width="380"
                    height="260"
                    viewBox="0 0 380 260"
                    style={{ position: "absolute", inset: 0 }}
                    aria-hidden="true"
                >
                    <motion.path
                        d={ROUTE}
                        fill="none"
                        stroke={accentColor}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeDasharray="6 8"
                        initial={
                            shouldAnimate
                                ? { pathLength: 0, opacity: 0.35 }
                                : { pathLength: 1, opacity: 0.55 }
                        }
                        animate={
                            shouldAnimate
                                ? { pathLength: 1, opacity: 0.55 }
                                : undefined
                        }
                        transition={shouldAnimate ? pathTransition : undefined}
                    />

                    {STOPS.map((stop, index) => {
                        const isMissing = stop.id === "missing"
                        return (
                            <g key={stop.id}>
                                {isMissing ? (
                                    <motion.circle
                                        cx={stop.x}
                                        cy={stop.y}
                                        r={16}
                                        fill="rgba(15, 103, 125, 0.08)"
                                        stroke={accentColor}
                                        strokeWidth="1.5"
                                        strokeDasharray="4 4"
                                        animate={
                                            shouldAnimate
                                                ? {
                                                      scale: [1, 1.08, 1],
                                                      opacity: [0.7, 1, 0.7],
                                                  }
                                                : undefined
                                        }
                                        transition={
                                            shouldAnimate
                                                ? {
                                                      duration: 2.8,
                                                      repeat: Infinity,
                                                      ease: "easeInOut",
                                                  }
                                                : undefined
                                        }
                                    />
                                ) : (
                                    <circle
                                        cx={stop.x}
                                        cy={stop.y}
                                        r={7}
                                        fill={inkColor}
                                    />
                                )}
                                <text
                                    x={stop.x}
                                    y={stop.y + (isMissing ? 34 : 24)}
                                    textAnchor="middle"
                                    style={{
                                        fontFamily:
                                            'Lato, "Helvetica Neue", sans-serif',
                                        fontSize: isMissing ? 18 : 11,
                                        fontWeight: isMissing ? 700 : 500,
                                        letterSpacing: isMissing
                                            ? "0.08em"
                                            : "0.04em",
                                        fill: inkColor,
                                        opacity: isMissing ? 0.9 : 0.72,
                                    }}
                                >
                                    {stop.label}
                                </text>
                            </g>
                        )
                    })}
                </svg>

                <motion.div
                    animate={
                        shouldAnimate
                            ? { rotate: [0, 8, -4, 0], scale: [1, 1.03, 1] }
                            : undefined
                    }
                    transition={
                        shouldAnimate
                            ? {
                                  duration: 5,
                                  repeat: Infinity,
                                  ease: "easeInOut",
                                  delay: 1.2,
                              }
                            : undefined
                    }
                    style={{
                        position: "absolute",
                        right: 26,
                        bottom: 22,
                        width: 54,
                        height: 54,
                        borderRadius: "50%",
                        background: `radial-gradient(circle at 30% 30%, ${goldColor}, #9a7f5d)`,
                        boxShadow: "inset 0 2px 4px rgba(255,255,255,0.35), 0 6px 16px rgba(31,58,64,0.15)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: paperColor,
                        fontFamily: '"Playfair Display", Georgia, serif',
                        fontSize: 22,
                        fontWeight: 700,
                    }}
                >
                    A
                </motion.div>

                <div
                    style={{
                        position: "absolute",
                        left: 28,
                        bottom: 24,
                        maxWidth: 210,
                        fontFamily: 'Lato, "Helvetica Neue", sans-serif',
                        fontSize: 12,
                        lineHeight: 1.45,
                        color: inkColor,
                        opacity: 0.62,
                    }}
                >
                    Unlisted stop — your concierge can chart the next chapter.
                </div>
            </motion.div>
        </div>
    )
}

addPropertyControls(NotFoundItinerary, {
    accentColor: {
        type: ControlType.Color,
        title: "Route",
        defaultValue: "#0f677d",
    },
    inkColor: {
        type: ControlType.Color,
        title: "Ink",
        defaultValue: "#1f3a40",
    },
    paperColor: {
        type: ControlType.Color,
        title: "Journal",
        defaultValue: "rgba(255, 250, 240, 0.96)",
    },
    goldColor: {
        type: ControlType.Color,
        title: "Seal",
        defaultValue: "#c4a882",
    },
    watermarkColor: {
        type: ControlType.Color,
        title: "404",
        defaultValue: "rgba(31, 58, 64, 0.1)",
    },
})

NotFoundItinerary.displayName = "Not Found Itinerary"
