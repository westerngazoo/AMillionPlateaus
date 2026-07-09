//! mp-host CLI — a thin dispatcher over the `mp_host` library (SPEC-0017).
//! `main` returns `Box<dyn Error>` so every fallible path (CrdtError, snapshot
//! I/O) surfaces as a message + non-zero exit, never a panic (CLAUDE.md §5).
//!
//!   mp-host seed   <db.redb>
//!   mp-host stats  <db.redb>
//!   mp-host merge  <db.redb> <snapshot.bin>
//!   mp-host import <vault-dir> <out.bin>

use std::error::Error;
use std::path::Path;
use std::process::exit;

fn main() {
    if let Err(e) = run() {
        eprintln!("error: {e}");
        exit(1);
    }
}

fn run() -> Result<(), Box<dyn Error>> {
    let args: Vec<String> = std::env::args().collect();
    match args.get(1).map(String::as_str) {
        Some("seed") if args.len() == 3 => {
            mp_host::seed(Path::new(&args[2]))?;
            println!("seeded {}", &args[2]);
        }
        Some("stats") if args.len() == 3 => {
            let s = mp_host::stats(Path::new(&args[2]))?;
            println!(
                "{} plateaus · {} bridges · {} resources ({} voted, {} crystallized)",
                s.plateaus, s.bridges, s.resources, s.voted, s.crystallized
            );
        }
        Some("merge") if args.len() == 4 => {
            let bytes = std::fs::read(&args[3])?; // io::Error → Box<dyn Error>
            mp_host::merge(Path::new(&args[2]), &bytes)?;
            println!("merged {} into {}", args[3], args[2]);
        }
        Some("import") if args.len() == 4 => {
            // import <vault-dir> <out.bin> → a browser-loadable CrdtDoc save-blob.
            let s = mp_host::import(Path::new(&args[2]), Path::new(&args[3]))?;
            println!(
                "imported {} → {} ({} notes · {} bridges · {} resources)",
                args[2], args[3], s.notes, s.bridges, s.resources
            );
        }
        _ => {
            eprintln!(
                "usage: mp-host <seed|stats|merge|import> <db.redb|vault-dir> [snapshot|out.bin]"
            );
            exit(2);
        }
    }
    Ok(())
}
