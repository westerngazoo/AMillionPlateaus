//! The GDExtension wrapper (godot-rust / gdext) — built only with `--features gdext`.
//! A thin `RefCounted` shell over [`crate::GraphData`]: it owns the core doc and
//! returns the DTO JSON the GDScript `GraphSource` parses. No GA, no logic here —
//! everything delegates to the host-tested `GraphData`.

use godot::prelude::*;

use crate::graph_source::GraphData;

struct MpGodotExtension;

#[gdextension]
unsafe impl ExtensionLibrary for MpGodotExtension {}

/// The native `GraphSource` Godot instantiates: `GraphSourceNative.new()`, then
/// `load_bytes(...)`, then `plateaus_json()/bridges_json()/resources_json()`.
#[derive(GodotClass)]
#[class(base=RefCounted)]
struct GraphSourceNative {
    data: Option<GraphData>,
    base: Base<RefCounted>,
}

#[godot_api]
impl IRefCounted for GraphSourceNative {
    fn init(base: Base<RefCounted>) -> Self {
        Self { data: GraphData::new().ok(), base }
    }
}

#[godot_api]
impl GraphSourceNative {
    /// Load a world from a saved/synced CRDT byte blob. Returns false on a bad blob.
    #[func]
    fn load_bytes(&mut self, bytes: PackedByteArray) -> bool {
        match GraphData::load(bytes.as_slice()) {
            Ok(d) => {
                self.data = Some(d);
                true
            }
            Err(_) => false,
        }
    }

    #[func]
    fn plateaus_json(&self) -> GString {
        let s = self.data.as_ref().map(|d| d.plateaus_json()).unwrap_or_else(|| "[]".to_string());
        GString::from(s.as_str())
    }

    #[func]
    fn bridges_json(&self) -> GString {
        let s = self.data.as_ref().map(|d| d.bridges_json()).unwrap_or_else(|| "[]".to_string());
        GString::from(s.as_str())
    }

    #[func]
    fn resources_json(&self) -> GString {
        let s = self.data.as_ref().map(|d| d.resources_json()).unwrap_or_else(|| "[]".to_string());
        GString::from(s.as_str())
    }
}
