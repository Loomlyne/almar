// Transparent BlockScrollLoader component for Framer
// Blocks scroll with fade effect and optional timer. Use inside pre-loading overlays.
import { useEffect, useState, startTransition } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "framer"

interface BlockScrollLoaderProps {
    block: boolean
    duration: number
    fade: boolean
    style?: React.CSSProperties
}

/**
 * BlockScrollLoader
 *
 * Transparent overlay that blocks scroll with optional fade and timer. Use inside pre-loading overlays.
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 */
export default function BlockScrollLoader(props: BlockScrollLoaderProps) {
    const { block, duration, fade, style } = props
    const [visible, setVisible] = useState(block)

    useEffect(() => {
        if (typeof window === "undefined") return
        const html = typeof document !== "undefined" ? document.documentElement : null
        if (block) {
            document.body.style.overflow = "hidden"
            if (html) html.style.overflow = "hidden"
            setVisible(true)
            // Prevent scroll events
            const prevent = (e) => { e.preventDefault() }
            window.addEventListener("wheel", prevent, { passive: false })
            window.addEventListener("touchmove", prevent, { passive: false })
            if (duration > 0) {
                const t = setTimeout(() => {
                    startTransition(() => setVisible(false))
                    document.body.style.overflow = ""
                    if (html) html.style.overflow = ""
                    window.removeEventListener("wheel", prevent)
                    window.removeEventListener("touchmove", prevent)
                }, duration)
                return () => {
                    clearTimeout(t)
                    document.body.style.overflow = ""
                    if (html) html.style.overflow = ""
                    window.removeEventListener("wheel", prevent)
                    window.removeEventListener("touchmove", prevent)
                }
            }
            return () => {
                document.body.style.overflow = ""
                if (html) html.style.overflow = ""
                window.removeEventListener("wheel", prevent)
                window.removeEventListener("touchmove", prevent)
            }
        } else {
            document.body.style.overflow = ""
            if (html) html.style.overflow = ""
            setVisible(false)
        }
        return () => {
            document.body.style.overflow = ""
            if (html) html.style.overflow = ""
        }
    }, [block, duration])

    if (!visible || RenderTarget.current() === RenderTarget.thumbnail)
        return null

    return (
        <div
            style={{
                ...style,
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                background: "transparent",
                zIndex: 9999,
                pointerEvents: "all",
                opacity: fade ? 0.7 : 1,
                transition: fade
                    ? "opacity 0.3s cubic-bezier(.4,0,.2,1)"
                    : undefined,
                touchAction: "none",
                overscrollBehavior: "none",
            }}
            aria-hidden="true"
        />
    )
}

addPropertyControls(BlockScrollLoader, {
    block: {
        type: ControlType.Boolean,
        title: "Block Scroll",
        defaultValue: true,
        enabledTitle: "Block",
        disabledTitle: "Allow",
    },
    duration: {
        type: ControlType.Number,
        title: "Timer (ms)",
        defaultValue: 0,
        min: 0,
        max: 10000,
        step: 100,
        unit: "ms",
    },
    fade: {
        type: ControlType.Boolean,
        title: "Fade Effect",
        defaultValue: true,
        enabledTitle: "Fade",
        disabledTitle: "None",
    },
})
