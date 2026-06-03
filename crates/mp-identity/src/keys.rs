//! `Keypair` — a BIP340 Schnorr keypair (the Nostr event-signing scheme).
//!
//! The secret scalar lives only inside the value. `secret_hex` exposes it for
//! **local** persistence (one browser's `localStorage`, mirroring the model
//! config) and nothing else: it is never synced, relayed, placed in a URL, or
//! logged (R-0010 AC1, CLAUDE.md §7). The x-only public key is the stable
//! wizard id.

use k256::schnorr::SigningKey;

use crate::error::IdError;

/// A BIP340 Schnorr keypair over secp256k1.
pub struct Keypair {
    signing: SigningKey,
}

impl Keypair {
    /// Mint a fresh keypair from OS/browser entropy (`getrandom`).
    pub fn generate() -> Self {
        loop {
            let mut bytes = [0u8; 32];
            // SAFETY: a CSPRNG failure is unrecoverable — there is no meaningful
            // keypair to hand back without entropy, so we surface it as a panic
            // rather than silently mint a weak key. In a browser `getrandom`'s
            // `js` feature backs this with `crypto.getRandomValues`.
            getrandom::getrandom(&mut bytes).expect("CSPRNG (getrandom) unavailable");
            // Astronomically rare: the draw was 0 or ≥ the curve order. Retry.
            if let Ok(signing) = SigningKey::from_bytes(&bytes) {
                return Self { signing };
            }
        }
    }

    /// Rebuild a keypair from a 32-byte secret hex (local persistence only).
    pub fn from_secret_hex(secret_hex: &str) -> Result<Self, IdError> {
        let bytes = hex::decode(secret_hex).map_err(|e| IdError::Hex(e.to_string()))?;
        let signing = SigningKey::from_bytes(&bytes).map_err(|e| IdError::Key(e.to_string()))?;
        Ok(Self { signing })
    }

    /// The secret key as 32-byte lowercase hex. **Local persistence only** —
    /// never synced, relayed, or logged.
    pub fn secret_hex(&self) -> String {
        hex::encode(self.signing.to_bytes())
    }

    /// The x-only public key as 32-byte lowercase hex — the stable wizard id.
    pub fn pubkey_hex(&self) -> String {
        hex::encode(self.signing.verifying_key().to_bytes())
    }

    /// Sign a message hash (the 32-byte Nostr event id) with BIP340 Schnorr,
    /// returning the 64-byte signature as lowercase hex.
    ///
    /// Uses zero `aux_rand`: a valid, secure BIP340 mode (the nonce derivation
    /// still folds in the secret key) that also makes signing deterministic.
    pub(crate) fn sign_hash(&self, hash: &[u8]) -> Result<String, IdError> {
        let sig = self
            .signing
            .sign_raw(hash, &[0u8; 32])
            .map_err(|e| IdError::Sig(e.to_string()))?;
        Ok(hex::encode(sig.to_bytes()))
    }
}
