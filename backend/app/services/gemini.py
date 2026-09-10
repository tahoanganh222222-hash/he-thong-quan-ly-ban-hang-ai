import json
from dataclasses import dataclass
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
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 1200,
        },
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

    try:
        with urlopen(request, timeout=settings.GEMINI_TIMEOUT_SECONDS) as response:
            body = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        try:
            error_body = json.loads(exc.read().decode("utf-8", errors="replace"))
            api_message = error_body.get("error", {}).get("message", "")
        except (ValueError, AttributeError):
            api_message = ""
        if exc.code in {401, 403}:
            message = "Gemini từ chối API key. Hãy kiểm tra lại key trong .env."
        elif exc.code == 429:
            message = "Gemini đang giới hạn lượt gọi. Vui lòng thử lại sau."
        else:
            message = api_message or f"Gemini trả về lỗi HTTP {exc.code}."
        raise GeminiServiceError(message) from exc
    except (URLError, TimeoutError) as exc:
        raise GeminiServiceError(
            "Không thể kết nối Gemini. Hãy kiểm tra Internet và thử lại."
        ) from exc
    except (ValueError, KeyError) as exc:
        raise GeminiServiceError("Phản hồi Gemini không đúng định dạng.") from exc

    try:
        parts = body["candidates"][0]["content"]["parts"]
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
