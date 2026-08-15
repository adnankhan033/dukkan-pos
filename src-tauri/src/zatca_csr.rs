use const_oid::AssociatedOid;
use k256::ecdsa::SigningKey as K256SigningKey;
use k256::pkcs8::DecodePrivateKey;
use k256::SecretKey;
use sec1::DecodeEcPrivateKey;
use serde::Deserialize;
use std::str::FromStr;
use x509_cert::builder::Builder;
use x509_cert::der::{Encode, EncodePem, asn1, pem::LineEnding};
use x509_cert::ext::pkix::name::GeneralName;
use x509_cert::ext::pkix::SubjectAltName;
use x509_cert::ext::{Criticality, Extension};
use x509_cert::name;
use x509_cert::request::RequestBuilder;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZatcaCsrFields {
    pub environment: String,
    pub common_name: String,
    pub taxpayer_name: String,
    pub branch_name: String,
    pub branch_location: String,
    pub branch_industry: String,
    pub vat_number: String,
    pub egs_serial: String,
}

enum ZatcaEnvironment {
    Sandbox,
    Simulation,
    Production,
}

struct TemplateNameExtension(asn1::OctetString);

impl AssociatedOid for TemplateNameExtension {
    const OID: const_oid::ObjectIdentifier =
        const_oid::ObjectIdentifier::new_unwrap("1.3.6.1.4.1.311.20.2");
}

impl Encode for TemplateNameExtension {
    fn encoded_len(&self) -> x509_cert::der::Result<x509_cert::der::Length> {
        self.0.encoded_len()
    }

    fn encode(&self, encoder: &mut impl x509_cert::der::Writer) -> x509_cert::der::Result<()> {
        self.0.encode(encoder)
    }
}

impl Criticality for TemplateNameExtension {
    fn criticality(&self, _subject: &name::Name, _extensions: &[Extension]) -> bool {
        false
    }
}

fn parse_environment(raw: &str) -> Result<ZatcaEnvironment, String> {
    match raw.trim().to_ascii_lowercase().as_str() {
        "sandbox" | "non_production" | "nonproduction" | "non-production" => {
            Ok(ZatcaEnvironment::Sandbox)
        }
        "simulation" => Ok(ZatcaEnvironment::Simulation),
        "production" | "prod" => Ok(ZatcaEnvironment::Production),
        other => Err(format!("Unsupported ZATCA environment for CSR: {other}")),
    }
}

fn template_name(env: ZatcaEnvironment) -> Result<TemplateNameExtension, String> {
    let bytes: &[u8] = match env {
        ZatcaEnvironment::Sandbox => b"TSTZATCA-Code-Signing",
        ZatcaEnvironment::Simulation => b"PREZATCA-Code-Signing",
        ZatcaEnvironment::Production => b"ZATCA-Code-Signing",
    };
    let os = asn1::OctetString::new(bytes)
        .map_err(|e| format!("Invalid ZATCA template name extension: {e}"))?;
    Ok(TemplateNameExtension(os))
}

fn load_private_key(pem: &str) -> Result<K256SigningKey, String> {
    let trimmed = pem.trim();
    if let Ok(key) = K256SigningKey::from_pkcs8_pem(trimmed) {
        return Ok(key);
    }

    let secret = SecretKey::from_sec1_pem(trimmed)
        .map_err(|e| format!("Invalid secp256k1 private key PEM: {e}"))?;
    Ok(K256SigningKey::from(&secret))
}

fn strip_cnf_quotes(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.starts_with('"') && trimmed.ends_with('"') && trimmed.len() >= 2 {
        return trimmed[1..trimmed.len() - 1].to_string();
    }
    trimmed.to_string()
}

pub fn generate_zatca_csr_native(
    private_key_pem: &str,
    fields: &ZatcaCsrFields,
) -> Result<String, String> {
    let signer = load_private_key(private_key_pem)?;
    let env = parse_environment(&fields.environment)?;

    let common_name = strip_cnf_quotes(&fields.common_name);
    let taxpayer_name = strip_cnf_quotes(&fields.taxpayer_name);
    let branch_name = strip_cnf_quotes(&fields.branch_name);
    let branch_location = strip_cnf_quotes(&fields.branch_location);
    let branch_industry = strip_cnf_quotes(&fields.branch_industry);
    let vat_number = strip_cnf_quotes(&fields.vat_number);
    let egs_serial = strip_cnf_quotes(&fields.egs_serial);

    let subject = name::Name::from_str(&format!(
        "C=SA,OU={},O={},CN={}",
        branch_name, taxpayer_name, common_name
    ))
    .map_err(|e| format!("Invalid CSR subject: {e}"))?;

    let san_name = name::Name::from_str(&format!(
        "sn={},uid={},title=1100,registeredAddress={},businessCategory={}",
        egs_serial, vat_number, branch_location, branch_industry
    ))
    .map_err(|e| format!("Invalid CSR subject alternative name: {e}"))?;

    let template_extension = template_name(env)?;
    let san_extension = SubjectAltName(vec![GeneralName::DirectoryName(san_name)]);

    let mut csr_builder =
        RequestBuilder::new(subject).map_err(|e| format!("Failed to start CSR builder: {e}"))?;

    csr_builder
        .add_extension(&template_extension)
        .map_err(|e| format!("Failed to add ZATCA template extension: {e}"))?;
    csr_builder
        .add_extension(&san_extension)
        .map_err(|e| format!("Failed to add ZATCA SAN extension: {e}"))?;

    let csr = csr_builder
        .build::<_, ecdsa::der::Signature<k256::Secp256k1>>(&signer)
        .map_err(|e| format!("Failed to build ZATCA CSR: {e}"))?;

    csr.to_pem(LineEnding::LF)
        .map_err(|e| format!("Failed to encode ZATCA CSR PEM: {e}"))
}
