//! The seeded random source shared by every port (ADR 0015).
//!
//! mulberry32 on unsigned 32-bit integers, with no floating point, so TypeScript, Python and
//! Rust draw the same numbers.

/// Largest seed; seeds are unsigned 32-bit integers.
pub const MAX_SEED: u32 = u32::MAX;

/// A deterministic stream of unsigned 32-bit integers.
#[derive(Debug, Clone)]
pub struct Random {
    state: u32,
}

impl Random {
    /// A stream for `seed`.
    #[must_use]
    pub fn new(seed: u32) -> Self {
        Self { state: seed }
    }

    /// The next unsigned 32-bit integer.
    pub fn next_u32(&mut self) -> u32 {
        self.state = self.state.wrapping_add(0x6D2B_79F5);
        let mut t = self.state;
        t = (t ^ (t >> 15)).wrapping_mul(t | 1);
        t ^= t.wrapping_add((t ^ (t >> 7)).wrapping_mul(t | 0x3D));
        t ^ (t >> 14)
    }

    /// An integer in `0 .. n` (0 when `n` is 0).
    pub fn below(&mut self, n: usize) -> usize {
        let v = self.next_u32();
        usize::try_from(v).map_or(0, |v| v.checked_rem(n).unwrap_or(0))
    }

    /// One element of `items`, or `None` when it is empty.
    pub fn pick<'a, T>(&mut self, items: &'a [T]) -> Option<&'a T> {
        let i = self.below(items.len());
        items.get(i)
    }
}

#[cfg(test)]
mod tests {
    use super::Random;

    #[test]
    fn matches_the_reference_vectors() {
        let mut r = Random::new(1);
        assert_eq!(
            [r.next_u32(), r.next_u32(), r.next_u32()],
            [2_693_262_067, 11_749_833, 2_265_367_787]
        );
        let mut z = Random::new(0);
        assert_eq!([z.next_u32(), z.next_u32()], [1_144_304_738, 1_416_247]);
        assert_eq!(Random::new(u32::MAX).next_u32(), 3_850_105_811);
        assert_eq!(Random::new(5).below(0), 0);
        assert_eq!(Random::new(5).pick::<u8>(&[]), None);
        assert_eq!(Random::new(5).pick(&["a"]), Some(&"a"));
    }
}
