use std::fs;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

#[tauri::command]
fn generate_zatca_csr(private_key_pem: String, csr_config: String) -> Result<String, String> {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_nanos();
    let temp_dir = std::env::temp_dir();
    let key_path = temp_dir.join(format!("portal-pos-zatca-{nanos}.pem"));
    let config_path = temp_dir.join(format!("portal-pos-zatca-{nanos}.cnf"));

    fs::write(&key_path, private_key_pem.trim()).map_err(|e| e.to_string())?;
    fs::write(&config_path, csr_config).map_err(|e| e.to_string())?;

    let output = Command::new("openssl")
        .args([
            "req",
            "-new",
            "-sha256",
            "-key",
            key_path.to_str().ok_or("Invalid temp key path")?,
            "-config",
            config_path.to_str().ok_or("Invalid temp config path")?,
            "-extensions",
            "v3_req",
        ])
        .output()
        .map_err(|e| {
            format!(
                "OpenSSL is required to generate the CSR. Install OpenSSL and try again. ({e})"
            )
        })?;

    let _ = fs::remove_file(&key_path);
    let _ = fs::remove_file(&config_path);

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let marker = "-----BEGIN CERTIFICATE REQUEST-----";
    let idx = stdout
        .find(marker)
        .ok_or("OpenSSL did not return a certificate signing request.")?;

    Ok(stdout[idx..].trim().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![generate_zatca_csr])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
