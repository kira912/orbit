import { Easing, FadeIn, FadeInDown, FadeInRight, FadeInUp, LinearTransition } from "react-native-reanimated";

/**
 * How things appear. Short ease-out fades with a small slide: elements arrive
 * softly and settle without any overshoot (springs on entering animations
 * looked too jumpy). Delays let lists cascade in.
 */
const DURATION = 260;
const ease = Easing.out(Easing.cubic);

export const enter = {
  /** Slides up a little while fading in: cards, list rows. */
  up: (delay = 0) => FadeInDown.duration(DURATION).delay(delay).easing(ease),
  /** Slides down a little: banners at the top of the screen. */
  down: (delay = 0) => FadeInUp.duration(DURATION).delay(delay).easing(ease),
  /** Slides in from the right: horizontal strips. */
  right: (delay = 0) => FadeInRight.duration(DURATION).delay(delay).easing(ease),
  /** Plain fade: buttons, badges, pins. */
  fade: (delay = 0) => FadeIn.duration(DURATION).delay(delay).easing(ease),
};

/** Rows moving to make room for others: a glide, no bounce. */
export const layoutTransition = LinearTransition.duration(220).easing(Easing.out(Easing.quad));
