"""Account-private saved excerpts and returns, using the existing content history."""

import re
from fastapi import HTTPException


def validate_moment(event):
    def require(test):
        if not test:
            raise HTTPException(422, "Invalid saved moment fields.")

    def text(value, limit):
        return (
            isinstance(value, str)
            and bool(value.strip())
            and len(value.encode("utf-16-le", errors="surrogatepass")) // 2 <= limit
            and not re.search(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", value)
        )

    def integer(value, limit):
        return type(value) is int and 0 <= value <= limit

    require(
        set(event) == {"id", "kind", "contentId", "version", "at", "moment"}
        and event["kind"] == "moment"
    )
    require(
        isinstance(event["id"], str)
        and re.fullmatch(r"[A-Za-z0-9_-]{16,80}", event["id"])
    )
    cid = event["contentId"]
    require(
        isinstance(cid, str)
        and re.fullmatch(r"moment:(?:[a-z][a-z0-9-]{0,50}|own:[a-f0-9]{64})", cid)
    )
    require(
        integer(event["at"], 2**53 - 1)
        and type(event["version"]) is int
        and event["version"] == 1
    )
    m = event["moment"]
    require(
        isinstance(m, dict)
        and set(m)
        == (
            {"schemaVersion", "userId", "action", "mode", "source"}
            | ({"undoOf"} if m.get("action") == "undo" else set())
        )
    )
    require(type(m["schemaVersion"]) is int and m["schemaVersion"] == 1)
    require(m["userId"] is None or text(m["userId"], 160) and m["userId"] != "!locked")
    require(m["action"] in ("keep", "mode", "reopen", "variation", "undo"))
    require(
        m["mode"] in ("practice", "reference", "familiar")
        if m["action"] in ("keep", "mode")
        else m["mode"] is None
    )
    if m["action"] == "undo":
        require(
            isinstance(m["undoOf"], str)
            and re.fullmatch(r"[A-Za-z0-9_-]{16,80}", m["undoOf"])
        )
    s = m["source"]
    if m["action"] == "keep" and cid.startswith("moment:own:"):
        require(
            isinstance(s, dict)
            and set(s)
            == {"pieceId", "origin", "title", "text", "language", "offset", "seconds"}
        )
        require(
            isinstance(s["pieceId"], str)
            and re.fullmatch(r"[a-f0-9]{64}", s["pieceId"])
        )
        require(
            s["origin"] in ("learner", "catalogue")
            and text(s["title"], 100)
            and text(s["text"], 600)
        )
        require(
            isinstance(s["language"], str)
            and re.fullmatch(r"[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?", s["language"])
        )
        require(
            integer(s["offset"], 1000000)
            and (s["seconds"] is None or integer(s["seconds"], 86400))
        )
    else:
        require(s is None)
    return event


def validate_moment_sequence(rows):
    roots = {}
    decisions = {}
    for e in sorted(
        (r for r in rows if r["kind"] == "moment"), key=lambda r: (r["at"], r["id"])
    ):
        m = e["moment"]
        key = (m["userId"], e["contentId"], e["version"])
        if m["action"] == "undo" and decisions.get(m["undoOf"]) != key:
            raise HTTPException(
                409, "Undo must refer to an earlier choice for this moment."
            )
        if m["action"] in ("keep", "mode"):
            decisions[e["id"]] = key
        if m["action"] == "keep":
            if key in roots and roots[key] != m["source"]:
                raise HTTPException(409, "A saved excerpt cannot change its source.")
            roots[key] = m["source"]
        elif key not in roots:
            raise HTTPException(409, "Keep the moment before changing or reopening it.")
