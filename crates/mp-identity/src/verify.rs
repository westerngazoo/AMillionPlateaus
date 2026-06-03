//! The single trust gate (R-0010 AC2).
//!
//! An event is trustworthy iff (1) its `id` equals the recomputed SHA-256 of the
//! canonical serialization (self-consistency — content/pubkey/kind/tags/time
//! cannot be altered without breaking the id) and (2) its `sig` is a valid
//! BIP340 Schnorr signature by `pubkey` over the raw id bytes. Every failure
//! mode — bad hex, wrong length, bad curve point, mismatched id — collapses to
//! `false`: an unverified event contributes nothing to reputation, lighting, or
//! discovery.

use k256::schnorr::{Signature, VerifyingKey};

use crate::event::{event_id, NostrEvent};

/// Verify an event's id self-consistency and BIP340 signature. See module docs.
pub fn verify(ev: &NostrEvent) -> bool {
    // 1. id self-consistency: recompute it from the (claimed) fields.
    let Ok(recomputed) = event_id(&ev.pubkey, ev.created_at, ev.kind, &ev.tags, &ev.content) else {
        return false;
    };
    if recomputed != ev.id {
        return false;
    }

    // 2. signature over the raw id bytes by the claimed pubkey.
    let (Ok(pk_bytes), Ok(id_bytes), Ok(sig_bytes)) = (
        hex::decode(&ev.pubkey),
        hex::decode(&ev.id),
        hex::decode(&ev.sig),
    ) else {
        return false;
    };
    let Ok(vk) = VerifyingKey::from_bytes(pk_bytes.as_slice()) else {
        return false;
    };
    let Ok(sig) = Signature::try_from(sig_bytes.as_slice()) else {
        return false;
    };
    vk.verify_raw(&id_bytes, &sig).is_ok()
}
