use reqwest::{redirect::Policy, Client};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;

const MODEL: &str = "qwen2.5vl:3b";
const BASE: &str = "http://127.0.0.1:11434";

fn client(timeout: Duration) -> Result<Client, String> {
    Client::builder().timeout(timeout).redirect(Policy::none()).build().map_err(|e| e.to_string())
}
async fn response(response: reqwest::Response) -> Result<Value, String> {
    let status = response.status();
    let body: Value = response.json().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(body.get("error").and_then(Value::as_str).unwrap_or("Local AI request failed").to_string());
    }
    Ok(body)
}
async fn installed(client: &Client) -> Result<bool, String> {
    let result = client.get(format!("{BASE}/api/tags")).send().await.map_err(|_| "Ollama is not running locally. Install Ollama and start its local service.".to_string())?;
    let body = response(result).await?;
    Ok(body["models"].as_array().is_some_and(|models| models.iter().any(|model| model["name"].as_str() == Some(MODEL))))
}
async fn verify_license(client: &Client) -> Result<(), String> {
    let result = client.post(format!("{BASE}/api/show"))
        .json(&json!({"model": MODEL})).send().await.map_err(|e| e.to_string())?;
    let body = response(result).await?;
    let license = body["license"].as_str().map(str::to_owned).unwrap_or_else(||
        body["license"].as_array().map(|items| items.iter().filter_map(Value::as_str).collect::<Vec<_>>().join("\n")).unwrap_or_default());
    if !license.contains("Apache License") || !license.contains("Version 2.0") {
        return Err("Local model license could not be verified as Apache 2.0".into());
    }
    Ok(())
}
#[tauri::command]
pub async fn ai_status() -> Result<bool, String> {
    installed(&client(Duration::from_secs(5))?).await
}
#[tauri::command]
pub async fn ai_prepare() -> Result<(), String> {
    let client = client(Duration::from_secs(1200))?;
    if installed(&client).await? { return verify_license(&client).await; }
    let result = client.post(format!("{BASE}/api/pull"))
        .json(&json!({"model": MODEL, "stream": false}))
        .send().await.map_err(|e| format!("Could not download the local AI model: {e}"))?;
    response(result).await?;
    if !installed(&client).await? { return Err("Model download did not finish".into()); }
    verify_license(&client).await
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateRequest { prompt: String, image: Option<String>, max_tokens: Option<u32> }
#[derive(Serialize)]
pub struct GenerateResponse { text: String }
#[tauri::command]
pub async fn ai_generate(request: GenerateRequest) -> Result<GenerateResponse, String> {
    if request.prompt.len() > 6000 { return Err("AI prompt is too long".into()); }
    let mut payload = json!({
        "model": MODEL, "prompt": request.prompt, "format": "json", "stream": false,
        "keep_alive": "1m", "options": {"temperature": 0, "num_predict": request.max_tokens.unwrap_or(256).clamp(32, 1536)}
    });
    if let Some(image) = request.image {
        let raw = image.strip_prefix("data:image/png;base64,").ok_or("Only captured PNG screenshots are accepted")?;
        if raw.len() > 20_000_000 || !raw.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'+' || c == b'/' || c == b'=') {
            return Err("Invalid or oversized screenshot".into());
        }
        payload["images"] = json!([raw]);
    }
    let result = client(Duration::from_secs(120))?.post(format!("{BASE}/api/generate"))
        .json(&payload).send().await.map_err(|e| format!("Local AI generation failed: {e}"))?;
    let body = response(result).await?;
    let text = body["response"].as_str().ok_or("Local AI returned no response")?;
    if text.len() > 100_000 { return Err("Local AI response is too large".into()); }
    Ok(GenerateResponse { text: text.to_owned() })
}
#[tauri::command]
pub async fn ai_unload() -> Result<(), String> {
    let result = client(Duration::from_secs(30))?.post(format!("{BASE}/api/generate"))
        .json(&json!({"model": MODEL, "keep_alive": 0, "stream": false}))
        .send().await.map_err(|e| e.to_string())?;
    response(result).await?;
    Ok(())
}
