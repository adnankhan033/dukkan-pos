use std::collections::hash_map::DefaultHasher;
use std::collections::HashMap;
use std::fs;
use std::hash::{Hash, Hasher};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use base64::Engine;
use lettre::message::header::ContentType;
use lettre::message::{Attachment, Message, MultiPart, SinglePart};
use lettre::transport::smtp::authentication::Credentials;
use lettre::Transport;
use serde::{Deserialize, Serialize};
use tauri::Manager;

mod zatca_csr;
use zatca_csr::{generate_zatca_csr_native, ZatcaCsrFields};

#[derive(Debug, Serialize, Deserialize)]
pub struct ZatcaHttpResponse {
    pub status: u16,
    pub body: String,
}

fn openssl_version_ok(bin: &str) -> bool {
    Command::new(bin)
        .arg("version")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

fn find_openssl_in_path() -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("where").arg("openssl").output().ok()?;
        if !output.status.success() {
            return None;
        }
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            let candidate = line.trim();
            if !candidate.is_empty() && openssl_version_ok(candidate) {
                return Some(candidate.to_string());
            }
        }
        return None;
    }

    #[cfg(not(target_os = "windows"))]
    {
        let output = Command::new("which").arg("openssl").output().ok()?;
        if !output.status.success() {
            return None;
        }
        let candidate = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if candidate.is_empty() || !openssl_version_ok(&candidate) {
            return None;
        }
        Some(candidate)
    }
}

fn openssl_not_found_message() -> String {
    #[cfg(target_os = "windows")]
    {
        return "OpenSSL not found on this PC. Install Win64 OpenSSL v3.x from slproweb.com (Light edition is enough), enable \"Add to PATH\" during setup, then restart Dukkan POS.".to_string();
    }

    #[cfg(target_os = "macos")]
    {
        return "OpenSSL not found on this Mac. Install it with: brew install openssl — then restart the app.".to_string();
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        return "OpenSSL not found. Install the openssl package for your Linux distribution, then restart the app.".to_string();
    }
}

fn resolve_openssl_bin() -> Result<String, String> {
    if let Ok(custom) = std::env::var("OPENSSL_BIN") {
        let trimmed = custom.trim();
        if !trimmed.is_empty() {
            if openssl_version_ok(trimmed) {
                return Ok(trimmed.to_string());
            }
            return Err(format!(
                "OPENSSL_BIN is set to \"{trimmed}\" but OpenSSL could not be run. Check the path and try again."
            ));
        }
    }

    let mut candidates: Vec<String> = Vec::new();

    if let Some(found) = find_openssl_in_path() {
        candidates.push(found);
    }

    candidates.push("openssl".to_string());

    #[cfg(target_os = "windows")]
    {
        candidates.push("openssl.exe".to_string());
        if let Ok(pf) = std::env::var("ProgramFiles") {
            candidates.push(format!(r"{pf}\OpenSSL-Win64\bin\openssl.exe"));
            candidates.push(format!(r"{pf}\Git\usr\bin\openssl.exe"));
        }
        if let Ok(pf86) = std::env::var("ProgramFiles(x86)") {
            candidates.push(format!(r"{pf86}\Git\usr\bin\openssl.exe"));
            candidates.push(format!(r"{pf86}\OpenSSL-Win32\bin\openssl.exe"));
        }
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            candidates.push(format!(
                r"{local}\Programs\OpenSSL-Win64\bin\openssl.exe"
            ));
        }
        candidates.push(r"C:\OpenSSL-Win64\bin\openssl.exe".to_string());
        candidates.push(r"C:\OpenSSL-Win32\bin\openssl.exe".to_string());
        if let Ok(userprofile) = std::env::var("USERPROFILE") {
            candidates.push(format!(
                r"{userprofile}\scoop\apps\openssl\current\bin\openssl.exe"
            ));
        }
        candidates.push(r"C:\ProgramData\chocolatey\bin\openssl.exe".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        candidates.extend([
            "/opt/homebrew/bin/openssl",
            "/usr/local/bin/openssl",
            "/usr/bin/openssl",
        ]
        .map(String::from));
    }

    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    {
        candidates.extend(["/usr/bin/openssl", "/usr/local/bin/openssl"].map(String::from));
    }

    let mut seen = std::collections::HashSet::new();
    for bin in candidates {
        if !seen.insert(bin.clone()) {
            continue;
        }
        if openssl_version_ok(&bin) {
            return Ok(bin);
        }
    }

    Err(openssl_not_found_message())
}

#[tauri::command]
fn generate_zatca_csr(
    private_key_pem: String,
    csr_config: String,
    csr_fields: Option<ZatcaCsrFields>,
) -> Result<String, String> {
    if let Some(fields) = csr_fields {
        return generate_zatca_csr_native(private_key_pem.trim(), &fields);
    }

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

fn openssl_x509_readable(openssl_bin: &str, path: &std::path::Path) -> bool {
    Command::new(openssl_bin)
        .args(["x509", "-noout", "-in"])
        .arg(path)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Normalize ZATCA certificate input to a readable X.509 PEM file.
fn prepare_x509_cert_pem(
    openssl_bin: &str,
    input: &str,
    cert_path: &std::path::Path,
) -> Result<(), String> {
    let trimmed = input.trim();

    // 1) Already valid PEM X.509
    if trimmed.contains("BEGIN CERTIFICATE") {
        fs::write(cert_path, trimmed).map_err(|e| e.to_string())?;
        if openssl_x509_readable(openssl_bin, cert_path) {
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
                    if openssl_x509_readable(openssl_bin, cert_path) {
                        return Ok(());
                    }
                }
                if decoded_text.contains("BEGIN CERTIFICATE") {
                    fs::write(cert_path, decoded_text.trim()).map_err(|e| e.to_string())?;
                    if openssl_x509_readable(openssl_bin, cert_path) {
                        return Ok(());
                    }
                }
            }

            // Raw DER bytes
            let der_path = cert_path.with_extension("der");
            if fs::write(&der_path, &decoded).is_ok() {
                let output = Command::new(openssl_bin)
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
                    if out.status.success() && openssl_x509_readable(openssl_bin, cert_path) {
                        return Ok(());
                    }
                }
            }
        }

        // Inner MIIC… body without outer decode
        if base64_body.starts_with("MII") {
            let pem = wrap_base64_pem(&base64_body, "CERTIFICATE");
            fs::write(cert_path, &pem).map_err(|e| e.to_string())?;
            if openssl_x509_readable(openssl_bin, cert_path) {
                return Ok(());
            }
        }

        // Legacy: wrap outer token directly (old bug — unlikely to work)
        let pem = wrap_base64_pem(&base64_body, "CERTIFICATE");
        fs::write(cert_path, &pem).map_err(|e| e.to_string())?;
        if openssl_x509_readable(openssl_bin, cert_path) {
            return Ok(());
        }
    }

    Err(
        "Could not parse certificate. Re-run Compliance CSID to refresh the binarySecurityToken."
            .to_string(),
    )
}

fn compare_public_keys(
    openssl_bin: &str,
    cert_path: &std::path::Path,
    key_path: &std::path::Path,
) -> bool {
    let cert_pub = Command::new(openssl_bin)
        .args(["x509", "-in"])
        .arg(cert_path)
        .args(["-pubkey", "-noout"])
        .output();

    let key_pub = Command::new(openssl_bin)
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
    let openssl_bin = resolve_openssl_bin()?;
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_nanos();
    let temp_dir = std::env::temp_dir();
    let cert_path = temp_dir.join(format!("dukkan-pos-cert-{nanos}.pem"));
    let key_path = temp_dir.join(format!("dukkan-pos-key-{nanos}.pem"));

    prepare_x509_cert_pem(&openssl_bin, &certificate_pem, &cert_path)?;
    fs::write(&key_path, private_key_pem.trim()).map_err(|e| e.to_string())?;

    let dates_output = Command::new(&openssl_bin)
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

    let not_expired = Command::new(&openssl_bin)
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

    let key_matches = compare_public_keys(&openssl_bin, &cert_path, &key_path);

    let _ = fs::remove_file(&cert_path);
    let _ = fs::remove_file(&key_path);

    Ok(ZatcaCertValidation {
        not_expired,
        not_before,
        not_after,
        key_matches,
    })
}

fn runner_version_ok(bin: &str) -> bool {
    Command::new(bin)
        .arg("--version")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

fn node_runner_candidates() -> Vec<String> {
    let mut candidates = Vec::new();

    if let Ok(custom) = std::env::var("NODE_BIN") {
        let trimmed = custom.trim();
        if !trimmed.is_empty() {
            candidates.push(trimmed.to_string());
        }
    }

    candidates.push("node".to_string());

    #[cfg(target_os = "macos")]
    {
        candidates.extend([
            "/opt/homebrew/bin/node",
            "/usr/local/bin/node",
            "/usr/bin/node",
        ]
        .map(String::from));
    }

    #[cfg(target_os = "windows")]
    {
        candidates.push("node.exe".to_string());
        if let Ok(pf) = std::env::var("ProgramFiles") {
            candidates.push(format!(r"{pf}\nodejs\node.exe"));
        }
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            candidates.push(format!(r"{local}\Programs\node\node.exe"));
        }
    }

    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    {
        candidates.extend(["/usr/bin/node", "/usr/local/bin/node"].map(String::from));
    }

    let mut seen = std::collections::HashSet::new();
    candidates
        .into_iter()
        .filter(|bin| seen.insert(bin.clone()))
        .filter(|bin| runner_version_ok(bin))
        .collect()
}

fn signer_dir_has_runtime(dir: &std::path::Path) -> bool {
    if !dir.is_dir() {
        return false;
    }
    let node_bin = if cfg!(target_os = "windows") {
        dir.join("node.exe")
    } else {
        dir.join("node")
    };
    node_bin.is_file() && dir.join("sign-zatca-invoice.mjs").is_file()
}

fn resolve_signer_dir(app: &tauri::AppHandle) -> Option<std::path::PathBuf> {
    let mut candidates: Vec<std::path::PathBuf> = Vec::new();

    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join("zatca-signer"));
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            candidates.push(exe_dir.join("resources").join("zatca-signer"));
            candidates.push(exe_dir.join("zatca-signer"));
        }
    }

    #[cfg(debug_assertions)]
    {
        let manifest_dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
        candidates.push(manifest_dir.join("resources/zatca-signer"));
    }

    let mut seen = std::collections::HashSet::new();
    for dir in candidates {
        if seen.insert(dir.clone()) && signer_dir_has_runtime(&dir) {
            return Some(dir);
        }
    }

    None
}

fn resolve_bundled_signer(app: &tauri::AppHandle) -> Option<(std::path::PathBuf, std::path::PathBuf, std::path::PathBuf)> {
    let signer_dir = resolve_signer_dir(app)?;
    let node_bin = if cfg!(target_os = "windows") {
        signer_dir.join("node.exe")
    } else {
        signer_dir.join("node")
    };
    let script = signer_dir.join("sign-zatca-invoice.mjs");
    if node_bin.is_file() && script.is_file() {
        Some((node_bin, script, signer_dir))
    } else {
        None
    }
}

fn run_node_signer(
    node_bin: &str,
    script: &std::path::Path,
    workdir: &std::path::Path,
    input_path: &std::path::Path,
) -> Result<std::process::Output, String> {
    Command::new(node_bin)
        .arg(script)
        .arg(input_path)
        .current_dir(workdir)
        .output()
        .map_err(|e| format!("Could not run ZATCA invoice signer ({e})"))
}

fn run_sign_script(
    app: &tauri::AppHandle,
    input_path: &std::path::Path,
) -> Result<std::process::Output, String> {
    if let Some((node_bin, bundled_script, workdir)) = resolve_bundled_signer(app) {
        return run_node_signer(
            node_bin.to_str().ok_or("Invalid bundled Node path")?,
            &bundled_script,
            &workdir,
            input_path,
        );
    }

    #[cfg(debug_assertions)]
    {
        let manifest_dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
        if let Some(project_root) = manifest_dir.parent() {
            let script = project_root.join("scripts/sign-zatca-invoice.mjs");
            if script.is_file() {
                for node_bin in node_runner_candidates() {
                    if let Ok(output) =
                        run_node_signer(&node_bin, &script, project_root, input_path)
                    {
                        return Ok(output);
                    }
                }
            }
        }
    }

    Err(
        "ZATCA invoice signing runtime was not found. Reinstall the application or rebuild with the bundled signer."
            .to_string(),
    )
}

#[tauri::command]
fn sign_zatca_invoice(app: tauri::AppHandle, input_json: String) -> Result<String, String> {
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

    let output = run_sign_script(&app, &input_path)?;

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

const DEFAULT_ACTIVATION_RECIPIENT: &str = "dev.adnankhan@gmail.com";

fn load_dotenv_files() {
    for path in [".env.local", "../.env.local", ".env", "../.env"] {
        let _ = dotenvy::from_filename(path);
    }
}

fn env_activation_var(primary: &str, fallback: &str) -> Option<String> {
    std::env::var(primary)
        .or_else(|_| std::env::var(fallback))
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn activation_smtp_credentials() -> Option<(String, String)> {
    let gmail = env_activation_var("VITE_ACTIVATION_GMAIL", "DUKKAN_ACTIVATION_GMAIL").or_else(|| {
        option_env!("DUKKAN_ACTIVATION_GMAIL").map(|value| value.to_string())
    })?;
    let password = env_activation_var(
        "VITE_ACTIVATION_GMAIL_APP_PASSWORD",
        "DUKKAN_ACTIVATION_GMAIL_APP_PASSWORD",
    )
    .or_else(|| {
        option_env!("DUKKAN_ACTIVATION_GMAIL_APP_PASSWORD").map(|value| value.to_string())
    })?;
    Some((gmail, password))
}

fn send_plain_text_email(
    gmail: &str,
    app_password: &str,
    recipient: &str,
    subject: &str,
    body_text: &str,
) -> Result<(), String> {
    let from = gmail.trim();
    let to = recipient.trim();
    let password = normalize_gmail_app_password(app_password);
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
        .singlepart(
            SinglePart::builder()
                .header(ContentType::TEXT_PLAIN)
                .body(body_text.to_string()),
        )
        .map_err(|e| format!("Could not build email: {e}"))?;

    let creds = Credentials::new(from.to_string(), password);
    let mailer = lettre::SmtpTransport::starttls_relay("smtp.gmail.com")
        .map_err(|e| format!("SMTP setup failed: {e}"))?
        .credentials(creds)
        .build();

    if let Err(err) = mailer.send(&email) {
        let raw = err.to_string();
        return Err(
            gmail_auth_error_message(&raw).unwrap_or_else(|| format!("Could not send email: {raw}")),
        );
    }

    Ok(())
}

#[cfg(target_os = "macos")]
fn platform_device_uuid() -> Option<String> {
    let output = Command::new("ioreg")
        .args(["-rd1", "-c", "IOPlatformExpertDevice"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout);
    for line in text.lines() {
        if line.contains("IOPlatformUUID") {
            if let Some(raw) = line.split('=').nth(1) {
                return Some(raw.trim().trim_matches('"').to_string());
            }
        }
    }
    None
}

#[cfg(target_os = "windows")]
fn platform_device_uuid() -> Option<String> {
    let output = Command::new("wmic")
        .args(["csproduct", "get", "uuid"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout);
    for line in text.lines().skip(1) {
        let trimmed = line.trim();
        if !trimmed.is_empty() && trimmed != "UUID" {
            return Some(trimmed.to_string());
        }
    }
    None
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn platform_device_uuid() -> Option<String> {
    fs::read_to_string("/etc/machine-id")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn collect_machine_identity_parts() -> Vec<String> {
    let mut parts = Vec::new();
    if let Ok(name) = std::env::var("COMPUTERNAME").or_else(|_| std::env::var("HOSTNAME")) {
        if !name.trim().is_empty() {
            parts.push(name.trim().to_string());
        }
    }
    if let Ok(user) = std::env::var("USER").or_else(|_| std::env::var("USERNAME")) {
        if !user.trim().is_empty() {
            parts.push(user.trim().to_string());
        }
    }
    parts.push(std::env::consts::OS.to_string());
    parts.push(std::env::consts::ARCH.to_string());
    if let Some(uuid) = platform_device_uuid() {
        parts.push(uuid);
    }
    parts
}

fn hash_machine_identity(parts: &[String]) -> String {
    let mut hasher = DefaultHasher::new();
    parts.join("|").hash(&mut hasher);
    format!("{:016X}", hasher.finish())
}

fn generate_activation_key_code() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let seed = nanos as u64 ^ (nanos >> 64) as u64;
    format!(
        "DKP-{:04X}-{:04X}-{:04X}",
        ((seed >> 48) & 0xFFFF) as u16,
        ((seed >> 32) & 0xFFFF) as u16,
        ((seed >> 16) & 0xFFFF) as u16
    )
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemActivationInfo {
    pub device_id: String,
    pub activation_key: String,
    pub hostname: String,
}

#[tauri::command]
fn generate_system_activation() -> Result<SystemActivationInfo, String> {
    let parts = collect_machine_identity_parts();
    let hostname = parts
        .first()
        .cloned()
        .unwrap_or_else(|| "Dukkan POS".to_string());
    let device_id = hash_machine_identity(&parts);
    let activation_key = generate_activation_key_code();
    Ok(SystemActivationInfo {
        device_id,
        activation_key,
        hostname,
    })
}

#[tauri::command]
fn send_activation_email(
    recipient: String,
    device_id: String,
    activation_key: String,
    hostname: String,
    gmail: Option<String>,
    app_password: Option<String>,
    customer_name: Option<String>,
    customer_phone: Option<String>,
    store_name: Option<String>,
    store_address: Option<String>,
    vat_number: Option<String>,
    cr_number: Option<String>,
) -> Result<(), String> {
    let to = recipient.trim();
    let to = if to.is_empty() {
        DEFAULT_ACTIVATION_RECIPIENT
    } else {
        to
    };
    if to.is_empty() {
        return Err("Recipient email is required.".to_string());
    }

    let (gmail, app_password) = match (
        gmail.as_deref().map(str::trim).filter(|s| !s.is_empty()),
        app_password.as_deref().map(str::trim).filter(|s| !s.is_empty()),
    ) {
        (Some(from), Some(password)) => (from.to_string(), password.to_string()),
        _ => activation_smtp_credentials().ok_or(
            "Email is not configured. Enter your Gmail App Password on the setup form."
                .to_string(),
        )?,
    };

    let host_label = if hostname.trim().is_empty() {
        "Unknown device".to_string()
    } else {
        hostname.trim().to_string()
    };

    let name = customer_name.unwrap_or_default().trim().to_string();
    let phone = customer_phone.unwrap_or_default().trim().to_string();
    let store = store_name.unwrap_or_default().trim().to_string();
    let address = store_address.unwrap_or_default().trim().to_string();
    let vat = vat_number.unwrap_or_default().trim().to_string();
    let cr = cr_number.unwrap_or_default().trim().to_string();

    let subject = if store.is_empty() {
        format!("Dukkan POS Activation Key — {host_label}")
    } else {
        format!("Dukkan POS Activation — {store}")
    };

    let mut body = String::from("New Dukkan POS store registration\n\n");

    if !store.is_empty() || !phone.is_empty() || !address.is_empty() {
        body.push_str("Store information:\n");
        if !store.is_empty() {
            body.push_str(&format!("  Store name: {store}\n"));
        }
        if !phone.is_empty() {
            body.push_str(&format!("  Phone: {phone}\n"));
        }
        if !address.is_empty() {
            body.push_str(&format!("  Address: {address}\n"));
        }
        body.push('\n');
    }

    if !name.is_empty() || !vat.is_empty() || !cr.is_empty() {
        body.push_str("Additional details:\n");
        if !name.is_empty() {
            body.push_str(&format!("  Contact: {name}\n"));
        }
        if !vat.is_empty() {
            body.push_str(&format!("  VAT number: {vat}\n"));
        }
        if !cr.is_empty() {
            body.push_str(&format!("  CR number: {cr}\n"));
        }
        body.push('\n');
    }

    body.push_str(&format!(
        "Activation key (share with customer after approval):\n\
         {activation_key}\n\n\
         Device: {host_label}\n\
         Device ID: {device_id}\n\n\
         — Dukkan POS"
    ));

    send_plain_text_email(&gmail, &app_password, to, &subject, &body)
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
    load_dotenv_files();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            generate_zatca_csr,
            zatca_http_request,
            validate_zatca_certificate,
            sign_zatca_invoice,
            generate_system_activation,
            send_activation_email,
            send_backup_email,
            get_backup_folder,
            save_backup_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
