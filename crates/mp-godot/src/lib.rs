//! mp-godot — the immersive Godot client's NATIVE binding (R-0025 / SPEC-0025).
//!
//! A thin GDExtension that owns a `mp_crdt::CrdtDoc` and answers the SAME DTO JSON
//! shapes the web binding (`mp-wasm`) does, **re-derived from `mp-domain`** — never
//! depending on `mp-wasm` (a binding→binding edge). The client does **no GA**; all
//! geometry/reputation stays in the unchanged core. Equivalence with the web binding
//! is guaranteed structurally by the parity tests in `graph_source.rs`.
//!
//! The engine-free logic ([`GraphData`]) is host-tested as an rlib; the `#[gdextension]`
//! wrapper ([`gdext`]) is built only with `--features gdext` (so `cargo test
//! --workspace` stays green without pulling the engine crate):
//!   cargo build -p mp-godot --features gdext   # → the cdylib Godot loads

pub mod dto;
pub mod graph_source;

pub use graph_source::GraphData;

#[cfg(feature = "gdext")]
mod gdext;
