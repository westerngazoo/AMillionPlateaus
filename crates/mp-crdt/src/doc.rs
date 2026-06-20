//! `CrdtDoc` — the replicated knowledge graph as an Automerge document.
//!
//! The document root holds exactly four maps (SPEC-0004 §2.1):
//!
//! ```text
//! ROOT
//! ├── "plateaus"  : Map<plateau_id        -> JSON(PlateauNode)>
//! ├── "bridges"   : Map<bridge_id         -> JSON(Bridge)>
//! ├── "resources" : Map<resource_id              -> JSON(Resource)>
//! └── "votes"     : Map<"resource/wizard/actor"  -> f64>   // flat, single-writer cells
//! ```
//!
//! Plateaus, bridges and resources are *write-once* this phase, stored as opaque
//! serde-JSON string scalars keyed by UUID — reusing `mp-graph`'s own
//! `Serialize`/`Deserialize` (incl. the `serde_mv` GA adapter) so the GA
//! invariants survive the wire verbatim. `votes` is a *flat* map keyed by a
//! `"<resource>/<wizard>/<actor>"` composite (not a per-resource sub-map): the
//! actor segment makes every cell single-writer, so concurrent votes never
//! collide, and a wizard's grow-only weight is the max over its per-actor cells
//! computed on read (see [`CrdtDoc::vote`] / [`CrdtDoc::resource_vote`]).
//!
//! All four root maps are created by a deterministic *genesis* change so two
//! independently-initialized replicas share the same root objects and merge
//! without orphaning each other's data (see [`GENESIS_ACTOR`]).
//!
//! Reputation and wizard profiles are deliberately **absent** (CLAUDE.md §7,
//! R-0004 AC6): they are computed from a signed event log, never synced.

use std::collections::BTreeMap;

use automerge::transaction::{CommitOptions, Transactable};
use automerge::{ActorId, AutoCommit, ObjId, ObjType, ReadDoc, ScalarValue, Value, ROOT};

use mp_domain::{
    Bridge, KnowledgeGraph, PlateauNode, Resource, ResourceState, CRYSTALLIZE_THRESHOLD,
};
use uuid::Uuid;

use crate::error::CrdtError;
use crate::vote::ResourceVote;

pub(crate) const PLATEAUS: &str = "plateaus";
pub(crate) const BRIDGES: &str = "bridges";
pub(crate) const RESOURCES: &str = "resources";
pub(crate) const VOTES: &str = "votes";

/// The four top-level data maps — and nothing else (R-0004 AC6).
pub(crate) const ROOT_KEYS: [&str; 4] = [PLATEAUS, BRIDGES, RESOURCES, VOTES];

/// Fixed actor id for the *genesis* change that creates the four root maps.
///
/// Every fresh replica builds the same genesis change (same actor, same ops,
/// time 0), so its hash — and the resulting root map object ids — are identical
/// across replicas. Without this, two independently-initialized documents would
/// each create a *different* `plateaus` map object at the root; merging them
/// would pick one as the winner and silently orphan the other's entries. The
/// shared genesis makes independent-bootstrap peers converge cleanly.
const GENESIS_ACTOR: [u8; 16] = [0xA1; 16];

/// A replica of the shareable knowledge-graph state.
pub struct CrdtDoc {
    pub(crate) doc: AutoCommit,
}

impl CrdtDoc {
    /// A fresh replica with the four empty root maps.
    ///
    /// The maps are created by a deterministic genesis change (see
    /// [`GENESIS_ACTOR`]); this replica then adopts a unique random actor for
    /// its own subsequent edits so its changes don't collide with a peer's.
    pub fn new() -> Result<Self, CrdtError> {
        let mut doc = AutoCommit::new();
        doc.set_actor(ActorId::from(GENESIS_ACTOR.as_slice()));
        for key in ROOT_KEYS {
            doc.put_object(ROOT, key, ObjType::Map)?;
        }
        // Seal the genesis as a change with a fixed timestamp so its hash is
        // identical on every replica, then switch to a per-replica actor.
        doc.commit_with(CommitOptions::default().with_time(0));
        doc.set_actor(ActorId::random());
        Ok(Self { doc })
    }

    // ── construction from / projection to a KnowledgeGraph ──────────────

    /// Hydrate a replica from a graph: every plateau, bridge and resource.
    pub fn from_graph(graph: &KnowledgeGraph) -> Result<Self, CrdtError> {
        let mut this = Self::new()?;
        for p in graph.plateaus() {
            this.add_plateau(p)?;
        }
        for b in graph.bridges() {
            this.add_bridge(b)?;
        }
        for r in graph.resources.values() {
            this.add_resource(r)?;
        }
        Ok(this)
    }

    /// Project the replica back into a `KnowledgeGraph`, re-validating every
    /// decoded entity's GA invariants (network/disk data is untrusted).
    ///
    /// Plateaus are inserted before bridges so bridge endpoints resolve. A
    /// resource's `vote_count` **and** `state` are recomputed from the
    /// authoritative `votes` map — the serialized blob's values are
    /// non-authoritative (SPEC-0004 §2.1). Crystallization is therefore derived
    /// on every projection, never trusted from a synced/persisted blob
    /// (CLAUDE.md §6, R-0015 AC3).
    pub fn to_graph(&self) -> Result<KnowledgeGraph, CrdtError> {
        let mut graph = KnowledgeGraph::new();

        for json in self.entries(PLATEAUS)? {
            let p: PlateauNode = serde_json::from_str(&json)?;
            p.validate()?;
            graph.add_plateau(p);
        }
        for json in self.entries(BRIDGES)? {
            let b: Bridge = serde_json::from_str(&json)?;
            b.validate()?;
            graph.add_bridge(b)?;
        }
        for json in self.entries(RESOURCES)? {
            let mut r: Resource = serde_json::from_str(&json)?;
            r.vote_count = self.resource_vote(&r.id)?.weighted_sum();
            // Crystallization is DERIVED from the votes, never stored
            // authoritatively (CLAUDE.md §6, R-0015 AC3). The persisted `state`
            // is only a placeholder; a blob that synced `Crystallized` with no
            // votes is ignored and recomputed from the tally here.
            r.state = if r.vote_count >= CRYSTALLIZE_THRESHOLD {
                ResourceState::Crystallized
            } else {
                ResourceState::Floating
            };
            graph.resources.insert(r.id, r);
        }

        Ok(graph)
    }

    // ── writers ─────────────────────────────────────────────────────────

    pub fn add_plateau(&mut self, p: &PlateauNode) -> Result<(), CrdtError> {
        self.put_entry(PLATEAUS, &p.id, &serde_json::to_string(p)?)
    }

    pub fn add_bridge(&mut self, b: &Bridge) -> Result<(), CrdtError> {
        self.put_entry(BRIDGES, &b.id, &serde_json::to_string(b)?)
    }

    pub fn add_resource(&mut self, r: &Resource) -> Result<(), CrdtError> {
        self.put_entry(RESOURCES, &r.id, &serde_json::to_string(r)?)
    }

    /// Record `wizard`'s vote on `resource` at `weight`, monotonically.
    ///
    /// Each vote is one cell `"<resource>/<wizard>/<actor>" -> f64` in the
    /// single, genesis-shared `votes` map, where `<actor>` is *this* replica's
    /// Automerge actor id. Keying by actor makes every cell **single-writer**:
    /// no two replicas ever write the same key, so concurrent votes can never
    /// collide into a last-writer-wins overwrite. The grow-only weight for a
    /// wizard is then the **max across that wizard's per-actor cells**, computed
    /// on read (see [`CrdtDoc::resource_vote`]) — concurrent same-wizard votes
    /// converge to the larger weight, and the local `max` keeps a single
    /// replica's own cell monotonic (SPEC-0004 §2.3).
    ///
    /// (A plain `"<resource>/<wizard>"` key would merge two concurrent puts as
    /// last-writer-wins by actor id, silently lowering a higher concurrent vote
    /// — the defect QA caught against AC3.)
    pub fn vote(&mut self, resource: Uuid, wizard: Uuid, weight: f32) -> Result<(), CrdtError> {
        let votes_map = self.map_id(VOTES)?;
        let actor = self.doc.get_actor().to_hex_string();
        let key = vote_key(resource, wizard, &actor);
        let existing = match self.doc.get(&votes_map, &key)? {
            Some((Value::Scalar(s), _)) => scalar_f64(&s)?,
            Some(_) => return Err(CrdtError::Malformed("vote cell is not a scalar".into())),
            None => f64::NEG_INFINITY,
        };
        let next = (weight as f64).max(existing);
        self.doc.put(&votes_map, &key, next)?;
        Ok(())
    }

    // ── readers ─────────────────────────────────────────────────────────

    pub fn plateau(&self, id: &Uuid) -> Result<Option<PlateauNode>, CrdtError> {
        self.read_entry(PLATEAUS, id)
    }

    pub fn bridge(&self, id: &Uuid) -> Result<Option<Bridge>, CrdtError> {
        self.read_entry(BRIDGES, id)
    }

    pub fn resource(&self, id: &Uuid) -> Result<Option<Resource>, CrdtError> {
        self.read_entry(RESOURCES, id)
    }

    /// The vote tally for `resource` (empty if the resource has no votes yet).
    ///
    /// A wizard's weight is the **max** over its per-actor cells, so concurrent
    /// votes converge to the larger weight without ever shrinking or dropping a
    /// voter (the grow-only guarantee, R-0004 AC3).
    pub fn resource_vote(&self, resource: &Uuid) -> Result<ResourceVote, CrdtError> {
        let votes_map = self.map_id(VOTES)?;
        let prefix = format!("{resource}/");

        let mut weights: BTreeMap<Uuid, f32> = BTreeMap::new();
        for key in self.doc.keys(&votes_map) {
            let Some(rest) = key.strip_prefix(&prefix) else {
                continue; // a cell for a different resource
            };
            // `rest` is "<wizard>/<actor>"; the wizard is the first segment.
            let wizard_str = rest.split('/').next().unwrap_or(rest);
            let wizard = Uuid::parse_str(wizard_str)
                .map_err(|e| CrdtError::Malformed(format!("bad wizard id {wizard_str}: {e}")))?;
            let weight = match self.doc.get(&votes_map, &key)? {
                Some((Value::Scalar(s), _)) => scalar_f64(&s)? as f32,
                _ => return Err(CrdtError::Malformed("vote cell is not a scalar".into())),
            };
            // Max across this wizard's per-actor cells.
            weights
                .entry(wizard)
                .and_modify(|w| *w = w.max(weight))
                .or_insert(weight);
        }
        Ok(ResourceVote::from_cells(weights))
    }

    /// The document's top-level keys, sorted — exactly the four data maps
    /// (R-0004 AC6).
    pub fn root_keys(&self) -> Vec<String> {
        let mut keys: Vec<String> = self.doc.keys(ROOT).collect();
        keys.sort();
        keys
    }

    // ── sync / persistence helpers ──────────────────────────────────────

    /// Merge another replica into this one (used by the redb cycle and tests).
    pub fn merge(&mut self, other: &mut CrdtDoc) -> Result<(), CrdtError> {
        self.doc.merge(&mut other.doc)?;
        Ok(())
    }

    /// Serialize the whole document to bytes.
    pub fn save(&mut self) -> Vec<u8> {
        self.doc.save()
    }

    /// Load a document from bytes produced by [`CrdtDoc::save`].
    pub fn load(bytes: &[u8]) -> Result<Self, CrdtError> {
        let doc = AutoCommit::load(bytes)?;
        Ok(Self { doc })
    }

    /// The current change heads — a stable convergence fingerprint. Two replicas
    /// that have seen the same changes share the same heads (SPEC-0004 §2.4).
    pub fn heads(&mut self) -> Vec<automerge::ChangeHash> {
        self.doc.get_heads()
    }

    // ── private plumbing ────────────────────────────────────────────────

    /// The `ObjId` of a top-level data map, or `Malformed` if it is missing.
    fn map_id(&self, key: &str) -> Result<ObjId, CrdtError> {
        match self.doc.get(ROOT, key)? {
            Some((Value::Object(ObjType::Map), id)) => Ok(id),
            _ => Err(CrdtError::Malformed(format!("missing root map {key}"))),
        }
    }

    fn put_entry(&mut self, map_key: &str, id: &Uuid, json: &str) -> Result<(), CrdtError> {
        let map = self.map_id(map_key)?;
        self.doc.put(&map, id.to_string(), json)?;
        Ok(())
    }

    fn read_entry<T: serde::de::DeserializeOwned>(
        &self,
        map_key: &str,
        id: &Uuid,
    ) -> Result<Option<T>, CrdtError> {
        let map = self.map_id(map_key)?;
        match self.doc.get(&map, id.to_string())? {
            Some((Value::Scalar(s), _)) => {
                let json = scalar_str(&s)?;
                Ok(Some(serde_json::from_str(&json)?))
            }
            Some(_) => Err(CrdtError::Malformed(format!(
                "{map_key} entry is not a string"
            ))),
            None => Ok(None),
        }
    }

    /// Every JSON-string value in a top-level data map.
    fn entries(&self, map_key: &str) -> Result<Vec<String>, CrdtError> {
        let map = self.map_id(map_key)?;
        let mut out = Vec::new();
        for key in self.doc.keys(&map) {
            match self.doc.get(&map, &key)? {
                Some((Value::Scalar(s), _)) => out.push(scalar_str(&s)?),
                _ => {
                    return Err(CrdtError::Malformed(format!(
                        "{map_key} entry is not a string"
                    )))
                }
            }
        }
        Ok(out)
    }
}

/// The flat `votes`-map key for one single-writer `(resource, wizard, actor)`
/// cell. UUIDs and the hex actor id never contain `/`, so the separators are
/// unambiguous.
fn vote_key(resource: Uuid, wizard: Uuid, actor: &str) -> String {
    format!("{resource}/{wizard}/{actor}")
}

/// Extract an owned `String` from a string scalar, else `Malformed`.
fn scalar_str(s: &ScalarValue) -> Result<String, CrdtError> {
    match s {
        ScalarValue::Str(smol) => Ok(smol.to_string()),
        other => Err(CrdtError::Malformed(format!(
            "expected string, got {other:?}"
        ))),
    }
}

/// Extract an `f64` from a numeric scalar, else `Malformed`.
fn scalar_f64(s: &ScalarValue) -> Result<f64, CrdtError> {
    match s {
        ScalarValue::F64(f) => Ok(*f),
        ScalarValue::Int(i) => Ok(*i as f64),
        ScalarValue::Uint(u) => Ok(*u as f64),
        other => Err(CrdtError::Malformed(format!(
            "expected number, got {other:?}"
        ))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mp_domain::Bridge;

    fn seed() -> KnowledgeGraph {
        let domain = Uuid::new_v4();
        let mut g = KnowledgeGraph::new();
        let a = PlateauNode::new("Linear Algebra", domain, 0.9, 0.1, 0.0);
        let b = PlateauNode::new("Differential Geometry", domain, 0.7, 0.5, 0.1);
        let bridge = Bridge::between(&a, &b, "tangent space", Uuid::nil());
        g.add_plateau(a);
        g.add_plateau(b);
        g.add_bridge(bridge).expect("seed bridge endpoints exist");
        g
    }

    #[test]
    fn new_doc_has_exactly_the_four_maps() {
        let doc = CrdtDoc::new().expect("new");
        assert_eq!(
            doc.root_keys(),
            vec!["bridges", "plateaus", "resources", "votes"]
        );
    }

    #[test]
    fn add_then_read_plateau_round_trips_and_validates() {
        let mut doc = CrdtDoc::new().expect("new");
        let domain = Uuid::new_v4();
        let p = PlateauNode::new("Topology", domain, 0.6, 0.3, 0.2);
        doc.add_plateau(&p).expect("add");

        let back = doc.plateau(&p.id).expect("read").expect("present");
        assert_eq!(back.id, p.id);
        assert_eq!(back.name, "Topology");
        assert_eq!(back.position().coeffs, p.position().coeffs);
        back.validate().expect("grade-1 invariant survives");

        assert!(doc.plateau(&Uuid::new_v4()).expect("read").is_none());
    }

    #[test]
    fn from_graph_to_graph_preserves_plateaus_and_bridges() {
        let original = seed();
        let doc = CrdtDoc::from_graph(&original).expect("hydrate");
        let back = doc.to_graph().expect("project");

        assert_eq!(back.plateau_count(), original.plateau_count());
        assert_eq!(back.bridge_count(), original.bridge_count());

        for p in original.plateaus() {
            let bp = back.plateau(&p.id).expect("plateau present");
            assert_eq!(bp.name, p.name);
            assert_eq!(bp.position().coeffs, p.position().coeffs);
            bp.validate().expect("invariant intact");
        }
        let ob = original.bridges().next().expect("orig bridge");
        let bb = back.bridges().next().expect("back bridge");
        assert_eq!(bb.id, ob.id);
        assert_eq!(bb.from, ob.from);
        assert_eq!(bb.to, ob.to);
        assert_eq!(bb.rotor().coeffs, ob.rotor().coeffs);
        bb.validate().expect("even-grade invariant intact");
    }

    #[test]
    fn votes_accumulate_and_are_monotonic() {
        let mut doc = CrdtDoc::new().expect("new");
        let resource = Uuid::new_v4();
        let (a, b) = (Uuid::new_v4(), Uuid::new_v4());

        doc.vote(resource, a, 2.0).expect("vote a");
        doc.vote(resource, b, 3.0).expect("vote b");
        doc.vote(resource, a, 5.0).expect("raise a");
        doc.vote(resource, a, 1.0).expect("lower a is a no-op");

        let tally = doc.resource_vote(&resource).expect("tally");
        assert_eq!(tally.voters(), 2);
        assert_eq!(tally.weight_of(&a), 5.0);
        assert_eq!(tally.weight_of(&b), 3.0);
        assert_eq!(tally.weighted_sum(), 8.0);

        // An unknown resource has an empty tally, not an error.
        assert_eq!(
            doc.resource_vote(&Uuid::new_v4()).expect("empty").voters(),
            0
        );
    }

    #[test]
    fn resource_state_is_derived_from_votes_not_the_blob() {
        // R-0015 AC3: crystallization is computed from the votes tally in
        // to_graph, never trusted from the stored/synced blob.
        let mut doc = CrdtDoc::new().expect("new");

        // A resource whose STORED state lies (Crystallized) but has zero votes.
        let mut r = Resource::new(
            Uuid::new_v4(),
            "spectral theorem",
            mp_domain::ResourceKind::Note,
            "",
            Uuid::nil(),
        );
        r.state = ResourceState::Crystallized; // the lie
        let rid = r.id;
        doc.add_resource(&r).expect("add");

        // Projected with zero votes → Floating, regardless of the blob.
        let g = doc.to_graph().expect("project");
        assert!(
            matches!(g.resources[&rid].state, ResourceState::Floating),
            "zero votes must project as Floating even if the blob says Crystallized"
        );

        // Distinct wizards push the weighted sum to/over the threshold.
        let per = CRYSTALLIZE_THRESHOLD / 2.0 + 1.0; // two voters clear it
        doc.vote(rid, Uuid::new_v4(), per).expect("vote 1");
        doc.vote(rid, Uuid::new_v4(), per).expect("vote 2");

        let g = doc.to_graph().expect("project");
        assert!(
            g.resources[&rid].vote_count >= CRYSTALLIZE_THRESHOLD,
            "weighted sum crosses the threshold"
        );
        assert!(
            matches!(g.resources[&rid].state, ResourceState::Crystallized),
            "crossing the threshold projects as Crystallized"
        );
    }

    #[test]
    fn malformed_plateau_blob_is_an_error_not_a_panic() {
        let mut doc = CrdtDoc::new().expect("new");
        // Write a non-JSON string directly into the plateaus map.
        let map = doc.map_id(PLATEAUS).expect("map");
        let id = Uuid::new_v4();
        doc.doc.put(&map, id.to_string(), "not json").expect("put");
        // `KnowledgeGraph` is not `Debug`, so match rather than `unwrap_err`.
        match doc.to_graph() {
            Err(CrdtError::Json(_)) => {}
            Err(other) => panic!("expected Json error, got {other:?}"),
            Ok(_) => panic!("expected a Json error, got Ok"),
        }
    }

    #[test]
    fn crate_does_not_depend_on_mp_reputation() {
        // AC6 / CLAUDE.md §7: reputation is never in the CRDT, so the crate must
        // not even link mp-reputation. Assert it programmatically against the
        // manifest rather than trusting review.
        let manifest = include_str!("../Cargo.toml");
        assert!(
            !manifest.contains("mp-reputation"),
            "mp-crdt must not depend on mp-reputation (CLAUDE.md §7)"
        );
    }

    #[test]
    fn save_load_round_trips() {
        let mut doc = CrdtDoc::from_graph(&seed()).expect("hydrate");
        let bytes = doc.save();
        let mut loaded = CrdtDoc::load(&bytes).expect("load");
        assert_eq!(loaded.heads(), doc.heads());
        assert_eq!(loaded.root_keys(), doc.root_keys());
    }
}
