from app.services.context.embedding import estimate_tokens


def chunk_text(text: str, max_chars: int = 900) -> list[str]:
    paragraphs = [part.strip() for part in text.split("\n\n") if part.strip()]
    if not paragraphs:
        paragraphs = [text.strip()] if text.strip() else []

    chunks: list[str] = []
    current = ""
    for paragraph in paragraphs:
        candidate = f"{current}\n\n{paragraph}".strip() if current else paragraph
        if len(candidate) <= max_chars:
            current = candidate
            continue

        if current:
            chunks.append(current)
            current = ""

        while len(paragraph) > max_chars:
            split_at = paragraph.rfind(" ", 0, max_chars)
            if split_at < max_chars // 2:
                split_at = max_chars
            chunks.append(paragraph[:split_at].strip())
            paragraph = paragraph[split_at:].strip()

        current = paragraph

    if current:
        chunks.append(current)

    return [chunk for chunk in chunks if estimate_tokens(chunk) > 0]
