//! Centralized child-process utilities for GUI applications.
//!
//! **All** child processes spawned from the app SHOULD use `process_cmd::new()`
//! instead of raw `std::process::Command::new()`. This guarantees
//! `CREATE_NO_WINDOW` (0x08000000) is set on Windows, preventing a console
//! window from flashing when spawning background tools (bun sidecar, bun add,
//! npm install, etc.).
//!
//! On macOS/Linux the returned `Command` is identical to the stdlib one.
//!
//! ## Usage
//!
//! ```rust,ignore
//! use crate::process_cmd;
//!
//! let mut cmd = process_cmd::new("bun");
//! cmd.arg("run").arg("script.ts");
//! let child = cmd.spawn()?;
//! ```

use std::ffi::OsStr;
use std::process::Command;

/// Create a new [`Command`] with platform-specific GUI flags applied.
///
/// On Windows: sets `CREATE_NO_WINDOW` (0x08000000) so the spawned process
/// does not flash a console window.
///
/// On other platforms: equivalent to `Command::new(program)`.
pub fn new<S: AsRef<OsStr>>(program: S) -> Command {
    #[allow(unused_mut)] // mut needed on Windows for creation_flags()
    let mut cmd = Command::new(program);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    cmd
}
