use std::collections::HashMap;
use std::fs;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use base64::Engine;
use lettre::message::header::ContentType;
use lettre::message::{Attachment, Message, MultiPart, SinglePart};
use lettre::transport::smtp::authentication::Credentials;
use lettre::Transport;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ZatcaHttpResponse {
    pub status: u16,
    pub body: String,
}

fn resolve_openssl_bin() -> Result<String, String> {
    if let Ok(custom) = std::env::var("OPENSSL_BIN") {
        let trimmed = custom.trim();
        if !trimmed.is_empty() {
            return Ok(trimmed.to_string());
        }
    }

    const CANDIDATES: &[&str] = &[
        "openssl",
        "/opt/homebrew/bin/openssl",
        "/usr/local/bin/openssl",
        "/usr/bin/openssl",
    ];

    for bin in CANDIDATES {
        let ok = Command::new(bin)
            .arg("version")
            .output()
            .map(|output| output.status.success())
            .unwrap_or(false);
        if ok {
            return Ok(bin.to_string());
        }
    }

    Err(
        "OpenSSL not found on this Mac. Install it with: brew install openssl — then restart the app."
            .to_string(),
    )
}

#[tauri::command]
fn generate_zatca_csr(private_key_pem: String, csr_config: String) -> Result<String, String> {
    let openssl_bin = resolve_openssl_bin()?;
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_nanos();
    let temp_dir = std::env::temp_dir();
    let key_path = temp_dir.join(format!("dukkan-pos-zatca-{nanos}.pem"));
    let config_path = temp_dir.join(format!("dukkan-pos-zatca-{nanos}.cnf"));

    fs::write(&key_path, private_key_pem.trim()).map_err(|e| e.to_string())?;
    fs::write(&config_path, csr_config).map_err(|e| e.to_string())?;

    let output = Command::new(&openssl_bin)
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

#[tauri::command]
async fn zatca_http_request(
    method: String,
    url: String,
    headers: HashMap<String, String>,
    body: Option<String>,
) -> Result<ZatcaHttpResponse, String> {
    let client = reqwest::Client::new();
    let method_upper = method.to_uppercase();

    let mut request = match method_upper.as_str() {
        "GET" => client.get(&url),
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "PATCH" => client.patch(&url),
        "DELETE" => client.delete(&url),
        _ => return Err(format!("Unsupported HTTP method: {method}")),
    };

    for (key, value) in headers {
        request = request.header(key, value);
    }

    if let Some(payload) = body {
        request = request.body(payload);
    }

    let response = request.send().await.map_err(|e| e.to_string())?;
    let status = response.status().as_u16();
    let body = response.text().await.map_err(|e| e.to_string())?;

    Ok(ZatcaHttpResponse { status, body })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ZatcaCertValidation {
    pub not_expired: bool,
    pub not_before: Option<String>,
    pub not_after: Option<String>,
    pub key_matches: bool,
}

fn wrap_base64_pem(base64_body: &str, label: &str) -> String {
    let cleaned: String = base64_body.chars().filter(|c| !c.is_whitespace()).collect();
    let mut lines = Vec::new();
    for chunk in cleaned.as_bytes().chunks(64) {
        lines.push(String::from_utf8_lossy(chunk).into_owned());
    }
    format!(
        "-----BEGIN {}-----\n{}\n-----END {}-----\n",
        label,
        lines.join("\n"),
        label
    )
}

fn openssl_x509_readable(path: &std::path::Path) -> bool {
    Command::new("openssl")
        .args(["x509", "-noout", "-in"])
        .arg(path)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Normalize ZATCA certificate input to a readable X.509 PEM file.
fn prepare_x509_cert_pem(input: &str, cert_path: &std::path::Path) -> Result<(), String> {
    let trimmed = input.trim();

    // 1) Already valid PEM X.509
    if trimmed.contains("BEGIN CERTIFICATE") {
        fs::write(cert_path, trimmed).map_err(|e| e.to_string())?;
        if openssl_x509_readable(cert_path) {
            return Ok(());
        }
        // PEM headers present but body may be wrongly stored outer token — re-normalize below
    }

    let mut candidates: Vec<String> = Vec::new();

    if trimmed.contains("BEGIN CERTIFICATE") {
        let body: String = trimmed
            .replace("-----BEGIN CERTIFICATE-----", "")
            .replace("-----END CERTIFICATE-----", "")
            .chars()
            .filter(|c| !c.is_whitespace())
            .collect();
        if !body.is_empty() {
            candidates.push(body);
        }
    } else {
        let body: String = trimmed.chars().filter(|c| !c.is_whitespace()).collect();
        if !body.is_empty() {
            candidates.push(body);
        }
    }

    for base64_body in candidates {
        // ZATCA binarySecurityToken: base64 decode once → inner MIIC… PEM body
        if let Ok(decoded) = base64::engine::general_purpose::STANDARD.decode(&base64_body) {
            if let Ok(decoded_text) = String::from_utf8(decoded.clone()) {
                let inner = decoded_text.replace(char::is_whitespace, "");
                if inner.starts_with("MII") {
                    let pem = wrap_base64_pem(&inner, "CERTIFICATE");
                    fs::write(cert_path, &pem).map_err(|e| e.to_string())?;
                    if openssl_x509_readable(cert_path) {
                        return Ok(());
                    }
                }
                if decoded_text.contains("BEGIN CERTIFICATE") {
                    fs::write(cert_path, decoded_text.trim()).map_err(|e| e.to_string())?;
                    if openssl_x509_readable(cert_path) {
                        return Ok(());
                    }
                }
            }

            // Raw DER bytes
            let der_path = cert_path.with_extension("der");
            if fs::write(&der_path, &decoded).is_ok() {
                let output = Command::new("openssl")
                    .args([
                        "x509",
                        "-inform",
                        "DER",
                        "-in",
                        der_path.to_str().ok_or("Invalid der path")?,
                        "-out",
                        cert_path.to_str().ok_or("Invalid cert path")?,
                    ])
                    .output();
                let _ = fs::remove_file(&der_path);
                if let Ok(out) = output {
                    if out.status.success() && openssl_x509_readable(cert_path) {
                        return Ok(());
                    }
                }
            }
        }

        // Inner MIIC… body without outer decode
        if base64_body.starts_with("MII") {
            let pem = wrap_base64_pem(&base64_body, "CERTIFICATE");
            fs::write(cert_path, &pem).map_err(|e| e.to_string())?;
            if openssl_x509_readable(cert_path) {
                return Ok(());
            }
        }

        // Legacy: wrap outer token directly (old bug — unlikely to work)
        let pem = wrap_base64_pem(&base64_body, "CERTIFICATE");
        fs::write(cert_path, &pem).map_err(|e| e.to_string())?;
        if openssl_x509_readable(cert_path) {
            return Ok(());
        }
    }

    Err(
        "Could not parse certificate. Re-run Compliance CSID to refresh the binarySecurityToken."
            .to_string(),
    )
}

fn compare_public_keys(cert_path: &std::path::Path, key_path: &std::path::Path) -> bool {
    let cert_pub = Command::new("openssl")
        .args(["x509", "-in"])
        .arg(cert_path)
        .args(["-pubkey", "-noout"])
        .output();

    let key_pub = Command::new("openssl")
        .args(["pkey", "-in"])
        .arg(key_path)
        .args(["-pubout"])
        .output();

    match (cert_pub, key_pub) {
        (Ok(cert), Ok(key)) if cert.status.success() && key.status.success() => {
            cert.stdout == key.stdout
        }
        _ => false,
    }
}

#[tauri::command]
fn validate_zatca_certificate(
    certificate_pem: String,
    private_key_pem: String,
) -> Result<ZatcaCertValidation, String> {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_nanos();
    let temp_dir = std::env::temp_dir();
    let cert_path = temp_dir.join(format!("dukkan-pos-cert-{nanos}.pem"));
    let key_path = temp_dir.join(format!("dukkan-pos-key-{nanos}.pem"));

    prepare_x509_cert_pem(&certificate_pem, &cert_path)?;
    fs::write(&key_path, private_key_pem.trim()).map_err(|e| e.to_string())?;

    let dates_output = Command::new("openssl")
        .args([
            "x509",
            "-noout",
            "-dates",
            "-in",
            cert_path.to_str().ok_or("Invalid cert path")?,
        ])
        .output()
        .map_err(|e| format!("OpenSSL required for certificate validation. ({e})"))?;

    if !dates_output.status.success() {
        let _ = fs::remove_file(&cert_path);
        let _ = fs::remove_file(&key_path);
        return Err(String::from_utf8_lossy(&dates_output.stderr).trim().to_string());
    }

    let not_expired = Command::new("openssl")
        .args([
            "x509",
            "-checkend",
            "0",
            "-noout",
            "-in",
            cert_path.to_str().ok_or("Invalid cert path")?,
        ])
        .status()
        .map(|s| s.success())
        .unwrap_or(true);

    let dates_str = String::from_utf8_lossy(&dates_output.stdout);
    let mut not_before = None;
    let mut not_after = None;
    for line in dates_str.lines() {
        if let Some(val) = line.strip_prefix("notBefore=") {
            not_before = Some(val.trim().to_string());
        }
        if let Some(val) = line.strip_prefix("notAfter=") {
            not_after = Some(val.trim().to_string());
        }
    }

    let key_matches = compare_public_keys(&cert_path, &key_path);

    let _ = fs::remove_file(&cert_path);
    let _ = fs::remove_file(&key_path);

    Ok(ZatcaCertValidation {
        not_expired,
        not_before,
        not_after,
        key_matches,
    })
}

fn run_sign_script(
    project_root: &std::path::Path,
    script: &std::path::Path,
    input_path: &std::path::Path,
) -> Result<std::process::Output, String> {
    // Node.js must run before Bun: Bun's OpenSSL bindings reject secp256k1 EC PRIVATE KEY PEM
    // from our key generator, while Node signs correctly (zatca-xml-js requirement).
    for runner in ["node", "bun"] {
        match Command::new(runner)
            .arg(script)
            .arg(input_path)
            .current_dir(project_root)
            .output()
        {
            Ok(output) => return Ok(output),
            Err(_) => continue,
        }
    }
    Err(
        "Node.js is required for ZATCA invoice signing. Install Node.js (nodejs.org) or ensure it is on PATH."
            .to_string(),
    )
}

#[tauri::command]
fn sign_zatca_invoice(input_json: String) -> Result<String, String> {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_nanos();
    let temp_dir = std::env::temp_dir();
    let input_path = temp_dir.join(format!("zatca-sign-in-{nanos}.json"));
    let output_path = temp_dir.join(format!("zatca-sign-out-{nanos}.json"));

    let mut input: serde_json::Value =
        serde_json::from_str(&input_json).map_err(|e| format!("Invalid signing input: {e}"))?;
    if let Some(obj) = input.as_object_mut() {
        obj.insert(
            "output_path".to_string(),
            serde_json::Value::String(output_path.to_string_lossy().into_owned()),
        );
    }

    fs::write(
        &input_path,
        serde_json::to_string(&input).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;

    let manifest_dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
    let project_root = manifest_dir
        .parent()
        .ok_or("Could not resolve project root for signing script.")?;
    let script = project_root.join("scripts/sign-zatca-invoice.mjs");

    if !script.exists() {
        let _ = fs::remove_file(&input_path);
        return Err(format!(
            "Signing script not found at {}. Reinstall the application.",
            script.display()
        ));
    }

    let output = run_sign_script(project_root, &script, &input_path)?;

    let _ = fs::remove_file(&input_path);

    if !output.status.success() {
        let _ = fs::remove_file(&output_path);
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        return Err(format!(
            "Invoice signing failed: {}{}",
            stderr.trim(),
            if stdout.trim().is_empty() {
                String::new()
            } else {
                format!(" ({})", stdout.trim())
            }
        ));
    }

    let result = fs::read_to_string(&output_path).map_err(|e| e.to_string())?;
    let _ = fs::remove_file(&output_path);
    Ok(result)
}

fn normalize_gmail_app_password(password: &str) -> String {
    password.chars().filter(|c| !c.is_whitespace()).collect()
}

fn gmail_auth_error_message(raw: &str) -> Option<String> {
    if raw.contains("535")
        || raw.contains("BadCredentials")
        || raw.contains("Username and Password not accepted")
    {
        Some(
            "Gmail rejected the login. You must use a 16-character App Password — not your normal Gmail password. \
             Steps: Google Account → Security → turn on 2-Step Verification → App passwords → create one for Mail. \
             Paste the 16 characters with no spaces."
                .to_string(),
        )
    } else {
        None
    }
}

#[tauri::command]
fn send_backup_email(
    gmail: String,
    app_password: String,
    recipient: String,
    subject: String,
    body_text: String,
    attachment_name: String,
    attachment_json: String,
) -> Result<(), String> {
    let from = gmail.trim();
    let to = recipient.trim();
    let password = normalize_gmail_app_password(&app_password);
    if from.is_empty() {
        return Err("Gmail address is required.".to_string());
    }
    if password.is_empty() {
        return Err("Gmail app password is required.".to_string());
    }
    if password.len() != 16 {
        return Err(
            "Gmail App Password must be 16 characters (spaces removed). Create one at Google Account → Security → App passwords."
                .to_string(),
        );
    }
    if to.is_empty() {
        return Err("Recipient email is required.".to_string());
    }

    let from_addr = from
        .parse()
        .map_err(|_| format!("Invalid sender email: {from}"))?;
    let to_addr = to
        .parse()
        .map_err(|_| format!("Invalid recipient email: {to}"))?;

    let email = Message::builder()
        .from(from_addr)
        .to(to_addr)
        .subject(subject)
        .multipart(
            MultiPart::mixed()
                .singlepart(
                    SinglePart::builder()
                        .header(ContentType::TEXT_PLAIN)
                        .body(body_text),
                )
                .singlepart(
                    Attachment::new(attachment_name)
                        .body(attachment_json, ContentType::parse("application/json").unwrap()),
                ),
        )
        .map_err(|e| format!("Could not build email: {e}"))?;

    let creds = Credentials::new(from.to_string(), password);
    // Gmail requires STARTTLS on port 587 (not plain port 25).
    let mailer = lettre::SmtpTransport::starttls_relay("smtp.gmail.com")
        .map_err(|e| format!("SMTP setup failed: {e}"))?
        .credentials(creds)
        .build();

    if let Err(err) = mailer.send(&email) {
        let raw = err.to_string();
        return Err(
            gmail_auth_error_message(&raw).unwrap_or_else(|| format!("Could not send backup email: {raw}")),
        );
    }

    Ok(())
}

fn backup_dir() -> Result<std::path::PathBuf, String> {
    let dir = dirs::document_dir()
        .ok_or("Could not find Documents folder on this computer.")?
        .join("DukkanPOS")
        .join("backups");
    std::fs::create_dir_all(&dir).map_err(|e| format!("Could not create backup folder: {e}"))?;
    Ok(dir)
}

#[tauri::command]
fn get_backup_folder() -> Result<String, String> {
    Ok(backup_dir()?.to_string_lossy().into_owned())
}

#[tauri::command]
fn save_backup_file(filename: String, content: String) -> Result<String, String> {
    let safe_name = std::path::Path::new(filename.trim())
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or("Invalid backup filename.")?;
    if !safe_name.ends_with(".json") {
        return Err("Backup file must be a .json file.".to_string());
    }
    let path = backup_dir()?.join(safe_name);
    std::fs::write(&path, content).map_err(|e| format!("Could not save local backup: {e}"))?;
    Ok(path.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            generate_zatca_csr,
            zatca_http_request,
            validate_zatca_certificate,
            sign_zatca_invoice,
            send_backup_email,
            get_backup_folder,
            save_backup_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
