//! A small, deterministic PDF 1.7 writer (ADR 0009), byte for byte the TypeScript output.
//!
//! Layers become Optional Content Groups, so PDF viewers, Inkscape and Illustrator show them.

use crate::color::{Rgba, to_cmyk};
use crate::drawing::{DrawOp, Drawing, Matrix, PathCmd};
use crate::format::num;
use std::fmt::Write as _;

/// The colour space of the page content.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum ColorSpace {
    /// `DeviceRGB`.
    #[default]
    Rgb,
    /// `DeviceCMYK` (naive conversion).
    Cmyk,
}

fn nums(values: &[f64]) -> String {
    values.iter().map(|x| num(*x)).collect::<Vec<_>>().join(" ")
}

fn matrix(m: &Matrix) -> String {
    nums(m)
}

fn path_ops(path: &[PathCmd]) -> String {
    path.iter()
        .map(|cmd| match cmd {
            PathCmd::M(x, y) => format!("{} m", nums(&[*x, *y])),
            PathCmd::L(x, y) => format!("{} l", nums(&[*x, *y])),
            PathCmd::C(v) => format!("{} c", nums(v)),
            PathCmd::H => "h".to_owned(),
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn color_op(c: Rgba, space: ColorSpace, stroke: bool) -> String {
    match space {
        ColorSpace::Cmyk => {
            let (cc, m, y, k) = to_cmyk(c);
            format!(
                "{} {}",
                nums(&[cc, m, y, k]),
                if stroke { "K" } else { "k" }
            )
        }
        ColorSpace::Rgb => format!(
            "{} {}",
            nums(&[c.0, c.1, c.2]),
            if stroke { "RG" } else { "rg" }
        ),
    }
}

/// A PDF text string as UTF-16BE hex, safe for any title.
fn pdf_text(s: &str) -> String {
    let mut out = String::from("<FEFF");
    for unit in s.encode_utf16() {
        let _ = write!(out, "{unit:04X}");
    }
    out.push('>');
    out
}

struct Content {
    alphas: Vec<String>,
    current: String,
    lines: Vec<String>,
    space: ColorSpace,
}

impl Content {
    fn gs(&mut self, stroke_a: f64, fill_a: f64) {
        let key = format!("{} {}", num(stroke_a), num(fill_a));
        if key == self.current {
            return;
        }
        let i = if let Some(i) = self.alphas.iter().position(|a| *a == key) {
            i
        } else {
            self.alphas.push(key.clone());
            self.alphas.len() - 1
        };
        self.lines.push(format!("/GS{i} gs"));
        self.current = key;
    }

    fn paint(&mut self, op: &DrawOp) {
        self.gs(op.stroke.map_or(1.0, |c| c.3), op.fill.map_or(1.0, |c| c.3));
        if let Some(c) = op.fill {
            self.lines.push(color_op(c, self.space, false));
        }
        if let Some(c) = op.stroke {
            self.lines.push(color_op(c, self.space, true));
        }
        self.lines.push(path_ops(&op.path));
        let close = match (op.fill.is_some(), op.stroke.is_some()) {
            (true, true) => "B",
            (true, false) => "f",
            _ => "S",
        };
        self.lines.push(close.to_owned());
    }
}

fn content(d: &Drawing, space: ColorSpace, layered: bool) -> (String, Vec<String>) {
    let mut c = Content {
        alphas: vec!["1 1".to_owned()],
        current: "1 1".to_owned(),
        lines: Vec::new(),
        space,
    };
    c.lines.push("q".to_owned());
    c.lines.push(format!("{} cm", matrix(&d.base)));
    c.lines.push(format!(
        "{} w {} J {} j 4 M",
        num(d.line_width),
        d.linecap,
        d.linejoin
    ));
    if let Some(bg) = &d.background {
        if layered {
            c.lines.push("/OC /OCbg BDC".to_owned());
        }
        c.paint(bg);
        if layered {
            c.lines.push("EMC".to_owned());
        }
    }
    c.lines.push("q".to_owned());
    for t in &d.transforms {
        c.lines.push(format!("{} cm", matrix(t)));
    }
    for (i, layer) in d.layers.iter().enumerate() {
        if layered {
            c.lines.push(format!("/OC /OC{i} BDC"));
        }
        for op in &layer.ops {
            c.paint(op);
        }
        if layered {
            c.lines.push("EMC".to_owned());
        }
    }
    c.lines.push("Q".to_owned());
    c.lines.push("Q".to_owned());
    (c.lines.join("\n") + "\n", c.alphas)
}

fn serialise(objects: &[String], root_ref: usize, info_ref: usize) -> Vec<u8> {
    // The second line holds four bytes above 127 (Latin-1 "âãÏÓ") marking the file as binary;
    // everything else is ASCII, so byte offsets equal character offsets.
    let mut out: Vec<u8> = b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n".to_vec();
    let mut offsets = Vec::with_capacity(objects.len());
    for (i, body) in objects.iter().enumerate() {
        offsets.push(out.len());
        out.extend_from_slice(format!("{} 0 obj\n{body}\nendobj\n", i + 1).as_bytes());
    }
    let xref = out.len();
    let mut tail = format!("xref\n0 {}\n0000000000 65535 f \n", objects.len() + 1);
    for off in offsets {
        let _ = writeln!(tail, "{off:010} 00000 n ");
    }
    let _ = write!(
        tail,
        "trailer\n<< /Size {} /Root {root_ref} 0 R /Info {info_ref} 0 R >>\nstartxref\n{xref}\n%%EOF\n",
        objects.len() + 1
    );
    out.extend_from_slice(tail.as_bytes());
    out
}

/// Write a one-page PDF for a drawing.
#[must_use]
pub fn write_pdf(d: &Drawing, color_space: ColorSpace, layers: bool, creator: &str) -> Vec<u8> {
    let (stream, alphas) = content(d, color_space, layers);
    // Object numbers: 1 catalog, 2 pages, 3 page, 4 content, 5 info, then OCGs.
    let mut names: Vec<&str> = Vec::new();
    if layers {
        if d.background.is_some() {
            names.push("background");
        }
        names.extend(d.layers.iter().map(|l| l.id.as_str()));
    }
    let refs = (0..names.len())
        .map(|i| format!("{} 0 R", 6 + i))
        .collect::<Vec<_>>()
        .join(" ");
    let mut oc_props = String::new();
    let mut props = String::new();
    if layers {
        oc_props = format!(
            " /OCProperties << /OCGs [{refs}] /D << /Name {} /Order [{refs}] /ON [{refs}] /OFF [] >> >> /PageMode /UseOC",
            pdf_text("Layers")
        );
        let shift = usize::from(d.background.is_some());
        let keys: Vec<String> = (0..names.len())
            .map(|i| {
                if d.background.is_some() && i == 0 {
                    format!("/OCbg {} 0 R", 6 + i)
                } else {
                    format!("/OC{} {} 0 R", i - shift, 6 + i)
                }
            })
            .collect();
        props = format!(" /Properties << {} >>", keys.join(" "));
    }
    let ext_g = alphas
        .iter()
        .enumerate()
        .map(|(i, a)| {
            let (sa, fa) = a.split_once(' ').unwrap_or((a, a));
            format!("/GS{i} << /Type /ExtGState /CA {sa} /ca {fa} >>")
        })
        .collect::<Vec<_>>()
        .join(" ");
    let bx = format!("[0 0 {} {}]", num(d.width), num(d.height));
    let mut objects = vec![
        format!("<< /Type /Catalog /Pages 2 0 R{oc_props} >>"),
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>".to_owned(),
        format!(
            "<< /Type /Page /Parent 2 0 R /MediaBox {bx} /Resources << /ExtGState << {ext_g} >>{props} >> /Contents 4 0 R >>"
        ),
        format!("<< /Length {} >>\nstream\n{stream}endstream", stream.len()),
        format!(
            "<< /Title {} /Creator {} /Producer (@0xdolan/deq-exporters) >>",
            pdf_text(&d.title),
            pdf_text(creator)
        ),
    ];
    objects.extend(
        names
            .iter()
            .map(|n| format!("<< /Type /OCG /Name {} >>", pdf_text(n))),
    );
    serialise(&objects, 1, 5)
}
