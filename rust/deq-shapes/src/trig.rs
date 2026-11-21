//! Sine and cosine that match JavaScript's `Math.sin` and `Math.cos` bit for bit.
//!
//! V8 computes them with fdlibm; the platform maths library may differ by one unit in the
//! last place, which can flip a rounded coordinate and break byte-for-byte parity (ADR 0011).
//! This is fdlibm's `sin`/`cos` with the medium-size argument reduction, which covers every
//! angle a shape uses (|x| <= 2^19 * pi / 2); larger arguments fall back to `f64`.
//! fdlibm's constants are kept digit for digit, as published.
#![allow(clippy::excessive_precision, clippy::approx_constant)]

const S1: f64 = -1.666_666_666_666_663_243_48e-01;
const S2: f64 = 8.333_333_333_322_489_461_24e-03;
const S3: f64 = -1.984_126_982_985_794_931_34e-04;
const S4: f64 = 2.755_731_370_707_006_767_89e-06;
const S5: f64 = -2.505_076_025_340_686_341_95e-08;
const S6: f64 = 1.589_690_995_211_550_102_21e-10;
const C1: f64 = 4.166_666_666_666_660_190_37e-02;
const C2: f64 = -1.388_888_888_887_410_957_49e-03;
const C3: f64 = 2.480_158_728_947_672_941_78e-05;
const C4: f64 = -2.755_731_435_139_066_330_35e-07;
const C5: f64 = 2.087_572_321_298_174_827_90e-09;
const C6: f64 = -1.135_964_755_778_819_482_65e-11;
const INVPIO2: f64 = 6.366_197_723_675_813_824_33e-01;
const PIO2_1: f64 = 1.570_796_326_734_125_614_17e+00;
const PIO2_1T: f64 = 6.077_100_506_506_192_249_32e-11;
const PIO2_2: f64 = 6.077_100_506_303_965_976_60e-11;
const PIO2_2T: f64 = 2.022_266_248_795_950_631_54e-21;
const PIO2_3: f64 = 2.022_266_248_711_166_455_80e-21;
const PIO2_3T: f64 = 8.478_427_660_368_899_569_97e-32;
/// High words of n * pi / 2 for n = 1 ..= 32.
const NPIO2_HW: [u32; 32] = [
    0x3FF9_21FB,
    0x4009_21FB,
    0x4012_D97C,
    0x4019_21FB,
    0x401F_6A7A,
    0x4022_D97C,
    0x4025_FDBB,
    0x4029_21FB,
    0x402C_463A,
    0x402F_6A7A,
    0x4031_475C,
    0x4032_D97C,
    0x4034_6B9C,
    0x4035_FDBB,
    0x4037_8FDB,
    0x4039_21FB,
    0x403A_B41B,
    0x403C_463A,
    0x403D_D85A,
    0x403F_6A7A,
    0x4040_7E4C,
    0x4041_475C,
    0x4042_106C,
    0x4042_D97C,
    0x4043_A28C,
    0x4044_6B9C,
    0x4045_34AC,
    0x4045_FDBB,
    0x4046_C6CB,
    0x4047_8FDB,
    0x4048_58EB,
    0x4049_21FB,
];

/// The high 32 bits of `x` without the sign bit.
fn high_abs(x: f64) -> u32 {
    high(x) & 0x7FFF_FFFF
}

#[allow(clippy::cast_possible_truncation)]
fn high(x: f64) -> u32 {
    (x.to_bits() >> 32) as u32
}

fn from_high(h: u32) -> f64 {
    f64::from_bits(u64::from(h) << 32)
}

/// Whether `x` is tiny and truncates to zero, as fdlibm's `(int) x == 0`.
fn tiny(x: f64) -> bool {
    high_abs(x) < 0x3E40_0000 && x.trunc() == 0.0
}

fn k_sin(x: f64, y: f64, with_tail: bool) -> f64 {
    if tiny(x) {
        return x;
    }
    let z = x * x;
    let v = z * x;
    let r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)));
    if with_tail {
        x - ((z * (0.5 * y - v * r) - y) - v * S1)
    } else {
        x + v * (S1 + z * r)
    }
}

fn k_cos(x: f64, y: f64) -> f64 {
    let ix = high_abs(x);
    if tiny(x) {
        return 1.0;
    }
    let z = x * x;
    let r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
    if ix < 0x3FD3_3333 {
        return 1.0 - (0.5 * z - (z * r - x * y));
    }
    let qx = if ix > 0x3FE9_0000 {
        0.28125
    } else {
        from_high(ix - 0x0020_0000)
    };
    let hz = 0.5 * z - qx;
    let a = 1.0 - qx;
    a - (hz - (z * r - x * y))
}

fn exponent_gap(j: u32, y0: f64) -> u32 {
    j.saturating_sub((high(y0) >> 20) & 0x7FF)
}

/// `x` as `n * pi / 2 + (y0 + y1)`, or `None` when `x` is too large.
#[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
fn reduce(x: f64) -> Option<(u32, f64, f64)> {
    let ix = high_abs(x);
    let negative = x.is_sign_negative();
    if ix < 0x4002_D97C {
        // |x| < 3 pi / 4
        let sign = if negative { -1.0 } else { 1.0 };
        let n = if negative { 3 } else { 1 };
        let z = x - sign * PIO2_1;
        if ix != 0x3FF9_21FB {
            let y0 = z - sign * PIO2_1T;
            return Some((n, y0, (z - y0) - sign * PIO2_1T));
        }
        let z = z - sign * PIO2_2;
        let y0 = z - sign * PIO2_2T;
        return Some((n, y0, (z - y0) - sign * PIO2_2T));
    }
    if ix > 0x4139_21FB {
        return None;
    }
    let t = x.abs();
    // t * 2/pi + 1/2 < 2^20 here, so the cast is exact.
    let n = (t * INVPIO2 + 0.5) as u32;
    let fn_ = f64::from(n);
    let mut r = t - fn_ * PIO2_1;
    let mut w = fn_ * PIO2_1T;
    let mut y0 = r - w;
    let near = !(1..=32).contains(&n) || NPIO2_HW.get((n - 1) as usize) == Some(&ix);
    if near {
        let j = ix >> 20;
        if exponent_gap(j, y0) > 16 {
            let t2 = r;
            w = fn_ * PIO2_2;
            r = t2 - w;
            w = fn_ * PIO2_2T - ((t2 - r) - w);
            y0 = r - w;
            if exponent_gap(j, y0) > 49 {
                let t3 = r;
                w = fn_ * PIO2_3;
                r = t3 - w;
                w = fn_ * PIO2_3T - ((t3 - r) - w);
                y0 = r - w;
            }
        }
    }
    let y1 = (r - y0) - w;
    if negative {
        // -n mod 4, which is all the callers use.
        Some((n.wrapping_neg(), -y0, -y1))
    } else {
        Some((n, y0, y1))
    }
}

/// `Math.sin(x)` as V8 computes it.
#[must_use]
pub fn sin(x: f64) -> f64 {
    if high_abs(x) <= 0x3FE9_21FB {
        return k_sin(x, 0.0, false);
    }
    let Some((n, a, b)) = reduce(x) else {
        return x.sin();
    };
    match n & 3 {
        0 => k_sin(a, b, true),
        1 => k_cos(a, b),
        2 => -k_sin(a, b, true),
        _ => -k_cos(a, b),
    }
}

/// `Math.cos(x)` as V8 computes it.
#[must_use]
pub fn cos(x: f64) -> f64 {
    if high_abs(x) <= 0x3FE9_21FB {
        return k_cos(x, 0.0);
    }
    let Some((n, a, b)) = reduce(x) else {
        return x.cos();
    };
    match n & 3 {
        0 => k_cos(a, b),
        1 => -k_sin(a, b, true),
        2 => -k_cos(a, b),
        _ => k_sin(a, b, true),
    }
}

#[cfg(test)]
mod tests {
    use super::{cos, sin};

    // Math.sin and Math.cos in V8 (fdlibm), which the C library does not always match.
    const V8: [(f64, f64, f64); 17] = [
        (
            4.188_790_204_786_390_5,
            -0.866_025_403_784_438_5,
            -0.500_000_000_000_000_4,
        ),
        (
            -4.188_790_204_786_390_5,
            0.866_025_403_784_438_5,
            -0.500_000_000_000_000_4,
        ),
        (1.570_796_326_794_896_6, 1.0, 6.123_233_995_736_766e-17),
        (-1.570_796_326_794_896_6, -1.0, 6.123_233_995_736_766e-17),
        (2.0, 0.909_297_426_825_681_7, -0.416_146_836_547_142_4),
        (-2.0, -0.909_297_426_825_681_7, -0.416_146_836_547_142_4),
        (1e-9, 1e-9, 1.0),
        (0.5, 0.479_425_538_604_203, 0.877_582_561_890_372_8),
        (0.7, 0.644_217_687_237_691, 0.764_842_187_284_488_5),
        (50.0, -0.262_374_853_703_928_77, 0.964_966_028_492_113_3),
        (157.079_632_679_489_66, 9.821_933_618_642_36e-16, 1.0),
        (48.694_686_130_641_79, -1.0, -3.674_559_378_078_648e-15),
        (-48.694_686_130_641_79, 1.0, -3.674_559_378_078_648e-15),
        (62.831_853_071_795_86, -2.449_293_598_294_706_5e-15, 1.0),
        (
            10_000_000.0,
            0.420_547_793_190_782_5,
            -0.907_270_386_181_739_6,
        ),
        (
            -10_000_000.0,
            -0.420_547_793_190_782_5,
            -0.907_270_386_181_739_6,
        ),
        (
            1_234.567_8,
            0.078_033_449_200_020_27,
            -0.996_950_741_414_011_9,
        ),
    ];

    #[test]
    fn matches_v8() {
        for (x, s, c) in V8 {
            assert_eq!(sin(x).to_bits(), s.to_bits(), "sin({x})");
            assert_eq!(cos(x).to_bits(), c.to_bits(), "cos({x})");
        }
    }

    #[test]
    fn large_arguments_fall_back() {
        assert_eq!(sin(1e300).to_bits(), 1e300_f64.sin().to_bits());
        assert_eq!(cos(1e300).to_bits(), 1e300_f64.cos().to_bits());
    }
}
