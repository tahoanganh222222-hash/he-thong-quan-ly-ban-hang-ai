import json
from dataclasses import dataclass
from time import sleep
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.core.config import settings


class GeminiServiceError(RuntimeError):
    pass


@dataclass(frozen=True)
class GeminiTextResult:
    answer: str
    token_usage: int


def generate_text(system_instruction: str, prompt: str) -> GeminiTextResult:
    api_key = (settings.GEMINI_API_KEY or "").strip()
    if not api_key:
        raise GeminiServiceError("Gemini API key chưa được cấu hình")

    model = (settings.GEMINI_MODEL or "gemini-3.6-flash").strip()
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent"
    )
    generation_config = {
        "temperature": 0.2,
        "maxOutputTokens": 4096,
    }
    if model.lower().startswith("gemini-3"):
        generation_config["thinkingConfig"] = {
            "thinkingLevel": "LOW",
        }

    payload = {
        "systemInstruction": {
            "parts": [{"text": system_instruction}],
        },
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}],
            }
        ],
        "generationConfig": generation_config,
    }
    request = Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": api_key,
        },
        method="POST",
    )

    transient_statuses = {429, 500, 502, 503, 504}
    max_attempts = 3
    body = None
    for attempt in range(max_attempts):
        try:
            with urlopen(request, timeout=settings.GEMINI_TIMEOUT_SECONDS) as response:
                body = json.loads(response.read().decode("utf-8"))
            break
        except HTTPError as exc:
            try:
                error_body = json.loads(exc.read().decode("utf-8", errors="replace"))
                api_message = error_body.get("error", {}).get("message", "")
            except (ValueError, AttributeError):
                api_message = ""

            if exc.code in transient_statuses and attempt < max_attempts - 1:
                sleep(0.75 * (2 ** attempt))
                continue
            if exc.code in {401, 403}:
                message = "Gemini từ chối API key. Hãy kiểm tra lại key trong .env."
            elif exc.code == 429:
                message = "Gemini đang giới hạn lượt gọi. Vui lòng thử lại sau."
            else:
                message = api_message or f"Gemini trả về lỗi HTTP {exc.code}."
            raise GeminiServiceError(message) from exc
        except (URLError, TimeoutError) as exc:
            if attempt < max_attempts - 1:
                sleep(0.75 * (2 ** attempt))
                continue
            raise GeminiServiceError(
                "Không thể kết nối Gemini. Hãy kiểm tra Internet và thử lại."
            ) from exc
        except (ValueError, KeyError) as exc:
            raise GeminiServiceError("Phản hồi Gemini không đúng định dạng.") from exc

    if body is None:
        raise GeminiServiceError("Gemini không trả về nội dung.")

    try:
        candidate = body["candidates"][0]
        finish_reason = str(candidate.get("finishReason") or "")
        parts = candidate["content"]["parts"]
        answer = "\n".join(
            part.get("text", "").strip() for part in parts if part.get("text")
        ).strip()
    except (KeyError, IndexError, TypeError) as exc:
        block_reason = body.get("promptFeedback", {}).get("blockReason")
        if block_reason:
            raise GeminiServiceError(
                f"Gemini không thể trả lời nội dung này ({block_reason})."
            ) from exc
        raise GeminiServiceError("Gemini không trả về nội dung.") from exc

    if finish_reason == "MAX_TOKENS":
        raise GeminiServiceError(
            "Gemini đã dừng giữa câu trả lời do giới hạn độ dài. Vui lòng thử lại."
        )
    if finish_reason not in {"", "STOP", "FINISH_REASON_UNSPECIFIED"}:
        finish_message = str(candidate.get("finishMessage") or "").strip()
        detail = f" ({finish_message})" if finish_message else ""
        raise GeminiServiceError(
            f"Gemini chưa hoàn tất câu trả lời: {finish_reason}{detail}."
        )
    if not answer:
        raise GeminiServiceError("Gemini không trả về nội dung.")
    usage = body.get("usageMetadata", {})
    token_usage = usage.get("totalTokenCount")
    if token_usage is None:
        token_usage = (
            int(usage.get("promptTokenCount") or 0)
            + int(usage.get("candidatesTokenCount") or 0)
        )
    return GeminiTextResult(answer=answer, token_usage=max(0, int(token_usage or 0)))
