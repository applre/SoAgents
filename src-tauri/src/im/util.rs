// Shared IM utilities (used by IM adapters)

/// Map MIME type to file extension.
pub(super) fn mime_to_ext(mime: &str) -> &str {
    match mime {
        "audio/ogg" => "ogg",
        "audio/mpeg" => "mp3",
        "audio/mp4" | "audio/m4a" => "m4a",
        "video/mp4" => "mp4",
        "video/quicktime" => "mov",
        "image/jpeg" => "jpg",
        "image/png" => "png",
        "image/gif" => "gif",
        "image/webp" => "webp",
        "image/bmp" => "bmp",
        "application/pdf" => "pdf",
        _ => {
            // Handle mime types with parameters (e.g. "audio/ogg; codecs=opus")
            if mime.starts_with("audio/ogg") {
                "ogg"
            } else if mime.starts_with("image/") {
                // Best-effort: extract subtype as extension
                mime.strip_prefix("image/")
                    .and_then(|s| s.split(';').next())
                    .unwrap_or("bin")
            } else {
                "bin"
            }
        }
    }
}

/// Map file extension to MIME type (reverse of mime_to_ext).
pub(super) fn ext_to_mime(filename: &str) -> &str {
    let ext = filename.rsplit('.').next().unwrap_or("").to_ascii_lowercase();
    match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "svg" => "image/svg+xml",
        "mp4" => "video/mp4",
        "mov" => "video/quicktime",
        "mp3" => "audio/mpeg",
        "ogg" => "audio/ogg",
        "m4a" => "audio/m4a",
        "pdf" => "application/pdf",
        _ => "application/octet-stream",
    }
}

/// Sanitize a filename to prevent path traversal attacks.
/// Strips path separators, `.` and `..` components, and null bytes.
pub(super) fn sanitize_filename(name: &str) -> String {
    // Take only the last path component (strip any directory traversal)
    let base = name.rsplit(['/', '\\']).next().unwrap_or("file");
    // Remove null bytes and leading dots (prevent hidden files / `.` / `..`)
    let cleaned: String = base.chars().filter(|c| *c != '\0').collect();
    let cleaned = cleaned.trim_start_matches('.');
    if cleaned.is_empty() {
        "file".to_string()
    } else {
        cleaned.to_string()
    }
}
