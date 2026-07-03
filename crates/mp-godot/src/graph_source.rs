//! The native GraphSource logic (R-0025 / SPEC-0025 §2.2) — engine-free, host-tested.
//! `GraphData` owns a `mp_crdt::CrdtDoc` (the unchanged core) and answers the SAME
//! DTO JSON shapes the web binding (`mp-wasm`) does, derived from `mp-domain` types
//! (see `dto.rs`). The gdext wrapper (`gdext.rs`) is a thin `#[func]` shell over this.
//! No GA, no reputation mutation here — pure read + value-marshalling.

use mp_crdt::{CrdtDoc, CrdtError};

use crate::dto::{bridge_dto, plateau_dto, resource_dto};
use crate::reputation::reachable_ids;

/// A loaded world the immersive client reads. Owns the CRDT doc; every accessor
/// re-derives the `KnowledgeGraph` and serialises the DTOs (POC-simple; the doc is
/// small). Errors degrade to an empty `"[]"` rather than panicking (no `unwrap` in
/// library code).
pub struct GraphData {
    doc: CrdtDoc,
}

impl GraphData {
    /// An empty world (a fresh CRDT doc).
    pub fn new() -> Result<Self, CrdtError> {
        Ok(Self {
            doc: CrdtDoc::new()?,
        })
    }

    /// Load a world from a saved/synced CRDT byte blob (the same bytes `save()`
    /// produces and the web app persists / merges — R-0012/R-0018).
    pub fn load(bytes: &[u8]) -> Result<Self, CrdtError> {
        Ok(Self {
            doc: CrdtDoc::load(bytes)?,
        })
    }

    /// Wrap an existing doc (used by tests + the native host).
    pub fn from_doc(doc: CrdtDoc) -> Self {
        Self { doc }
    }

    /// Seed a small REAL world through the core (PlateauNode/Bridge → CrdtDoc) so the
    /// flat-3D scene can render native-sourced data while the sync transport (Track D)
    /// is still deferred — a DEMO helper, not production authoring (the real path is
    /// `load` from a saved/synced doc). A few topics across Math / Physics / Music.
    pub fn seed_demo(&mut self) -> Result<(), CrdtError> {
        use mp_domain::{Bridge, PlateauNode};
        use uuid::Uuid;
        let math = Uuid::new_v4();
        let phys = Uuid::new_v4();
        let music = Uuid::new_v4();
        let mk = |name: &str, dom: Uuid, e1: f32, e2: f32, e3: f32| {
            PlateauNode::new(name, dom, e1, e2, e3)
        };
        let calc = mk("Calculus", math, 0.95, 0.10, 0.05);
        let alg = mk("Algebra", math, 0.85, 0.12, 0.10);
        let geom = mk("Geometry", math, 0.78, 0.22, 0.32);
        let motion = mk("Motion", phys, 0.45, 0.85, 0.08);
        let waves = mk("Waves", phys, 0.30, 0.80, 0.42);
        let harmony = mk("Harmony", music, 0.10, 0.12, 0.92);
        let rhythm = mk("Rhythm", music, 0.06, 0.32, 0.84);
        for p in [&calc, &alg, &geom, &motion, &waves, &harmony, &rhythm] {
            self.doc.add_plateau(p)?;
        }
        let nil = Uuid::nil();
        for b in [
            Bridge::between(&alg, &calc, "functions", nil),
            Bridge::between(&calc, &geom, "coordinates", nil),
            Bridge::between(&calc, &motion, "equations of motion", nil),
            Bridge::between(&motion, &waves, "oscillation", nil),
            Bridge::between(&waves, &harmony, "frequency", nil),
            Bridge::between(&harmony, &rhythm, "meter", nil),
        ] {
            self.doc.add_bridge(&b)?;
        }
        Ok(())
    }

    /// Every plateau as a DTO-JSON array (same shape as `mp-wasm`'s `plateaus`).
    pub fn plateaus_json(&self) -> String {
        match self.doc.to_graph() {
            Ok(g) => serde_json::to_string(&g.plateaus().map(plateau_dto).collect::<Vec<_>>())
                .unwrap_or_else(|_| "[]".to_string()),
            Err(_) => "[]".to_string(),
        }
    }

    /// Every bridge as a DTO-JSON array.
    pub fn bridges_json(&self) -> String {
        match self.doc.to_graph() {
            Ok(g) => serde_json::to_string(&g.bridges().map(bridge_dto).collect::<Vec<_>>())
                .unwrap_or_else(|_| "[]".to_string()),
            Err(_) => "[]".to_string(),
        }
    }

    /// Every resource (trail marker) as a DTO-JSON array.
    pub fn resources_json(&self) -> String {
        match self.doc.to_graph() {
            Ok(g) => {
                serde_json::to_string(&g.resources.values().map(resource_dto).collect::<Vec<_>>())
                    .unwrap_or_else(|_| "[]".to_string())
            }
            Err(_) => "[]".to_string(),
        }
    }

    /// Plateau ids reachable for `rep_json` — same fog query as `mp-wasm` (AC2).
    pub fn reachable_plateaus_json(&self, rep_json: &str) -> String {
        match self.doc.to_graph() {
            Ok(g) => match reachable_ids(&g, rep_json) {
                Ok(ids) => serde_json::to_string(&ids).unwrap_or_else(|_| "[]".to_string()),
                Err(_) => "[]".to_string(),
            },
            Err(_) => "[]".to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mp_domain::{Bridge, PlateauNode, Resource, ResourceKind};
    use uuid::Uuid;

    fn doc_with_fixture() -> CrdtDoc {
        let mut doc = CrdtDoc::new().expect("doc");
        let math = Uuid::new_v4();
        let calc = PlateauNode::new("Calculus", math, 0.95, 0.10, 0.05);
        let geom = PlateauNode::new("Geometry", math, 0.80, 0.20, 0.30);
        doc.add_plateau(&calc).expect("add calc");
        doc.add_plateau(&geom).expect("add geom");
        let bridge = Bridge::between(&calc, &geom, "coordinates", Uuid::nil());
        doc.add_bridge(&bridge).expect("add bridge");
        let res = Resource::new(
            calc.id,
            "Spivak — Calculus",
            ResourceKind::Article,
            "https://x.test",
            Uuid::nil(),
        );
        doc.add_resource(&res).expect("add resource");
        doc
    }

    // PARITY: the plateau DTO has EXACTLY the contract keys mp-wasm's PlateauDto emits
    // (id/name/description/domain_id/position{e1,e2,e3}) — structural equivalence, not
    // shared struct identity (SPEC-0025 §2.2 decision).
    #[test]
    fn plateau_dto_shape_matches_the_contract() {
        let p = PlateauNode::new("Calculus", Uuid::new_v4(), 0.95, 0.10, 0.05);
        let v = serde_json::to_value(crate::dto::plateau_dto(&p)).expect("serialise");
        let obj = v.as_object().expect("object");
        let mut keys: Vec<String> = obj.keys().cloned().collect();
        keys.sort();
        assert_eq!(keys, ["description", "domain_id", "id", "name", "position"]);
        let pos = obj["position"].as_object().expect("position object");
        let mut pk: Vec<String> = pos.keys().cloned().collect();
        pk.sort();
        assert_eq!(pk, ["e1", "e2", "e3"]);
        assert_eq!(obj["name"], "Calculus");
        assert_eq!(pos["e1"].as_f64().expect("e1") as f32, 0.95_f32);
        assert_eq!(pos["e3"].as_f64().expect("e3") as f32, 0.05_f32); // e3 = coeffs[4]
    }

    #[test]
    fn graphdata_emits_plateaus_bridges_resources() {
        let data = GraphData::from_doc(doc_with_fixture());

        let plats: serde_json::Value = serde_json::from_str(&data.plateaus_json()).expect("json");
        assert_eq!(plats.as_array().expect("array").len(), 2);
        let names: Vec<String> = plats
            .as_array()
            .expect("array")
            .iter()
            .map(|p| p["name"].as_str().unwrap_or("").to_string())
            .collect();
        assert!(names.contains(&"Calculus".to_string()) && names.contains(&"Geometry".to_string()));

        let bridges: serde_json::Value = serde_json::from_str(&data.bridges_json()).expect("json");
        assert_eq!(bridges.as_array().expect("array").len(), 1);
        assert_eq!(bridges[0]["concept"], "coordinates");

        let res: serde_json::Value = serde_json::from_str(&data.resources_json()).expect("json");
        assert_eq!(res.as_array().expect("array").len(), 1);
        assert_eq!(res[0]["kind"], "Article"); // unit enum → variant-name string (mp-wasm parity)
        assert_eq!(res[0]["state"], "Floating");
    }

    #[test]
    fn save_then_load_roundtrips_the_graph() {
        let mut doc = doc_with_fixture();
        let bytes = doc.save();
        let data = GraphData::load(&bytes).expect("load");
        let plats: serde_json::Value = serde_json::from_str(&data.plateaus_json()).expect("json");
        assert_eq!(plats.as_array().expect("array").len(), 2);
    }

    #[test]
    fn seed_demo_populates_a_real_native_world() {
        let mut data = GraphData::new().expect("new");
        data.seed_demo().expect("seed");
        let plats: serde_json::Value = serde_json::from_str(&data.plateaus_json()).expect("json");
        assert_eq!(plats.as_array().expect("array").len(), 7);
        let bridges: serde_json::Value = serde_json::from_str(&data.bridges_json()).expect("json");
        assert_eq!(bridges.as_array().expect("array").len(), 6);
        // real ids (Uuids), not the GDScript stand-in strings
        let id = plats[0]["id"].as_str().expect("id");
        assert!(
            uuid::Uuid::parse_str(id).is_ok(),
            "native ids are real Uuids"
        );
    }

    #[test]
    fn empty_world_emits_empty_arrays() {
        let data = GraphData::new().expect("new");
        assert_eq!(data.plateaus_json(), "[]");
        assert_eq!(data.bridges_json(), "[]");
        assert_eq!(data.resources_json(), "[]");
        assert_eq!(data.reachable_plateaus_json("{}"), "[]");
    }

    #[test]
    fn reachable_json_matches_fog() {
        let mut doc = doc_with_fixture();
        let math = {
            let g = doc.to_graph().expect("graph");
            g.plateaus().next().expect("plateau").domain_id
        };
        let data = GraphData::from_doc(doc);
        let json = format!(
            r#"{{ "domain_reps": {{ "{math}": [0.0, 0.95, 0.1, 0.0, 0.05, 0.0, 0.0, 0.0] }} }}"#
        );
        let ids: serde_json::Value =
            serde_json::from_str(&data.reachable_plateaus_json(&json)).expect("json");
        let arr = ids.as_array().expect("array");
        assert!(!arr.is_empty());
    }
}
