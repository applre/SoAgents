//! Install the OpenClaw plugin-sdk shim into a plugin's node_modules.
//!
//! OpenClaw plugins `import { X } from 'openclaw/plugin-sdk/...'` to access
//! channel / tool / command registration helpers. The upstream `openclaw`
//! npm package pulls ~400 transitive dependencies (larksuite-sdk,
//! playwright-core, aws-sdk, etc.) — far too heavy for a desktop bundle.
//!
//! Instead we ship a lightweight **shim** at
//! `src/server/plugin-bridge/sdk-shim/` that matches the openclaw export
//! surface. After `npm install` puts real bytes in
//! `node_modules/openclaw/`, this module overwrites that directory with our
//! shim. `--omit=peer` (applied in `npm_runner`) prevents npm from
//! auto-installing the real openclaw as a peer dep.
//!
//! Ordering matters: the shim install runs as the **last** step of plugin
//! installation so lockfile reconciliation can't overwrite it.

use std::path::{Path, PathBuf};

/// Locate the sdk-shim source directory.
/// - **Production**: `<resource_dir>/plugin-bridge-sdk-shim/`
/// - **Development**: `<workspace>/src/server/plugin-bridge/sdk-shim/`
pub fn find_sdk_shim_dir<R: tauri::Runtime>(
    app_handle: &tauri::AppHandle<R>,
) -> Option<PathBuf> {
    // Production: bundled in resources
    #[cfg(not(debug_assertions))]
    {
        use tauri::Manager;
        if let Ok(resource_dir) = app_handle.path().resource_dir() {
            let bundled = resource_dir.join("plugin-bridge-sdk-shim");
            if bundled.exists() {
                return Some(bundled);
            }
        }
    }

    // Development: source tree. CARGO_MANIFEST_DIR = src-tauri/, so parent is repo root.
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let project_root = Path::new(manifest_dir)
        .parent()
        .unwrap_or(Path::new("."));
    let dev_path = project_root.join("src/server/plugin-bridge/sdk-shim");
    if dev_path.exists() {
        return Some(dev_path);
    }

    let _ = app_handle;
    None
}

/// Recursively copy `src` → `dst`. Overwrites files, creates dirs as needed.
pub async fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    tokio::fs::create_dir_all(dst)
        .await
        .map_err(|e| format!("create_dir_all {:?}: {}", dst, e))?;

    let mut entries = tokio::fs::read_dir(src)
        .await
        .map_err(|e| format!("read_dir {:?}: {}", src, e))?;

    while let Some(entry) = entries
        .next_entry()
        .await
        .map_err(|e| format!("read_dir entry in {:?}: {}", src, e))?
    {
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        let file_type = entry
            .file_type()
            .await
            .map_err(|e| format!("file_type for {:?}: {}", src_path, e))?;

        if file_type.is_dir() {
            Box::pin(copy_dir_recursive(&src_path, &dst_path)).await?;
        } else {
            tokio::fs::copy(&src_path, &dst_path)
                .await
                .map_err(|e| format!("copy {:?} → {:?}: {}", src_path, dst_path, e))?;
        }
    }

    Ok(())
}

/// Overwrite `<plugin_dir>/node_modules/openclaw/` with the bundled shim.
///
/// Call this after `npm install` / `bun add` has finished. Lockfile
/// reconciliation may have placed real openclaw bytes there; we replace
/// them with our shim to avoid pulling hundreds of heavy dependencies.
pub async fn install_sdk_shim<R: tauri::Runtime>(
    app_handle: &tauri::AppHandle<R>,
    plugin_dir: &Path,
) -> Result<(), String> {
    let shim_src = find_sdk_shim_dir(app_handle)
        .ok_or_else(|| "SDK shim source directory not found".to_string())?;

    let shim_dst = plugin_dir.join("node_modules").join("openclaw");

    // Wipe whatever's there so we don't mix shim with real openclaw remnants.
    if shim_dst.exists() {
        let _ = tokio::fs::remove_dir_all(&shim_dst).await;
    }

    copy_dir_recursive(&shim_src, &shim_dst).await?;

    log::info!(
        "[openclaw] SDK shim installed from {:?} → {:?}",
        shim_src,
        shim_dst
    );

    // Optional: make @larksuiteoapi/node-sdk happy under Bun.
    // Bun's default axios HTTP adapter hangs on socket close; we swap in
    // a fetch-based adapter via source patch. No-op if the plugin doesn't
    // use @larksuiteoapi/node-sdk.
    patch_lark_sdk_for_bun(plugin_dir).await;

    Ok(())
}

/// Patch `@larksuiteoapi/node-sdk`'s `defaultHttpInstance` to use a
/// fetch-based axios adapter. Bun's default node-http adapter exhibits a
/// 30s hang on socket close with the Lark SDK; fetch adapter finishes in
/// ~250 ms. No-op if the plugin doesn't ship @larksuiteoapi/node-sdk or if
/// the file doesn't match the expected signature.
async fn patch_lark_sdk_for_bun(plugin_dir: &Path) {
    let sdk_file = plugin_dir
        .join("node_modules")
        .join("@larksuiteoapi")
        .join("node-sdk")
        .join("lib")
        .join("index.js");

    if !sdk_file.exists() {
        return;
    }

    let Ok(code) = tokio::fs::read_to_string(&sdk_file).await else {
        return;
    };

    let target = r#"const defaultHttpInstance = axios__default["default"].create();"#;
    if !code.contains(target) {
        return; // Already patched or different SDK version.
    }

    // Minimal fetch-based adapter replacing axios's Node http adapter.
    let adapter = concat!(
        "function bunFetchAdapter(c){return new Promise(async(r,j)=>{try{",
        "let u=c.baseURL?c.baseURL+c.url:c.url;",
        "let h={};if(c.headers)for(let[k,v]of Object.entries(c.headers))if(v!=null)h[k]=String(v);",
        "if(c.params){let q=new URLSearchParams();for(let[k,v]of Object.entries(c.params)){",
        "if(Array.isArray(v))v.forEach(i=>q.append(k,String(i)));",
        "else if(v!=null)q.append(k,String(v))}",
        "let s=q.toString();if(s)u+=(u.includes('?')?'&':'?')+s}",
        "let m=(c.method||'get').toUpperCase();",
        "let opts={method:m,headers:h};",
        "if(c.data&&m!=='GET'&&m!=='HEAD'&&m!=='OPTIONS'){",
        "opts.body=typeof c.data==='string'?c.data:JSON.stringify(c.data)}",
        "let resp=await fetch(u,opts);",
        "let d;try{d=await resp.json()}catch{d=await resp.text()}",
        "r({data:d,status:resp.status,statusText:resp.statusText,",
        "headers:Object.fromEntries(resp.headers.entries()),config:c,request:{}})",
        "}catch(e){j(e)}})}",
    );

    let replacement = format!(
        "{}; const defaultHttpInstance = axios__default[\"default\"].create({{adapter: bunFetchAdapter}});",
        adapter
    );

    let patched = code.replace(target, &replacement);
    if let Err(e) = tokio::fs::write(&sdk_file, patched).await {
        log::warn!("[openclaw] failed to patch Lark SDK for Bun: {}", e);
    } else {
        log::info!("[openclaw] patched @larksuiteoapi/node-sdk with fetch adapter");
    }
}
