import {
    addPropertyControls,
    ControlType,
    useIsStaticRenderer,
} from "framer"
import { motion, useReducedMotion } from "framer-motion"
import { type CSSProperties, useMemo } from "react"

interface NotFoundCompassProps {
    accentColor: string
    ringColor: string
    pinColor: string
    watermarkColor: string
    backgroundColor: string
    style?: CSSProperties
}

const PIN_ANGLES = [0, 118, 236]
const ORBIT_RADIUS = 96

function MapPinIcon({
    color,
    size = 18,
}: {
    color: string
    size?: number
}) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill={color}
        >
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" />
        </svg>
    )
}

function CompassNeedle({
    color,
    animate,
}: {
    color: string
    animate: boolean
}) {
    const needle = (
        <>
            <polygon points="26,7 30,27 26,23 22,27" fill={color} />
            <polygon
                points="26,45 30,25 26,29 22,25"
                fill={color}
                opacity="0.35"
            />
            <circle cx="26" cy="26" r="3.5" fill={color} />
        </>
    )

    return (
        <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true">
            <circle
                cx="26"
                cy="26"
                r="24"
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                opacity="0.22"
            />
            {animate ? (
                <motion.g
                    animate={{ rotate: [0, 16, -10, 0] }}
                    transition={{
                        duration: 7,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                    style={{ transformOrigin: "26px 26px" }}
                >
                    {needle}
                </motion.g>
            ) : (
                <g style={{ transform: "rotate(8deg)", transformOrigin: "26px 26px" }}>
                    {needle}
                </g>
            )}
        </svg>
    )
}

/**
 * @framerIntrinsicWidth 420
 * @framerIntrinsicHeight 320
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 */
export default function NotFoundCompass(props: NotFoundCompassProps) {
    const {
        accentColor = "#0f677d",
        ringColor = "rgba(15, 103, 125, 0.28)",
        pinColor = "#1f3a40",
        watermarkColor = "rgba(31, 58, 64, 0.14)",
        backgroundColor = "rgba(255, 250, 240, 0)",
        style,
    } = props

    const isStatic = useIsStaticRenderer()
    const reduceMotion = useReducedMotion()
    const shouldAnimate = !isStatic && !reduceMotion

    const pins = useMemo(
        () =>
            PIN_ANGLES.map((angle, index) => ({
                angle,
                delay: index * 0.45,
                size: index === 0 ? 20 : 16,
                opacity: index === 0 ? 1 : 0.68,
            })),
        []
    )

    const isFullWidth = style?.width === "100%"

    return (
        <div
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                minHeight: 280,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                background: backgroundColor,
                ...(isFullWidth ? style : { minWidth: "max-content", ...style }),
            }}
            aria-hidden="true"
        >
            <link
                href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap"
                rel="stylesheet"
            />

            {shouldAnimate && (
                <>
                    <motion.div
                        style={{
                            position: "absolute",
                            width: 300,
                            height: 300,
                            borderRadius: "50%",
                            background: `radial-gradient(circle, ${accentColor}26 0%, transparent 72%)`,
                            left: "50%",
                            top: "44%",
                            transform: "translate(-50%, -50%)",
                        }}
                        animate={{ scale: [1, 1.1, 1], opacity: [0.45, 0.75, 0.45] }}
                        transition={{
                            duration: 8,
                            repeat: Infinity,
                            ease: "easeInOut",
                        }}
                    />
                    <motion.div
                        style={{
                            position: "absolute",
                            width: 190,
                            height: 190,
                            borderRadius: "50%",
                            background:
                                "radial-gradient(circle, rgba(196, 168, 130, 0.22) 0%, transparent 72%)",
                            left: "56%",
                            top: "60%",
                            transform: "translate(-50%, -50%)",
                        }}
                        animate={{ scale: [1.05, 0.92, 1.05], opacity: [0.25, 0.5, 0.25] }}
                        transition={{
                            duration: 10,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: 0.8,
                        }}
                    />
                </>
            )}

            <div
                style={{
                    position: "absolute",
                    fontFamily: '"Playfair Display", Georgia, serif',
                    fontWeight: 700,
                    fontSize: 116,
                    lineHeight: 1,
                    letterSpacing: "-0.05em",
                    color: watermarkColor,
                    userSelect: "none",
                    pointerEvents: "none",
                    bottom: 4,
                }}
            >
                404
            </div>

            <div style={{ position: "relative", width: 248, height: 248 }}>
                <motion.div
                    style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: "50%",
                        border: `1px solid ${ringColor}`,
                    }}
                    animate={shouldAnimate ? { rotate: 360 } : undefined}
                    transition={
                        shouldAnimate
                            ? { duration: 26, repeat: Infinity, ease: "linear" }
                            : undefined
                    }
                />

                <motion.div
                    style={{
                        position: "absolute",
                        inset: 20,
                        borderRadius: "50%",
                        border: `1px dashed ${ringColor}`,
                        opacity: 0.55,
                    }}
                    animate={shouldAnimate ? { rotate: -360 } : undefined}
                    transition={
                        shouldAnimate
                            ? { duration: 34, repeat: Infinity, ease: "linear" }
                            : undefined
                    }
                />

                <motion.div
                    style={{
                        position: "absolute",
                        inset: 0,
                    }}
                    animate={shouldAnimate ? { rotate: 360 } : undefined}
                    transition={
                        shouldAnimate
                            ? { duration: 26, repeat: Infinity, ease: "linear" }
                            : undefined
                    }
                >
                    {pins.map((pin, index) => {
                        const radians = (pin.angle * Math.PI) / 180
                        const x = Math.cos(radians) * ORBIT_RADIUS
                        const y = Math.sin(radians) * ORBIT_RADIUS

                        return (
                            <motion.div
                                key={pin.angle}
                                style={{
                                    position: "absolute",
                                    left: "50%",
                                    top: "50%",
                                    marginLeft: x - pin.size / 2,
                                    marginTop: y - pin.size / 2,
                                    opacity: pin.opacity,
                                }}
                                animate={
                                    shouldAnimate
                                        ? { y: [0, -8, 0], scale: [1, 1.06, 1] }
                                        : undefined
                                }
                                transition={
                                    shouldAnimate
                                        ? {
                                              duration: 3.2 + index * 0.4,
                                              repeat: Infinity,
                                              ease: "easeInOut",
                                              delay: pin.delay,
                                          }
                                        : undefined
                                }
                            >
                                <MapPinIcon color={pinColor} size={pin.size} />
                            </motion.div>
                        )
                    })}
                </motion.div>

                <div
                    style={{
                        position: "absolute",
                        left: "50%",
                        top: "50%",
                        transform: "translate(-50%, -50%)",
                        width: 116,
                        height: 116,
                        borderRadius: "50%",
                        background: "rgba(251, 246, 245, 0.94)",
                        boxShadow: "0 12px 42px rgba(31, 58, 64, 0.14)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <CompassNeedle color={pinColor} animate={shouldAnimate} />
                </div>
            </div>
        </div>
    )
}

addPropertyControls(NotFoundCompass, {
    accentColor: {
        type: ControlType.Color,
        title: "Accent",
        defaultValue: "#0f677d",
    },
    pinColor: {
        type: ControlType.Color,
        title: "Compass",
        defaultValue: "#1f3a40",
    },
    ringColor: {
        type: ControlType.Color,
        title: "Rings",
        defaultValue: "rgba(15, 103, 125, 0.28)",
    },
    watermarkColor: {
        type: ControlType.Color,
        title: "404",
        defaultValue: "rgba(31, 58, 64, 0.14)",
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "rgba(255, 250, 240, 0)",
    },
})

NotFoundCompass.displayName = "Not Found Compass"
